"""Shared result type for the six physics checks."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CheckResult:
    """Outcome of a single physics check.

    `reason` is written for humans (eventually an on-device explanation
    layer), so it names quantities and thresholds, not internal state.
    """

    name: str
    passed: bool
    confidence: float  # 0..1; how sure the check is about its own verdict
    reason: str


def check_result(
    name: str,
    passed: bool,
    confidence: float,
    reason: str,
) -> CheckResult:
    return CheckResult(name=name, passed=passed, confidence=confidence, reason=reason)
