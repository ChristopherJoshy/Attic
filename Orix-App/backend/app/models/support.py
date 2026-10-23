from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

class TicketMessage(BaseModel):
    """A message within a support ticket thread."""
    sender_id: str = Field(..., description="User ID or 'admin'")
    sender_name: Optional[str] = Field(None, description="Name of sender")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_admin: bool = Field(False, description="Whether this message is from an admin")

class SupportTicket(BaseModel):
    """
    Model representing a support ticket.
    Types: 'issue', 'feature', 'report_user', 'other'
    """
    ticket_id: str = Field(..., description="Unique ticket ID")
    user_id: str = Field(..., description="ID of the user who created the ticket")
    type: str = Field(..., description="Type of ticket: issue, feature, report_user, other")
    subject: str = Field(..., description="Brief summary")
    description: str = Field(..., description="Detailed description")
    status: str = Field("open", description="open, in_progress, resolved, closed")
    priority: str = Field("normal", description="low, normal, high, urgent")
    
    # For user reports
    reported_user_id: Optional[str] = Field(None, description="ID of reported user if applicable")
    
    messages: List[TicketMessage] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None

class CreateTicketRequest(BaseModel):
    type: str
    subject: str
    description: str
    priority: str = "normal"
    reported_user_id: Optional[str] = None

class AddMessageRequest(BaseModel):
    content: str
