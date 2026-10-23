"""
Notification Model - Defines the notification schema for in-app and push
notifications.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    """Type of notification."""

    MATCH_FOUND = "match_found"
    MATCH_EXPIRED = "match_expired"
    READINESS_REQUEST = "readiness_request"
    READINESS_CONFIRMED = "readiness_confirmed"
    GROUP_FINALIZED = "group_finalized"
    GROUP_CANCELLED = "group_cancelled"
    REPORT_ACTION = "report_action"
    SUSPENSION = "suspension"
    BAN = "ban"
    SYSTEM = "system"
    PROMOTION = "promotion"
    CHAT_MESSAGE = "chat_message"
    MEMBER_JOINED = "member_joined"
    MEMBER_LEFT = "member_left"
    RIDE_START_WARNING = "ride_start_warning"
    MATCHMAKING_STARTED = "matchmaking_started"
    GROUP_FOUND = "group_found"
    GROUP_ACCEPTED = "group_accepted"


class Notification(BaseModel):
    """
    Notification model for MongoDB.

    Stores in-app notifications. Push notifications are sent via FCM
    but also stored here for the notification center.

    Fields:
    - notification_id: Unique UUID
    - user_id: Target user
    - type: Notification type for UI rendering
    - title: Notification title
    - body: Notification body
    - data: Additional data (e.g., group_id, request_id)
    - read: Whether user has read the notification
    - created_at: When notification was created
    """

    notification_id: str = Field(..., description="Unique notification ID")
    user_id: str = Field(..., description="Target user ID")
    type: NotificationType
    title: str = Field(..., description="Notification title")
    body: str = Field(..., description="Notification body")
    data: Optional[dict] = Field(None, description="Additional data")
    read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        use_enum_values = True


class NotificationResponse(BaseModel):
    """Response model for notification."""

    notification_id: str
    type: str
    title: str
    body: str
    data: Optional[dict]
    read: bool
    created_at: datetime
