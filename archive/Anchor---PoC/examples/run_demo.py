"""Run Anchor end-to-end: clean trace vs spoofed trace, side by side."""

import random
import sys

sys.path.insert(0, "src")

from anchor.fusion import fuse_checks
from anchor.simulate import (
    generate_legitimate_trace,
    inject_stationary_phone_moving_gps,
    inject_teleport,
)
from anchor.state_machine import RECOVERY_CLEAN_WINDOWS_REQUIRED, evaluate_window

WINDOW_FIXES = 30          # ~30 s of fixes per evaluation window
WINDOW_IMU = WINDOW_FIXES * 10


def run_pipeline(trace, movement_mode="driving"):
    """Slide a window over the trace and print the verdict sequence."""
    verdicts = []
    step_fixes = 15  # half-window stride so spoof boundaries can't hide
    for start in range(0, len(trace.fixes) - WINDOW_FIXES + 1, step_fixes):
        fixes = trace.fixes[start : start + WINDOW_FIXES]
        t0, t1 = fixes[0].timestamp_s, fixes[-1].timestamp_s
        imu = [s for s in trace.imu_samples if t0 <= s.timestamp_s <= t1]
        baro = [s for s in trace.barometer_samples if t0 <= s.timestamp_s <= t1]
        mag = [s for s in trace.magnetometer_samples if t0 <= s.timestamp_s <= t1]

        results = fuse_checks(fixes, imu, baro, mag, movement_mode)
        previous_state = verdicts[-1].state if verdicts else "TRUSTED"
        clean_streak = _consecutive_clean(verdicts, previous_state)
        verdict = evaluate_window(results, previous_state, clean_streak)
        verdicts.append(verdict)

        failed = ",".join(verdict.failed_checks) or "-"
        print(
            f"  t={t0:6.0f}-{t1:6.0f}s  {verdict.state:<10} failed=[{failed}]  "
            f"{_short_reason(verdict.explanation)}"
        )
    return verdicts


def main():
    print("Anchor GPS-spoofing detection demo")
    print("=" * 70)

    # --- Scenario 1: honest drive -----------------------------------
    rng = random.Random(2026)
    clean_trace = generate_legitimate_trace(0.0, 180.0, "driving", rng)
    print("\nScenario 1: legitimate driving trace (no spoofing)")
    print("-" * 70)
    clean_verdicts = run_pipeline(clean_trace)
    states = {v.state for v in clean_verdicts}
    print(f"  -> final: {sorted(states)}")

    # --- Scenario 2: same drive with two injected attacks -------------
    rng2 = random.Random(2026)
    spoofed_trace = generate_legitimate_trace(0.0, 180.0, "driving", rng2)
    inject_teleport(spoofed_trace, at_s=60.0, jump_km=12.0, rng=rng2)
    inject_stationary_phone_moving_gps(spoofed_trace, at_s=110.0, end_s=160.0, rng=rng2)
    print("\nScenario 2: same drive with teleport @60s + desk-spoof @110-160s")
    print("-" * 70)
    spoofed_verdicts = run_pipeline(spoofed_trace)
    denied_windows = [v for v in spoofed_verdicts if v.state == "DENIED"]
    print(
        f"  -> DENIED windows: {len(denied_windows)}/{len(spoofed_verdicts)}; "
        f"clean run stayed TRUSTED: {all(v.state == 'TRUSTED' for v in clean_verdicts)}"
    )
    print(
        f"     (recovery would need {RECOVERY_CLEAN_WINDOWS_REQUIRED} consecutive "
        "clean windows after the last attack)"
    )


def _consecutive_clean(verdicts, previous_state):
    """How many consecutive clean windows precede this one while recovering."""
    if previous_state not in ("RECOVERING",):
        return 0
    streak = 0
    for v in reversed(verdicts):
        if v.state == "RECOVERING":
            streak += 1
        else:
            break
    return streak


def _short_reason(explanation, limit=58):
    text = explanation.replace("\n", " ")
    return text[:limit] + ("..." if len(text) > limit else "")


if __name__ == "__main__":
    main()
