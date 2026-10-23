"""
Groups Router

Ride group management, readiness confirmation, and chat.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from app.utils.timezone_utils import utc_now

from app.models.user import User
from app.models.chat_message import ChatMessageCreate
from app.services.group_service import GroupService
from app.services.audit_service import AuditService
from app.dependencies import get_current_active_user
from app.database import get_db


router = APIRouter()
group_service = GroupService()
audit_service = AuditService()


class GroupMemberResponse(BaseModel):
    """Group member details."""

    user_id: str
    display_name: str
    photo_url: Optional[str]
    phone: Optional[str]  # Masked until group ACTIVE, then full phone
    gender: Optional[str]
    role: str
    readiness_confirmed: bool
    is_me: bool


class TimeWindow(BaseModel):
    """Time window for a ride."""

    start: str
    end: str


class GroupResponse(BaseModel):
    """Ride group response."""

    group_id: str
    route_summary: str
    pickup_summary: str
    drop_summary: str
    female_only: bool
    status: str
    date: Optional[str] = None  # Ride date in YYYY-MM-DD format
    time_window: Optional[TimeWindow] = None  # Start time info
    confirmation_deadline: datetime
    created_at: datetime
    finalized_at: Optional[datetime]
    my_readiness_confirmed: bool
    all_confirmed: bool
    time_to_confirm_seconds: Optional[int]


class GroupDetailResponse(GroupResponse):
    """Detailed group response with member info."""

    members: List[GroupMemberResponse]


class ConfirmReadinessRequest(BaseModel):
    """Request to confirm readiness."""

    confirmed: bool = True


class ChatMessageResponse(BaseModel):
    """Chat message response."""

    message_id: str
    user_id: Optional[str]
    user_display_name: Optional[str]
    message_type: str
    content: str
    created_at: datetime
    is_mine: bool


@router.get("", response_model=List[GroupResponse])
async def get_my_groups(
    include_completed: bool = False,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get user's ride groups.

    By default, returns only active groups.
    """
    groups = await group_service.get_user_groups(
        user_id=current_user.user_id, include_completed=include_completed
    )

    now = utc_now()

    result = []
    for g in groups:
        my_confirmed = any(
            m.user_id == current_user.user_id and m.readiness_confirmed
            for m in g.members
        )
        all_confirmed = all(m.readiness_confirmed for m in g.members)

        time_to_confirm = None
        if g.status == "confirming":
            deadline = g.confirmation_deadline
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            time_to_confirm = max(0, int((deadline - now).total_seconds()))

        # Get time_window from group if available
        group_time_window = None
        if hasattr(g, "time_window") and g.time_window:
            group_time_window = TimeWindow(
                start=g.time_window.get("start", ""), end=g.time_window.get("end", "")
            )

        result.append(
            GroupResponse(
                group_id=g.group_id,
                route_summary=g.route_summary,
                pickup_summary=g.pickup_summary,
                drop_summary=g.drop_summary,
                female_only=g.female_only,
                status=g.status,
                date=getattr(g, "date", None),
                time_window=group_time_window,
                confirmation_deadline=g.confirmation_deadline,
                created_at=g.created_at,
                finalized_at=g.finalized_at,
                my_readiness_confirmed=my_confirmed,
                all_confirmed=all_confirmed,
                time_to_confirm_seconds=time_to_confirm,
            )
        )

    return result


@router.get("/discover/available", response_model=List[GroupResponse])
async def discover_available_rides(
    current_user: User = Depends(get_current_active_user),
):
    """
    Discover available rides from other users.

    Returns ACTIVE groups that the user is not already part of.
    Excludes groups where user is already a member.
    """
    available = await group_service.get_available_rides(
        current_user_id=current_user.user_id
    )

    now = utc_now()
    result = []

    for g in available:
        all_confirmed = all(m.readiness_confirmed for m in g.members)

        result.append(
            GroupResponse(
                group_id=g.group_id,
                route_summary=g.route_summary,
                pickup_summary=g.pickup_summary,
                drop_summary=g.drop_summary,
                female_only=g.female_only,
                status=g.status,
                date=getattr(g, "date", None),
                time_window=None,  # Don't expose full details for discovery
                confirmation_deadline=g.confirmation_deadline,
                created_at=g.created_at,
                finalized_at=g.finalized_at,
                my_readiness_confirmed=False,  # User isn't in this group yet
                all_confirmed=all_confirmed,
                time_to_confirm_seconds=None,
            )
        )

    return result


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group(
    group_id: str, current_user: User = Depends(get_current_active_user)
):
    """
    Get group details with member information.

    SECURITY: Only group members can view details.
    Phone numbers are shared among group members.
    """
    group_data = await group_service.get_group_with_members(
        group_id=group_id, requesting_user_id=current_user.user_id
    )

    if not group_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or you are not a member",
        )

    now = utc_now()

    my_confirmed = any(
        m["user_id"] == current_user.user_id and m["readiness_confirmed"]
        for m in group_data["members"]
    )
    all_confirmed = all(m["readiness_confirmed"] for m in group_data["members"])

    time_to_confirm = None
    deadline = group_data["confirmation_deadline"]
    if isinstance(deadline, str):
        deadline = datetime.fromisoformat(deadline)

    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    if group_data["status"] == "confirming":
        time_to_confirm = max(0, int((deadline - now).total_seconds()))

    members = [GroupMemberResponse(**m) for m in group_data["members"]]

    # Get time_window from group_data if available
    group_time_window = None
    if group_data.get("time_window"):
        tw = group_data["time_window"]
        group_time_window = TimeWindow(start=tw.get("start", ""), end=tw.get("end", ""))

    return GroupDetailResponse(
        group_id=group_data["group_id"],
        route_summary=group_data["route_summary"],
        pickup_summary=group_data["pickup_summary"],
        drop_summary=group_data["drop_summary"],
        female_only=group_data["female_only"],
        status=group_data["status"],
        date=group_data.get("date"),
        time_window=group_time_window,
        confirmation_deadline=deadline,
        created_at=group_data["created_at"],
        finalized_at=group_data.get("finalized_at"),
        my_readiness_confirmed=my_confirmed,
        all_confirmed=all_confirmed,
        time_to_confirm_seconds=time_to_confirm,
        members=members,
    )


