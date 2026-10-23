"""Patient and session query mixins for SAHAYI database access."""

from __future__ import annotations

from sqlalchemy import delete, desc, select

from db.models import CallSession, DoctorSummary, OrchestrationLog, Patient, SignalRecord
from db.session import SessionLocal
from utils.logger import get_logger
from utils.validators import phone_lookup_variants


logger = get_logger("sahayi.db.patients")


class PatientGateway:
    """Patient-centric database access methods."""

    async def create_patient(self, payload: dict) -> Patient:
        """Create a patient record.

        Args:
            payload: ORM-ready patient data payload.
        Returns:
            Persisted Patient ORM object.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            patient = Patient(**payload)
            session.add(patient)
            await session.commit()
            await session.refresh(patient)
            return patient

    async def update_patient(self, patient_id: int, doctor_uid: str, updates: dict) -> Patient | None:
        """Update one doctor-owned patient record.

        Args:
            patient_id: Patient identifier.
            doctor_uid: Owning doctor UID.
            updates: Partial update payload.
        Returns:
            Updated Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            patient = await session.scalar(select(Patient).where(Patient.id == patient_id, Patient.doctor_uid == doctor_uid))
            if not patient:
                return None
            for key, value in updates.items():
                setattr(patient, key, value)
            await session.commit()
            await session.refresh(patient)
            return patient

    async def get_patient(self, patient_id: int, doctor_uid: str) -> Patient | None:
        """Fetch one doctor-owned patient.

        Args:
            patient_id: Patient identifier.
            doctor_uid: Owning doctor UID.
        Returns:
            Matching Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            return await session.scalar(select(Patient).where(Patient.id == patient_id, Patient.doctor_uid == doctor_uid))

    async def get_patient_by_phone(self, phone_number: str) -> Patient | None:
        """Find a patient by registered caller phone number.

        Args:
            phone_number: Normalized patient phone number.
        Returns:
            Matching Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            variants = phone_lookup_variants(phone_number)
            return await session.scalar(select(Patient).where(Patient.phone_number.in_(variants)))

    async def get_patient_by_whatsapp(self, phone_number: str) -> Patient | None:
        """Find a patient by their or their relative's WhatsApp number.

        Args:
            phone_number: Normalized WhatsApp phone number (without whatsapp: prefix).
        Returns:
            Matching Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            variants = phone_lookup_variants(phone_number)
            whatsapp_variants = tuple(f"whatsapp:{v}" for v in variants)
            
            # Check primary phone number
            patient = await session.scalar(select(Patient).where(Patient.phone_number.in_(variants)))
            if patient:
                return patient
                
            # Fallback to checking relatives array in Python (safe for SQLite/small datasets)
            patients = await session.scalars(select(Patient))
            for p in patients:
                for rel in p.relatives or []:
                    rel_phone = rel.get("phone")
                    rel_wa = rel.get("whatsapp_number")
                    if rel_wa in whatsapp_variants or rel_wa in variants or rel_phone in variants:
                        return p
            
            return None

    async def get_patient_by_registration(self, reg_number: str) -> Patient | None:
        """Find a patient by doctor-assigned registration number.

        Args:
            reg_number: Registration number string.
        Returns:
            Matching Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            return await session.scalar(select(Patient).where(Patient.registration_number == reg_number))

    async def get_patient_by_id(self, patient_id: int) -> Patient | None:
        """Fetch one patient by primary key (internal use, no doctor scope).

        Args:
            patient_id: Patient identifier.
        Returns:
            Matching Patient ORM object or None.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            return await session.scalar(select(Patient).where(Patient.id == patient_id))

    async def list_patients(self, doctor_uid: str) -> list[Patient]:
        """List patients owned by one doctor.

        Args:
            doctor_uid: Owning doctor UID.
        Returns:
            List of Patient ORM objects.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            rows = await session.scalars(select(Patient).where(Patient.doctor_uid == doctor_uid).order_by(desc(Patient.created_at)))
            return list(rows)

    async def delete_patient(self, patient_id: int, doctor_uid: str) -> bool:
        """Delete one doctor-owned patient and their related records.

        Args:
            patient_id: Patient identifier.
            doctor_uid: Owning doctor UID.
        Returns:
            True if deleted, False if not found.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            # First verify the patient exists and belongs to the doctor
            patient = await session.scalar(select(Patient).where(Patient.id == patient_id, Patient.doctor_uid == doctor_uid))
            if not patient:
                return False
            
            # Explicitly delete all related records to avoid foreign key issues and orphaned data
            # Order matters: dependent records first
            await session.execute(delete(SignalRecord).where(SignalRecord.patient_id == patient_id))
            await session.execute(delete(CallSession).where(CallSession.patient_id == patient_id))
            await session.execute(delete(DoctorSummary).where(DoctorSummary.patient_id == patient_id))
            await session.execute(delete(OrchestrationLog).where(OrchestrationLog.patient_id == patient_id))
            
            # Finally delete the patient record
            await session.delete(patient)
            await session.commit()
            return True

    async def patient_signals(self, patient_id: int, doctor_uid: str) -> list[SignalRecord]:
        """Fetch all signal records for one doctor-owned patient.

        Args:
            patient_id: Patient identifier.
            doctor_uid: Owning doctor UID.
        Returns:
            List of SignalRecord ORM objects.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            rows = await session.scalars(
                select(SignalRecord).join(Patient, Patient.id == SignalRecord.patient_id).where(Patient.id == patient_id, Patient.doctor_uid == doctor_uid).order_by(desc(SignalRecord.created_at))
            )
            return list(rows)

    async def patient_call_history(self, patient_id: int, doctor_uid: str) -> list[CallSession]:
        """Fetch call history for one doctor-owned patient.

        Args:
            patient_id: Patient identifier.
            doctor_uid: Owning doctor UID.
        Returns:
            List of CallSession ORM objects.
        Agent:
            Database
        """

        async with SessionLocal() as session:
            rows = await session.scalars(
                select(CallSession).join(Patient, Patient.id == CallSession.patient_id).where(Patient.id == patient_id, Patient.doctor_uid == doctor_uid).order_by(desc(CallSession.started_at))
            )
            return list(rows)
