"""Ride Group Model - Defines the ride group schema for MongoDB persistence."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class GroupStatus(str, Enum):
    """Status of a ride group."""
    PENDING = "pending"        # Group created, waiting for more members
    CONFIRMING = "confirming"  # Waiting for all members to confirm readiness
    ACTIVE = "active"          # All confirmed, group is active
    COMPLETED = "completed"    # Ride completed
    CANCELLED = "cancelled"    # Group cancelled
    EXPIRED = "expired"        # Group expired (TTL ended)


class GroupMember(BaseModel):
    """Member of a ride group."""
    user_id: str = Field(..., description="User ID")
    role: str = Field(..., description="passenger or rider")
    readiness_confirmed: bool = Field(default=False)
    confirmed_at: Optional[datetime] = Field(None)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RideGroup(BaseModel):
    """
    Ride group model for MongoDB.
    
    Created when a match is found. Members must confirm readiness
    within the confirmation deadline. Phone numbers are automatically
    shared among confirmed members.
    
    Fields:
    - group_id: Unique UUID for the group
    - members: List of group members with their roles
    - route_summary: Human-readable route description
    - pickup_summary: Combined pickup points summary
    - drop_summary: Combined drop points summary
    - female_only: Whether this is a female-only group
    - status: Current group status
    - confirmation_deadline: When members must confirm by
    - created_at: When group was created
    - finalized_at: When all members confirmed
    """
    group_id: str = Field(..., description="Unique group ID")
    members: list[GroupMember] = Field(..., description="Group members")
    route_summary: str = Field(..., description="Route description")
    pickup_summary: str = Field(..., description="Pickup points summary")
    drop_summary: str = Field(..., description="Drop points summary")
    date: Optional[str] = Field(None, description="Ride date in YYYY-MM-DD format")
    time_window: Optional[dict] = Field(None, description="Time window with start/end times")
    female_only: bool = Field(default=False)
    status: GroupStatus = Field(default=GroupStatus.CONFIRMING)
    confirmation_deadline: datetime = Field(..., description="Confirm by this time")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finalized_at: Optional[datetime] = Field(None)
    expires_at: Optional[datetime] = Field(None, description="When group expires/completes")
    
    class Config:
        use_enum_values = True


class GroupResponse(BaseModel):
    """Response model for ride group."""
    group_id: str
    members: list[dict]  # UserInGroup data
    route_summary: str
    pickup_summary: str
    drop_summary: str
    female_only: bool
    status: str
    confirmation_deadline: datetime
    created_at: datetime
    finalized_at: Optional[datetime]
    my_readiness_confirmed: bool
    all_confirmed: bool
    time_to_confirm_seconds: Optional[int]


class ReadinessConfirmation(BaseModel):
    """Confirmation of readiness to ride."""
    confirmed: bool = True
