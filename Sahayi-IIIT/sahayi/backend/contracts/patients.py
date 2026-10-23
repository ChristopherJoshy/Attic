"""Pydantic request and response contracts for patient-facing APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MedicineInput(BaseModel):
    """Medicine input payload.

    Args:
        name: Medicine name.
        dose: Dose text.
        frequency: Frequency text.
        timing: Timing instructions.
    Returns:
        Validated medicine payload.
    Agent:
        API
    """

    name: str
    dose: str
    frequency: str
    timing: str


class ContactInput(BaseModel):
    """Contact input payload.

    Args:
        name: Contact name.
        phone: Contact phone number.
        relationship: Relationship to the patient.
    Returns:
        Validated contact payload.
    Agent:
        API
    """

    name: str
    phone: str
    relationship: str


class RelativeInput(BaseModel):
    """Relative input payload.

    Args:
        name: Relative name.
        phone: Relative phone number.
        whatsapp_number: Relative WhatsApp number.
        relationship: Relationship to the patient.
    Returns:
        Validated relative payload.
    Agent:
        API
    """

    name: str
    phone: str
    whatsapp_number: str | None = None
    relationship: str


class PatientCreateRequest(BaseModel):
    """Patient creation payload.

    Args:
        name: Patient name.
        language: Preferred language.
        phone_number: Registered caller phone number.
        conditions: Known conditions.
        medicines: Structured medicines.
        emergency_contact: Emergency contact object.
        doctor_contact: Doctor contact object.
        relatives: List of relative objects for escalation messaging.
    Returns:
        Validated patient creation payload.
    Agent:
        API
    """

    name: str
    language: str = Field(default="ml-IN")
    phone_number: str
    registration_number: str = Field(default="")
    conditions: list[str]
    medicines: list[MedicineInput]
    emergency_contact: ContactInput
    doctor_contact: ContactInput
    relatives: list[RelativeInput]


class PatientUpdateRequest(BaseModel):
    """Patient update payload.

    Args:
        name: Patient name override.
        language: Preferred language override.
        phone_number: Registered caller phone number override.
        conditions: Known conditions.
        medicines: Structured medicines.
        emergency_contact: Emergency contact object.
        doctor_contact: Doctor contact object.
        relatives: List of relative objects for escalation messaging.
    Returns:
        Validated patient update payload.
    Agent:
        API
    """

    name: str | None = None
    language: str | None = None
    phone_number: str | None = None
    registration_number: str | None = None
    conditions: list[str] | None = None
    medicines: list[MedicineInput] | None = None
    emergency_contact: ContactInput | None = None
    doctor_contact: ContactInput | None = None
    relatives: list[RelativeInput] | None = None


class PatientResponse(BaseModel):
    """Patient response payload.

    Args:
        id: Patient identifier.
        name: Patient name.
        language: Preferred language.
        phone_number: Registered caller phone number.
        conditions: Known conditions.
        medicines: Structured medicines.
        emergency_contact: Emergency contact object.
        doctor_contact: Doctor contact object.
        relatives: List of relative objects.
        created_at: Creation timestamp.
    Returns:
        API-safe patient payload.
    Agent:
        API
    """

    id: int
    name: str
    language: str
    phone_number: str
    registration_number: str
    conditions: list[str]
    medicines: list[dict[str, Any]]
    emergency_contact: dict[str, Any]
    doctor_contact: dict[str, Any]
    relatives: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class PatientRiskResponse(BaseModel):
    """Patient risk response payload.

    Args:
        score: Current risk score.
        breakdown: Formula breakdown.
        status: Color status.
        trend: Trend label.
        z_score: Anomaly z-score.
        is_anomaly: Whether an anomaly was detected.
    Returns:
        API-safe patient risk payload.
    Agent:
        API
    """

    score: float
    breakdown: dict[str, float]
    status: str
    trend: str
    z_score: float
    is_anomaly: bool
