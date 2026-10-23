"""
Admin Router

Admin API endpoints for moderation and system management.
"""

from datetime import datetime, timedelta
from app.utils.timezone_utils import utc_now
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List

from app.models.user import User
from app.models.admin_log import ActorType
from app.database import get_db
from app.services.user_service import UserService
from app.services.group_service import GroupService
from app.services.notification_service import NotificationService
from app.services.audit_service import AuditService
from app.services.redis_service import RedisService
from app.dependencies import get_admin_user


router = APIRouter()
user_service = UserService()
group_service = GroupService()
notification_service = NotificationService()
audit_service = AuditService()
redis_service = RedisService()


# =============================================================================
# Request/Response Models
# =============================================================================

class UserLookupResponse(BaseModel):
    """User lookup response."""
    user_id: str
    email: str
    display_name: str
    phone: Optional[str]
    gender: Optional[str]
    status: str
    trust_score: float
    is_rider: bool
    onboarding_completed: bool
    created_at: datetime


class BanUserRequest(BaseModel):
    """Request to ban a user."""
    reason: str = Field(..., min_length=1, max_length=500)


class SuspendUserRequest(BaseModel):
    """Request to suspend a user."""
    hours: int = Field(..., ge=1, le=8760)  # Max 1 year
    reason: str = Field(..., min_length=1, max_length=500)


class ResolveReportRequest(BaseModel):
    """Request to resolve a report."""
    resolution: str = Field(..., pattern="^(warn|suspend|ban|dismiss)$")
    note: Optional[str] = None
    suspend_hours: Optional[int] = None


class MaintenanceModeRequest(BaseModel):
    """Request to set maintenance mode."""
    enabled: bool
    message: Optional[str] = None


class AdminLogResponse(BaseModel):
    """Admin log entry response."""
    log_id: str
    timestamp: datetime
    actor_type: str
    actor_email: Optional[str]
    action: str
    target_type: Optional[str]
    target_id: Optional[str]


# =============================================================================
# User Management Endpoints
# =============================================================================

@router.get("/users/lookup")
async def lookup_user(
    email: Optional[str] = None,
    user_id: Optional[str] = None,
    admin: User = Depends(get_admin_user)
):
    """
    Lookup a user by email or user_id.
    
    SECURITY: Admin action, requires X-Admin-Secret header.
    Exactly one of email or user_id must be provided.
    """
    if not email and not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either email or user_id"
        )
    
    if email and user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide only one of email or user_id"
        )
    
    db = get_db()
    
    if email:
        user_doc = await db.users.find_one({"email": email.lower()})
    else:
        user_doc = await db.users.find_one({"user_id": user_id})
    
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserLookupResponse(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        display_name=user_doc["display_name"],
        phone=user_doc.get("phone"),
        gender=user_doc.get("gender"),
        status=user_doc["status"],
        trust_score=user_doc.get("trust_score", 0.5),
        is_rider=user_doc.get("is_rider", False),
        onboarding_completed=user_doc.get("onboarding_completed", False),
        created_at=user_doc["created_at"]
    )


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    request: BanUserRequest,
    admin: User = Depends(get_admin_user)
):
    """
    Permanently ban a user.
    
    SECURITY: Admin action, must be logged.
    """
    target_user = await user_service.get_user(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    before_state = {"status": target_user.status}
    
    updated = await user_service.ban_user(user_id, request.reason)
    
    # Log the action
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action="ban_user",
        target_type="user",
        target_id=user_id,
        reason=request.reason,
        before_state=before_state,
        after_state={"status": "banned"}
    )
    
    # Notify the user
    await notification_service.notify_ban(
        user_id=user_id,
        reason=request.reason
    )
    
    return {"message": f"User {target_user.email} has been banned"}


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    request: SuspendUserRequest,
    admin: User = Depends(get_admin_user)
):
    """
    Suspend a user for a specified duration.
    
    SECURITY: Admin action, must be logged.
    """
    target_user = await user_service.get_user(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    before_state = {"status": target_user.status}
    
    updated = await user_service.suspend_user(
        user_id, 
        request.hours, 
        request.reason
    )
    
    # Log the action
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action="suspend_user",
        target_type="user",
        target_id=user_id,
        reason=request.reason,
        before_state=before_state,
        after_state={
            "status": "suspended",
            "duration_hours": request.hours
        }
    )
    
    # Notify the user
    await notification_service.notify_suspension(
        user_id=user_id,
        hours=request.hours,
        reason=request.reason
    )
    
    return {"message": f"User {target_user.email} suspended for {request.hours} hours"}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    admin: User = Depends(get_admin_user)
):
    """
    Unban or unsuspend a user.
    
    SECURITY: Admin action, must be logged.
    """
    target_user = await user_service.get_user(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    before_state = {"status": target_user.status}
    
    updated = await user_service.unban_user(user_id)
    
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action="unban_user",
        target_type="user",
        target_id=user_id,
        before_state=before_state,
        after_state={"status": "active"}
    )
    
    return {"message": f"User {target_user.email} has been unbanned"}


