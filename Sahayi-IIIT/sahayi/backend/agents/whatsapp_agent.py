from __future__ import annotations

import json
import httpx
import uuid
from typing import Any, Optional

from google.genai import client as genai_client
from google.genai import types

from core.config import get_settings
from utils.logger import get_logger
from voice.sarvam_tts import SarvamTTSClient
from voice.sarvam_stt import SarvamSTTClient

class WhatsAppAgent:
    def __init__(self, database: Any) -> None:
        self.database = database
        settings = get_settings()
        self.logger = get_logger("sahayi.whatsapp_agent")
        
        if settings.google_cloud_project and settings.google_cloud_location:
            self.client = genai_client.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
        else:
            self.client = genai_client.Client(api_key=settings.gemini_api_key)
            
        self.tts = SarvamTTSClient()
        self.stt = SarvamSTTClient()

    async def handle_message(self, patient: dict, text: str, media_url: Optional[str] = None, media_type: Optional[str] = None) -> tuple[str, Optional[bytes]]:
        wants_audio_reply = False
        parts = []
        
        if media_url:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(media_url)
                    response.raise_for_status()
                    media_bytes = response.content
                    
                    if media_type and media_type.startswith("audio/"):
                        wants_audio_reply = True
                        stt_result = await self.stt.transcribe_file(media_bytes, "audio.ogg", media_type)
                        transcript = str(stt_result.get("text", "")).strip()
                        if transcript:
                            text = (text + "\n" + transcript).strip() if text else transcript
                    elif media_type and media_type.startswith("image/"):
                        parts.append(
                            types.Part.from_bytes(data=media_bytes, mime_type=media_type)
                        )
            except Exception as e:
                self.logger.error(f"Failed to process media: {e}")

        if text:
            parts.append(types.Part.from_text(text=text))
            
        if not parts:
            parts.append(types.Part.from_text(text="Hello"))

        # Instead of complex tool execution, let's inject the patient's full context into the prompt!
        # This provides all the info the agent needs (medications, conditions, summaries) without needing multi-turn tool loops.
        # Let's get recent signals and summaries
        recent_signals = await self.database.recent_signals(patient["id"], days=7)
        signals_text = ", ".join([f"Sev {s.severity} (Fatigue: {s.fatigue})" for s in recent_signals]) if recent_signals else "No recent signals."
        
        sender_name = patient.get("sender_name", "User")
        sender_role = "Patient's Relative"
        
        system_instruction = f"""
You are Sahayi, a helpful, empathetic medical assistant. You are chatting via WhatsApp with {sender_role} (Name: {sender_name}).
UNDER NO CIRCUMSTANCES should you use English. ONLY USE MALAYALAM SCRIPT. ALWAYS reply in fluent Malayalam. Be concise and conversational.
If an image is provided, it is likely a prescription. Analyze it, list the medicines, and confirm they have been noted. 
If an audio message is provided, transcribe it internally and respond to it.

Patient Context:
Name: {patient.get('name')}
Language: {patient.get('language')}
Conditions: {patient.get('conditions')}
Current Medicines: {json.dumps(patient.get('medicines'))}
Recent Signals: {signals_text}

Answer the user's query using this information. 
"""

        reply_text: str = ""
        try:
            response = await self.client.aio.models.generate_content(
                model=get_settings().gemini_model,
                contents=[types.Content(role="user", parts=parts)],
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3
                )
            )
            reply_text = str(response.text) if response.text else "ക്ഷമിക്കണം, എനിക്ക് ഇപ്പോൾ മറുപടി നൽകാൻ കഴിയുന്നില്ല."
        except Exception as e:
            self.logger.error(f"Gemini generation failed: {e}")
            reply_text = "ക്ഷമിക്കണം, എനിക്ക് ഇപ്പോൾ മറുപടി നൽകാൻ കഴിയുന്നില്ല."

        audio_bytes = None
        if wants_audio_reply:
            try:
                audio_bytes = await self.tts.synthesize(reply_text)
            except Exception as e:
                self.logger.error(f"TTS generation failed: {e}")

        return reply_text, audio_bytes