@router.post("/{group_id}/confirm")
async def confirm_readiness(
    group_id: str,
    request: ConfirmReadinessRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Confirm readiness to join the ride.

    All members must confirm within the deadline for the group to
    be finalized.
    """
    if not request.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot unconfirm readiness"
        )

    # Validate group exists before processing
    db = get_db()
    group_data = await db.ride_groups.find_one({"group_id": group_id})

    if not group_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or has been completed",
        )

    # Validate user is a group member
    if not any(
        m.get("user_id") == current_user.user_id for m in group_data.get("members", [])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )

    group = await group_service.confirm_readiness(
        group_id=group_id, user_id=current_user.user_id
    )

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or you are not a member",
        )

    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="confirmed_readiness",
        target_type="group",
        target_id=group_id,
    )

    all_confirmed = all(m.readiness_confirmed for m in group.members)

    return {
        "message": "Readiness confirmed",
        "all_confirmed": all_confirmed,
        "group_status": group.status,
    }


@router.post("/{group_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    group_id: str,
    request: ChatMessageCreate,
    current_user: User = Depends(get_current_active_user),
):
    """
    Send a chat message in the group.

    SECURITY: Only group members can send messages.
    Messages are logged for moderation.
    """
    # Validate group exists and user is member before processing
    db = get_db()
    group_data = await db.ride_groups.find_one({"group_id": group_id})

    if not group_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or has been completed",
        )

    if not any(
        m.get("user_id") == current_user.user_id for m in group_data.get("members", [])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )

    message = await group_service.send_chat_message(
        group_id=group_id, user_id=current_user.user_id, content=request.content
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to send message",
        )

    return ChatMessageResponse(
        message_id=message.message_id,
        user_id=message.user_id,
        user_display_name=message.user_display_name,
        message_type=message.message_type,
        content=message.content,
        created_at=message.created_at,
        is_mine=True,
    )


@router.get("/{group_id}/chat", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    group_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get chat messages for the group.

    SECURITY: Only group members can read messages.
    """
    messages = await group_service.get_chat_messages(
        group_id=group_id, user_id=current_user.user_id, limit=limit
    )

    return [
        ChatMessageResponse(
            message_id=m.message_id,
            user_id=m.user_id,
            user_display_name=m.user_display_name,
            message_type=m.message_type,
            content=m.content,
            created_at=m.created_at,
            is_mine=m.user_id == current_user.user_id,
        )
        for m in messages
    ]


@router.post("/groups/{group_id}/mark-here")
async def mark_rider_here(
    group_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Mark that the rider is at the pickup location (clicked 'I am here').
    Completes the group and triggers rating notifications.
    """
    try:
        group = await group_service.mark_rider_here(group_id, current_user.user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark rider as here",
        )

    # Log the action
    await audit_service.log_action(
        user_id=current_user.user_id,
        action="marked_here",
        object_type="group",
        object_id=group_id,
        details={"status": "completed_by_rider"},
    )

    return {
        "message": "Marked as here, group completed",
        "group_id": group_id,
        "status": "completed",
    }


@router.post("/{group_id}/finish")
async def finish_ride(
    group_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Finish a ride and remove the user from the group.
    - Removes user from the group
    - If all users have left after completion, immediately delete the group
    - Otherwise, schedule deletion for 34 hours after completion time
    """
    try:
        result = await group_service.finish_ride(group_id, current_user.user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to finish ride: {str(e)}",
        )

    # Log the action
    await audit_service.log_action(
        user_id=current_user.user_id,
        action="finish_ride",
        object_type="group",
        object_id=group_id,
        details={
            "group_deleted": result.get("group_deleted", False),
            "remaining_members": result.get("remaining_members", 0),
        },
    )

    return result
