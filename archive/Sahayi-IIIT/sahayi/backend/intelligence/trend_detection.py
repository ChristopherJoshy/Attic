"""Trend detection helpers for SAHAYI."""

from __future__ import annotations


def detect_trend(current_week_count: int, previous_week_count: int) -> tuple[str, int]:
    """Classify the weekly symptom trend.

    Args:
        current_week_count: Count in the current week.
        previous_week_count: Count in the previous week.
    Returns:
        Tuple of trend label and raw delta.
    Agent:
        Intelligence
    """

    delta = current_week_count - previous_week_count
    if delta > 0:
        return "WORSENING", delta
    if delta < 0:
        return "IMPROVING", delta
    return "STABLE", delta
