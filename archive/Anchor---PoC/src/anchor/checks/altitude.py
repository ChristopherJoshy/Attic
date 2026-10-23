"""Altitude check: GNSS altitude vs barometer-derived altitude."""

from ..sensors import BarometerSample, GnssFix
from . import CheckResult, check_result

# Standard-atmosphere pressure->altitude is only an approximation outdoors:
# weather systems move the reference pressure by 1-3 hPa over hours, which is
# already 10-80 m of "phantom" altitude change, and raw-pressure phones never
# see the true sea-level reference. 150 m keeps weather drift from flagging
# while still catching the hundreds-of-meters errors typical when a spoofer
# fabricates a fix wholesale.
ALTITUDE_TOLERANCE_M = 150.0
# International Standard Atmosphere, sea level constants.
SEA_LEVEL_PRESSURE_HPA = 1013.25
SEA_LEVEL_TEMPERATURE_K = 288.15
LAPSE_RATE_K_PER_M = 0.0065


def check_altitude(
    fixes: list[GnssFix],
    barometer_samples: list[BarometerSample],
) -> CheckResult:
    """Compare GNSS-reported altitude against pressure-derived altitude.

    Barometric altitude here uses raw pressure with the ISA formula and no
    calibration; that bias is exactly why the tolerance is wide.
    """
    pairs = _pair_fixes_with_pressure(fixes, barometer_samples)
    if not pairs:
        return check_result(
            "altitude", True, 0.0, "no fixes with nearby barometer readings"
        )

    worst_gap_m = 0.0
    worst_timestamp_s = pairs[0][0].timestamp_s
    for fix, pressure_hpa in pairs:
        baro_altitude_m = pressure_to_altitude_m(pressure_hpa)
        gap_m = abs(fix.altitude_m - baro_altitude_m)
        if gap_m > worst_gap_m:
            worst_gap_m = gap_m
            worst_timestamp_s = fix.timestamp_s

    if worst_gap_m > ALTITUDE_TOLERANCE_M:
        return check_result(
            "altitude",
            False,
            min(1.0, worst_gap_m / ALTITUDE_TOLERANCE_M / 2),
            f"GNSS altitude diverges from barometric altitude by {worst_gap_m:.0f} m "
            f"at t={worst_timestamp_s:.0f} (tolerance {ALTITUDE_TOLERANCE_M:.0f} m "
            "already allows for weather-driven pressure drift)",
        )
    return check_result(
        "altitude",
        True,
        min(1.0, worst_gap_m / ALTITUDE_TOLERANCE_M + 0.1),
        f"GNSS altitude within {worst_gap_m:.0f} m of barometric altitude",
    )


def pressure_to_altitude_m(pressure_hpa: float) -> float:
    """Invert the ISA troposphere relation p = p0 * (1 - L*h/T0)^(g/(R*L)).

    Valid below ~11 km; accurate to a few meters for short vertical spans,
    subject to whatever weather offset exists in the actual surface pressure.
    """
    ratio = pressure_hpa / SEA_LEVEL_PRESSURE_HPA
    exponent = 0.190263  # g / (R * L), rounded; error < 0.01% below 11 km
    return SEA_LEVEL_TEMPERATURE_K / LAPSE_RATE_K_PER_M * (1.0 - ratio**exponent)


def _pair_fixes_with_pressure(
    fixes: list[GnssFix],
    barometer_samples: list[BarometerSample],
) -> list[tuple[GnssFix, float]]:
    pairs: list[tuple[GnssFix, float]] = []
    for fix in fixes:
        best_sample = None
        best_dt = float("inf")
        for sample in barometer_samples:
            dt = abs(sample.timestamp_s - fix.timestamp_s)
            if dt <= 1.0 and dt < best_dt:
                best_dt = dt
                best_sample = sample
        if best_sample is not None:
            pairs.append((fix, best_sample.pressure_hpa))
    return pairs
