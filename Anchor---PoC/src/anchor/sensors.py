"""Raw sensor observations Anchor consumes.

All timestamps are Unix epoch seconds (UTC). Positions are WGS-84 lat/lon in
degrees, altitude in meters. Accelerometer readings are specific force in
m/s^2 (device frame, gravity included), matching what Android delivers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class GnssFix:
    timestamp_s: float
    latitude_deg: float
    longitude_deg: float
    altitude_m: float
    # Course over ground, degrees clockwise from true north. None when the
    # receiver cannot compute it (e.g. stationary or too few satellites).
    course_over_ground_deg: float | None = None


@dataclass(frozen=True)
class ImuSample:
    timestamp_s: float
    accelerometer_mps2: tuple[float, float, float]


@dataclass(frozen=True)
class BarometerSample:
    timestamp_s: float
    pressure_hpa: float


@dataclass(frozen=True)
class MagnetometerSample:
    timestamp_s: float
    # Microtesla, device frame.
    field_utm: tuple[float, float, float]


@dataclass(frozen=True)
class SolarPosition:
    """Sun geometry computed for a given time/place.

    azimuth_deg is clockwise from true north; altitude_deg above the horizon.
    """

    azimuth_deg: float
    altitude_deg: float
