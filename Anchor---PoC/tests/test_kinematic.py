import math
import random

from anchor.checks.kinematic import (
    PEDESTRIAN_ACCELERATION_LIMIT_MPS2,
    VEHICLE_ACCELERATION_LIMIT_MPS2,
    check_kinematics,
)
from anchor.sensors import GnssFix

LAT = 51.5
LON = -0.13


def _fix(t_s, lat=LAT, lon=LON):
    return GnssFix(t_s, lat, lon, 35.0, None)


def _constant_speed_fixes(start_speed_mps, speed_delta_per_fix, n=10):
    """Fixes along the equator-parallel at 1 s spacing with linear speed ramp."""
    fixes = []
    position_m = 0.0
    speed = start_speed_mps
    for i in range(n):
        t = float(i)
        lat = LAT + math.degrees(position_m / 6_371_000.0)
        fixes.append(_fix(t, lat=lat))
        position_m += speed * 1.0
        speed += speed_delta_per_fix
    return fixes


def test_clean_driving_passes():
    rng = random.Random(1)
    # Gentle speed oscillation like real traffic; well under vehicle limit.
    fixes = _constant_speed_fixes(8.0, 0.0)
    for i in range(1, len(fixes)):
        pass  # positions already encode constant speed
    result = check_kinematics(fixes, "driving")
    assert result.passed


def test_vehicle_hard_braking_still_passes():
    # Deceleration of 6 m/s^2 is harder than any legal stop but far below 1.2g.
    fixes = _constant_speed_fixes(25.0, -6.0)
    result = check_kinematics(fixes, "driving")
    assert result.passed, result.reason


def test_impossible_acceleration_flags_driving():
    # +20 m/s^2 per second is ~2g: nothing road-going does that.
    fixes = _constant_speed_fixes(5.0, 20.0)
    result = check_kinematics(fixes, "driving")
    assert not result.passed
    assert result.confidence > 0.7
    assert "m/s^2" in result.reason


def test_pedestrian_limit_stricter_than_vehicle():
    # 4 m/s^2 is fine for a car start but absurd for walking.
    fixes = _constant_speed_fixes(0.0, 4.0)
    driving = check_kinematics(fixes, "driving")
    walking = check_kinematics(fixes, "walking")
    assert driving.passed
    assert not walking.passed


def test_decelerating_but_never_stopping_passes():
    # Braking at 3 m/s^2 from 30 m/s across the window: strong but honest -
    # the vehicle is still rolling at the end and nothing here is impossible.
    fixes = _constant_speed_fixes(30.0, -3.0)
    result = check_kinematics(fixes, "driving")
    assert result.passed, result.reason


def test_instant_stop_from_speed_flags():
    # Negation: dropping from 25 m/s to a standstill between consecutive
    # fixes implies ~25 m/s^2 - no road vehicle stops like that.
    fixes = _constant_speed_fixes(25.0, -25.0)
    result = check_kinematics(fixes, "driving")
    assert not result.passed


def test_too_few_fixes_abstains():
    result = check_kinematics([_fix(0.0), _fix(1.0)], "driving")
    assert result.passed
    assert result.confidence == 0.0


def test_limits_ordered_sensibly():
    assert PEDESTRIAN_ACCELERATION_LIMIT_MPS2 < VEHICLE_ACCELERATION_LIMIT_MPS2
