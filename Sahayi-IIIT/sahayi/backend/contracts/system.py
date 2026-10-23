"""Pydantic contracts for dashboard and system APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DashboardEvent(BaseModel):
    """Dashboard WebSocket event payload.

    Args:
        event: Event type name.
        payload: Event data payload.
        occurred_at: UTC timestamp for the event.
    Returns:
        Serialized event object.
    Agent:
        API
    """

    event: str
    payload: dict[str, Any]
    occurred_at: datetime


class DashboardPatientCard(BaseModel):
    """Dashboard patient card payload.

    Args:
        patient_id: Patient identifier.
        patient_name: Patient display name.
        language: Patient language.
        latest_status: Latest green/yellow/red status.
        risk_score: Latest risk score.
        conditions: Patient's primary conditions.
        active_session_id: Optional active session UUID.
    Returns:
        Serialized patient status card.
    Agent:
        API
    """

    patient_id: int
    patient_name: str
    language: str
    latest_status: str
    risk_score: float
    conditions: list[str]
    active_session_id: str | None
    latest_symptom: str | None = None
    latest_signal_date: str | None = None
    severity: int | None = None
    latest_summary: dict | None = None


class HealthResponse(BaseModel):
    """Health check response payload.

    Args:
        status: Overall health status.
        services: Per-service health details.
        checked_at: UTC timestamp for the check.
    Returns:
        Serialized health response.
    Agent:
        API
    """

    status: str
    services: dict[str, Any]
    checked_at: datetime


class AcknowledgeResponse(BaseModel):
    """Doctor summary acknowledgement response.

    Args:
        summary_id: Acknowledged summary identifier.
        acknowledged: Final acknowledgement status.
    Returns:
        Serialized acknowledgement response.
    Agent:
        API
    """

    summary_id: int
    acknowledged: bool
