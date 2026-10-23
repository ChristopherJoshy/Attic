"""Operational audit mixins for SAHAYI database access."""

from __future__ import annotations

from sqlalchemy import select

from db.models import OrchestrationLog, SignalRecord
from db.session import SessionLocal


class OpsGateway:
    """Operational audit database access methods."""

    async def log_decision(self, patient_id: int, session_id: str, trigger: str, decision: str) -> None:
        """Persist one orchestration decision.

        Args:
            patient_id: Patient identifier.
            session_id: Session UUID.
            trigger: Decision trigger label.
            decision: Rendered decision text.
        Returns:
            None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            session.add(OrchestrationLog(patient_id=patient_id, session_id=session_id, trigger=trigger, decision=decision))
            await session.commit()

    async def latest_signal(self, patient_id: int) -> SignalRecord | None:
        """Fetch the most recent signal for one patient.

        Args:
            patient_id: Patient identifier.
        Returns:
            Latest SignalRecord ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            result = await session.scalars(select(SignalRecord).where(SignalRecord.patient_id == patient_id).order_by(SignalRecord.created_at.desc()).limit(1))
            return result.first()
