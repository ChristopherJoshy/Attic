# ============================================
# AGENT: DoctorSummaryAgent
# ROLE: Build structured clinician reports and publish them to the dashboard
# TRIGGERS: Risk score above summary threshold in the orchestrator
# OUTPUTS: DoctorReport dataclass persisted to SQLite and broadcast by WebSocket
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

from dataclasses import asdict

from contracts.agents import DoctorReport, ExtractedSignal, HypothesisResult, ResearchInsight, RiskAssessment
from core.realtime import DashboardSocketManager
from db.database import DatabaseGateway
from intelligence.self_reflection import review_summary
from utils.logger import get_logger


class DoctorSummaryAgent:
    """Agent that builds and publishes doctor-facing reports."""

    def __init__(self, database: DatabaseGateway, socket_manager: DashboardSocketManager) -> None:
        """Initialise the doctor summary dependencies.

        Args:
            database: Shared database gateway instance.
            socket_manager: Shared dashboard socket manager.
        Returns:
            None.
        Agent:
            DoctorSummaryAgent
        """

        self.database = database
        self.sockets = socket_manager
        self.logger = get_logger("sahayi.doctor_summary")

    async def generate(self, patient: dict, signal: ExtractedSignal, risk: RiskAssessment, research: ResearchInsight, hypothesis: HypothesisResult | None) -> DoctorReport:
        """Create, persist, and publish one structured doctor report.

        Args:
            patient: Patient profile dictionary.
            signal: Latest extracted signal.
            risk: Latest risk assessment.
            research: Research synthesis payload.
            hypothesis: Optional hypothesis payload.
        Returns:
            Typed doctor report.
        Agent:
            DoctorSummaryAgent
        """

        self.logger.info("Doctor summary activated | patient_id=%s | trigger=summary_threshold", patient.get("id"))
        summary = self._render_summary(signal, risk, research, hypothesis)
        report = DoctorReport(summary, risk.score, research.rag_chunks, asdict(hypothesis) if hypothesis else {}, research.citations, research.graph, "Review clinically and compare with recent symptom change.")
        reflection = review_summary(report.summary_text, report.citations + report.rag_context)
        stored = await self.database.create_summary(
            {"patient_id": patient["id"], "summary_text": report.summary_text, "risk_score": report.risk_score, "rag_context": report.rag_context, "hypothesis": report.hypothesis, "citations": report.citations, "knowledge_graph": report.knowledge_graph}
        )
        payload = {"summary_id": stored.id, "patient_id": patient["id"], "patient_name": patient["name"], "summary_text": report.summary_text, "risk_score": risk.score, "citations": report.citations, "knowledge_graph": report.knowledge_graph, "reflection": reflection}
        await self.sockets.broadcast(patient["doctor_uid"], "doctor_summary", payload)
        return report

    def _render_summary(self, signal: ExtractedSignal, risk: RiskAssessment, research: ResearchInsight, hypothesis: HypothesisResult | None) -> str:
        """Render the structured doctor summary format.

        Args:
            signal: Latest extracted signal.
            risk: Latest risk assessment.
            research: Research synthesis payload.
            hypothesis: Optional hypothesis payload.
        Returns:
            Structured English summary text.
        Agent:
            DoctorSummaryAgent
        """

        hypo_text = hypothesis.statement if hypothesis else "No hypothesis generated."
        return (
            f"SIGNALS\nFatigue={signal.fatigue}, Appetite={signal.appetite}, Chest Pain={signal.chest_pain}, Duration={signal.duration_days}d, Severity={signal.severity}\n\n"
            f"RISK SCORE\nScore={risk.score}, Breakdown={risk.breakdown}, Trend={risk.trend}\n\n"
            f"Z-SCORE\nZ={risk.z_score}, Anomaly={risk.is_anomaly}\n\n"
            f"RESEARCH EVIDENCE\n{research.narrative}\n\n"
            f"KNOWLEDGE GRAPH CONNECTIONS\nNodes={len(research.graph.get('nodes', []))}, Edges={len(research.graph.get('edges', []))}\n\n"
            f"HYPOTHESIS\n{hypo_text}\n\n"
            f"RECOMMENDATION\nObservational review recommended; correlate with adherence, vitals, and recent history."
        )
