"""Admin Log Model - Defines the audit log schema for admin and system actions."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Any

from pydantic import BaseModel, Field


class ActorType(str, Enum):
    """Type of actor performing the action."""
    USER = "user"
    ADMIN = "admin"
    SYSTEM = "system"


class AdminLog(BaseModel):
    """
    Admin log model for MongoDB.
    
    SECURITY: Every significant action is logged for audit purposes.
    This includes admin actions, system events, and security-related
    user actions.
    
    Fields:
    - log_id: Unique UUID for the log entry
    - timestamp: When the action occurred
    - actor_type: user/admin/system
    - actor_id: ID of the actor (user_id or "system")
    - actor_email: Email of the actor (for admin actions)
    - action: Description of the action
    - target_type: Type of target (user, group, report, etc.)
    - target_id: ID of the target
    - before_state: State before the action (for changes)
    - after_state: State after the action (for changes)
    - metadata: Additional context
    """
    log_id: str = Field(..., description="Unique log ID")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor_type: ActorType
    actor_id: str = Field(..., description="Actor's ID")
    actor_email: Optional[str] = Field(None, description="Actor's email")
    action: str = Field(..., description="Action description")
    target_type: Optional[str] = Field(None)
    target_id: Optional[str] = Field(None)
    before_state: Optional[dict] = Field(None)
    after_state: Optional[dict] = Field(None)
    metadata: Optional[dict] = Field(None)
    
    class Config:
        use_enum_values = True


class AdminLogCreate(BaseModel):
    """Data required to create an admin log entry."""
    actor_type: ActorType
    actor_id: str
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    before_state: Optional[dict] = None
    after_state: Optional[dict] = None
    metadata: Optional[dict] = None


class AdminLogResponse(BaseModel):
    """Response model for admin log."""
    log_id: str
    timestamp: datetime
    actor_type: str
    actor_email: Optional[str]
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
