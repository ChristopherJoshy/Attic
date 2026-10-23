"""Evidence-grounding review helpers for SAHAYI summaries."""

from __future__ import annotations

from typing import Any


def review_summary(summary_text: str, evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """Review a doctor summary against the evidence used.

    Args:
        summary_text: Doctor-facing summary text.
        evidence: Supporting evidence list used to build the summary.
    Returns:
        Confidence, alternatives, and evidence grounding scores.
    Agent:
        Intelligence
    """

    lowered = summary_text.lower()
    matched = sum(1 for item in evidence if str(item).lower()[:32] in lowered)
    grounding_score = round(matched / max(len(evidence), 1), 3)
    confidence = round(min(0.55 + grounding_score * 0.4, 0.98), 3)
    alternatives = ["Review medication adherence", "Compare with last week symptom mentions"]
    return {"confidence": confidence, "alternatives": alternatives, "evidence_grounding_score": grounding_score}
