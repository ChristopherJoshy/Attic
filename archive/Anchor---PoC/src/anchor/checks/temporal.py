"""Temporal check: catch teleports - fixes that imply absurd speed."""

import math

from ..sensors import GnssFix
from . import CheckResult, check_result

# Faster than a commercial airliner at ground level is impossible by any
# transport mode. This check is the coarse backstop: kinematics looks at how
# speed *changes*, this one only asks whether the displacement between two
# consecutive fixes could have been crossed at all.
TELEPORT_SPEED_LIMIT_MPS = 1000_000.0 / 3600.0  # 1000 km/h


def check_temporal(fixes: list[GnssFix]) -> CheckResult:
    """Flag any fix pair implying more than 1000 km/h of ground travel."""
    if len(fixes) < 2:
        return check_result(
            "temporal", True, 0.0, "need at least 2 fixes to measure displacement"
        )

    worst_speed_mps = 0.0
    worst_timestamp_s = fixes[1].timestamp_s
    for prev, curr in zip(fixes, fixes[1:]):
        dt = curr.timestamp_s - prev.timestamp_s
        if dt <= 0:
            continue
        speed_mps = _distance_m(prev, curr) / dt
        if speed_mps > worst_speed_mps:
            worst_speed_mps = speed_mps
            worst_timestamp_s = curr.timestamp_s

    if worst_speed_mps > TELEPORT_SPEED_LIMIT_MPS:
        return check_result(
            "temporal",
            False,
            1.0,
            f"position jumped {worst_speed_mps * 3.6:.0f} km/h between fixes at t="
            f"{worst_timestamp_s:.0f} - faster than any aircraft at ground level",
        )
    return check_result(
        "temporal",
        True,
        min(1.0, worst_speed_mps / TELEPORT_SPEED_LIMIT_MPS + 0.1),
        f"max implied speed {worst_speed_mps * 3.6:.1f} km/h within plausible bounds",
    )


def _distance_m(a: GnssFix, b: GnssFix) -> float:
    # Equirectangular around the midpoint latitude; sub-meter error at phone
    # scales (see kinematic note).
    lat_mid_rad = math.radians((a.latitude_deg + b.latitude_deg) / 2)
    dx = math.radians(b.longitude_deg - a.longitude_deg) * math.cos(lat_mid_rad) * 6_371_000.0
    dy = math.radians(b.latitude_deg - a.latitude_deg) * 6_371_000.0
    return math.hypot(dx, dy)
