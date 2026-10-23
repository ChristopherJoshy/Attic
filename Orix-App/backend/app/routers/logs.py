from fastapi import APIRouter, Depends
from app.dependencies import get_current_user_optional, get_current_active_user
from app.models.user import User
from app.models.log import ClientLogRequest, ActivityLogRequest, NotificationReceivedRequest
from app.services.audit_service import AuditService

router = APIRouter()
audit_service = AuditService()


@router.post("/client")
async def log_client_error(
    request: ClientLogRequest,
    current_user: User = Depends(get_current_user_optional)
):
    """
    Log client-side errors to Telegram.
    Allows unauthenticated logging for login/startup issues.
    """
    try:
        user_info = None
        user_email = None
        user_id = None
        
        if current_user:
            user_id = current_user.user_id
            user_email = current_user.email
            user_info = f"{current_user.email} ({current_user.user_id})"
        else:
            user_info = "Unauthenticated User"

        await audit_service.log_client_bug(
            level=request.level,
            message=request.message,
            context=request.context,
            stack_trace=request.stack_trace,
            user_id=user_id,
            user_email=user_email,
            metadata=request.metadata
        )
        
        return {"status": "logged"}
    except Exception as e:
        print(f"Failed to log client error: {e}")
        return {"status": "failed", "error": str(e)}


@router.post("/activity")
async def log_user_activity(
    request: ActivityLogRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Log user activity/actions to Telegram.
    Tracks screen navigation, button taps, feature usage.
    """
    try:
        await audit_service.log_user_activity(
            user_id=current_user.user_id,
            action_type=request.action_type,
            screen=request.screen,
            target=request.target,
            metadata=request.metadata
        )
        
        return {"status": "logged"}
    except Exception as e:
        print(f"Failed to log activity: {e}")
        return {"status": "failed", "error": str(e)}


@router.post("/notification-received")
async def log_notification_received(
    request: NotificationReceivedRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Log when user receives/opens/interacts with a notification.
    """
    try:
        await audit_service.log_notification_received(
            user_id=current_user.user_id,
            notification_id=request.notification_id,
            action=request.action
        )
        
        return {"status": "logged"}
    except Exception as e:
        print(f"Failed to log notification received: {e}")
        return {"status": "failed", "error": str(e)}
