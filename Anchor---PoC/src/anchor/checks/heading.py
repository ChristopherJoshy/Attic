import math

from ..sensors import GnssFix, ImuSample, MagnetometerSample
from . import CheckResult, check_result

# A real turn shows up on both sensors within a sample or two; a spoofed
# course drifts arbitrarily. 35 degrees splits "sensor noise plus magnetometer
# wobble in a car" (typically <20 deg) from genuine disagreement.
DIVERGENCE_THRESHOLD_DEG = 35.0
# One or two samples diverge during hard turns and around steel structures;
# only a sustained split indicts the GNSS course.
SUSTAINED_SAMPLE_COUNT = 3


def check_heading(
    fixes: list[GnssFix],
    imu_samples: list[ImuSample],
    mag_samples: list[MagnetometerSample],
) -> CheckResult:
    """Flag sustained divergence between GNSS course and device heading.

    The device reference heading is the magnetometer-derived heading when
    usable (gravity-aligned projection of the field), falling back to IMU
    yaw integration is deliberately NOT done here - that needs gyro data we
    do not model. Single-sample divergence never flags: turns legitimately
    produce transient disagreement while the compass catches up.
    """
    paired_divergences = _pair_fixes_with_heading(fixes, imu_samples, mag_samples)
    if not paired_divergences:
        return check_result(
            "heading", True, 0.0, "no fixes with both GNSS course and device heading"
        )

    sustained_divergence_count = 0
    worst_divergence_deg = 0.0
    for divergence_deg in paired_divergences:
        if divergence_deg > DIVERGENCE_THRESHOLD_DEG:
            sustained_divergence_count += 1
            worst_divergence_deg = max(worst_divergence_deg, divergence_deg)
        else:
            # Consecutive requirement: one clean sample resets the streak,
            # so an isolated spike during a normal turn cannot accumulate.
            sustained_divergence_count = 0

    if sustained_divergence_count >= SUSTAINED_SAMPLE_COUNT:
        return check_result(
            "heading",
            False,
            min(1.0, sustained_divergence_count / (SUSTAINED_SAMPLE_COUNT + 2)),
            f"GNSS course vs compass heading diverged >{DIVERGENCE_THRESHOLD_DEG:.0f} deg "
            f"for {sustained_divergence_count} consecutive samples "
            f"(worst {worst_divergence_deg:.0f} deg) - reported track disagrees with "
            "the direction the device physically faces",
        )
    return check_result(
        "heading",
        True,
        min(1.0, worst_divergence_deg / DIVERGENCE_THRESHOLD_DEG + 0.1),
        f"GNSS course consistent with device heading (worst divergence "
        f"{worst_divergence_deg:.1f} deg)",
    )


def magnetic_heading_deg(field_utm: tuple[float, float, float]) -> float | None:
    """Compass heading from the raw field vector, assuming the phone is flat.

    Returns None near the poles of inclination where horizontal projection is
    meaningless - callers skip those samples rather than invent a heading.
    """
    bx, by, bz = field_utm
    horizontal_strength = math.hypot(bx, by)
    if horizontal_strength < 5.0:  # uT; Earth's field is ~25-65 uT total
        return None
    return math.degrees(math.atan2(by, bx)) % 360.0


def _pair_fixes_with_heading(
    fixes: list[GnssFix],
    imu_samples: list[ImuSample],
    mag_samples: list[MagnetometerSample],
) -> list[float]:
    """Divergence (deg) for each fix that has a nearby device-heading reading."""
    headings_by_time = [
        (sample.timestamp_s, magnetic_heading_deg(sample.field_utm))
        for sample in mag_samples
    ]
    divergences: list[float] = []
    for fix in fixes:
        if fix.course_over_ground_deg is None:
            continue
        heading_deg = _nearest_heading(headings_by_time, fix.timestamp_s)
        if heading_deg is None:
            continue
        divergences.append(
            _angular_difference_deg(fix.course_over_ground_deg, heading_deg)
        )
    return divergences


def _nearest_heading(
    headings_by_time: list[tuple[float, float | None]],
    timestamp_s: float,
) -> float | None:
    best: tuple[float, float] | None = None  # (abs dt, heading)
    for t, heading_deg in headings_by_time:
        if heading_deg is None:
            continue
        dt = abs(t - timestamp_s)
        if dt <= 0.6 and (best is None or dt < best[0]):
            best = (dt, heading_deg)
    return best[1] if best else None


def _angular_difference_deg(a_deg: float, b_deg: float) -> float:
    diff = abs(a_deg - b_deg) % 360.0
    return min(diff, 360.0 - diff)


