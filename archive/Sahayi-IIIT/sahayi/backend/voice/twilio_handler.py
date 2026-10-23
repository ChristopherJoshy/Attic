"""Twilio voice transport handler for SAHAYI."""
from __future__ import annotations
import asyncio
import base64
import json
import struct
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from twilio.twiml.voice_response import Connect, VoiceResponse
from core.config import get_settings
from db.database import DatabaseGateway
from utils.logger import get_logger
from utils.validators import normalize_phone
from voice.audio_codec import mulaw_to_pcm16, upsample_8k_to_16k
from voice.sarvam_stt import SarvamSTTClient
from voice.sarvam_tts import SarvamTTSClient
from voice.vad import SileroVAD

@dataclass(slots=True)
class VoiceSessionState:
    """In-memory state for one live Twilio media stream.

    Args:
        session_id: Active session UUID.
        patient: Patient profile dictionary.
        stream_sid: Twilio stream SID once known.
        started_at: Stream start time.
        buffer: In-memory inbound audio buffer.
        processing: Whether an STT turn is already being processed.
        last_response_time: Timestamp of last response sent to user.
    Returns:
        VoiceSessionState dataclass.
    Agent:
        Voice
    """
    session_id: str
    patient: dict
    stream_sid: str = ""
    started_at: datetime = field(default_factory=datetime.utcnow)
    buffer: bytearray = field(default_factory=bytearray)
    processing: bool = False
    last_response_time: datetime = field(default_factory=datetime.utcnow)
    speech_detected: bool = False
    silence_start: datetime | None = None
    vad: SileroVAD | None = None
    pcm_buffer: bytearray = field(default_factory=bytearray)


