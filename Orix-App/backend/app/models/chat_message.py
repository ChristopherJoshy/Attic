"""Chat Message Model - Defines the chat message schema for group communication."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Type of chat message."""
    USER = "user"      # Regular user message
    SYSTEM = "system"  # System message (join/leave, etc.)


class ChatMessage(BaseModel):
    """
    Chat message model for MongoDB.
    
    Append-only chat for ride groups. System messages are also stored
    for context. All messages are logged for moderation purposes.
    
    SECURITY: Chat logs are retained for moderation and can be
    included in reports.
    
    Fields:
    - message_id: Unique UUID
    - group_id: Parent group
    - user_id: Sender (None for system messages)
    - user_display_name: Display name at time of message
    - message_type: user or system
    - content: Message content
    - created_at: When message was sent
    """
    message_id: str = Field(..., description="Unique message ID")
    group_id: str = Field(..., description="Parent group ID")
    user_id: Optional[str] = Field(None, description="Sender user ID")
    user_display_name: Optional[str] = Field(None, description="Sender display name")
    message_type: MessageType = Field(default=MessageType.USER)
    content: str = Field(..., description="Message content")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        use_enum_values = True


class ChatMessageCreate(BaseModel):
    """Data required to send a chat message."""
    content: str = Field(..., min_length=1, max_length=1000)


class ChatMessageResponse(BaseModel):
    """Response model for chat message."""
    message_id: str
    user_id: Optional[str]
    user_display_name: Optional[str]
    message_type: str
    content: str
    created_at: datetime
    is_mine: bool = False  # Set by API based on current user
