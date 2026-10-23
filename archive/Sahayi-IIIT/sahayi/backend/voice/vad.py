"""Voice Activity Detection using Silero VAD via ONNX.

Supports the newer Silero VAD ONNX interface where the GRU hidden state is a
single fused ``state`` tensor of shape ``(2, batch, 128)`` rather than the
older separate ``h`` / ``c`` pair.  The model's inputs are:

    input  – float32, shape (batch, num_samples)
    state  – float32, shape (2, batch, 128)
    sr     – int64,   scalar

And it returns:

    output  – float32, shape (batch, 1)   – per-batch speech probability
    stateN  – float32                     – updated hidden state
"""

from __future__ import annotations

import os

import numpy as np
import onnxruntime


class SileroVAD:
    """Lightweight, stateful VAD wrapping the Silero ONNX model.

    The class introspects the loaded model on initialisation so it works
    with both the legacy ``h`` / ``c`` interface and the newer fused
    ``state`` interface – although only the newer interface is expected
    after the model upgrade that triggered the original bug.
    """

    def __init__(
        self,
        model_path: str = "silero_vad.onnx",
        threshold: float = 0.5,
    ) -> None:
        """Initialise the VAD model.

        Args:
            model_path: Path to ``silero_vad.onnx``.  Relative paths are
                resolved against the directory that contains this module.
            threshold: Speech-probability threshold above which a frame is
                considered to contain speech.
        """
        opts = onnxruntime.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1

        base_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(base_dir, model_path)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"VAD model not found at {full_path}")

        self.session = onnxruntime.InferenceSession(
            full_path,
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        self.threshold = threshold

        # Discover the model's input names once so _is_speech can build the
        # correct feed dict without branching on every call.
        self._input_names: set[str] = {inp.name for inp in self.session.get_inputs()}

        self.reset_state()

    # ------------------------------------------------------------------
    # State management
    # ------------------------------------------------------------------

    def reset_state(self) -> None:
        """Reset all internal GRU hidden-state tensors to zeros."""
        if "state" in self._input_names:
            # New interface: single fused state tensor (2, 1, 128)
            self._state = np.zeros((2, 1, 128), dtype=np.float32)
        else:
            # Legacy interface: separate h / c tensors (2, 1, 64)
            self._h = np.zeros((2, 1, 64), dtype=np.float32)
            self._c = np.zeros((2, 1, 64), dtype=np.float32)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def is_speech(self, audio_chunk: bytes, sample_rate: int = 8000) -> bool:
        """Return ``True`` when *audio_chunk* contains speech.

        Args:
            audio_chunk: Raw 16-bit little-endian PCM bytes.  At 8 000 Hz a
                chunk of 512 bytes (256 samples, ≈ 32 ms) works well.
            sample_rate: Sample rate of the audio, either 8 000 or 16 000 Hz.

        Returns:
            ``True`` if the speech probability exceeds ``self.threshold``.
        """
        if not audio_chunk:
            return False

        # --- decode -------------------------------------------------------
        audio_int16 = np.frombuffer(audio_chunk, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0
        # Shape: (1, num_samples) – batch dimension first
        input_data = np.expand_dims(audio_float32, axis=0)

        sr_array = np.array(sample_rate, dtype=np.int64)

        # --- build feed dict for whichever model interface is present -----
        if "state" in self._input_names:
            feed = {
                "input": input_data,
                "state": self._state,
                "sr": sr_array,
            }
            outputs = self.session.run(None, feed)
            # outputs = [speech_prob, stateN]
            probability = float(outputs[0][0][0])
            self._state = outputs[1]
        else:
            # Legacy interface: h / c hidden states
            feed = {
                "input": input_data,
                "sr": sr_array,
                "h": self._h,
                "c": self._c,
            }
            outputs = self.session.run(None, feed)
            # outputs = [speech_prob, h, c]
            probability = float(outputs[0][0][0])
            self._h = outputs[1]
            self._c = outputs[2]

        return probability > self.threshold