class TwilioVoiceHandler:
    """Handle Twilio voice webhooks and media stream events."""

    def __init__(self, database: DatabaseGateway, orchestrator: object, sockets: object) -> None:
        """Initialise Twilio voice transport dependencies.

        Args:
            database: Shared database gateway instance.
            orchestrator: Shared orchestrator instance.
            sockets: Shared dashboard socket manager.
        Returns:
            None.
        Agent:
            Voice
        """

        self.database = database
        self.orchestrator = orchestrator
        self.sockets = sockets
        self.settings = get_settings()
        self.stt = SarvamSTTClient()
        self.tts = SarvamTTSClient()
        self.logger = get_logger("sahayi.twilio_handler")
        self.sessions: dict[str, VoiceSessionState] = {}
        self.client = Client(self.settings.twilio_account_sid, self.settings.twilio_auth_token) if self.settings.twilio_account_sid and self.settings.twilio_auth_token else None

    async def create_incoming_response(self, form_data: dict[str, str], websocket_base: str, outbound_patient_id: int | None = None) -> tuple[str, str]:
        """Create a TwiML response for an incoming Twilio call.

        For inbound calls the patient is resolved by caller phone number.
        For outbound follow-up calls, `outbound_patient_id` carries the
        database ID so the handler can identify the patient even though the
        caller number belongs to Twilio.

        Args:
            form_data: Twilio webhook form payload.
            websocket_base: Public WebSocket base URL.
            outbound_patient_id: Optional patient ID for outbound calls.
        Returns:
            Tuple of `(session_id, twiml_xml)`.
        Agent:
            Voice
        """

        patient = None
        if outbound_patient_id:
            patient = await self.database.get_patient_by_id(outbound_patient_id)
        if not patient:
            raw_from = form_data.get("From", "")
            phone_number = normalize_phone(str(raw_from))
            patient = await self.database.get_patient_by_phone(phone_number)
        session_id = str(uuid4())
        if not patient:
            response = VoiceResponse()
            response.say("നിങ്ങളുടെ നമ്പർ സഹായിയിൽ രജിസ്റ്റർ ചെയ്തിട്ടില്ല. നിങ്ങളുടെ ഡോക്ടറോട് നിങ്ങളുടെ നമ്പർ ചേർക്കാൻ ആവശ്യപ്പെടുക.", language="ml-IN")
            return session_id, str(response)
        patient_payload = {"id": patient.id, "name": patient.name, "language": patient.language, "registration_number": patient.registration_number or "", "conditions": patient.conditions, "medicines": patient.medicines, "doctor_uid": patient.doctor_uid, "doctor_email": patient.doctor_email, "relatives": patient.relatives}
        self.sessions[session_id] = VoiceSessionState(session_id=session_id, patient=patient_payload)
        await self.database.create_call_session(patient.id, session_id)
        response = VoiceResponse()
        connect = Connect()
        connect.stream(url=f"{websocket_base}/ws/voice/{session_id}")
        response.append(connect)
        return session_id, str(response)

    async def handle_stream_event(self, session_id: str, raw_message: str) -> tuple[str, dict | None, bool]:
        """Handle one Twilio media-stream WebSocket message (non-blocking).

        Returns quickly so the WebSocket receive loop stays responsive.
        Heavy processing is signalled via the `ready` flag and should be
        executed in a background task by calling `process_audio_turn`.

        Args:
            session_id: Active session UUID.
            raw_message: Raw JSON string from Twilio.
        Returns:
            Tuple of (event_type, optional immediate outbound media dict,
            ready_for_processing flag).
        Agent:
            Voice
        """

        message = json.loads(raw_message)
        state = self.sessions.get(session_id)
        if not state:
            return ("unknown", None, False)

        event = message.get("event")

        if event == "start":
            outbound = await self._on_start(state, message)
            return ("start", outbound, False)

        if event == "media":
            ready = self._accumulate_audio(state, message)
            return ("media", None, ready)

        if event == "mark":
            # Twilio confirms our audio finished playing
            state.last_response_time = datetime.utcnow()
            return ("mark", None, False)

        if event == "stop":
            await self._on_stop(state)
            return ("stop", None, False)

        return (event or "unknown", None, False)

    async def _on_start(self, state: VoiceSessionState, message: dict) -> dict | None:
        """Handle Twilio stream start and send a Malayalam greeting.

        Synthesizes a personalised greeting using the patient's name so
        the first thing they hear is 'Hello {name}, I am Sahayi'.

        Args:
            state: Mutable voice session state.
            message: Parsed Twilio event payload.
        Returns:
            Optional outbound media event with the greeting audio.
        Agent:
            Voice
        """

        state.stream_sid = message.get("start", {}).get("streamSid", "")
        await self.sockets.broadcast(state.patient["doctor_uid"], "call_started", {"session_id": state.session_id, "patient_id": state.patient["id"], "patient_name": state.patient["name"], "language": state.patient["language"], "started_at": state.started_at.isoformat()})

        patient_name = state.patient.get("name", "സുഹൃത്തെ")
        greeting = f"ഹലോ {patient_name}, ഞാൻ സഹായി ആണ്. നിങ്ങളുടെ ആരോഗ്യം എങ്ങനെയുണ്ട്?"
        try:
            audio = await self.tts.synthesize(greeting)
            if audio and state.stream_sid:
                state.last_response_time = datetime.utcnow()
                return self._build_media_payload(state.stream_sid, audio)
        except Exception:
            self.logger.exception("Failed to synthesize greeting | session_id=%s", state.session_id)
        return None

    # Sarvam STT rejects audio longer than 30s.  Keep at most ~20s of
    # 8 kHz mono mu-law (1 byte per sample) to stay safely under the limit.
    _MAX_BUFFER_BYTES = 160_000

    # Seconds of continuous silence after speech before we trigger processing.
    # Must be long enough to cover natural pauses between sentences (~0.8s).
    _TRAILING_SILENCE_SECONDS = 0.4

    def _accumulate_audio(self, state: VoiceSessionState, message: dict) -> bool:
        """Buffer inbound audio and return True when ready to process.

        Uses Silero VAD for voice activity detection: waits for the user
        to start speaking, then waits for trailing silence before
        triggering STT.  This prevents cutting the user off mid-sentence.

        Args:
            state: Mutable voice session state.
            message: Parsed Twilio media event payload.
        Returns:
            True when the user has finished speaking and audio is ready.
        Agent:
            Voice
        """

        payload = base64.b64decode(message.get("media", {}).get("payload", ""))
        state.buffer.extend(payload)
        
        # Convert mu-law to PCM16 and buffer for VAD
        pcm_chunk = mulaw_to_pcm16(payload)
        state.pcm_buffer.extend(pcm_chunk)

        # Trim leading (oldest) audio so we never exceed the STT limit
        overflow = len(state.buffer) - self._MAX_BUFFER_BYTES
        if overflow > 0:
            del state.buffer[:overflow]

        if state.processing:
            return False

        elapsed = (datetime.utcnow() - state.last_response_time).total_seconds()
        if elapsed < 2.0:
            # Still in cooldown after our last response — reset speech state
            state.speech_detected = False
            state.silence_start = None
            state.pcm_buffer.clear()
            if state.vad:
                state.vad.reset_state()
            return False

        # Initialize VAD lazily
        if not state.vad:
            state.vad = SileroVAD()

        # VAD requires exactly 256 or 512 samples (512 or 1024 bytes) at 8kHz
        # We will process chunks of 512 bytes (32ms)
        is_speaking_now = False
        processed_any = False
        
        while len(state.pcm_buffer) >= 512:
            chunk = state.pcm_buffer[:512]
            del state.pcm_buffer[:512]
            
            try:
                # threshold=0.5 is default in Silero
                if state.vad.is_speech(bytes(chunk), sample_rate=8000):
                    is_speaking_now = True
                processed_any = True
            except Exception as e:
                self.logger.error("VAD error: %s", e)
                # Fallback to assuming silence
                pass

        if not processed_any:
            # Not enough data for VAD yet, maintain previous state
            return False

        if is_speaking_now:
            # User is speaking
            state.speech_detected = True
            state.silence_start = None
            return False

        # Energy is low — if speech was detected, track trailing silence
        if state.speech_detected:
            now = datetime.utcnow()
            if state.silence_start is None:
                state.silence_start = now
            elif (now - state.silence_start).total_seconds() >= self._TRAILING_SILENCE_SECONDS:
                # User stopped speaking
                state.speech_detected = False
                state.silence_start = None
                state.processing = True
                state.vad.reset_state()
                state.pcm_buffer.clear()
                return True

        return False

    async def process_audio_turn(self, session_id: str):
        """Run the heavy STT → orchestrator → TTS pipeline for one turn.

        Designed to be called from a background `asyncio.Task` so the
        WebSocket receive loop stays responsive to keepalive pings.
        ``state.processing`` is already True when this method is called.

        Args:
            session_id: Active session UUID.
        Yields:
            Outbound media dicts to send over the WebSocket.
        """

        state = self.sessions.get(session_id)
        if not state:
            return

        audio_data = bytes(state.buffer)
        state.buffer.clear()

        try:
            transcript = await self.stt.transcribe(
                upsample_8k_to_16k(mulaw_to_pcm16(audio_data))
            )

            if transcript["should_repeat"]:
                if transcript["text"]:
                    audio = await self.tts.synthesize("ക്ഷമിക്കണം, വ്യക്തമല്ല. വീണ്ടും പറയാമോ?")
                    if audio:
                        state.last_response_time = datetime.utcnow()
                        yield self._build_media_payload(state.stream_sid, audio)
                # If no text at all, just ignore and don't say anything to avoid a loop of "can't hear anything"
            else:
                turn_result = await self.orchestrator.handle_turn(
                    state.patient, state.session_id, str(transcript["text"])
                )
                audio = await self.tts.synthesize(turn_result.reply.text)
                if audio:
                    state.last_response_time = datetime.utcnow()
                    yield self._build_media_payload(state.stream_sid, audio)

        except Exception:
            self.logger.exception(
                "Error processing audio turn | session_id=%s", state.session_id
            )
        finally:
            state.processing = False

    @staticmethod
    def _build_media_payload(stream_sid: str, audio: bytes) -> dict:
        """Build a Twilio-compatible outbound media event dict.

        Args:
            stream_sid: Twilio stream SID.
            audio: Mu-law audio bytes.
        Returns:
            Dict ready to be sent as JSON over the media-stream WebSocket.
        Agent:
            Voice
        """

        return {
            "event": "media",
            "streamSid": stream_sid,
            "media": {"payload": base64.b64encode(audio).decode("utf-8")},
        }

    async def _on_stop(self, state: VoiceSessionState) -> None:
        """Handle Twilio stream stop events.

        Args:
            state: Mutable voice session state.
        Returns:
            None.
        Agent:
            Voice
        """

        risk_score = float(self.orchestrator.session_risks.get(state.session_id, 0.0))
        await self.database.finalize_call_session(state.session_id, risk_score, "completed")
        await self.sockets.broadcast(state.patient["doctor_uid"], "call_ended", {"session_id": state.session_id, "patient_id": state.patient["id"], "ended_at": datetime.utcnow().isoformat(), "risk_score": risk_score})
        self.sessions.pop(state.session_id, None)

    async def initiate_follow_up_call(self, phone_number: str, patient_id: int | None = None) -> None:
        """Create an outbound Twilio follow-up call when required.

        When `patient_id` is provided the webhook URL includes it as a
        query parameter so the incoming handler can identify the patient
        even though the caller ID is the Twilio number, not the patient.

        Args:
            phone_number: Patient phone number to call.
            patient_id: Optional patient database ID for context.
        Returns:
            None.
        Agent:
            Voice
        """

        if not self.client:
            return
        destination = normalize_phone(phone_number)
        if not destination:
            self.logger.warning("Follow-up call skipped due to missing phone number")
            return
        base_url = self.settings.twilio_webhook_base.rstrip("/")
        webhook_url = base_url if base_url.endswith("/voice/incoming") else f"{base_url}/voice/incoming"
        if patient_id:
            webhook_url = f"{webhook_url}?patient_id={patient_id}"
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.calls.create,
                    to=destination,
                    from_=self.settings.twilio_phone_number,
                    url=webhook_url,
                ),
                timeout=5,
            )
        except (TwilioRestException, TimeoutError, ValueError):
            self.logger.exception("Failed to initiate Twilio follow-up call | to=%s", destination)
