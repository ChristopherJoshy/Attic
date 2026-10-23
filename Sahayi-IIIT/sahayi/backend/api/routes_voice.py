"""Voice and messaging routes for SAHAYI."""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from utils.logger import get_logger
from utils.validators import normalize_phone

router = APIRouter()
logger = get_logger("sahayi.api.voice")


def _validate_twilio(request: Request, form_data: dict[str, Any]) -> bool:
    """Validate a Twilio webhook signature when configured.

    Args:
        request: Incoming FastAPI request.
        form_data: Parsed Twilio form payload.
    Returns:
        Whether the request is valid for the configured auth token.
    Agent:
        API
    """

    # Skip validation in development for hackathon flexibility
    if request.app.state.settings.environment == "development":
        logger.info("Skipping Twilio signature validation in development mode")
        return True

    token = request.app.state.settings.twilio_auth_token
    signature = request.headers.get("X-Twilio-Signature", "")
    if not token or not signature:
        return False

    # Twilio signs with HTTPS URL. Behind ngrok, uvicorn might see HTTP.
    # Reconstruct the public URL using proxy headers.
    host = request.headers.get("X-Forwarded-Host", request.headers.get("host", ""))
    scheme = request.headers.get("X-Forwarded-Proto", "https")
    public_url = f"{scheme}://{host}{request.url.path}"

    if request.url.query:
        public_url = f"{public_url}?{request.url.query}"

    is_valid = RequestValidator(token).validate(public_url, form_data, signature)
    if not is_valid:
        # Fallback to TWILIO_WEBHOOK_BASE if header-based reconstruction fails
        base_url = request.app.state.settings.twilio_webhook_base.rstrip("/")
        path = request.url.path
        public_url = base_url if base_url.endswith(path) else f"{base_url}{path}"
        if request.url.query:
            public_url = f"{public_url}?{request.url.query}"
        is_valid = RequestValidator(token).validate(public_url, form_data, signature)

    if not is_valid:
        logger.warning("Twilio signature validation failed | public_url=%s", public_url)

    return is_valid


TTS_CACHE: dict[str, bytes] = {}

