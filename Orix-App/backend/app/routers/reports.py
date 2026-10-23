"""
Reports Router

Safety reporting and moderation.
"""

import uuid
from app.utils.timezone_utils import utc_now
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.models.user import User
from app.models.report import ReportCreate, ReportStatus
from app.database import get_db
from app.services.group_service import GroupService
from app.services.audit_service import AuditService
from app.dependencies import get_current_active_user
from app.config import settings


router = APIRouter()
group_service = GroupService()
audit_service = AuditService()


class ReportRequest(BaseModel):
    """Request to create a report."""
    accused_user_id: str = Field(..., description="User being reported")
    group_id: Optional[str] = Field(None, description="Related group")
    note: Optional[str] = Field(None, max_length=1000, description="Additional context")


class ReportResponse(BaseModel):
    """Report creation response."""
    report_id: str
    message: str


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: ReportRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a report about another user.
    
    Reports are reviewed by admins via Telegram.
    If a group_id is provided, recent chat is automatically included.
    
    SECURITY: Report creation is logged and abuse can be detected.
    """
    db = get_db()
    
    # Cannot report yourself
    if request.accused_user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report yourself"
        )
    
    # Verify accused user exists
    accused = await db.users.find_one({"user_id": request.accused_user_id})
    if not accused:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get chat excerpt if group is provided
    chat_excerpt = None
    if request.group_id:
        # Verify both users are in the group
        group = await db.ride_groups.find_one({
            "group_id": request.group_id,
            "members.user_id": {"$all": [current_user.user_id, request.accused_user_id]}
        })
        
        if group:
            chat_excerpt = await group_service.get_recent_chat_for_report(
                request.group_id
            )
    
    # Create report
    report_id = str(uuid.uuid4())
    
    report = {
        "report_id": report_id,
        "reporter_user_id": current_user.user_id,
        "accused_user_id": request.accused_user_id,
        "group_id": request.group_id,
        "chat_excerpt": chat_excerpt,
        "note": request.note,
        "status": ReportStatus.PENDING,
        "resolution": None,
        "resolution_note": None,
        "resolved_by": None,
        "created_at": utc_now(),
        "resolved_at": None
    }
    
    await db.reports.insert_one(report)
    
    # Log the report
    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="created_report",
        target_type="user",
        target_id=request.accused_user_id,
        metadata={
            "report_id": report_id,
            "group_id": request.group_id
        }
    )
    
    # Notify admins via Telegram
    await _notify_admins_telegram(
        report_id=report_id,
        reporter_email=current_user.email,
        accused_email=accused.get("email", "Unknown"),
        note=request.note
    )
    
    return ReportResponse(
        report_id=report_id,
        message="Report submitted successfully. Admins have been notified."
    )


async def _notify_admins_telegram(
    report_id: str,
    reporter_email: str,
    accused_email: str,
    note: Optional[str]
):
    """
    Send report notification to admin Telegram chats.
    
    TODO: Implement when Telegram bot is configured.
    """
    try:
        from telegram import Bot
        
        if not settings.telegram_bot_token or settings.telegram_bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
            return
        
        bot = Bot(token=settings.telegram_bot_token)
        
        message = (
            f"*New Report*\n\n"
            f"Report ID: `{report_id}`\n"
            f"Reporter: {reporter_email}\n"
            f"Accused: {accused_email}\n"
        )
        
        if note:
            message += f"Note: {note}"
        
        message += f"\n\nUse /resolve {report_id} to review."
        
        for chat_id in settings.admin_chat_ids_list:
            await bot.send_message(
                chat_id=chat_id,
                text=message,
                parse_mode="Markdown"
            )
    except Exception as e:
        # Don't fail report creation if Telegram notification fails
        import logging
        logging.warning(f"Telegram notification failed: {e}")
