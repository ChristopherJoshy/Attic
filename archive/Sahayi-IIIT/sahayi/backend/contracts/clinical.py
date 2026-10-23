"""Clinical dataclasses shared across SAHAYI backend agents."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class ExtractedSignal:
    """Structured patient signal output.

    Args:
        patient_id: Database patient identifier.
        session_id: Voice or WhatsApp session UUID.
        fatigue: Whether fatigue was mentioned.
        appetite: Appetite change summary.
        chest_pain: Whether chest pain was mentioned.
        duration_days: Duration of symptoms in days.
        severity: Symptom severity on a 1-5 scale.
        red_flag: Whether the turn contains urgent risk markers.
        source_text: Transcript or WhatsApp text that produced the record.
        confidence: Extraction confidence from the agent.
        created_at: UTC timestamp for the extraction.
    Returns:
        ExtractedSignal dataclass instance.
    Agent:
        SignalExtractorAgent
    """

    patient_id: int
    session_id: str
    fatigue: bool
    appetite: str
    chest_pain: bool
    duration_days: int
    severity: int
    red_flag: bool
    symptom_description: str
    source_text: str
    confidence: float
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(slots=True)
class RiskAssessment:
    """Calculated patient risk output.

    Args:
        score: Numeric risk score in the 0-1+ range.
        breakdown: Formula breakdown for UI and summary rendering.
        status: Green/yellow/red status label.
        trend: Symptom trend label.
        z_score: Anomaly z-score against patient baseline.
        is_anomaly: Whether the z-score crossed the threshold.
    Returns:
        RiskAssessment dataclass instance.
    Agent:
        Orchestrator
    """

    score: float
    breakdown: dict[str, float]
    status: str
    trend: str
    z_score: float
    is_anomaly: bool


@dataclass(slots=True)
class ResearchInsight:
    """Research synthesis output for clinicians.

    Args:
        narrative: Plain-English observational insight.
        rag_chunks: Retrieved knowledge-base chunks.
        citations: PubMed citations used for grounding.
        graph: Knowledge-graph payload for the dashboard.
    Returns:
        ResearchInsight dataclass instance.
    Agent:
        ResearchIntelligenceAgent
    """

    narrative: str
    rag_chunks: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    graph: dict[str, Any]


@dataclass(slots=True)
class HypothesisResult:
    """Testable clinical hypothesis output.

    Args:
        statement: One specific testable hypothesis.
        confidence: Low, Medium, or High.
        confirming_data: Data that would support the hypothesis.
        refuting_data: Data that would weaken the hypothesis.
    Returns:
        HypothesisResult dataclass instance.
    Agent:
        HypothesisAgent
    """

    statement: str
    confidence: str
    confirming_data: list[str]
    refuting_data: list[str]


@dataclass(slots=True)
class PopulationFinding:
    """Population intelligence pattern output.

    Args:
        pattern_json: Clustered symptom pattern payload.
        frequency: Count of matching records.
        week_delta: Week-over-week change in frequency.
        research_gap: Whether supporting literature is sparse.
    Returns:
        PopulationFinding dataclass instance.
    Agent:
        PopulationIntelligenceAgent
    """

    pattern_json: dict[str, Any]
    frequency: int
    week_delta: int
    research_gap: bool


@dataclass(slots=True)
class DoctorReport:
    """Doctor-facing structured summary output.

    Args:
        summary_text: Rendered English summary.
        risk_score: Numeric risk score.
        rag_context: RAG context payload used for grounding.
        hypothesis: Hypothesis payload if available.
        citations: PubMed citations used in the report.
        knowledge_graph: Graph payload for UI rendering.
        recommendation: Observational follow-up suggestion.
    Returns:
        DoctorReport dataclass instance.
    Agent:
        DoctorSummaryAgent
    """

    summary_text: str
    risk_score: float
    rag_context: list[dict[str, Any]]
    hypothesis: dict[str, Any]
    citations: list[dict[str, Any]]
    knowledge_graph: dict[str, Any]
    recommendation: str


@dataclass(slots=True)
class PrescriptionData:
    """Extracted prescription data from WhatsApp image.
    
    Args:
        medicines: List of medicine names.
        doses: List of doses (e.g., '500mg', '10ml').
        timings: List of timings (e.g., 'morning', 'night', 'after food').
        purposes: List of purposes/indications.
        raw_text: Raw text extracted from the prescription image.
        confidence: Extraction confidence score.
    Returns:
        PrescriptionData dataclass instance.
    Agent:
        WhatsApp Vision
    """
    
    medicines: list[str]
    doses: list[str]
    timings: list[str]
    purposes: list[str]
    raw_text: str
    confidence: float
