"""Environmental check: stationary phone while GNSS claims movement.

The single most telling physical contradiction available without any extra
hardware: accelerometers see only gravity and vibration when a phone rests on
a desk, so continuous GNSS motion at that same moment cannot be genuine.
"""

import math

from ..sensors import GnssFix, ImuSample
from . import CheckResult, check_result

# Variance of |specific force| around g for a phone lying still on a surface:
# sensor noise plus faint building sway lands around (0.02 m/s^2)^2; walking
# or vehicle vibration raises it by two orders of magnitude.
STATIONARY_VARIANCE_LIMIT = 0.05**2
# Below this GNSS speed we treat the fix as "not moving" too - GPS jitter
# produces phantom 0.2-0.5 m/s drift on a genuinely parked car.
GNSS_MOVING_SPEED_MPS = 1.0
# One noisy window shouldn't convict a receiver; sustained contradiction can.
MIN_CONTRADICTION_WINDOWS = 4


def check_environmental(
    fixes: list[GnssFix],
    imu_samples: list[ImuSample],
) -> CheckResult:
    """Flag windows where the device is physically still but GNSS moves.

    Splits time into ~1 s windows anchored on IMU samples, classifies each as
    stationary/moving from accelerometer variance, then checks whether GNSS
    reports real speed during stationary windows. Requires several
    contradicting windows in a row so a single dropped-sample glitch cannot
    flag a legitimate drive.
    """
    windows = _variance_windows(imu_samples)
    if len(windows) < MIN_CONTRADICTION_WINDOWS:
        return check_result(
            "environmental", True, 0.0, "not enough IMU coverage to judge stationarity"
        )

    speeds_by_time = _gnss_speeds(fixes)
    # A single window without contradiction (GNSS speed briefly under the
    # threshold, or no fix landing inside it) must not erase an otherwise
    # sustained run - real traces always contain such dips. Bridging ONE
    # window keeps that noise from hiding a spoof, while genuinely scattered
    # contradictions still never build the sustained run needed to flag.
    gap_tolerance_windows = 1
    max_sustained_run_windows = 0
    current_run_windows = 0
    open_gap_windows = 0
    for window_start_s, window_end_s, variance in windows:
        is_stationary = variance <= STATIONARY_VARIANCE_LIMIT
        gnss_speed_mps = _speed_during(speeds_by_time, window_start_s, window_end_s)
        contradicts = (
            is_stationary
            and gnss_speed_mps is not None
            and gnss_speed_mps > GNSS_MOVING_SPEED_MPS
        )
        if contradicts:
            current_run_windows += 1 + open_gap_windows
            open_gap_windows = 0
            max_sustained_run_windows = max(
                max_sustained_run_windows, current_run_windows
            )
        elif open_gap_windows < gap_tolerance_windows:
            open_gap_windows += 1
        else:
            current_run_windows = 0
            open_gap_windows = 0

    if max_sustained_run_windows >= MIN_CONTRADICTION_WINDOWS:
        return check_result(
            "environmental",
            False,
            min(1.0, max_sustained_run_windows / (MIN_CONTRADICTION_WINDOWS + 2)),
            f"accelerometer shows device stationary across "
            f"{max_sustained_run_windows} s while GNSS reported >"
            f"{GNSS_MOVING_SPEED_MPS:.1f} m/s movement - phone did not move but "
            "the position trace claims it did",
        )
    return check_result(
        "environmental",
        True,
        min(1.0, max_sustained_run_windows / MIN_CONTRADICTION_WINDOWS),
        "device motion consistent with GNSS-reported movement",
    )


def _variance_windows(imu_samples: list[ImuSample]) -> list[tuple[float, float, float]]:
    """(start, end, variance of specific-force magnitude) per ~1 s window."""
    windows: list[tuple[float, float, float]] = []
    current: list[ImuSample] = []
    window_start_s = imu_samples[0].timestamp_s if imu_samples else 0.0
    for sample in imu_samples:
        if sample.timestamp_s - window_start_s >= 1.0:
            magnitudes = [
                math.sqrt(sum(c * c for c in s.accelerometer_mps2)) for s in current
            ]
            mean = sum(magnitudes) / len(magnitudes)
            variance = sum((m - mean) ** 2 for m in magnitudes) / len(magnitudes)
            windows.append((window_start_s, sample.timestamp_s, variance))
            current = []
            window_start_s = sample.timestamp_s
        current.append(sample)
    return windows


def _gnss_speeds(fixes: list[GnssFix]) -> list[tuple[float, float]]:
    """(midpoint time, speed m/s) for each consecutive fix pair."""
    speeds: list[tuple[float, float]] = []
    lat_mid_rad = None
    for prev, curr in zip(fixes, fixes[1:]):
        dt = curr.timestamp_s - prev.timestamp_s
        if dt <= 0:
            continue
        lat_mid_rad = math.radians((prev.latitude_deg + curr.latitude_deg) / 2)
        dx = math.radians(curr.longitude_deg - prev.longitude_deg) * math.cos(lat_mid_rad) * 6_371_000.0
        dy = math.radians(curr.latitude_deg - prev.latitude_deg) * 6_371_000.0
        midpoint_s = (prev.timestamp_s + curr.timestamp_s) / 2
        speeds.append((midpoint_s, math.hypot(dx, dy) / dt))
    return speeds


def _speed_during(
    speeds_by_time: list[tuple[float, float]],
    start_s: float,
    end_s: float,
) -> float | None:
    values = [speed for t, speed in speeds_by_time if start_s <= t <= end_s]
    return max(values) if values else None
