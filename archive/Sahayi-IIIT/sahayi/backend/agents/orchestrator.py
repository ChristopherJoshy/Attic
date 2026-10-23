# ============================================
# AGENT: Orchestrator
# ROLE: Route each patient turn through extraction, intelligence, safety, and escalation
# TRIGGERS: Every patient transcript or WhatsApp message
# OUTPUTS: TurnResult dataclass plus realtime dashboard updates
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import asdict

from contracts.agents import CompanionReply, PopulationFinding, TurnResult
from core.config import get_settings
from core.realtime import DashboardSocketManager
from db.database import DatabaseGateway
from intelligence.anomaly_detection import detect_anomaly
from intelligence.risk_scoring import compute_risk
from intelligence.trend_detection import detect_trend
from utils.logger import get_logger


class Orchestrator:
    """Central routing agent for SAHAYI patient turns."""

    def __init__(self, database: DatabaseGateway, sockets: DashboardSocketManager, signal_extractor: object, safety_agent: object, companion_agent: object, research_agent: object, hypothesis_agent: object, population_agent: object, doctor_summary_agent: object) -> None:
        """Initialise orchestrator dependencies.

        Args:
            database: Shared database gateway instance.
            sockets: Shared dashboard socket manager.
            signal_extractor: Signal extractor agent instance.
            safety_agent: Safety agent instance.
            companion_agent: Main companion agent instance.
            research_agent: Research intelligence agent instance.
            hypothesis_agent: Hypothesis agent instance.
            population_agent: Population intelligence agent instance.
            doctor_summary_agent: Doctor summary agent instance.
        Returns:
            None.
        Agent:
            Orchestrator
        """

        self.database = database
        self.sockets = sockets
        self.signal_extractor = signal_extractor
        self.safety_agent = safety_agent
        self.companion_agent = companion_agent
        self.research_agent = research_agent
        self.hypothesis_agent = hypothesis_agent
        self.population_agent = population_agent
        self.doctor_summary_agent = doctor_summary_agent
        self.logger = get_logger("sahayi.orchestrator")
        self.session_history: dict[str, list[str]] = defaultdict(list)
        self.session_risks: dict[str, float] = {}

    async def handle_turn(self, patient: dict, session_id: str, transcript: str) -> TurnResult:
        """Process one patient turn end-to-end.

        Runs signal extraction and companion reply concurrently so the
        patient hears a response faster.  Downstream risk-based agents
        (research, hypothesis, doctor summary) also run in parallel where
        their data dependencies allow.

        Args:
            patient: Patient profile dictionary.
            session_id: Active session UUID.
            transcript: Latest transcript or message text.
        Returns:
            Typed turn result.
        Agent:
            Orchestrator
        """

        self.logger.info("Orchestrator activated | patient_id=%s | session_id=%s | trigger=patient_turn", patient["id"], session_id)
        self.session_history[session_id].append(f"patient:{transcript}")

        # Risk scoring needs the signal, so it runs after extraction.
        # Run signal extraction and companion reply simultaneously —
        # neither depends on the other's output.
        # To make voice snappy, we will await ONLY the companion agent now,
        # and fire the rest in the background!
        
        reply_task = self.companion_agent.respond(patient, self.session_history[session_id], transcript)
        reply = await reply_task
        
        # Safety review runs immediately — risk-based routing (research,
        # hypothesis, doctor summary) is fired off in the background so
        # the patient hears a reply without waiting for PubMed / extra LLM calls.
        safety = await self.safety_agent.review(reply.text, [])
        await self.sockets.broadcast(patient["doctor_uid"], "safety_check", {"session_id": session_id, "patient_id": patient["id"], "safe_response": safety.safe_response})

        safe_reply = CompanionReply(text=safety.safe_response, used_context=reply.used_context)
        self.session_history[session_id].append(f"assistant:{safe_reply.text}")

        # Kick off downstream intelligence in the background — results
        # flow to the dashboard via sockets and to the database log.
        asyncio.create_task(
            self._background_processing(patient, session_id, transcript, safe_reply)
        )

        # Return dummy turn result (signal and risk will be computed in bg)
        # TurnResult is primarily consumed for reply text
        return TurnResult(signal=None, risk=None, reply=safe_reply, research=None, hypothesis=None, doctor_report=None)

    async def _background_processing(self, patient: dict, session_id: str, transcript: str, safe_reply: object) -> None:
        """Run extraction, risk, and downstream agents in the background."""
        try:
            signal = await self.signal_extractor.extract(patient["id"], session_id, transcript)
            history = await self.database.recent_signals(patient["id"], days=14)
            risk = self._calculate_risk(signal, history)
            self.session_risks[session_id] = risk.score
            await self._broadcast_basics(patient, session_id, signal, risk)
            
            await self._background_risk_routing(patient, session_id, signal, risk, history, safe_reply)
        except Exception:
            self.logger.exception("Background processing failed | session_id=%s", session_id)

    async def _background_risk_routing(self, patient: dict, session_id: str, signal: object, risk: object, history: list[object], reply: object) -> None:
        """Run risk-based downstream agents in the background.

        Results update the dashboard via sockets and are persisted to the
        database audit log.  This never blocks the voice reply.

        Args:
            patient: Patient profile dictionary.
            session_id: Active session UUID.
            signal: Latest extracted signal.
            risk: Latest risk assessment.
            history: Recent patient signal history.
            reply: The companion reply that was already sent.
        Returns:
            None.
        Agent:
            Orchestrator
        """

        try:
            research, hypothesis, report = await self._route_by_risk(patient, signal, risk, history)
            await self.database.log_decision(patient["id"], session_id, "patient_turn", self._decision_text(risk, report, hypothesis))
        except Exception:
            self.logger.exception("Background risk routing failed | session_id=%s", session_id)

    def _calculate_risk(self, signal: object, history: list[object]) -> object:
        """Calculate risk using trend and anomaly helpers.

        Args:
            signal: Latest extracted signal.
            history: Recent patient signal history.
        Returns:
            Typed risk assessment.
        Agent:
            Orchestrator
        """

        this_week = [item for item in history if (signal.created_at - item.created_at).days < 7]
        previous = [item for item in history if (signal.created_at - item.created_at).days >= 7]
        current_count = len(this_week)
        previous_count = len(previous)
        trend, _ = detect_trend(current_count, previous_count)
        anomaly, z_score, _ = detect_anomaly([item.severity for item in history[:-1]], signal.severity, get_settings().anomaly_z_score_threshold)
        return compute_risk(signal, current_count, previous_count, get_settings().risk_yellow_threshold, get_settings().risk_red_threshold, trend, z_score, anomaly)

    async def _broadcast_basics(self, patient: dict, session_id: str, signal: object, risk: object) -> None:
        """Broadcast baseline signal and risk updates to the dashboard.

        Args:
            patient: Patient profile dictionary.
            session_id: Active session UUID.
            signal: Latest extracted signal.
            risk: Latest risk assessment.
        Returns:
            None.
        Agent:
            Orchestrator
        """

        await self.sockets.broadcast(patient["doctor_uid"], "new_signal", {"session_id": session_id, "patient_id": patient["id"], "patient_name": patient["name"], **asdict(signal)})
        await self.sockets.broadcast(patient["doctor_uid"], "risk_update", {"session_id": session_id, "patient_id": patient["id"], "patient_name": patient["name"], **asdict(risk)})

    async def _route_by_risk(self, patient: dict, signal: object, risk: object, history: list[object]) -> tuple[object | None, object | None, object | None]:
        """Route optional downstream agents based on risk thresholds.

        Runs independent agents concurrently where possible to minimise
        overall latency.

        Args:
            patient: Patient profile dictionary.
            signal: Latest extracted signal.
            risk: Latest risk assessment.
            history: Recent patient signal history.
        Returns:
            Tuple of optional research, hypothesis, and doctor report outputs.
        Agent:
            Orchestrator
        """

        # Research and population patterns are independent — fetch together.
        research_coro = self.research_agent.analyze(signal, self._serialize_history(history), patient) if risk.score > 0.3 else None
        patterns_coro = self.database.latest_population_patterns()

        if research_coro:
            research, patterns = await asyncio.gather(research_coro, patterns_coro)
        else:
            research = None
            patterns = await patterns_coro

        findings = [PopulationFinding(item.pattern_json, item.frequency, item.week_delta, item.research_gap) for item in patterns]

        # Hypothesis and doctor summary depend on research but not on
        # each other — run them simultaneously when both are needed.
        hypothesis = None
        report = None
        if research:
            need_hypothesis = risk.score > 0.5
            need_report = risk.score > 0.4
            if need_hypothesis and need_report:
                hypothesis, report = await asyncio.gather(
                    self.hypothesis_agent.generate(research, findings),
                    self.doctor_summary_agent.generate(patient, signal, risk, research, None),
                )
            elif need_hypothesis:
                hypothesis = await self.hypothesis_agent.generate(research, findings)
            elif need_report:
                report = await self.doctor_summary_agent.generate(patient, signal, risk, research, None)
                await self.sockets.broadcast(patient["doctor_uid"], "doctor_summary", {"session_id": session_id, "patient_id": patient["id"], **asdict(report)})

        if hypothesis:
            await self.sockets.broadcast(patient["doctor_uid"], "hypothesis_generated", {"patient_id": patient["id"], **asdict(hypothesis)})
        return research, hypothesis, report

    def _serialize_history(self, history: list[object]) -> list[dict]:
        """Serialize ORM signal history for downstream agents.

        Args:
            history: SignalRecord ORM instances.
        Returns:
            List of simple dictionaries.
        Agent:
            Orchestrator
        """

        return [
            {
                "fatigue": item.fatigue,
                "appetite": item.appetite,
                "chest_pain": item.chest_pain,
                "duration_days": item.duration_days,
                "severity": item.severity,
                "red_flag": item.red_flag,
                "created_at": item.created_at.isoformat(),
            }
            for item in history
        ]

    def _decision_text(self, risk: object, report: object | None, hypothesis: object | None) -> str:
        """Render the audit log decision text.

        Args:
            risk: Latest risk assessment.
            report: Optional doctor report.
            hypothesis: Optional hypothesis result.
        Returns:
            Rendered decision text.
        Agent:
            Orchestrator
        """

        return f"risk={risk.score}; summary={'yes' if report else 'no'}; hypothesis={'yes' if hypothesis else 'no'}"
