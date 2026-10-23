"""Patient management routes for SAHAYI."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status

from contracts.patients import PatientCreateRequest, PatientResponse, PatientRiskResponse, PatientUpdateRequest
from core.security import require_doctor
from intelligence.anomaly_detection import detect_anomaly
from intelligence.risk_scoring import compute_risk
from intelligence.trend_detection import detect_trend
from utils.logger import get_logger
from utils.validators import normalize_phone, normalize_whatsapp

from utils.logger import get_logger

router = APIRouter(prefix="/patients", tags=["patients"])
logger = get_logger("sahayi.api.patients")


@router.post("")
async def create_patient(payload: PatientCreateRequest, request: Request, doctor: dict = Depends(require_doctor)) -> dict:
    """Create a new doctor-owned patient profile.

    Args:
        payload: Patient creation payload.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Created patient payload plus shared contact numbers.
    Agent:
        API
    """

    record = await request.app.state.database.create_patient({"name": payload.name, "language": payload.language, "phone_number": normalize_phone(payload.phone_number), "registration_number": payload.registration_number or None, "conditions": payload.conditions, "medicines": [item.model_dump() for item in payload.medicines], "emergency_contact": payload.emergency_contact.model_dump(), "doctor_contact": payload.doctor_contact.model_dump(), "relatives": [{"name": r.name, "relationship": r.relationship, "phone": normalize_phone(r.phone), "whatsapp_number": normalize_whatsapp(r.whatsapp_number or r.phone)} for r in payload.relatives], "doctor_uid": doctor["uid"], "doctor_email": doctor.get("email", "")})
    logger.info("Created new patient profile | patient_id=%s | doctor_uid=%s", record.id, doctor["uid"])
    response = _patient_response(record)
    # Request: authenticated patient profile payload. Response: saved patient plus shared Sahayi voice and WhatsApp numbers.
    return {"patient": response.model_dump(mode="json"), "voice_number": request.app.state.settings.twilio_phone_number, "whatsapp_number": request.app.state.settings.twilio_whatsapp_number}


@router.delete("/{patient_id}")
async def delete_patient(patient_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> dict:
    """Delete a doctor-owned patient profile.

    Args:
        patient_id: Patient identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Status message.
    Agent:
        API
    """

    logger.info("Delete request for patient | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
    success = await request.app.state.database.delete_patient(patient_id, doctor["uid"])
    if not success:
        logger.warning("Patient not found for deletion | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    logger.info("Successfully deleted patient | patient_id=%s", patient_id)
    # Request: authenticated DELETE. Response: JSON success message.
    return {"status": "deleted", "patient_id": patient_id}


@router.get("/{patient_id}")
async def get_patient(patient_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> dict:
    """Fetch one patient profile and call history.

    Args:
        patient_id: Patient identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Patient profile plus call history.
    Agent:
        API
    """

    patient = await request.app.state.database.get_patient(patient_id, doctor["uid"])
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    calls = await request.app.state.database.patient_call_history(patient_id, doctor["uid"])
    latest_summary = await request.app.state.database.latest_patient_summary(patient_id)
    summary_dict = None
    if latest_summary:
        summary_dict = {
            "summary_id": latest_summary.id,
            "patient_id": latest_summary.patient_id,
            "summary_text": latest_summary.summary_text,
            "risk_score": latest_summary.risk_score,
            "rag_context": latest_summary.rag_context,
            "hypothesis": latest_summary.hypothesis,
            "citations": latest_summary.citations,
            "knowledge_graph": latest_summary.knowledge_graph,
        }
    # Request: authenticated GET. Response: patient profile and serialized call history.
    return {"patient": _patient_response(patient).model_dump(mode="json"), "calls": [{"session_id": call.session_id, "started_at": call.started_at.isoformat(), "ended_at": call.ended_at.isoformat() if call.ended_at else None, "risk_score": call.risk_score, "status": call.status} for call in calls], "latest_summary": summary_dict}


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: int, payload: PatientUpdateRequest, request: Request, doctor: dict = Depends(require_doctor)) -> PatientResponse:
    """Update a doctor-owned patient profile.

    Args:
        patient_id: Patient identifier.
        payload: Patient update payload.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Updated patient payload.
    Agent:
        API
    """

    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if "phone_number" in updates:
        updates["phone_number"] = normalize_phone(updates["phone_number"])
    if "relatives" in updates:
        updates["relatives"] = [{"name": r["name"], "relationship": r["relationship"], "phone": normalize_phone(r["phone"]), "whatsapp_number": normalize_whatsapp(r.get("whatsapp_number") or r.get("phone", ""))} for r in updates["relatives"]]
    patient = await request.app.state.database.update_patient(patient_id, doctor["uid"], updates)
    if not patient:
        logger.warning("Failed to update patient: not found | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    
    logger.info("Updated patient profile | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
    # Request: authenticated PUT with partial patient payload. Response: updated patient object.
    return _patient_response(patient)


@router.get("/{patient_id}/signals")
async def get_signals(patient_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> list[dict]:
    """Fetch all signal records for one patient.

    Args:
        patient_id: Patient identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Serialized signal record list.
    Agent:
        API
    """

    # Request: authenticated GET. Response: chronological patient signal records.
    return [{"id": item.id, "session_id": item.session_id, "fatigue": item.fatigue, "appetite": item.appetite, "chest_pain": item.chest_pain, "duration_days": item.duration_days, "severity": item.severity, "red_flag": item.red_flag, "confidence": item.confidence, "created_at": item.created_at.isoformat()} for item in await request.app.state.database.patient_signals(patient_id, doctor["uid"])]


@router.get("/{patient_id}/risk", response_model=PatientRiskResponse)
async def get_risk(patient_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> PatientRiskResponse:
    """Compute the current risk view for one patient.

    Args:
        patient_id: Patient identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Current patient risk payload.
    Agent:
        API
    """

    patient = await request.app.state.database.get_patient(patient_id, doctor["uid"])
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    signals = await request.app.state.database.recent_signals(patient_id, days=14)
    if not signals:
        return PatientRiskResponse(score=0.0, breakdown={"severity_component": 0.0, "duration_component": 0.0, "change_component": 0.0}, status="green", trend="STABLE", z_score=0.0, is_anomaly=False)
    latest = signals[-1]
    current = [item for item in signals if (latest.created_at - item.created_at).days < 7]
    previous = [item for item in signals if (latest.created_at - item.created_at).days >= 7]
    trend, _ = detect_trend(len(current), len(previous))
    is_anomaly, z_score, _ = detect_anomaly([item.severity for item in signals[:-1]], latest.severity, request.app.state.settings.anomaly_z_score_threshold)
    risk = compute_risk(_signal_contract(latest), len(current), len(previous), request.app.state.settings.risk_yellow_threshold, request.app.state.settings.risk_red_threshold, trend, z_score, is_anomaly)
    
    logger.info("Computed risk for patient | patient_id=%s | risk_score=%.2f | doctor_uid=%s", patient_id, risk.score, doctor["uid"])
    
    # Request: authenticated GET. Response: latest calculated patient risk payload.
    return PatientRiskResponse(score=risk.score, breakdown=risk.breakdown, status=risk.status, trend=risk.trend, z_score=risk.z_score, is_anomaly=risk.is_anomaly)


def _patient_response(patient: object) -> PatientResponse:
    """Serialize a Patient ORM object to a response model.

    Args:
        patient: Patient ORM object.
    Returns:
        Patient response model.
    Agent:
        API
    """

    return PatientResponse(id=patient.id, name=patient.name, language=patient.language, phone_number=patient.phone_number, registration_number=patient.registration_number or "", conditions=patient.conditions, medicines=patient.medicines, emergency_contact=patient.emergency_contact, doctor_contact=patient.doctor_contact, relatives=patient.relatives, created_at=patient.created_at)


def _signal_contract(signal: object) -> object:
    """Convert a SignalRecord ORM object into the risk contract shape.

    Args:
        signal: SignalRecord ORM object.
    Returns:
        Lightweight object with signal attributes.
    Agent:
        API
    """

    from contracts.agents import ExtractedSignal

    return ExtractedSignal(signal.patient_id, signal.session_id, signal.fatigue, signal.appetite, signal.chest_pain, signal.duration_days, signal.severity, signal.red_flag, signal.source_text, signal.confidence, signal.created_at)