@router.get("/users/{user_id}/history", response_model=List[AdminLogResponse])
async def get_user_history(
    user_id: str,
    limit: int = 50,
    admin: User = Depends(get_admin_user)
):
    """Get admin action history for a user."""
    logs = await audit_service.get_user_history(user_id, limit)
    
    return [
        AdminLogResponse(
            log_id=log.log_id,
            timestamp=log.timestamp,
            actor_type=log.actor_type,
            actor_email=log.actor_email,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id
        )
        for log in logs
    ]


# =============================================================================
# Group Management Endpoints
# =============================================================================

@router.get("/groups/{group_id}")
async def get_group_admin(
    group_id: str,
    admin: User = Depends(get_admin_user)
):
    """Get group details as admin."""
    db = get_db()
    group = await db.ride_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    return group


@router.post("/groups/{group_id}/cancel")
async def cancel_group_admin(
    group_id: str,
    reason: str = "Cancelled by admin",
    admin: User = Depends(get_admin_user)
):
    """
    Cancel a group as admin.
    
    SECURITY: Admin action, must be logged.
    """
    success = await group_service.cancel_group(group_id, reason)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action="cancel_group",
        target_type="group",
        target_id=group_id,
        reason=reason
    )
    
    return {"message": "Group cancelled"}


# =============================================================================
# Report Management Endpoints
# =============================================================================

@router.get("/reports")
async def get_pending_reports(
    status: str = "pending",
    limit: int = 50,
    admin: User = Depends(get_admin_user)
):
    """Get pending reports."""
    db = get_db()
    
    query = {}
    if status != "all":
        query["status"] = status
    
    cursor = db.reports.find(query).sort("created_at", -1).limit(limit)
    
    reports = []
    async for doc in cursor:
        reports.append(doc)
    
    return {"reports": reports}


@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: str,
    request: ResolveReportRequest,
    admin: User = Depends(get_admin_user)
):
    """
    Resolve a report.
    
    SECURITY: Admin action, must be logged.
    """
    db = get_db()
    
    report = await db.reports.find_one({"report_id": report_id})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    accused_id = report["accused_user_id"]
    
    # Take action based on resolution
    if request.resolution == "ban":
        await user_service.ban_user(accused_id, request.note or "Banned due to report")
        await notification_service.notify_ban(accused_id, request.note or "Policy violation")
        
    elif request.resolution == "suspend":
        hours = request.suspend_hours or 24
        await user_service.suspend_user(accused_id, hours, request.note or "Suspended due to report")
        await notification_service.notify_suspension(accused_id, hours, request.note or "Policy violation")
        
    elif request.resolution == "warn":
        await notification_service.notify_report_action(
            accused_id, 
            "Warning", 
            request.note
        )
    
    # Update report
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": "resolved",
            "resolution": request.resolution,
            "resolution_note": request.note,
            "resolved_by": admin.user_id,
            "resolved_at": utc_now()
        }}
    )
    
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action=f"resolve_report_{request.resolution}",
        target_type="report",
        target_id=report_id,
        reason=request.note,
        metadata={"accused_user_id": accused_id}
    )
    
    return {"message": f"Report resolved with action: {request.resolution}"}


