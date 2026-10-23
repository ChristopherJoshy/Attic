"""Anomaly detection helpers for SAHAYI."""

from __future__ import annotations

import math


def detect_anomaly(values: list[float], latest_value: float, threshold: float) -> tuple[bool, float, float]:
    """Detect z-score anomalies against a patient baseline.

    Args:
        values: Historical values excluding or including the latest point.
        latest_value: Latest score to evaluate.
        threshold: Z-score threshold for anomaly.
    Returns:
        Tuple of `(is_anomaly, z_score, baseline_avg)`.
    Agent:
        Intelligence
    """

    if len(values) < 3:
        return False, 0.0, 0.0
    baseline_avg = sum(values) / len(values)
    variance = sum((value - baseline_avg) ** 2 for value in values) / len(values)
    std_dev = math.sqrt(variance) or 1.0
    z_score = (latest_value - baseline_avg) / std_dev
    return z_score > threshold, round(z_score, 3), round(baseline_avg, 3)
