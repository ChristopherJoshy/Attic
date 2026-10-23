"""
Ride Request Model

Defines the ride request schema for MongoDB persistence.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RideRequestStatus(str, Enum):
    """Status of a ride request."""

    PENDING = "pending"  # Waiting for match
    MATCHING = "matching"  # In matching process
    MATCHED = "matched"  # Successfully matched
    EXPIRED = "expired"  # TTL expired (15 hours)
    CANCELLED = "cancelled"  # User cancelled


class GeoPoint(BaseModel):
    """Geographic point with coordinates."""

    type: str = Field(default="Point")
    coordinates: list[float] = Field(..., description="[longitude, latitude]")

    @classmethod
    def from_lat_lng(cls, lat: float, lng: float) -> "GeoPoint":
        """Create GeoPoint from latitude and longitude."""
        return cls(coordinates=[lng, lat])

    @property
    def latitude(self) -> float:
        return self.coordinates[1]

    @property
    def longitude(self) -> float:
        return self.coordinates[0]


class TimeWindow(BaseModel):
    """Time window for ride."""

    start: str = Field(..., description="Start time (HH:MM)")
    end: str = Field(..., description="End time (HH:MM)")


class RideRequest(BaseModel):
    """
    Ride request model for MongoDB.

    Fields:
    - request_id: Unique UUID for the request
    - user_id: Reference to the user creating the request
    - pickup: GeoJSON point for pickup location
    - pickup_label: Human-readable pickup description
    - drop: GeoJSON point for drop location
    - drop_label: Human-readable drop description
    - date: Date of the ride (YYYY-MM-DD)
    - time_window: Preferred time window
    - allow_riders: Whether to allow riders (not just passengers)
    - female_only: Hard constraint for female-only groups
    - status: Current status of the request
    - group_id: Reference to ride_groups if matched
    - created_at: When request was created
    - expires_at: When request expires (15 hours from creation)
    - matched_at: When match was found
    """

    request_id: str = Field(..., description="Unique request ID")
    user_id: str = Field(..., description="User who created the request")
    pickup: GeoPoint = Field(..., description="Pickup location")
    pickup_label: str = Field(..., description="Pickup location name")
    drop: GeoPoint = Field(..., description="Drop location")
    drop_label: str = Field(..., description="Drop location name")
    date: str = Field(..., description="Ride date (YYYY-MM-DD)")
    time_window: TimeWindow = Field(..., description="Preferred time window")
    timezone_offset_minutes: int = Field(
        ..., description="User timezone offset from UTC in minutes"
    )
    allow_riders: bool = Field(
        default=True, description="Allow riders (not just passengers)"
    )
    female_only: bool = Field(default=False, description="Female-only constraint")
    status: RideRequestStatus = Field(default=RideRequestStatus.PENDING)
    group_id: Optional[str] = Field(None, description="Group ID if matched")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(..., description="Request expiry time")
    matched_at: Optional[datetime] = Field(None)

    class Config:
        use_enum_values = True


class RideRequestCreate(BaseModel):
    """Data required to create a new ride request."""

    pickup_lat: float = Field(..., ge=-90, le=90)
    pickup_lng: float = Field(..., ge=-180, le=180)
    pickup_label: str = Field(..., min_length=1, max_length=200)
    drop_lat: float = Field(..., ge=-90, le=90)
    drop_lng: float = Field(..., ge=-180, le=180)
    drop_label: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time_window_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    time_window_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    timezone_offset_minutes: int = Field(
        ..., ge=-720, le=840, description="Timezone offset in minutes from UTC"
    )
    allow_riders: bool = True
    female_only: bool = False


class RideRequestResponse(BaseModel):
    """Response model for ride request."""

    request_id: str
    pickup_label: str
    drop_label: str
    date: str
    time_window: TimeWindow
    status: str
    created_at: datetime
    expires_at: datetime
    time_remaining_seconds: int = Field(..., description="Seconds until expiry")
