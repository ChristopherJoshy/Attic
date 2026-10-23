"""State machine: six check votes in, one verdict out.

Verdicts, most to least severe:
    DENIED      - GNSS position untrustworthy; act as if location is hostile
    RECOVERING  - was DENIED, currently seeing clean evidence, not yet enough
                  of it to trust again
    DEGRADED    - one weak signal of trouble; keep watching closely
    TRUSTED     - physics agrees with GNSS

The rules are a literal table so a reviewer can trace any verdict by reading.
"""

from dataclasses import dataclass

from .checks import CheckResult


@dataclass(frozen=True)
class Verdict:
    state: str  # one of STATE_TRUSTED / DEGRADED / DENIED / RECOVERING
    failed_checks: tuple[str, ...]
    explanation: str


STATE_TRUSTED = "TRUSTED"
STATE_DEGRADED = "DEGRADED"
STATE_DENIED = "DENIED"
STATE_RECOVERING = "RECOVERING"

# High-confidence single failure is enough to deny: a check that is very sure
# about a physical contradiction should not need company. Low-confidence
# failures are ambiguous (sensor gaps, borderline thresholds), so they only
# degrade.
HIGH_CONFIDENCE_THRESHOLD = 0.7

# Recovery requires this many consecutive clean windows. One clean window
# after a spoof could be the spoofer pausing between attacks; several in a row
# make that unlikely without making recovery uselessly slow at ~1 Hz fixes.
RECOVERY_CLEAN_WINDOWS_REQUIRED = 5


def evaluate_window(
    results: list[CheckResult],
    previous_state: str = STATE_TRUSTED,
    consecutive_clean_windows: int = 0,
) -> Verdict:
    """Apply the verdict table to one analysis window.

    `consecutive_clean_windows` counts how many windows before this one were
    already clean while in RECOVERING; the caller carries it across windows.
    """
    failures = [r for r in results if not r.passed]
    failed_names = tuple(r.name for r in failures)
    high_confidence_failures = [r for r in failures if r.confidence >= HIGH_CONFIDENCE_THRESHOLD]

    # --- transitions out of DENIED ------------------------------------
    if previous_state == STATE_DENIED:
        if not failures:
            if consecutive_clean_windows + 1 >= RECOVERY_CLEAN_WINDOWS_REQUIRED:
                return Verdict(
                    STATE_TRUSTED,
                    failed_names,
                    f"recovered after {consecutive_clean_windows + 1} consecutive "
                    "clean windows",
                )
            return Verdict(
                STATE_RECOVERING,
                failed_names,
                f"clean window {consecutive_clean_windows + 1} of "
                f"{RECOVERY_CLEAN_WINDOWS_REQUIRED} required for recovery",
            )
        return Verdict(
            STATE_DENIED,
            failed_names,
            _explain(failures, still_denied=True),
        )

    # --- transitions out of RECOVERING ---------------------------------
    if previous_state == STATE_RECOVERING:
        if not failures:
            if consecutive_clean_windows + 1 >= RECOVERY_CLEAN_WINDOWS_REQUIRED:
                return Verdict(
                    STATE_TRUSTED,
                    failed_names,
                    f"recovered after {consecutive_clean_windows + 1} consecutive "
                    "clean windows",
                )
            return Verdict(
                STATE_RECOVERING,
                failed_names,
                f"clean window {consecutive_clean_windows + 1} of "
                f"{RECOVERY_CLEAN_WINDOWS_REQUIRED} required for recovery",
            )
        return Verdict(
            STATE_DENIED,
            failed_names,
            "relapse during recovery: " + _explain(failures),
        )

    # --- fresh evaluation from TRUSTED / DEGRADED ----------------------
    if len(failures) >= 2:
        return Verdict(
            STATE_DENIED,
            failed_names,
            _explain(failures) + " - multiple independent physics checks disagree "
            "with the reported position",
        )
    if len(high_confidence_failures) >= 1:
        failure = high_confidence_failures[0]
        return Verdict(
            STATE_DENIED,
            failed_names,
            f"{failure.name}: {failure.reason}",
        )
    if len(failures) == 1:
        failure = failures[0]
        return Verdict(
            STATE_DEGRADED,
            failed_names,
            f"{failure.name}: {failure.reason}",
        )
    return Verdict(STATE_TRUSTED, (), "all physics checks passed")


def _explain(failures: list[CheckResult], still_denied: bool = False) -> str:
    prefix = "still denied - " if still_denied else ""
    joined = "; ".join(f"{f.name}: {f.reason}" for f in failures)
    return prefix + joined


def advance_state(previous_state: str, verdict_state: str) -> str:
    """Fold a verdict into the running state.

    Kept separate from evaluate_window so callers that already track state can
    reuse the transition rule verbatim; DENIED never jumps straight to TRUSTED
    because the verdict table routes every post-DENIED clean window through
    RECOVERING first.
    """
    return verdict_state
