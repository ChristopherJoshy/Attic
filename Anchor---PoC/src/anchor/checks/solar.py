"""Solar check: does the claimed heading agree with where the sun must be?

Implements the NOAA Solar Calculator equations (the "General Solar Position
Calculations" from NOAA's Global Monitoring Division; same algorithm behind
their public sunrise/sunset spreadsheet). Everything is plain stdlib math so
any step can be verified by hand against a known almanac value.

Verification anchor used in tests: London (51.5 N, 0.13 W) on 2026-06-21 at
12:00 UTC is close to local solar noon, so the sun sits essentially due south
(azimuth ~180 deg) at elevation ~61-62 deg - cross-checkable against any
published sun-position table or timeanddate.com for that date/place.
"""

import math
from datetime import datetime, timezone

from ..sensors import GnssFix
from . import CheckResult, check_result
from .heading import _angular_difference_deg

# Compass disagreement tolerated before we call it inconsistent: shadow-edge
# estimation and phone compass both carry ~10 deg of honest error.
SOLAR_HEADING_TOLERANCE_DEG = 15.0

OBLIQUITY_OF_ECLIPTIC_DEG = 23.44
JULIAN_DAY_EPOCH_2000 = 2451545.0


def solar_position(
    when_utc: datetime,
    latitude_deg: float,
    longitude_deg: float,
) -> tuple[float, float]:
    """Return (azimuth_deg, altitude_deg), azimuth clockwise from true north.

    Steps follow NOAA's "General Solar Position Calculations" document:
      1. Julian day -> fractional year gamma.
      2. Equation of time and declination from Spencer-style Fourier fits.
      3. True solar time -> hour angle.
      4. Project sun vector onto the local horizontal frame for zenith, then
         convert to azimuth with the quadrant fix NOAA specifies.
    """
    # NOAA's gamma fit works on fractional year in radians, anchored on
    # solar noon of day 1 so the hour lands inside the right fit window.
    day_of_year = when_utc.timetuple().tm_yday
    fraction_of_year = (
        2 * math.pi / 365.0
        * (day_of_year - 1 + (when_utc.hour - 12) / 24.0)
    )
    eq_time_minutes = (
        229.18
        * (
            0.000075
            + 0.001868 * math.cos(fraction_of_year)
            - 0.032077 * math.sin(fraction_of_year)
            - 0.014615 * math.cos(2 * fraction_of_year)
            - 0.040849 * math.sin(2 * fraction_of_year)
        )
    )
    # This series yields RADIANS, not degrees - do not wrap it again.
    declination_rad = (
        0.006918
        - 0.399912 * math.cos(fraction_of_year)
        + 0.070257 * math.sin(fraction_of_year)
        - 0.006758 * math.cos(2 * fraction_of_year)
        + 0.000907 * math.sin(2 * fraction_of_year)
        - 0.002697 * math.cos(3 * fraction_of_year)
        + 0.00148 * math.sin(3 * fraction_of_year)
    )

    time_utc_minutes = (
        when_utc.hour * 60.0 + when_utc.minute + when_utc.second / 60.0
    )
    true_solar_time_minutes = (
        time_utc_minutes + eq_time_minutes + 4.0 * longitude_deg
    )
    hour_angle_deg = true_solar_time_minutes / 4.0 - 180.0

    lat_rad = math.radians(latitude_deg)
    dec_rad = declination_rad
    ha_rad = math.radians(hour_angle_deg)

    cos_zenith = (
        math.sin(lat_rad) * math.sin(dec_rad)
        + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
    )
    cos_zenith = max(-1.0, min(1.0, cos_zenith))
    zenith_rad = math.acos(cos_zenith)

    # Azimuth, clockwise from true north. Derived from the standard spherical
    # relations (sin az = -sin ha cos dec / sin z, cos az = (sin dec -
    # sin lat cos z)/(cos lat sin z)); NOAA's spreadsheet uses an equivalent
    # atan2 form with its own quadrant fix. Hand-verified: this puts the sun
    # due south at London solar noon and in the NE at sunrise, June.
    sin_zenith = math.sin(zenith_rad)
    if abs(sin_zenith) < 1e-9:
        sin_zenith = 1e-9  # sun at zenith: azimuth undefined, pick north
    sin_azimuth = -math.sin(ha_rad) * math.cos(dec_rad) / sin_zenith
    cos_azimuth = (math.sin(dec_rad) - math.sin(lat_rad) * math.cos(zenith_rad)) / (
        math.cos(lat_rad) * sin_zenith
    )
    azimuth_deg = math.degrees(math.atan2(sin_azimuth, cos_azimuth))
    return azimuth_deg % 360.0, 90.0 - math.degrees(zenith_rad)


