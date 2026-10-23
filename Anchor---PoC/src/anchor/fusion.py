"""Fusion: run all six physics checks over one analysis window."""

from .checks import CheckResult
from .checks.altitude import check_altitude
from .checks.environmental import check_environmental
from .checks.heading import check_heading
from .checks.kinematic import check_kinematics
from .checks.solar import check_solar
from .checks.temporal import check_temporal
from .sensors import BarometerSample, GnssFix, ImuSample, MagnetometerSample


def fuse_checks(
    fixes: list[GnssFix],
    imu_samples: list[ImuSample],
    barometer_samples: list[BarometerSample],
    mag_samples: list[MagnetometerSample],
    movement_mode: str = "driving",
) -> list[CheckResult]:
    """Run every check against the same window of sensor history.

    Returns results in a fixed order so the state machine and any explanation
    layer can index by position. Checks that lack the sensor data they need
    abstain (pass with low confidence) rather than vote on guesses.
    """
    return [
        check_kinematics(fixes, movement_mode),
        check_heading(fixes, imu_samples, mag_samples),
        check_temporal(fixes),
        check_altitude(fixes, barometer_samples),
        check_environmental(fixes, imu_samples),
        check_solar(
            fixes,
            _device_headings(mag_samples),
        ),
    ]


def _device_headings(
    mag_samples: list[MagnetometerSample],
) -> list[tuple[float, float]]:
    """(timestamp, heading deg from true north) pairs the solar check eats."""
    from .checks.heading import magnetic_heading_deg

    headings: list[tuple[float, float]] = []
    for sample in mag_samples:
        heading_deg = magnetic_heading_deg(sample.field_utm)
        if heading_deg is not None:
            headings.append((sample.timestamp_s, heading_deg))
    return headings
