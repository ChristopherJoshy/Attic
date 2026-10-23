"""Audio conversion helpers for SAHAYI voice pipeline."""

from __future__ import annotations

import io
import struct
import wave


def mulaw_to_pcm16(payload: bytes) -> bytes:
    """Decode 8kHz mu-law audio into 16-bit PCM.

    Args:
        payload: Mu-law encoded audio bytes.
    Returns:
        Little-endian PCM16 audio bytes at 8kHz.
    Agent:
        Voice
    """

    return b"".join(_decode_mulaw_byte(byte) for byte in payload)


def upsample_8k_to_16k(pcm_bytes: bytes) -> bytes:
    """Upsample 8kHz PCM16 audio to 16kHz by duplication.

    Args:
        pcm_bytes: PCM16 mono audio bytes at 8kHz.
    Returns:
        PCM16 mono audio bytes at 16kHz.
    Agent:
        Voice
    """

    samples = [pcm_bytes[index : index + 2] for index in range(0, len(pcm_bytes), 2)]
    return b"".join(sample + sample for sample in samples)


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int) -> bytes:
    """Wrap PCM16 bytes in a WAV container.

    Args:
        pcm_bytes: PCM16 mono audio bytes.
        sample_rate: Audio sample rate in Hertz.
    Returns:
        WAV file bytes.
    Agent:
        Voice
    """

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


def _decode_mulaw_byte(value: int) -> bytes:
    """Decode one mu-law sample to PCM16.

    Args:
        value: One mu-law sample byte.
    Returns:
        PCM16 sample bytes.
    Agent:
        Voice
    """

    value = (~value) & 0xFF
    sign = value & 0x80
    exponent = (value >> 4) & 0x07
    mantissa = value & 0x0F
    sample = (((mantissa << 3) + 0x84) << exponent) - 0x84
    return struct.pack("<h", -sample if sign else sample)
