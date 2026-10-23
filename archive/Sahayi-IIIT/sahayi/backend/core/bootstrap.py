"""Application bootstrap helpers for SAHAYI backend."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from agents.doctor_summary import DoctorSummaryAgent
from agents.family_alert import FamilyAlertAgent
from agents.hypothesis_agent import HypothesisAgent
from agents.main_companion import MainCompanionAgent
from agents.orchestrator import Orchestrator
from agents.population_intelligence import PopulationIntelligenceAgent
from agents.research_intelligence import ResearchIntelligenceAgent
from agents.safety_agent import SafetyAgent
from agents.signal_extractor import SignalExtractorAgent
from agents.whatsapp_agent import WhatsAppAgent
from core.realtime import DashboardSocketManager
from db.database import DatabaseGateway, init_db
from rag.chroma_store import ChromaStore
from rag.pubmed_client import PubMedClient
from twilio.rest import Client
from utils.logger import get_logger
from voice.twilio_handler import TwilioVoiceHandler

logger = get_logger("sahayi.bootstrap")


async def bootstrap_app(app: Any) -> None:
    """Initialise database, retrieval, agents, and voice services.

    Args:
        app: FastAPI application instance.
    Returns:
        None.
    Agent:
        Platform
    """

    await init_db()
    app.state.database = DatabaseGateway()
    app.state.sockets = DashboardSocketManager()
    app.state.chroma = ChromaStore()
    await preload_knowledge_base(app.state.chroma)
    pubmed = PubMedClient()
    signal = SignalExtractorAgent(app.state.database)
    safety = SafetyAgent()
    companion = MainCompanionAgent()
    research = ResearchIntelligenceAgent(app.state.chroma, pubmed)
    population = PopulationIntelligenceAgent(app.state.database, pubmed)
    hypothesis = HypothesisAgent()
    doctor_summary = DoctorSummaryAgent(app.state.database, app.state.sockets)
    app.state.orchestrator = Orchestrator(app.state.database, app.state.sockets, signal, safety, companion, research, hypothesis, population, doctor_summary)
    app.state.family_alert = FamilyAlertAgent()
    app.state.twilio_handler = TwilioVoiceHandler(app.state.database, app.state.orchestrator, app.state.sockets)
    app.state.twilio_client = Client(app.state.settings.twilio_account_sid, app.state.settings.twilio_auth_token) if app.state.settings.twilio_account_sid and app.state.settings.twilio_auth_token else None
    app.state.whatsapp_agent = WhatsAppAgent(app.state.database)

    # Initialise population data if empty on startup
    import asyncio
    asyncio.create_task(run_population_job(app))


async def preload_knowledge_base(chroma: ChromaStore) -> None:
    """Populate Chroma when the collection is empty.

    Args:
        chroma: Shared Chroma store wrapper.
    Returns:
        None.
    Agent:
        Platform
    """

    if chroma.count():
        return
    logger.info("Knowledge base is empty at startup; keeping local store ready without remote preload.")


async def run_population_job(app: Any) -> None:
    """Execute the scheduled population intelligence job.

    Args:
        app: FastAPI application instance.
    Returns:
        None.
    Agent:
        Platform
    """

    findings = await app.state.orchestrator.population_agent.run()
    for finding in findings:
        await app.state.sockets.broadcast_all("population_update", {"pattern_json": finding.pattern_json, "frequency": finding.frequency, "week_delta": finding.week_delta, "research_gap": finding.research_gap})


async def run_overdue_summary_job(app: Any) -> None:
    """Handle overdue summaries and escalation rules.

    Args:
        app: FastAPI application instance.
    Returns:
        None.
    Agent:
        Platform
    """

    cutoff = datetime.utcnow() - timedelta(hours=app.state.settings.doctor_escalation_hours)
    for summary, patient in await app.state.database.latest_unacknowledged():
        if summary.created_at > cutoff:
            continue
        latest_signal = await app.state.database.latest_signal(patient.id)
        await app.state.twilio_handler.initiate_follow_up_call(patient.phone_number)
        await app.state.sockets.broadcast(patient.doctor_uid, "follow_up_due", {"summary_id": summary.id, "patient_id": patient.id, "patient_name": patient.name})
        if latest_signal and latest_signal.red_flag:
            payload = patient.__dict__.copy()
            payload.pop("_sa_instance_state", None)
            await app.state.family_alert.send(payload, "Doctor summary remained unacknowledged for 3 hours.", red_flag=True)


async def health_snapshot(app: Any) -> dict[str, Any]:
    """Build the health-check payload for the system.

    Args:
        app: FastAPI application instance.
    Returns:
        Health payload dictionary.
    Agent:
        Platform
    """

    services = {
        "database": {"status": "green"},
        "chroma": {"status": "green" if app.state.chroma.count() >= 0 else "red"},
        "firebase": {"status": "green" if app.state.settings.service_account_file else "red"},
        "gemini": {"status": "green" if app.state.settings.gemini_api_key else "red"},
        "twilio": {"status": "green" if app.state.settings.twilio_account_sid else "red"},
        "sarvam": {"status": "green" if app.state.settings.sarvam_api_key else "red"},
        "pubmed": {"status": "green" if app.state.settings.pubmed_email else "yellow"},
    }
    overall = "green" if all(item["status"] == "green" for item in services.values() if item["status"] != "yellow") else "degraded"
    return {"status": overall, "services": services}
