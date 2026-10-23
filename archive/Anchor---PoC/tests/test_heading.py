import math

from anchor.checks.heading import check_heading, magnetic_heading_deg
from anchor.sensors import GnssFix, MagnetometerSample

LAT = 51.5
LON = -0.13


def _field_for(heading_deg):
    horizontal = 20.0  # uT
    r = math.radians(heading_deg)
    return (horizontal * math.cos(r), horizontal * math.sin(r), -43.0)


def _drive_straight(course_deg, n_fixes=8, dt=1.0, start_t=0.0):
    fixes = [
        GnssFix(start_t + i * dt, LAT, LON + i * 0.0002, 35.0, course_deg)
        for i in range(n_fixes)
    ]
    mag = [
        MagnetometerSample(start_t + i * dt - 0.3, _field_for(course_deg))
        for i in range(n_fixes)
    ]
    return fixes, mag


def test_aligned_course_and_compass_passes():
    fixes, mag = _drive_straight(90.0)
    result = check_heading(fixes, [], mag)
    assert result.passed


def test_single_sample_divergence_during_turn_does_not_flag():
    # Compass lags the GNSS course for exactly ONE sample mid-turn; that is
    # normal sensor behavior and must never convict.
    course = 90.0
    fixes, mag = [], []
    for i in range(10):
        t = float(i)
        if i == 5:
            fix_course = 130.0  # one-sample spike while compass still at 90
            compass = 90.0
        else:
            fix_course = course
            compass = course
        fixes.append(GnssFix(t, LAT, LON + i * 0.0002, 35.0, fix_course))
        mag.append(MagnetometerSample(t - 0.3, _field_for(compass)))
    result = check_heading(fixes, [], mag)
    assert result.passed, f"single-sample divergence flagged: {result.reason}"


def test_sustained_divergence_flags():
    # GNSS claims due east while the compass insists north, for many samples.
    fixes, mag = [], []
    for i in range(10):
        t = float(i)
        fixes.append(GnssFix(t, LAT, LON + i * 0.0002, 35.0, 90.0))
        mag.append(MagnetometerSample(t - 0.3, _field_for(0.0)))
    result = check_heading(fixes, [], mag)
    assert not result.passed
    assert result.confidence >= 0.7


def test_divergence_streak_needs_consecutive_samples():
    # Divergent samples separated by clean ones must NOT accumulate: this is
    # the negation of "any three divergent samples flag".
    fixes, mag = [], []
    divergent_at = {1, 4, 7}
    for i in range(10):
        t = float(i)
        fix_course = 90.0 if i in divergent_at else 90.0
        compass = 170.0 if i in divergent_at else 90.0
        fixes.append(GnssFix(t, LAT, LON + i * 0.0002, 35.0, fix_course))
        mag.append(MagnetometerSample(t - 0.3, _field_for(compass)))
    result = check_heading(fixes, [], mag)
    assert result.passed


def test_missing_compass_data_abstains():
    fixes = [GnssFix(float(i), LAT, LON, 35.0, 90.0) for i in range(6)]
    result = check_heading(fixes, [], [])
    assert result.passed
    assert result.confidence == 0.0


def test_magnetic_heading_from_field_vector():
    assert magnetic_heading_deg(_field_for(45.0)) == 45.0
    assert magnetic_heading_deg(_field_for(359.0)) == 359.0
    # Degenerate field (no horizontal component) yields no heading.
    assert magnetic_heading_deg((0.0, 0.0, -48.0)) is None