@router.get("/voice/media/{media_id}.wav")
async def get_media(media_id: str) -> Response:
    """Serve cached TTS audio for WhatsApp voice replies."""
    if media_id in TTS_CACHE:
        return Response(content=TTS_CACHE[media_id], media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Media not found")

@router.post("/voice/incoming")
async def incoming_voice(request: Request) -> Response:
    """Handle incoming Twilio voice webhooks.

    Args:
        request: Incoming form-encoded Twilio webhook.
    Returns:
        TwiML XML response that starts a media stream.
    Agent:
        API
    """

    form_data = dict(await request.form())
    if not _validate_twilio(request, form_data):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")
    # For outbound follow-up calls the webhook URL carries the patient_id so
    # the handler can identify the patient even though the caller is Twilio.
    raw_patient_id = request.query_params.get("patient_id")
    outbound_patient_id = int(raw_patient_id) if raw_patient_id and raw_patient_id.isdigit() else None
    # Request: Twilio voice webhook form. Response: TwiML that connects the call to the voice WebSocket.
    logger.info("Incoming Twilio voice webhook | outbound_patient_id=%s", outbound_patient_id)
    _, xml = await request.app.state.twilio_handler.create_incoming_response(form_data, request.app.state.websocket_base, outbound_patient_id)
    return Response(content=xml, media_type="application/xml")


@router.post("/voice/whatsapp")
async def incoming_whatsapp(request: Request) -> Response:
    """Handle incoming Twilio WhatsApp messages including prescription images.

    Args:
        request: Incoming form-encoded Twilio WhatsApp webhook.
    Returns:
        TwiML messaging response with the assistant reply.
    Agent:
        API
    """

    form_data = dict(await request.form())
    if not _validate_twilio(request, form_data):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")
    
    raw_from = form_data.get("From", "")
    phone_number = normalize_phone(str(raw_from).replace("whatsapp:", ""))
    patient = await request.app.state.database.get_patient_by_whatsapp(phone_number)
    response = MessagingResponse()
    
    if not patient:
        error_text = f"ക്ഷമിക്കണം, ഈ നമ്പർ ({phone_number}) സഹായിയിൽ രജിസ്റ്റർ ചെയ്തിട്ടില്ല. ദയവായി നിങ്ങളുടെ ഡോക്ടറെ സമീപിച്ച് നമ്പർ ചേർക്കുക."
        media_type = form_data.get("MediaContentType0")
        if media_type and str(media_type).startswith("audio/"):
            try:
                audio_bytes = await request.app.state.whatsapp_agent.tts.synthesize(error_text)
                if audio_bytes:
                    media_id = str(uuid4())
                    TTS_CACHE[media_id] = audio_bytes
                    public_url = request.app.state.settings.twilio_webhook_base.rstrip("/")
                    msg = response.message()
                    msg.media(f"{public_url}/voice/media/{media_id}.wav")  # type: ignore
                    return Response(content=str(response), media_type="application/xml")
            except Exception:
                pass
        
        response.message(error_text)
        return Response(content=str(response), media_type="application/xml")
    
    # Determine who is messaging (patient or relative)
    from utils.validators import phone_lookup_variants
    variants = phone_lookup_variants(phone_number)
    whatsapp_variants = tuple(f"whatsapp:{v}" for v in variants)
    
    is_relative = False
    sender_name = patient.name
    
    # Check if the sender is a relative
    for rel in patient.relatives or []:
        rel_wa = rel.get("whatsapp_number")
        rel_phone = rel.get("phone")
        if rel_wa in whatsapp_variants or rel_wa in variants or rel_phone in variants:
            is_relative = True
            sender_name = rel.get("name") or "കുടുംബാംഗം"
            break
    
    # Check for media (images or voice notes)
    media_url = form_data.get("MediaUrl0")
    media_type = form_data.get("MediaContentType0")
    text_body = form_data.get("Body", "")
    
    if media_url and media_type and str(media_type).startswith("image/"):
        # Pre-process image to extract medicines before sending to Agent
        from voice.vision import extract_prescription_from_url
        prescription = await extract_prescription_from_url(str(media_url))
        if prescription.medicines and prescription.confidence > 0.5:
            current_medicines = patient.medicines or []
            new_medicines = current_medicines + [
                {"name": m, "dose": d, "timing": t, "purpose": p}
                for m, d, t, p in zip(prescription.medicines, prescription.doses, prescription.timings, prescription.purposes)
            ]
            patient = await request.app.state.database.update_patient(
                patient.id, 
                patient.doctor_uid, 
                {"medicines": new_medicines}
            )
            asyncio.create_task(
                request.app.state.twilio_handler.initiate_follow_up_call(phone_number, patient.id)
            )

    # Let the WhatsAppAgent handle the reply
    payload = {
        "id": patient.id, 
        "name": patient.name, 
        "language": patient.language, 
        "conditions": patient.conditions, 
        "medicines": patient.medicines, 
        "doctor_uid": patient.doctor_uid, 
        "doctor_email": patient.doctor_email, 
        "relatives": patient.relatives,
        "sender_name": sender_name,
        "is_relative": is_relative
    }
    
    text_reply, audio_bytes = await request.app.state.whatsapp_agent.handle_message(
        payload, 
        text_body, 
        media_url=str(media_url) if media_url else None, 
        media_type=str(media_type) if media_type else None
    )

    if audio_bytes:
        media_id = str(uuid4())
        TTS_CACHE[media_id] = audio_bytes
        public_url = request.app.state.settings.twilio_webhook_base.rstrip("/")
        msg = response.message(text_reply)
        msg.media(f"{public_url}/voice/media/{media_id}.wav")  # type: ignore
    else:
        response.message(text_reply)

    return Response(content=str(response), media_type="application/xml")


@router.websocket("/ws/voice/{session_id}")
async def voice_stream(websocket: WebSocket, session_id: str) -> None:
    """Handle real-time Twilio media stream messages.

    Uses a dedicated sender coroutine and background processing tasks so
    the receive loop stays free to handle WebSocket keepalive pings.

    Args:
        websocket: Incoming Twilio WebSocket.
        session_id: Active session UUID.
    Returns:
        None.
    Agent:
        API
    """

    await websocket.accept()
    handler = websocket.app.state.twilio_handler
    send_queue: asyncio.Queue[dict] = asyncio.Queue()
    active_tasks: set[asyncio.Task] = set()

    async def _sender() -> None:
        """Drain the send queue and write outbound events to Twilio."""
        while True:
            payload = await send_queue.get()
            try:
                await websocket.send_json(payload)
            except Exception:
                break

    async def _spawn_processing(sid: str) -> None:
        """Run the heavy STT→AI→TTS pipeline and enqueue the result."""
        try:
            async for outbound in handler.process_audio_turn(sid):
                if outbound:
                    await send_queue.put(outbound)
        except Exception:
            logger.exception("Background audio task failed | session=%s", sid)

    sender_task = asyncio.create_task(_sender())

    try:
        while True:
            message = await websocket.receive_text()
            event_type, immediate, ready = await handler.handle_stream_event(
                session_id, message
            )

            if immediate:
                await send_queue.put(immediate)

            if ready:
                task = asyncio.create_task(_spawn_processing(session_id))
                active_tasks.add(task)
                task.add_done_callback(active_tasks.discard)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Voice stream error | session=%s", session_id)
    finally:
        sender_task.cancel()
        for pending in active_tasks:
            pending.cancel()
        # Ensure session cleanup runs even on unexpected disconnect
        if session_id in handler.sessions:
            try:
                await handler._on_stop(handler.sessions[session_id])
            except Exception:
                logger.exception("Cleanup failed | session=%s", session_id)