def check_solar(
    fixes: list[GnssFix],
    device_headings_by_time: list[tuple[float, float]],
) -> CheckResult:
    """Flag fixes whose timestamp+location put the sun somewhere the claimed
    device heading contradicts.

    `device_headings_by_time` carries (timestamp_s, heading_deg clockwise
    from true north) readings - normally derived from the magnetometer, but
    any trusted orientation source qualifies.

    Only meaningful while the sun is up: below ~5 degrees elevation shadows
    are unreadable and the check abstains rather than guessing.
    """
    if not fixes or not device_headings_by_time:
        return check_result(
            "solar", True, 0.0, "no fixes or headings to compare against the sun"
        )

    comparisons = 0
    worst_divergence_deg = 0.0
    for fix in fixes:
        heading_deg = _nearest_heading(device_headings_by_time, fix.timestamp_s)
        if heading_deg is None:
            continue
        azimuth_deg, altitude_deg = solar_position(
            datetime.fromtimestamp(fix.timestamp_s, tz=timezone.utc),
            fix.latitude_deg,
            fix.longitude_deg,
        )
        if altitude_deg < 5.0:
            continue  # sun too low for orientation claims to be testable
        comparisons += 1
        divergence_deg = _angular_difference_deg(azimuth_deg, heading_deg)
        worst_divergence_deg = max(worst_divergence_deg, divergence_deg)

    if comparisons == 0:
        return check_result(
            "solar", True, 0.0, "sun too low to verify heading (night or twilight)"
        )

    if worst_divergence_deg > SOLAR_HEADING_TOLERANCE_DEG:
        return check_result(
            "solar",
            False,
            min(1.0, worst_divergence_deg / SOLAR_HEADING_TOLERANCE_DEG / 3),
            f"claimed heading diverges {worst_divergence_deg:.0f} deg from computed "
            f"solar azimuth (tolerance {SOLAR_HEADING_TOLERANCE_DEG:.0f} deg) - the "
            "sky says one direction, the device says another",
        )
    return check_result(
        "solar",
        True,
        min(1.0, worst_divergence_deg / SOLAR_HEADING_TOLERANCE_DEG + 0.1),
        f"claimed heading within {worst_divergence_deg:.0f} deg of solar azimuth",
    )


def _nearest_heading(
    headings_by_time: list[tuple[float, float]],
    timestamp_s: float,
) -> float | None:
    best: tuple[float, float] | None = None
    for t, heading_deg in headings_by_time:
        dt = abs(t - timestamp_s)
        if dt <= 2.0 and (best is None or dt < best[0]):
            best = (dt, heading_deg)
    return best[1] if best else None

def _julian_day(when_utc: datetime) -> float:
    """Julian day from a UTC datetime (Meeus integer-day formula).

    Kept for hand-verification against almanac tables even though the
    position fit above only needs day-of-year.
    """
    year = when_utc.year
    month = when_utc.month
    day = when_utc.day
    if month <= 2:
        year -= 1
        month += 12
    gregorian_correction = 2 - year // 100 + (year // 100) // 4
    day_fraction = (
        when_utc.hour + when_utc.minute / 60.0 + when_utc.second / 3600.0
    ) / 24.0
    return (
        math.floor(365.25 * (year + 4716))
        + math.floor(30.6001 * (month + 1))
        + day + day_fraction + gregorian_correction - 1524.5
    )
