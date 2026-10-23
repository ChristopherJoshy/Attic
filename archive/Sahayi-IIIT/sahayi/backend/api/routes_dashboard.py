"""Doctor dashboard routes for SAHAYI."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status

from contracts.system import AcknowledgeResponse, DashboardPatientCard
from core.security import require_doctor, require_doctor_socket
from utils.logger import get_logger

router = APIRouter(tags=["dashboard"])
logger = get_logger("sahayi.api.dashboard")


@router.websocket("/ws/dashboard")
async def dashboard_socket(websocket: WebSocket) -> None:
    """Handle authenticated doctor dashboard WebSockets.

    Args:
        websocket: Incoming doctor dashboard WebSocket.
    Returns:
        None.
    Agent:
        API
    """

    doctor = await require_doctor_socket(websocket)
    await websocket.app.state.sockets.connect(doctor["uid"], websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("Dashboard websocket dropped unexpectedly: %s", e)
    finally:
        websocket.app.state.sockets.disconnect(doctor["uid"], websocket)


@router.get("/dashboard/patients")
async def dashboard_patients(request: Request, doctor: dict = Depends(require_doctor)) -> list[DashboardPatientCard]:
    """List recent patient status cards for the authenticated doctor.

    Args:
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Dashboard patient card list.
    Agent:
        API
    """

    # Request: authenticated GET. Response: patient cards with latest risk and active session metadata.
    patients = await request.app.state.database.list_patients(doctor["uid"])
    cards: list[DashboardPatientCard] = []
    for patient in patients:
        latest_signal = await request.app.state.database.latest_signal(patient.id)
        calls = await request.app.state.database.patient_call_history(patient.id, doctor["uid"])
        active = next((call for call in calls if call.ended_at is None), None)
        latest_summary = await request.app.state.database.latest_patient_summary(patient.id)
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

        cards.append(
            DashboardPatientCard(
                patient_id=patient.id,
                patient_name=patient.name,
                language=patient.language,
                latest_status="red" if latest_signal and latest_signal.red_flag else "green",
                risk_score=float(active.risk_score if active else 0.0),
                conditions=patient.conditions,
                active_session_id=active.session_id if active else None,
                latest_symptom=latest_signal.symptom_description if latest_signal else None,
                latest_signal_date=latest_signal.created_at.isoformat() if latest_signal else None,
                severity=latest_signal.severity if latest_signal else None,
                latest_summary=summary_dict,
            )
        )
    
    logger.info("Fetched dashboard patients | doctor_uid=%s | count=%d", doctor["uid"], len(cards))
    return cards


@router.get("/dashboard/population")
async def dashboard_population(request: Request, doctor: dict = Depends(require_doctor)) -> list[dict]:
    """Return the latest population intelligence findings.

    Args:
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Serialized population intelligence list.
    Agent:
        API
    """

    # Request: authenticated GET. Response: latest saved population pattern payloads.
    return [{"id": item.id, "pattern_json": item.pattern_json, "frequency": item.frequency, "week_delta": item.week_delta, "research_gap": item.research_gap, "created_at": item.created_at.isoformat()} for item in await request.app.state.database.latest_population_patterns()]


@router.post("/dashboard/acknowledge/{summary_id}", response_model=AcknowledgeResponse)
async def acknowledge_summary(summary_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> AcknowledgeResponse:
    """Acknowledge a doctor summary.

    Args:
        summary_id: Summary identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Acknowledge response payload.
    Agent:
        API
    """

    # Request: authenticated POST with summary id. Response: acknowledgement status.
    summary = await request.app.state.database.acknowledge_summary(summary_id, doctor["uid"])
    if not summary:
        logger.warning("Failed to acknowledge summary: not found | summary_id=%s | doctor_uid=%s", summary_id, doctor["uid"])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary not found")
    
    logger.info("Acknowledged summary | summary_id=%s | doctor_uid=%s", summary_id, doctor["uid"])
    return AcknowledgeResponse(summary_id=summary.id, acknowledged=summary.acknowledged)


@router.post("/dashboard/escalate/{patient_id}")
async def escalate_patient(patient_id: int, request: Request, doctor: dict = Depends(require_doctor)) -> dict:
    """Trigger a doctor-initiated family alert.

    Args:
        patient_id: Patient identifier.
        request: FastAPI request carrying app state.
        doctor: Verified Firebase doctor payload.
    Returns:
        Serialized alert dispatch payload.
    Agent:
        API
    """

    patient = await request.app.state.database.get_patient(patient_id, doctor["uid"])
    if not patient:
        logger.warning("Failed to escalate patient: not found | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    payload = patient.__dict__.copy()
    payload.pop("_sa_instance_state", None)
    # Request: authenticated POST with patient id. Response: family alert dispatch result.
    result = await request.app.state.family_alert.send(payload, "Doctor requested a family check-in.", doctor_trigger=True, red_flag=True)
    logger.info("Escalated patient | patient_id=%s | doctor_uid=%s", patient_id, doctor["uid"])
    return {"delivered": result.delivered, "channel": result.channel, "message": result.message}
