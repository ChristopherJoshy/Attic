import math

from anchor.checks.temporal import check_temporal
from anchor.sensors import GnssFix

LAT = 51.5
LON = -0.13


def _fix(t_s, lat=LAT, lon=LON):
    return GnssFix(t_s, lat, lon, 35.0, None)


def test_normal_drive_passes():
    fixes = []
    lon = LON
    for i in range(20):
        fixes.append(_fix(float(i), lon=lon))
        lon += math.degrees(12.0 / 6_371_000.0) / math.cos(math.radians(LAT))
    result = check_temporal(fixes)
    assert result.passed


def test_highway_speed_passes():
    # 130 km/h between 1 s fixes is ordinary motorway driving.
    step_deg = math.degrees((130_000 / 3600) / 6_371_000.0) / math.cos(math.radians(LAT))
    fixes = [_fix(float(i), lon=LON + i * step_deg) for i in range(10)]
    result = check_temporal(fixes)
    assert result.passed, result.reason


def test_teleport_flags():
    fixes = [_fix(float(i)) for i in range(5)]
    # Jump ~15 km in one second: ~54000 km/h.
    fixes.append(_fix(5.0, lat=LAT + 15 / 111.32))
    fixes.extend([_fix(6.0), _fix(7.0)])
    result = check_temporal(fixes)
    assert not result.passed


def test_sustained_sub_teleport_speed_passes():
    # 900 km/h at ground level is under the 1000 km/h backstop; this coarse
    # check deliberately does NOT duplicate the kinematic check's job.
    step_deg = math.degrees((900_000 / 3600) / 6_371_000.0) / math.cos(math.radians(LAT))
    fixes = [_fix(float(i), lon=LON + i * step_deg) for i in range(6)]
    result = check_temporal(fixes)
    assert result.passed


def test_mach_2_ground_travel_flags():
    # 1200 km/h at ground level: faster than any production vehicle, above
    # the teleport threshold - only an aircraft at altitude could do this.
    step_deg = math.degrees((1_200_000 / 3600) / 6_371_000.0) / math.cos(math.radians(LAT))
    fixes = [_fix(float(i), lon=LON + i * step_deg) for i in range(6)]
    result = check_temporal(fixes)
    assert not result.passed


def test_single_fix_abstains():
    result = check_temporal([_fix(0.0)])
    assert result.passed
    assert result.confidence == 0.0
