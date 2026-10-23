import pytest

from anchor.checks import CheckResult, check_result
from anchor.state_machine import (
    RECOVERY_CLEAN_WINDOWS_REQUIRED,
    STATE_DEGRADED,
    STATE_DENIED,
    STATE_RECOVERING,
    STATE_TRUSTED,
    evaluate_window,
)


def _results(failures):
    """Build six results from a list of (name, confidence) failure specs."""
    failing = {name: conf for name, conf in failures}
    names = ["kinematic", "heading", "temporal", "altitude", "environmental", "solar"]
    out = []
    for name in names:
        if name in failing:
            out.append(
                CheckResult(name=name, passed=False, confidence=failing[name],
                            reason=f"{name} failed")
            )
        else:
            out.append(
                CheckResult(name=name, passed=True, confidence=0.5, reason="ok")
            )
    return out


def test_all_pass_trusted():
    verdict = evaluate_window(_results([]))
    assert verdict.state == STATE_TRUSTED
    assert verdict.failed_checks == ()


def test_single_low_confidence_failure_degrades_not_denies():
    """Exactly one weak check failing must land in DEGRADED, not DENIED."""
    verdict = evaluate_window(_results([("kinematic", 0.5)]))
    assert verdict.state == STATE_DEGRADED
    assert verdict.failed_checks == ("kinematic",)


def test_two_failures_deny_even_if_weak():
    verdict = evaluate_window(_results([("kinematic", 0.3), ("altitude", 0.4)]))
    assert verdict.state == STATE_DENIED
    assert set(verdict.failed_checks) == {"kinematic", "altitude"}


def test_single_high_confidence_failure_denies():
    verdict = evaluate_window(_results([("solar", 0.9)]))
    assert verdict.state == STATE_DENIED
    assert "solar" in verdict.explanation


def test_high_confidence_threshold_boundary():
    # Confidence exactly at the threshold counts as high.
    at_threshold = evaluate_window(_results([("heading", 0.7)]))
    assert at_threshold.state == STATE_DENIED
    just_below = evaluate_window(_results([("heading", 0.69)]))
    assert just_below.state == STATE_DEGRADED


def test_recovery_goes_through_recovering_not_straight_to_trusted():
    """DENIED + one clean fix MUST NOT jump to TRUSTED."""
    state = STATE_DENIED
    consecutive_clean = 0
    states_seen = []
    for _ in range(RECOVERY_CLEAN_WINDOWS_REQUIRED + 1):
        verdict = evaluate_window(_results([]), state, consecutive_clean)
        state = verdict.state
        if state == STATE_RECOVERING:
            consecutive_clean += 1
        states_seen.append(state)
    assert STATE_RECOVERING in states_seen, "must pass through RECOVERING"
    assert states_seen[0] == STATE_RECOVERING  # first clean window: not trusted
    assert states_seen[-1] == STATE_TRUSTED


def test_relapse_during_recovery_returns_to_denied():
    verdict = evaluate_window(
        _results([("temporal", 1.0)]), STATE_RECOVERING, 2
    )
    assert verdict.state == STATE_DENIED


def test_new_attack_while_recovering_restarts_cycle():
    """After relapse, clean windows must count from zero again."""
    state = STATE_DENIED
    clean = 0
    # One clean window, then a relapse, then clean windows again.
    v1 = evaluate_window(_results([]), state, clean)
    state, clean = v1.state, 1
    v2 = evaluate_window(_results([("kinematic", 0.8)]), state, clean)
    assert v2.state == STATE_DENIED
    v3 = evaluate_window(_results([]), v2.state, 0)
    assert v3.state == STATE_RECOVERING
    assert "1 of" in v3.explanation


def test_degraded_recovers_immediately_when_check_clears():
    """DEGRADED has no recovery hysteresis: one clean window is enough."""
    verdict = evaluate_window(_results([]), STATE_DEGRADED, 0)
    assert verdict.state == STATE_TRUSTED


def test_explanation_names_failing_check():
    verdict = evaluate_window(_results([("altitude", 0.5)]))
    assert verdict.explanation.startswith("altitude:")


def test_all_six_failing_denied_with_full_reason_chain():
    everything = [
        ("kinematic", 1.0),
        ("heading", 1.0),
        ("temporal", 1.0),
        ("altitude", 1.0),
        ("environmental", 1.0),
        ("solar", 1.0),
    ]
    verdict = evaluate_window(_results(everything))
    assert verdict.state == STATE_DENIED
    assert len(verdict.failed_checks) == 6
