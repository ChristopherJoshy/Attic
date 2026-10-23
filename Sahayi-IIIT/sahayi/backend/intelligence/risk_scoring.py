"""Risk scoring utilities for SAHAYI."""

from __future__ import annotations

from contracts.agents import ExtractedSignal, RiskAssessment


def normalize_duration(duration_days: int) -> float:
    """Normalize symptom duration to a 0-1 scale.

    Args:
        duration_days: Symptom duration in days.
    Returns:
        Duration normalized with a 14-day cap.
    Agent:
        Intelligence
    """

    return min(duration_days / 14.0, 1.0)


def calculate_change_rate(this_week_mentions: int, last_week_mentions: int) -> float:
    """Calculate mention growth for the risk formula.

    Args:
        this_week_mentions: Current-week symptom mentions.
        last_week_mentions: Previous-week symptom mentions.
    Returns:
        Change-rate component capped to 1.0.
    Agent:
        Intelligence
    """

    return min(this_week_mentions / max(last_week_mentions, 1), 1.0)


def compute_risk(signal: ExtractedSignal, this_week_mentions: int, last_week_mentions: int, yellow: float, red: float, trend: str, z_score: float, is_anomaly: bool) -> RiskAssessment:
    """Compute the required SAHAYI risk score.

    Args:
        signal: Extracted patient signal.
        this_week_mentions: Current-week symptom mentions.
        last_week_mentions: Previous-week symptom mentions.
        yellow: Yellow threshold.
        red: Red threshold.
        trend: Trend label from trend detection.
        z_score: Baseline anomaly z-score.
        is_anomaly: Whether anomaly detection fired.
    Returns:
        Typed risk assessment output.
    Agent:
        Intelligence
    """

    duration_normalized = normalize_duration(signal.duration_days)
    change_rate = calculate_change_rate(this_week_mentions, last_week_mentions)
    # Formula: (severity*0.4) + (duration_normalized*0.3) + (change_rate*0.3)
    severity_component = (signal.severity / 5.0) * 0.4
    duration_component = duration_normalized * 0.3
    change_component = change_rate * 0.3
    score = round(severity_component + duration_component + change_component, 3)
    status = "red" if score >= red or signal.red_flag else "yellow" if score >= yellow else "green"
    breakdown = {
        "severity_component": round(severity_component, 3),
        "duration_component": round(duration_component, 3),
        "change_component": round(change_component, 3),
    }
    return RiskAssessment(score=score, breakdown=breakdown, status=status, trend=trend, z_score=round(z_score, 3), is_anomaly=is_anomaly)
