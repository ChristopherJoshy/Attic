"""Synthetic sensor trace generation for tests and demos.

Everything is deterministic under a fixed seed: a seeded `random.Random`
drives every noisy quantity, so the same seed reproduces the exact trace.
Traces bundle all four sensor streams plus the ground truth the simulator
used, so tests can assert against reality rather than the report.
"""

import math
from dataclasses import dataclass, field

from .checks.solar import solar_position
from .sensors import BarometerSample, GnssFix, ImuSample, MagnetometerSample

EARTH_RADIUS_M = 6_371_000.0


@dataclass
class SensorTrace:
    fixes: list[GnssFix] = field(default_factory=list)
    imu_samples: list[ImuSample] = field(default_factory=list)
    barometer_samples: list[BarometerSample] = field(default_factory=list)
    magnetometer_samples: list[MagnetometerSample] = field(default_factory=list)
    # (start_s, end_s, label) segments of ground truth, e.g. ("legit", "spoof").
    spoof_segments: list[tuple[float, float, str]] = field(default_factory=list)


def generate_legitimate_trace(
    start_time_s: float,
    duration_s: float,
    mode: str,
    rng,
    start_latitude_deg: float = 51.5,
    start_longitude_deg: float = -0.13,
) -> SensorTrace:
    """A physically honest journey: smooth accel profile, real turns, sensor noise.

    The phone follows the trajectory exactly; GNSS gets meter-level jitter and
    the barometer a slow weather drift, like any real device.
    """
    trace = SensorTrace()
    sample_rate_hz = 10.0
    dt_sample = 1.0 / sample_rate_hz
    # Phones deliver GNSS fixes near 1 Hz while IMU runs 50-100 Hz; 10 Hz IMU
    # keeps the PoC light. Differentiating raw fix jitter at high rates would
    # manufacture enormous phantom accelerations - see the kinematic check.
    fix_every_n_imu = 10
    latitude_deg = start_latitude_deg
    longitude_deg = start_longitude_deg
    altitude_m = 35.0
    speed_mps = 0.0 if mode == "walking" else 8.0
    cruise_mps = 1.4 if mode == "walking" else 12.0
    max_accel_mps2 = 1.5 if mode == "walking" else 2.2  # honest vehicle values
    heading_deg = rng.uniform(0, 360)

    n_samples = int(duration_s / dt_sample)
    accel_bias = rng.uniform(-0.05, 0.05)
    imu_sample_index = 0

    for i in range(n_samples):
        t_s = start_time_s + i * dt_sample
        phase = math.sin(t_s / 25.0 * math.pi)  # gentle accel/decel cycles
        commanded_accel_mps2 = max_accel_mps2 * phase
        if speed_mps <= 0 and commanded_accel_mps2 < 0:
            commanded_accel_mps2 = 0.0
        speed_mps += commanded_accel_mps2 * dt_sample
        speed_mps = min(max(speed_mps, 0.0), cruise_mps)

        # Slow heading wander plus occasional deliberate turns.
        heading_deg += 2.0 * math.sin(t_s / 40.0) * dt_sample
        if i % int(sample_rate_hz * 45) == int(sample_rate_hz * 20):
            heading_deg += 3.0  # sustained gentle turn segment

        vx_mps = speed_mps * math.sin(math.radians(heading_deg))
        vy_mps = speed_mps * math.cos(math.radians(heading_deg))
        latitude_deg += math.degrees(vy_mps * dt_sample / EARTH_RADIUS_M)
        longitude_deg += math.degrees(
            vx_mps * dt_sample / (EARTH_RADIUS_M * math.cos(math.radians(latitude_deg)))
        )
        imu_sample_index += 1
        _emit_imu_sample(trace, t_s, heading_deg, speed_mps, accel_bias, rng)
        if imu_sample_index % fix_every_n_imu == 0:
            _emit_fix(trace, t_s, latitude_deg, longitude_deg, altitude_m,
                      heading_deg, speed_mps, rng)

    return trace


