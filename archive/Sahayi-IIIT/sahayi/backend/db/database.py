"""Stable database gateway import surface for SAHAYI."""

from db.clinical_gateway import ClinicalGateway
from db.ops_gateway import OpsGateway
from db.patient_gateway import PatientGateway
from db.session import SessionLocal, engine, init_db


class DatabaseGateway(PatientGateway, ClinicalGateway, OpsGateway):
    """Single gateway for all SQLite access.

    Args:
        None: Combines patient, clinical, and operational query mixins.
    Returns:
        DatabaseGateway instance.
    Agent:
        Database
    """


__all__ = ["DatabaseGateway", "SessionLocal", "engine", "init_db"]
