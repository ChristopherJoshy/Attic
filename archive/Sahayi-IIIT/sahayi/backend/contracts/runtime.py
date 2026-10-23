"""Runtime dataclasses shared across SAHAYI backend agents."""

from __future__ import annotations

from dataclasses import dataclass

from contracts.clinical import DoctorReport, ExtractedSignal, HypothesisResult, ResearchInsight, RiskAssessment


@dataclass(slots=True)
class SafetyReview:
    """Safety review result for patient-facing responses.

    Args:
        verdict: SAFE or UNSAFE.
        confidence: Safety confidence score.
        flagged_claims: Unsupported or unsafe claims.
        safe_response: Fallback or approved response text.
    Returns:
        SafetyReview dataclass instance.
    Agent:
        SafetyAgent
    """

    verdict: str
    confidence: float
    flagged_claims: list[str]
    safe_response: str


@dataclass(slots=True)
class CompanionReply:
    """Patient-facing companion response output.

    Args:
        text: Malayalam response content.
        used_context: Evidence or history used for the reply.
    Returns:
        CompanionReply dataclass instance.
    Agent:
        MainCompanionAgent
    """

    text: str
    used_context: list[str]


@dataclass(slots=True)
class AlertDispatch:
    """Family alert dispatch output.

    Args:
        delivered: Whether the alert was sent successfully.
        channel: Delivery channel name.
        message: Final message content.
    Returns:
        AlertDispatch dataclass instance.
    Agent:
        FamilyAlertAgent
    """

    delivered: bool
    channel: str
    message: str


@dataclass(slots=True)
class TurnResult:
    """End-to-end orchestration output for one patient turn.

    Args:
        signal: Extracted signal output.
        risk: Risk assessment output.
        reply: Safe patient-facing reply.
        research: Optional research insight.
        hypothesis: Optional hypothesis output.
        doctor_report: Optional doctor-facing report.
    Returns:
        TurnResult dataclass instance.
    Agent:
        Orchestrator
    """

    signal: ExtractedSignal
    risk: RiskAssessment
    reply: CompanionReply
    research: ResearchInsight | None
    hypothesis: HypothesisResult | None
    doctor_report: DoctorReport | None
