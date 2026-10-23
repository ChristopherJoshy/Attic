"""Sarvam speech-to-text client for SAHAYI."""

from __future__ import annotations

import asyncio
import io
from sarvamai import SarvamAI

from core.config import get_settings
from utils.logger import get_logger
from voice.audio_codec import pcm_to_wav


class SarvamSTTClient:
    """Client for Sarvam speech-to-text transcription using official SDK."""

    def __init__(self) -> None:
        """Initialise STT client settings.

        Args:
            None: Uses environment-backed Sarvam settings.
        Returns:
            None.
        Agent:
            Voice
        """

        self.settings = get_settings()
        self.logger = get_logger("sahayi.sarvam_stt")
        self.client = SarvamAI(api_subscription_key=self.settings.sarvam_api_key) if self.settings.sarvam_api_key else None

    async def transcribe(self, pcm16_16khz: bytes) -> dict[str, object]:
        """Transcribe audio and return text with confidence using SDK.

        Args:
            pcm16_16khz: PCM16 mono audio bytes at 16kHz.
        Returns:
            Dictionary containing transcript text and confidence.
        Agent:
            Voice
        """

        if not self.client or not pcm16_16khz:
            return {"text": "", "confidence": 0.0, "should_repeat": True}

        wav_data = pcm_to_wav(pcm16_16khz, 16000)
        
        try:
            # Run synchronous SDK call in thread pool to avoid blocking event loop
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.speech_to_text.transcribe,
                    file=("audio.wav", io.BytesIO(wav_data), "audio/wav"),
                    model=self.settings.sarvam_stt_model,
                    language_code=self.settings.sarvam_language,
                    mode="transcribe"
                ),
                timeout=10.0,
            )
            
            # The SDK response is typically a dictionary or object.
            # We normalize it for the pipeline.
            confidence = float(getattr(response, 'language_probability', 0.85) or 0.85)
            transcript = str(getattr(response, 'transcript', "")).strip()
            return {"text": transcript, "confidence": confidence, "should_repeat": confidence < 0.6 or not transcript}
            
        except asyncio.TimeoutError:
            self.logger.warning("Sarvam STT timed out after 10 seconds")
            return {"text": "", "confidence": 0.0, "should_repeat": True}
        except Exception:
            self.logger.exception("Sarvam SDK STT failed")
            return {"text": "", "confidence": 0.0, "should_repeat": True}

    async def transcribe_file(self, file_bytes: bytes, file_name: str, mime_type: str) -> dict[str, object]:
        """Transcribe an arbitrary audio file using the SDK.

        Args:
            file_bytes: Raw audio file bytes.
            file_name: Dummy or actual file name payload.
            mime_type: MIME type of the audio.
        Returns:
            Dictionary containing transcript text and confidence.
        Agent:
            Voice
        """
        if not self.client or not file_bytes:
            return {"text": "", "confidence": 0.0, "should_repeat": True}

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.speech_to_text.transcribe,
                    file=(file_name, io.BytesIO(file_bytes), mime_type),
                    model=self.settings.sarvam_stt_model,
                    language_code=self.settings.sarvam_language,
                    mode="transcribe"
                ),
                timeout=10.0,
            )
            
            confidence = float(getattr(response, 'language_probability', 0.85) or 0.85)
            transcript = str(getattr(response, 'transcript', "")).strip()
            return {"text": transcript, "confidence": confidence, "should_repeat": confidence < 0.6 or not transcript}
            
        except asyncio.TimeoutError:
            self.logger.warning("Sarvam STT file ingest timed out after 10 seconds")
            return {"text": "", "confidence": 0.0, "should_repeat": True}
        except Exception:
            self.logger.exception("Sarvam SDK STT file ingest failed")
            return {"text": "", "confidence": 0.0, "should_repeat": True}