def inject_teleport(trace: SensorTrace, at_s: float, jump_km: float, rng) -> None:
    """Move every subsequent fix by an instant offset - the classic teleport."""
    offset_lat_deg = jump_km * 1000.0 / EARTH_RADIUS_M
    offset_lon_deg = offset_lat_deg / math.cos(math.radians(51.5))
    _shift_fixes_after(trace, at_s, offset_lat_deg, offset_lon_deg, 0.0,
                       f"teleport {jump_km} km")


def inject_constant_offset_drift(
    trace: SensorTrace,
    at_s: float,
    end_s: float,
    drift_rate_mps: float,
    bearing_deg: float,
    rng,
) -> None:
    """Position slides steadily away from truth while motion stays plausible.

    Each fix is displaced by the offset accumulated since `at_s`, so the
    spoofed track is a smooth, constant-velocity shear of the honest track -
    no single-fix jump for the temporal check to catch.
    """
    trace.spoof_segments.append((at_s, end_s, f"offset drift {drift_rate_mps} m/s"))
    lat_dir_rad = math.radians(bearing_deg)
    drifted: list[GnssFix] = []
    for fix in trace.fixes:
        if fix.timestamp_s < at_s:
            drifted.append(fix)
            continue
        # Offset grows linearly and freezes at end_s; applying the TOTAL
        # offset to each ORIGINAL coordinate keeps the drift cumulative.
        # (Adding only the latest per-step delta would leave every fix a
        # constant one-step hop from truth - invisible to every check.)
        elapsed_s = min(fix.timestamp_s - at_s, end_s - at_s)
        offset_m = max(elapsed_s, 0.0) * drift_rate_mps
        dlat = math.degrees(offset_m * math.cos(lat_dir_rad) / EARTH_RADIUS_M)
        dlon = math.degrees(
            offset_m * math.sin(lat_dir_rad)
            / (EARTH_RADIUS_M * math.cos(math.radians(fix.latitude_deg)))
        )
        drifted.append(
            GnssFix(
                fix.timestamp_s,
                fix.latitude_deg + dlat,
                fix.longitude_deg + dlon,
                fix.altitude_m,
                # Course stays honest-looking; the LIE is the position, so the
                # course must rotate along with the shifted track to remain
                # self-consistent (a real spoofer would do this).
                fix.course_over_ground_deg,
            )
        )
    trace.fixes = drifted


def inject_stationary_phone_moving_gps(trace: SensorTrace, at_s: float, end_s: float, rng) -> None:
    """Phone sits still; GNSS keeps claiming a drive.

    Replaces IMU samples in the window with desk-like readings (gravity only,
    tiny vibration) while leaving the fix stream untouched.
    """
    trace.spoof_segments.append((at_s, end_s, "stationary phone, moving GPS"))
    still_imu: list[ImuSample] = []
    for sample in trace.imu_samples:
        if at_s <= sample.timestamp_s <= end_s:
            still_imu.append(
                ImuSample(sample.timestamp_s, (0.03, -0.02, 9.807 + rng.gauss(0, 0.01)))
            )
        else:
            still_imu.append(sample)
    trace.imu_samples = still_imu


def inject_impossible_heading(trace: SensorTrace, at_s: float, end_s: float, rng) -> None:
    """Rotate reported course-over-ground away from the compass by ~120 deg."""
    trace.spoof_segments.append((at_s, end_s, "impossible heading"))
    rotated_fixes: list[GnssFix] = []
    for fix in trace.fixes:
        course = fix.course_over_ground_deg
        if fix.timestamp_s >= at_s and course is not None:
            rotated_fixes.append(
                GnssFix(fix.timestamp_s, fix.latitude_deg, fix.longitude_deg,
                        fix.altitude_m, (course + 120.0) % 360.0)
            )
        else:
            rotated_fixes.append(fix)
    trace.fixes = rotated_fixes
    # Compass keeps telling the physical truth; only the GNSS course lies.
    true_heading = _median_compass_heading(trace.magnetometer_samples)
    if true_heading is not None:
        lying_mag = [
            MagnetometerSample(s.timestamp_s, _field_for_heading(true_heading))
            for s in trace.magnetometer_samples
        ]
        trace.magnetometer_samples = lying_mag


