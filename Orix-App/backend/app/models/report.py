"""Report Model - Defines the report schema for safety and moderation."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ReportStatus(str, Enum):
    """Status of a report."""
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ReportResolution(str, Enum):
    """Resolution action for a report."""
    WARN = "warn"
    SUSPEND = "suspend"
    BAN = "ban"
    DISMISS = "dismiss"


class Report(BaseModel):
    """
    Report model for MongoDB.
    
    Created when a user reports another user for safety concerns.
    Admins are notified via Telegram and can resolve the report.
    
    Fields:
    - report_id: Unique UUID for the report
    - reporter_user_id: User who filed the report
    - accused_user_id: User being reported
    - group_id: Related ride group (if applicable)
    - chat_excerpt: Excerpt from chat (if applicable)
    - note: Additional notes from reporter
    - status: Current status
    - resolution: Action taken (if resolved)
    - resolved_by: Admin who resolved
    - created_at: When report was filed
    - resolved_at: When report was resolved
    """
    report_id: str = Field(..., description="Unique report ID")
    reporter_user_id: str = Field(..., description="User filing the report")
    accused_user_id: str = Field(..., description="User being reported")
    group_id: Optional[str] = Field(None, description="Related group ID")
    chat_excerpt: Optional[str] = Field(None, description="Chat excerpt")
    note: Optional[str] = Field(None, description="Additional notes")
    status: ReportStatus = Field(default=ReportStatus.PENDING)
    resolution: Optional[ReportResolution] = Field(None)
    resolution_note: Optional[str] = Field(None)
    resolved_by: Optional[str] = Field(None, description="Admin user ID")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = Field(None)
    
    class Config:
        use_enum_values = True


class ReportCreate(BaseModel):
    """Data required to create a report."""
    accused_user_id: str = Field(..., description="User being reported")
    group_id: Optional[str] = Field(None)
    note: Optional[str] = Field(None, max_length=1000)
    # Chat excerpt is populated automatically from group chat


class ReportResponse(BaseModel):
    """Response model for report."""
    report_id: str
    accused_user_id: str
    accused_display_name: str
    group_id: Optional[str]
    status: str
    created_at: datetime
    message: str = "Report submitted successfully. Admins have been notified."
