"""
Notifications Router

In-app notification center.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.models.user import User
from app.services.notification_service import NotificationService
from app.dependencies import get_current_active_user, get_current_admin_user


router = APIRouter()
notification_service = NotificationService()


class NotificationResponse(BaseModel):
    """Notification response."""
    notification_id: str
    type: str
    title: str
    body: str
    data: Optional[dict]
    read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    """List of notifications with unread count."""
    notifications: List[NotificationResponse]
    unread_count: int


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: User = Depends(get_current_active_user)
):
    """Get user's notifications."""
    notifications = await notification_service.get_notifications(
        user_id=current_user.user_id,
        limit=limit,
        unread_only=unread_only
    )
    
    unread_count = await notification_service.get_unread_count(
        current_user.user_id
    )
    
    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                notification_id=n.notification_id,
                type=n.type,
                title=n.title,
                body=n.body,
                data=n.data,
                read=n.read,
                created_at=n.created_at
            )
            for n in notifications
        ],
        unread_count=unread_count
    )


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Mark a notification as read."""
    success = await notification_service.mark_read(
        user_id=current_user.user_id,
        notification_id=notification_id
    )
    
    return {
        "success": success,
        "message": "Notification marked as read" if success else "Notification not found"
    }


@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_active_user)
):
    """Mark all notifications as read."""
    count = await notification_service.mark_all_read(current_user.user_id)
    
    return {
        "success": True,
        "count": count,
        "message": f"Marked {count} notifications as read"
    }


@router.delete("")
async def delete_all_notifications(
    current_user: User = Depends(get_current_active_user)
):
    """Delete all notifications."""
    count = await notification_service.delete_all_notifications(current_user.user_id)
    
    return {
        "success": True,
        "count": count,
        "message": f"Deleted {count} notifications"
    }


@router.post("/test-broadcast")
async def test_broadcast_promotion(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Test broadcasting a random promotion.
    
    Security: Admin only.
    """
    success = await notification_service.broadcast_random_promotion()
    return {"success": success, "message": "Broadcast triggered"}


class TestPushRequest(BaseModel):
    title: str = "Test Notification 🔔"
    body: str = "This is a test notification from Orix!"


@router.post("/test-push")
async def test_push_notification(
    payload: TestPushRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Test sending a push notification to the current user.
    Useful for debugging FCM configuration.
    """
    from app.models.notification import NotificationType
    
    notification = await notification_service.send_notification(
        user_id=current_user.user_id,
        notification_type=NotificationType.SYSTEM,
        title=payload.title,
        body=payload.body,
        data={"action": "test_push"},
        send_push=True
    )
    
    return {
        "success": True,
        "message": "Notification sent (or queued)",
        "notification_id": notification.notification_id
    }
