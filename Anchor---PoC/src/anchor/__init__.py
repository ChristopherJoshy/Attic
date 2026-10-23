"""Anchor: GPS spoofing detection from physics, not probabilities.

Six independent sensor-consistency checks vote on each window of sensor
history; a deterministic state machine folds those votes into
TRUSTED / DEGRADED / DENIED / RECOVERING.
"""

from .checks import CheckResult
from .fusion import fuse_checks
from .sensors import (
    BarometerSample,
    GnssFix,
    ImuSample,
    MagnetometerSample,
    SolarPosition,
)
from .state_machine import (
    STATE_DEGRADED,
    STATE_DENIED,
    STATE_RECOVERING,
    STATE_TRUSTED,
    Verdict,
    evaluate_window,
)

__version__ = "0.1.0"

__all__ = [
    "BarometerSample",
    "CheckResult",
    "GnssFix",
    "ImuSample",
    "MagnetometerSample",
    "SolarPosition",
    "STATE_DEGRADED",
    "STATE_DENIED",
    "STATE_RECOVERING",
    "STATE_TRUSTED",
    "Verdict",
    "evaluate_window",
    "fuse_checks",
]
