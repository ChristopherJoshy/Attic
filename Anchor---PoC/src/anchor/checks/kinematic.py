"""Kinematic check: is the implied acceleration physically possible?"""

import math

from ..sensors import GnssFix
from . import CheckResult, check_result

# Hard braking in a passenger car peaks around 0.8-1.0 g; even race cars with
# massive downforce rarely sustain much above 1.5 g laterally. 1.2 g sits
# comfortably above "aggressive but real driving" while still catching the
# smooth multi-g accelerations a naive spoofer injects when it yanks the
# reported position.
VEHICLE_ACCELERATION_LIMIT_MPS2 = 11.8  # ~1.2 g

# Walking: peak foot-strike transients aside, sustained whole-body
# acceleration stays under ~3 m/s^2 (brisk start from standstill).
PEDESTRIAN_ACCELERATION_LIMIT_MPS2 = 3.0


def check_kinematics(
    fixes: list[GnssFix],
    movement_mode: str = "driving",
) -> CheckResult:
    """Flag fixes whose implied acceleration exceeds what the mode allows.

    Uses consecutive GNSS fixes only: v between fixes from position delta,
    then dv/dt. This is deliberately coarser than IMU integration - it checks
    whether the *reported* trajectory could be real, not whether the phone
    agrees with itself.

    Limitation: flat-Earth approximation over each fix interval; fine at the
    meter scales and ~1 Hz fix rates this PoC cares about.
    """
    if len(fixes) < 3:
        return check_result(
            "kinematic", True, 0.0, "need at least 3 fixes to estimate acceleration"
        )

    limit_mps2 = (
        VEHICLE_ACCELERATION_LIMIT_MPS2
        if movement_mode == "driving"
        else PEDESTRIAN_ACCELERATION_LIMIT_MPS2
    )

    # Speeds from raw fix deltas carry meter-level jitter; differentiating
    # those naively manufactures multi-g phantom accelerations. Instead we fit
    # speed vs time by least squares over the window - the standard trick for
    # noisy GPS speed - and bound its slope. A real spoofed trajectory bends
    # hard enough that even the smoothed slope blows past the limit.
    times_s = [fix.timestamp_s for fix in fixes]
    speeds_mps = [_ground_speed_mps(a, b) for a, b in zip(fixes, fixes[1:])]
    mid_times_s = [
        (a.timestamp_s + b.timestamp_s) / 2 for a, b in zip(fixes, fixes[1:])
    ]
    implied_acceleration_mps2 = abs(_least_squares_slope(mid_times_s, speeds_mps))

    worst_acceleration_mps2 = implied_acceleration_mps2
    worst_timestamp_s = times_s[len(times_s) // 2]
    passed = worst_acceleration_mps2 <= limit_mps2
    if passed:
        return check_result(
            "kinematic",
            True,
            min(1.0, worst_acceleration_mps2 / limit_mps2 + 0.1),
            f"max implied acceleration {worst_acceleration_mps2:.2f} m/s^2 within "
            f"{limit_mps2:.1f} m/s^2 for {movement_mode} profile",
        )
    return check_result(
        "kinematic",
        False,
        min(1.0, worst_acceleration_mps2 / limit_mps2 / 2),
        f"implied acceleration {worst_acceleration_mps2:.2f} m/s^2 at t="
        f"{worst_timestamp_s:.0f} exceeds {limit_mps2:.1f} m/s^2 "
        f"({movement_mode}) - reported speed changed faster than physics allows",
    )


def _ground_speed_mps(a: GnssFix, b: GnssFix) -> float:
    dt = b.timestamp_s - a.timestamp_s
    if dt <= 0:
        return 0.0
    # Equirectangular projection around the midpoint latitude: good enough
    # below ~100 km distances, which is all a phone ever sees.
    lat_mid_rad = math.radians((a.latitude_deg + b.latitude_deg) / 2)
    dx = math.radians(b.longitude_deg - a.longitude_deg) * math.cos(lat_mid_rad) * 6_371_000.0
    dy = math.radians(b.latitude_deg - a.latitude_deg) * 6_371_000.0
    return math.hypot(dx, dy) / dt


def _least_squares_slope(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    covariance = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    variance_x = sum((x - mean_x) ** 2 for x in xs)
    if variance_x == 0.0:
        return 0.0
    return covariance / variance_x
