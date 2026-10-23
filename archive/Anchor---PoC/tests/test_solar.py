from datetime import datetime, timezone

from anchor.checks.solar import check_solar, solar_position

# Reference facts (cross-checkable against timeanddate.com or the NOAA solar
# calculator for London, 51.5 N / 0.13 W):
#   * 2026-06-21 ~12:00 UTC is local solar noon -> sun due SOUTH (~180 deg),
#     elevation ~61-62 deg.
#   * 2026-06-21 sunrise ~04:43 UTC -> sun in the NORTH-EAST (~50-60 deg).
#   * 2026-12-21 ~12:00 UTC -> due south again but elevation only ~14-15 deg.

LONDON_LAT = 51.5
LONDON_LON = -0.13


def test_london_june_solstice_solar_noon_due_south():
    azimuth_deg, altitude_deg = solar_position(
        datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc), LONDON_LAT, LONDON_LON
    )
    # Source of truth: NOAA solar calculator / timeanddate.com table for
    # London on 2026-06-21 shows the sun crossing the meridian near 12:00 UTC
    # (1 pm BST) at elevation ~62 deg. Tolerances absorb equation-of-time and
    # rounding differences between almanacs.
    assert abs(azimuth_deg - 180.0) < 3.0, f"azimuth {azimuth_deg:.1f} not ~south"
    assert abs(altitude_deg - 62.0) < 2.0, f"elevation {altitude_deg:.1f} not ~62"


def test_london_december_solstice_noon_low_south():
    azimuth_deg, altitude_deg = solar_position(
        datetime(2026, 12, 21, 12, 0, tzinfo=timezone.utc), LONDON_LAT, LONDON_LON
    )
    assert abs(azimuth_deg - 180.0) < 3.0
    # Winter solstice noon elevation = 90 - latitude - declination magnitude.
    assert abs(altitude_deg - 15.0) < 2.0


def test_sunrise_azimuth_northeast_in_june():
    # London sunrise on Jun 21 is around 04:43 UTC; sun should sit NE just
    # after rising, i.e. azimuth well east of south and low above horizon.
    azimuth_deg, altitude_deg = solar_position(
        datetime(2026, 6, 21, 5, 30, tzinfo=timezone.utc), LONDON_LAT, LONDON_LON
    )
    assert 50.0 <= azimuth_deg <= 110.0, f"sunrise azimuth {azimuth_deg:.1f} not NE-E"
    assert 5.0 <= altitude_deg <= 20.0


def test_afternoon_sun_west_of_south():
    azimuth_deg, _ = solar_position(
        datetime(2026, 6, 21, 15, 0, tzinfo=timezone.utc), LONDON_LAT, LONDON_LON
    )
    assert azimuth_deg > 200.0


def test_honest_heading_passes():
    fixes = [
        _fix_at(datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc))
    ]
    # Device heading pointing at the sun (due south) must pass.
    result = check_solar(fixes, [(fixes[0].timestamp_s, 178.0)])
    assert result.passed


def test_impossible_heading_flags():
    fixes = [
        _fix_at(datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc))
    ]
    # Claiming to face north while the sun sits due south is physically
    # inconsistent with any shadow/orientation reading.
    result = check_solar(fixes, [(fixes[0].timestamp_s, 10.0)])
    assert not result.passed


def test_night_abstains():
    # Deep night in London: sun far below horizon, check cannot judge.
    fixes = [_fix_at(datetime(2026, 6, 21, 23, 30, tzinfo=timezone.utc))]
    result = check_solar(fixes, [(fixes[0].timestamp_s, 90.0)])
    assert result.passed
    assert "too low" in result.reason or result.confidence == 0.0


def test_no_headings_abstains():
    fixes = [_fix_at(datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc))]
    result = check_solar(fixes, [])
    assert result.passed
    assert result.confidence == 0.0


def test_boundary_tolerance_respected():
    # Heading within tolerance of the solar azimuth passes; just outside flags.
    fixes = [_fix_at(datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc))]
    inside = check_solar(fixes, [(fixes[0].timestamp_s, 194.0)])  # 14 deg off
    outside = check_solar(fixes, [(fixes[0].timestamp_s, 196.0)])  # 16 deg off
    assert inside.passed
    assert not outside.passed


def _fix_at(when_utc):
    from anchor.sensors import GnssFix

    return GnssFix(when_utc.timestamp(), LONDON_LAT, LONDON_LON, 35.0, None)