# =============================================================================
# System Management Endpoints
# =============================================================================

@router.post("/maintenance")
async def set_maintenance_mode(
    request: MaintenanceModeRequest,
    admin: User = Depends(get_admin_user)
):
    """
    Enable or disable maintenance mode.
    
    When enabled, the app shows maintenance screen to all users.
    """
    await redis_service.set_maintenance_mode(request.enabled)
    
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action=f"maintenance_mode_{'enabled' if request.enabled else 'disabled'}",
        target_type="system",
        target_id="maintenance",
        metadata={"message": request.message}
    )
    
    return {
        "maintenance_mode": request.enabled,
        "message": request.message
    }


@router.get("/maintenance")
async def get_maintenance_mode(
    admin: User = Depends(get_admin_user)
):
    """Get current maintenance mode status."""
    enabled = await redis_service.is_maintenance_mode()
    return {"maintenance_mode": enabled}


@router.post("/reconcile")
async def trigger_reconciliation(
    admin: User = Depends(get_admin_user)
):
    """
    Manually trigger Redis ↔ MongoDB reconciliation.
    
    Rehydrates pending ride requests from MongoDB to Redis.
    """
    db = get_db()
    
    # Get pending requests from MongoDB
    cursor = db.ride_requests.find({
        "status": {"$in": ["pending", "matching"]},
        "expires_at": {"$gt": utc_now()}
    })
    
    count = 0
    async for request in cursor:
        await redis_service.add_to_match_queue(
            request_id=request["request_id"],
            user_id=request["user_id"],
            date=request["date"],
            pickup_lat=request["pickup"]["coordinates"][1],
            pickup_lng=request["pickup"]["coordinates"][0],
            drop_lat=request["drop"]["coordinates"][1],
            drop_lng=request["drop"]["coordinates"][0],
            time_start=request["time_window"]["start"],
            time_end=request["time_window"]["end"],
            female_only=request.get("female_only", False),
            allow_riders=request.get("allow_riders", True)
        )
        count += 1
    
    await audit_service.log_admin_action(
        admin_id=admin.user_id,
        admin_email=admin.email,
        action="manual_reconciliation",
        target_type="system",
        target_id="redis",
        metadata={"requests_rehydrated": count}
    )
    
    return {"message": f"Reconciliation complete. Rehydrated {count} requests."}


@router.get("/stats")
async def get_stats(
    admin: User = Depends(get_admin_user)
):
    """Get system statistics."""
    db = get_db()
    
    user_count = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": "active"})
    pending_requests = await db.ride_requests.count_documents({"status": "pending"})
    active_groups = await db.ride_groups.count_documents({"status": "active"})
    pending_reports = await db.reports.count_documents({"status": "pending"})
    
    queue_stats = await redis_service.get_queue_stats()
    maintenance = await redis_service.is_maintenance_mode()
    
    return {
        "users": {
            "total": user_count,
            "active": active_users
        },
        "rides": {
            "pending_requests": pending_requests,
            "active_groups": active_groups
        },
        "reports": {
            "pending": pending_reports
        },
        "queue": queue_stats,
        "maintenance_mode": maintenance
    }


@router.get("/logs", response_model=List[AdminLogResponse])
async def get_recent_logs(
    limit: int = 50,
    admin: User = Depends(get_admin_user)
):
    """Get recent admin action logs."""
    logs = await audit_service.get_recent_admin_actions(limit)
    
    return [
        AdminLogResponse(
            log_id=log.log_id,
            timestamp=log.timestamp,
            actor_type=log.actor_type,
            actor_email=log.actor_email,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id
        )
        for log in logs
    ]
