"""
Rides Router

Ride request creation and management.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from app.utils.timezone_utils import utc_now

from app.models.user import User
from app.models.ride_request import RideRequestCreate, RideRequestStatus, TimeWindow
from app.services.ride_service import RideService
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.dependencies import get_current_active_user


router = APIRouter()
ride_service = RideService()

audit_service = AuditService()
notification_service = NotificationService()


class RideRequestResponse(BaseModel):
    """Ride request response."""
    request_id: str
    pickup_label: str
    drop_label: str
    date: str
    time_window: TimeWindow
    allow_riders: bool
    female_only: bool
    status: str
    group_id: Optional[str]
    created_at: datetime
    expires_at: datetime
    time_remaining_seconds: int



class MatchingStatusResponse(BaseModel):
    """Matching status response."""
    has_active_request: bool
    request_id: Optional[str] = None
    status: Optional[str] = None
    pickup_label: Optional[str] = None
    drop_label: Optional[str] = None
    date: Optional[str] = None
    time_window: Optional[TimeWindow] = None
    time_remaining_seconds: Optional[int] = None
    expires_at: Optional[str] = None
    pending_confirmation_group_id: Optional[str] = None
    my_readiness_confirmed: bool = False
    # Match quality fields for transparency
    match_score: Optional[float] = None
    route_overlap_score: Optional[float] = None
    time_compatibility_score: Optional[float] = None


@router.delete("/{request_id}")
async def cancel_ride_request(
    request_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Cancel a pending ride request.
    
    Only the request owner can cancel.
    """
    success = await ride_service.cancel_ride_request(
        user_id=current_user.user_id,
        request_id=request_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride request not found or cannot be cancelled"
        )
    
    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="cancelled_ride_request",
        target_type="ride_request",
        target_id=request_id
    )
    
    return {"message": "Ride request cancelled"}


@router.post("", response_model=RideRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_ride_request(
    request: RideRequestCreate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new ride request.
    
    Validates:
    - User has no active request (handled by service)
    - Female-only constraint matches user gender
    """
    if request.female_only:
        # Strict gender check: defined in user model
        # Allow 'F', 'Female', 'female' just to be safe, but typically it is 'F' or 'Female'
        user_gender = (current_user.gender or "").lower()
        if user_gender not in ["f", "female"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only female users can set the female-only preference."
            )

    created_request = await ride_service.create_ride_request(
        user_id=current_user.user_id,
        data=request
    )
    
    if not created_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create ride request. You may already have an active request."
        )
        
    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="created_ride_request",
        target_type="ride_request",
        target_id=created_request.request_id
    )
    
    # Notification is already handled in ride_service.create_ride_request

    # Return the created request

    # Calculate time remaining
    now = utc_now()
    expires_at = created_request.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    time_remaining = max(0, int((expires_at - now).total_seconds()))

    return RideRequestResponse(
        request_id=created_request.request_id,
        pickup_label=created_request.pickup_label,
        drop_label=created_request.drop_label,
        date=created_request.date,
        time_window=created_request.time_window,
        allow_riders=created_request.allow_riders,
        female_only=created_request.female_only,
        status=created_request.status,
        group_id=created_request.group_id,
        created_at=created_request.created_at,
        expires_at=created_request.expires_at,
        time_remaining_seconds=time_remaining
    )

@router.get("/status", response_model=MatchingStatusResponse)
async def get_matching_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current matchmaking status.
    
    Returns the active ride request status with time remaining.
    """
    status_data = await ride_service.get_matchmaking_status(current_user.user_id)
    
    if not status_data:
        return MatchingStatusResponse(has_active_request=False)
    
    return MatchingStatusResponse(
        has_active_request=True,
        request_id=status_data["request_id"],
        status=status_data["status"],
        pickup_label=status_data["pickup_label"],
        drop_label=status_data["drop_label"],
        date=status_data["date"],
        time_window=TimeWindow(**status_data["time_window"]),
        time_remaining_seconds=status_data["time_remaining_seconds"],
        expires_at=status_data["expires_at"],
        pending_confirmation_group_id=status_data.get("pending_confirmation_group_id"),
        my_readiness_confirmed=status_data.get("my_readiness_confirmed", False)
    )


@router.get("", response_model=List[RideRequestResponse])
async def get_my_rides(
    include_history: bool = False,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get user's ride requests.
    
    By default, returns only pending/active requests.
    Set include_history=true for all requests.
    """
    requests = await ride_service.get_user_requests(
        user_id=current_user.user_id,
        include_history=include_history
    )
    
    now = utc_now()
    
    return [
        RideRequestResponse(
            request_id=r.request_id,
            pickup_label=r.pickup_label,
            drop_label=r.drop_label,
            date=r.date,
            time_window=r.time_window,
            allow_riders=r.allow_riders,
            female_only=r.female_only,
            status=r.status,
            group_id=r.group_id,
            created_at=r.created_at,
            expires_at=r.expires_at,
            time_remaining_seconds=max(0, int(((r.expires_at.replace(tzinfo=timezone.utc) if r.expires_at.tzinfo is None else r.expires_at) - now).total_seconds()))
        )
        for r in requests
    ]
