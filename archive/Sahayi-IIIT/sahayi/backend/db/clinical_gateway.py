"""Clinical record query mixins for SAHAYI database access."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import desc, select

from db.models import CallSession, DoctorSummary, Patient, PopulationPattern, SignalRecord
from db.session import SessionLocal


class ClinicalGateway:
    """Clinical record database access methods."""

    async def create_call_session(self, patient_id: int, session_id: str) -> CallSession:
        """Create a new voice or message session.

        Args:
            patient_id: Patient identifier.
            session_id: Session UUID.
        Returns:
            Persisted CallSession ORM object.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            record = CallSession(patient_id=patient_id, session_id=session_id)
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record

    async def finalize_call_session(self, session_id: str, risk_score: float, status: str) -> None:
        """Close a session and store its final risk.

        Args:
            session_id: Session UUID.
            risk_score: Final risk score for the session.
            status: Final session status string.
        Returns:
            None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            record = await session.scalar(select(CallSession).where(CallSession.session_id == session_id))
            if record:
                record.ended_at = datetime.utcnow()
                record.risk_score = risk_score
                record.status = status
                await session.commit()

    async def save_signal(self, payload: dict) -> SignalRecord:
        """Persist one extracted signal record.

        Args:
            payload: ORM-ready signal payload.
        Returns:
            Persisted SignalRecord ORM object.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            record = SignalRecord(**payload)
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record

    async def recent_signals(self, patient_id: int, days: int = 14) -> list[SignalRecord]:
        """Fetch recent signals for one patient.

        Args:
            patient_id: Patient identifier.
            days: Lookback window in days.
        Returns:
            List of SignalRecord ORM objects.
        Agent:
            Database
        """

        cutoff = datetime.utcnow() - timedelta(days=days)
        async with SessionLocal() as session:
            rows = await session.scalars(select(SignalRecord).where(SignalRecord.patient_id == patient_id, SignalRecord.created_at >= cutoff).order_by(SignalRecord.created_at))
            return list(rows)

    async def all_recent_signals(self, days: int = 7) -> list[SignalRecord]:
        """Fetch all recent signals for population analysis.

        Args:
            days: Lookback window in days.
        Returns:
            List of SignalRecord ORM objects.
        Agent:
            Database
        """

        cutoff = datetime.utcnow() - timedelta(days=days)
        async with SessionLocal() as session:
            rows = await session.scalars(select(SignalRecord).where(SignalRecord.created_at >= cutoff))
            return list(rows)

    async def create_summary(self, payload: dict) -> DoctorSummary:
        """Persist a doctor summary.

        Args:
            payload: ORM-ready summary payload.
        Returns:
            Persisted DoctorSummary ORM object.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            summary = DoctorSummary(**payload)
            session.add(summary)
            await session.commit()
            await session.refresh(summary)
            return summary

    async def acknowledge_summary(self, summary_id: int, doctor_uid: str) -> DoctorSummary | None:
        """Acknowledge a doctor summary owned by a doctor.

        Args:
            summary_id: Summary identifier.
            doctor_uid: Owning doctor UID.
        Returns:
            Updated DoctorSummary ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            summary = await session.scalar(select(DoctorSummary).join(Patient, Patient.id == DoctorSummary.patient_id).where(DoctorSummary.id == summary_id, Patient.doctor_uid == doctor_uid))
            if not summary:
                return None
            summary.acknowledged = True
            await session.commit()
            await session.refresh(summary)
            return summary

    async def latest_unacknowledged(self) -> list[tuple[DoctorSummary, Patient]]:
        """Fetch unacknowledged summaries with patient context.

        Args:
            None: Uses database ordering and join conditions.
        Returns:
            List of `(DoctorSummary, Patient)` tuples.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            rows = await session.execute(select(DoctorSummary, Patient).join(Patient, Patient.id == DoctorSummary.patient_id).where(DoctorSummary.acknowledged.is_(False)))
            return list(rows.all())

    async def save_population_pattern(self, payload: dict) -> PopulationPattern:
        """Persist one population pattern.

        Args:
            payload: ORM-ready population pattern payload.
        Returns:
            Persisted PopulationPattern ORM object.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            pattern = PopulationPattern(**payload)
            session.add(pattern)
            await session.commit()
            await session.refresh(pattern)
            return pattern

    async def latest_population_patterns(self) -> list[PopulationPattern]:
        """Fetch the latest saved population patterns.

        Args:
            None: Uses database ordering.
        Returns:
            List of PopulationPattern ORM objects.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            rows = await session.scalars(select(PopulationPattern).order_by(desc(PopulationPattern.created_at)).limit(10))
            return list(rows)

    async def latest_patient_summary(self, patient_id: int):
        """Fetch the most recent summary for one patient."""
        async with SessionLocal() as session:
            result = await session.scalars(select(DoctorSummary).where(DoctorSummary.patient_id == patient_id).order_by(desc(DoctorSummary.created_at)).limit(1))
            return result.first()
