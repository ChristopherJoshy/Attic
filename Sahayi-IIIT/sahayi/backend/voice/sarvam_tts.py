"""Sarvam text-to-speech client for SAHAYI."""

from __future__ import annotations

import asyncio
import base64
from sarvamai import SarvamAI

from core.config import get_settings
from utils.logger import get_logger


class SarvamTTSClient:
    """Client for Sarvam text-to-speech synthesis using official SDK."""

    def __init__(self) -> None:
        """Initialise TTS client settings.

        Args:
            None: Uses environment-backed TTS settings.
        Returns:
            None.
        Agent:
            Voice
        """

        self.settings = get_settings()
        self.logger = get_logger("sahayi.sarvam_tts")
        self.client = SarvamAI(api_subscription_key=self.settings.sarvam_api_key) if self.settings.sarvam_api_key else None

    async def synthesize(self, text: str) -> bytes:
        """Synthesize Malayalam speech into Twilio-safe mu-law audio using SDK.

        Args:
            text: Malayalam text to synthesize.
        Returns:
            Mu-law audio bytes at 8kHz, or empty bytes when Sarvam fails.
        Agent:
            Voice
        """

        if not self.client or not text.strip():
            return b""

        try:
            # Run synchronous SDK call in thread pool to avoid blocking event loop
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.text_to_speech.convert,
                    text=text,
                    target_language_code=self.settings.sarvam_language,
                    speaker=self.settings.sarvam_tts_speaker,
                    model=self.settings.sarvam_tts_model,
                    output_audio_codec="mulaw",
                    speech_sample_rate=8000,
                ),
                timeout=10.0,
            )
            
            # The SDK response contains base64 encoded audio.
            # Check for 'audio' or 'audios' attribute based on SDK version.
            if hasattr(response, "audio") and response.audio:
                return base64.b64decode(response.audio)
            if hasattr(response, "audios") and response.audios:
                return base64.b64decode(response.audios[0])
            return b""
            
        except asyncio.TimeoutError:
            self.logger.warning("Sarvam TTS timed out after 10 seconds")
            return b""
        except Exception:
            self.logger.exception("Sarvam SDK TTS failed")
            return b""