def _shift_fixes_after(
    trace: SensorTrace,
    at_s: float,
    dlat_deg: float,
    dlon_deg: float,
    dalt_m: float,
    label: str,
) -> None:
    trace.spoof_segments.append((at_s, trace.fixes[-1].timestamp_s, label))
    shifted: list[GnssFix] = []
    for fix in trace.fixes:
        if fix.timestamp_s >= at_s:
            shifted.append(
                GnssFix(fix.timestamp_s, fix.latitude_deg + dlat_deg,
                        fix.longitude_deg + dlon_deg, fix.altitude_m + dalt_m,
                        fix.course_over_ground_deg)
            )
        else:
            shifted.append(fix)
    trace.fixes = shifted


def _emit_fix(trace, t_s, lat, lon, alt, heading, speed, rng):
    jitter_lat = rng.gauss(0, 2.5) / EARTH_RADIUS_M
    jitter_lon = rng.gauss(0, 2.5) / (EARTH_RADIUS_M * math.cos(math.radians(lat)))
    course = (heading + rng.gauss(0, 1.5)) % 360.0 if speed > 0.5 else None
    trace.fixes.append(
        GnssFix(t_s, lat + math.degrees(jitter_lat), lon + math.degrees(jitter_lon),
                alt + rng.gauss(0, 3.0), course)
    )
    trace.barometer_samples.append(
        BarometerSample(t_s, _altitude_to_pressure_hpa(alt)
                        + 2.0 * math.sin(t_s / 3600.0)  # slow weather drift
                        + rng.gauss(0, 0.1))
    )
    trace.magnetometer_samples.append(
        MagnetometerSample(t_s, _field_for_heading(heading + rng.gauss(0, 2.0)))
    )


def _emit_imu_sample(trace, t_s, heading, speed, accel_bias, rng):
    # Forward acceleration oscillation rides on the gravity axis; real phone
    # accelerometers see specific force, so gravity stays in the reading.
    forward_accel = 1.2 * math.sin(t_s / 7.0) + accel_bias
    trace.imu_samples.append(
        ImuSample(
            t_s,
            (
                rng.gauss(0, 0.15),
                rng.gauss(0, 0.15),
                9.81 + forward_accel + rng.gauss(0, 0.1),
            ),
        )
    )


# Earth's magnetic field, flattened to a plausible mid-latitude vector (~48 uT
# total, ~65 deg inclination). Only the horizontal direction matters to Anchor.
_MAG_FIELD_TOTAL_UT = 48.0
_MAG_INCLINATION_SIN = math.sin(math.radians(65.0))


def _field_for_heading(heading_deg: float) -> tuple[float, float, float]:
    horizontal = _MAG_FIELD_TOTAL_UT * math.cos(math.radians(65.0))
    heading_rad = math.radians(heading_deg)
    return (
        horizontal * math.cos(heading_rad),
        horizontal * math.sin(heading_rad),
        -_MAG_FIELD_TOTAL_UT * _MAG_INCLINATION_SIN,
    )


def _median_compass_heading(samples: list[MagnetometerSample]) -> float | None:
    from .checks.heading import magnetic_heading_deg

    headings = [h for s in samples if (h := magnetic_heading_deg(s.field_utm)) is not None]
    if not headings:
        return None
    headings.sort()
    return headings[len(headings) // 2]


def _altitude_to_pressure_hpa(altitude_m: float) -> float:
    from .checks.altitude import SEA_LEVEL_PRESSURE_HPA, SEA_LEVEL_TEMPERATURE_K, LAPSE_RATE_K_PER_M

    # Inverse of the check-side inversion: pressure = p0 * (1 - L*h/T0)^(g/(R*L)).
    exponent = 1.0 / 0.190263
    ratio = (1.0 - LAPSE_RATE_K_PER_M * altitude_m / SEA_LEVEL_TEMPERATURE_K) ** (
        exponent
    )
    return SEA_LEVEL_PRESSURE_HPA * ratio


__all__ = [
    "SensorTrace",
    "generate_legitimate_trace",
    "inject_constant_offset_drift",
    "inject_impossible_heading",
    "inject_stationary_phone_moving_gps",
    "inject_teleport",
    "solar_position",
]
