"""User Model - Defines the user schema for MongoDB persistence."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserStatus(str, Enum):
    """User account status."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    BANNED = "banned"


class RiderInfo(BaseModel):
    """Information for users offering rides."""
    vehicle_type: str = Field(..., description="Type of vehicle (car, motorcycle, etc.)")
    from_location: dict = Field(..., description="Starting location with lat/lng")
    from_label: str = Field(..., description="Human-readable starting location")
    to_location: dict = Field(..., description="Destination location with lat/lng")
    to_label: str = Field(..., description="Human-readable destination")
    date: str = Field(..., description="Date offering ride (YYYY-MM-DD)")
    time_window_start: str = Field(..., description="Start of availability (HH:MM)")
    time_window_end: str = Field(..., description="End of availability (HH:MM)")
    seats: int = Field(..., ge=1, le=6, description="Available seats")
    expires_at: datetime = Field(..., description="When this rider availability expires")



class UserRole(str, Enum):
    """User roles for RBAC."""
    USER = "user"
    ADMIN = "admin"


class User(BaseModel):
    """
    User model for MongoDB.
    
    Fields:
    - user_id: Internal immutable UUID, never changes
    - firebase_uid: Firebase Authentication UID
    - email: College email address (verified via Firebase)
    - phone: Phone number (required after onboarding, stored encrypted)
    - gender: Optional gender for female-only matching
    - display_name: From Google profile
    - photo_url: From Google profile
    - trust_score: Hidden score for matching, not exposed to users
    - role: RBAC role (user/admin)
    - is_rider: Currently offering rides
    - rider_info: Present when is_rider is True
    - onboarding_completed: True after phone/consent collected
    - safety_consent: User agreed to safety terms
    - status: Account status (active/suspended/banned)
    - suspension_expires_at: When suspension ends
    - ban_reason: Reason for ban
    - fcm_token: Firebase Cloud Messaging token for push notifications
    """
    user_id: str = Field(..., description="Internal UUID")
    firebase_uid: str = Field(..., description="Firebase UID")
    email: EmailStr = Field(..., description="College email")
    phone: Optional[str] = Field(None, description="Phone number (encrypted)")
    gender: Optional[str] = Field(None, description="M/F/O or None")
    display_name: str = Field(..., description="Display name from Google")
    photo_url: Optional[str] = Field(None, description="Profile photo URL")
    trust_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Hidden trust score")
    role: UserRole = Field(default=UserRole.USER, description="User role")
    is_rider: bool = Field(default=False, description="Currently offering rides")
    rider_info: Optional[RiderInfo] = Field(None, description="Rider details when is_rider=True")
    onboarding_completed: bool = Field(default=False)
    safety_consent: bool = Field(default=False)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    suspension_expires_at: Optional[datetime] = Field(None)
    ban_reason: Optional[str] = Field(None)
    fcm_token: Optional[str] = Field(None, description="FCM token for push notifications")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        use_enum_values = True


class UserCreate(BaseModel):
    """Data required to create a new user from Firebase auth."""
    firebase_uid: str
    email: EmailStr
    display_name: str
    photo_url: Optional[str] = None


class UserUpdate(BaseModel):
    """Data that can be updated by the user."""
    phone: Optional[str] = None
    gender: Optional[str] = None
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    safety_consent: Optional[bool] = None
    fcm_token: Optional[str] = None


class UserPublic(BaseModel):
    """Public user data shown to other users (phone masked)."""
    user_id: str
    display_name: str
    photo_url: Optional[str] = None
    gender: Optional[str] = None
    phone_masked: Optional[str] = None  # e.g., "***-***-1234"


class UserInGroup(BaseModel):
    """User data shown within a ride group (full phone visible)."""
    user_id: str
    display_name: str
    photo_url: Optional[str] = None
    phone: str  # Full phone number visible in groups
    gender: Optional[str] = None
