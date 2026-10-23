"""
Users Router

User profile management and rider toggle.
"""

from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    HTTPException,
    status,
    Depends,
    UploadFile,
    File,
    Response,
)
from pydantic import BaseModel, Field
from typing import Optional
from app.utils.timezone_utils import utc_now

from app.models.user import User, UserUpdate
from app.services.user_service import UserService
from app.services.audit_service import AuditService
from app.dependencies import get_current_user, get_current_active_user
from typing import List


router = APIRouter()
user_service = UserService()
audit_service = AuditService()


class UserProfileResponse(BaseModel):
    """User profile response."""

    user_id: str
    email: str
    display_name: str
    photo_url: Optional[str]
    phone: Optional[str]  # Full phone in own profile
    gender: Optional[str]
    is_rider: bool
    rider_info: Optional[dict]
    onboarding_completed: bool
    status: str


class UpdateProfileRequest(BaseModel):
    """Request to update profile."""

    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    fcm_token: Optional[str] = None


class SearchResult(BaseModel):
    """Public user search result."""

    user_id: str
    display_name: str
    photo_url: Optional[str] = None
    email: str


class RiderEnableRequest(BaseModel):
    """Request to enable rider mode."""

    vehicle_type: str = Field(..., min_length=1, max_length=50)
    from_lat: float = Field(..., ge=-90, le=90)
    from_lng: float = Field(..., ge=-180, le=180)
    from_label: str = Field(..., min_length=1, max_length=200)
    to_lat: float = Field(..., ge=-90, le=90)
    to_lng: float = Field(..., ge=-180, le=180)
    to_label: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time_window_start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    time_window_end: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    seats: int = Field(..., ge=1, le=6)


class RiderInfoResponse(BaseModel):
    """Rider information response."""

    is_rider: bool
    vehicle_type: Optional[str] = None
    from_location: Optional[dict] = None
    from_label: Optional[str] = None
    to_location: Optional[dict] = None
    to_label: Optional[str] = None
    date: Optional[str] = None
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    seats: Optional[int] = None
    expires_at: Optional[datetime] = None
    time_remaining_seconds: Optional[int] = None


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile."""
    return UserProfileResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        display_name=current_user.display_name,
        photo_url=current_user.photo_url,
        phone=current_user.phone,
        gender=current_user.gender,
        is_rider=current_user.is_rider,
        rider_info=(
            current_user.rider_info.model_dump() if current_user.rider_info else None
        ),
        onboarding_completed=current_user.onboarding_completed,
        status=current_user.status,
    )


@router.get("/search", response_model=List[SearchResult])
async def search_users(
    query: str, current_user: User = Depends(get_current_active_user)
):
    """
    Search for users to report.
    Returns limited public info.
    """
    users = await user_service.search_users(query)

    return [
        SearchResult(
            user_id=u.user_id,
            display_name=u.display_name,
            photo_url=u.photo_url,
            email=u.email,
        )
        for u in users
    ]


@router.put("/me", response_model=UserProfileResponse)
async def update_profile(
    request: UpdateProfileRequest, current_user: User = Depends(get_current_user)
):
    """Update current user's profile."""
    update = UserUpdate(
        display_name=request.display_name,
        photo_url=request.photo_url,
        fcm_token=request.fcm_token,
    )

    updated_user = await user_service.update_user(current_user.user_id, update)

    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )

    # Log action
    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="update_profile",
        metadata={"updated_fields": list(update.model_dump(exclude_unset=True).keys())},
    )

    return UserProfileResponse(
        user_id=updated_user.user_id,
        email=updated_user.email,
        display_name=updated_user.display_name,
        photo_url=updated_user.photo_url,
        phone=updated_user.phone,
        gender=updated_user.gender,
        is_rider=updated_user.is_rider,
        rider_info=(
            updated_user.rider_info.model_dump() if updated_user.rider_info else None
        ),
        onboarding_completed=updated_user.onboarding_completed,
        status=updated_user.status,
    )


@router.get("/me/rider", response_model=RiderInfoResponse)
async def get_rider_info(current_user: User = Depends(get_current_active_user)):
    """Get current rider status and info."""
    if not current_user.is_rider or not current_user.rider_info:
        return RiderInfoResponse(is_rider=False)

    info = current_user.rider_info
    now = utc_now()
    expires_at = info.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    time_remaining = max(0, int((expires_at - now).total_seconds()))

    # Check if expired
    if time_remaining == 0:
        await user_service.disable_rider_mode(current_user.user_id)
        return RiderInfoResponse(is_rider=False)

    return RiderInfoResponse(
        is_rider=True,
        vehicle_type=info.vehicle_type,
        from_location=info.from_location,
        from_label=info.from_label,
        to_location=info.to_location,
        to_label=info.to_label,
        date=info.date,
        time_window_start=info.time_window_start,
        time_window_end=info.time_window_end,
        seats=info.seats,
        expires_at=info.expires_at,
        time_remaining_seconds=time_remaining,
    )


@router.post("/me/rider", response_model=RiderInfoResponse)
async def enable_rider_mode(
    request: RiderEnableRequest, current_user: User = Depends(get_current_active_user)
):
    """
    Enable rider mode with vehicle and availability info.

    Rider availability expires after:
    - First successful ride, OR
    - 24 hours (configurable)
    """
    updated_user = await user_service.enable_rider_mode(
        user_id=current_user.user_id,
        vehicle_type=request.vehicle_type,
        from_lat=request.from_lat,
        from_lng=request.from_lng,
        from_label=request.from_label,
        to_lat=request.to_lat,
        to_lng=request.to_lng,
        to_label=request.to_label,
        date=request.date,
        time_window_start=request.time_window_start,
        time_window_end=request.time_window_end,
        seats=request.seats,
    )

    if not updated_user or not updated_user.rider_info:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enable rider mode",
        )

    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="enabled_rider_mode",
        metadata={"vehicle_type": request.vehicle_type, "seats": request.seats},
    )

    info = updated_user.rider_info
    now = utc_now()
    expires_at = info.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    time_remaining = max(0, int((expires_at - now).total_seconds()))

    return RiderInfoResponse(
        is_rider=True,
        vehicle_type=info.vehicle_type,
        from_location=info.from_location,
        from_label=info.from_label,
        to_location=info.to_location,
        to_label=info.to_label,
        date=info.date,
        time_window_start=info.time_window_start,
        time_window_end=info.time_window_end,
        seats=info.seats,
        expires_at=info.expires_at,
        time_remaining_seconds=time_remaining,
    )


@router.delete("/me/rider")
async def disable_rider_mode(current_user: User = Depends(get_current_active_user)):
    """Disable rider mode."""
    if not current_user.is_rider:
        return {"message": "Rider mode already disabled"}

    await user_service.disable_rider_mode(current_user.user_id)

    await audit_service.log_user_action(
        user_id=current_user.user_id, action="disabled_rider_mode"
    )

    return {"message": "Rider mode disabled"}


@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...), current_user: User = Depends(get_current_active_user)
):
    """
    Upload a custom profile picture.
    Max size: 2MB. Format: JPEG, PNG.
    """
    try:
        # Avatar file received and processing
        # Validate content type
        if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image format: {file.content_type}. Use JPEG, PNG, or WebP.",
            )

        # Read file content
        content = await file.read()

        # Validate size (2MB limit)
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image too large. Max size is 2MB.",
            )

        updated_user = await user_service.update_profile_image(
            current_user.user_id, content, file.content_type
        )

        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile image",
            )

        return UserProfileResponse(
            user_id=updated_user.user_id,
            email=updated_user.email,
            display_name=updated_user.display_name,
            photo_url=updated_user.photo_url,
            phone=updated_user.phone,
            gender=updated_user.gender,
            is_rider=updated_user.is_rider,
            rider_info=(
                updated_user.rider_info.model_dump()
                if updated_user.rider_info
                else None
            ),
            onboarding_completed=updated_user.onboarding_completed,
            status=updated_user.status,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}",
        )


@router.get("/{user_id}/avatar")
async def get_avatar(user_id: str):
    """Get user avatar image."""
    avatar_data = await user_service.get_profile_image(user_id)

    if not avatar_data:
        # Redirect to default google image if we had it?
        # Or return 404 and let client handle fallback.
        # But wait, success means we just serve bytes.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found"
        )

    return Response(
        content=avatar_data["image_data"], media_type=avatar_data["content_type"]
    )


# Current Terms & Conditions version
TERMS_VERSION = "1.0"


class AcceptTermsRequest(BaseModel):
    """Request to accept terms and conditions."""

    terms_version: str = Field(..., min_length=1, max_length=10)


@router.post("/me/accept-terms")
async def accept_terms(
    request: AcceptTermsRequest, current_user: User = Depends(get_current_active_user)
):
    """
    Accept Terms and Conditions.

    Called when user accepts T&C on first login or when T&C version updates.
    """
    from app.database import get_db

    db = get_db()
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "terms_accepted_at": utc_now(),
                "terms_version": request.terms_version,
            }
        },
    )

    await audit_service.log_user_action(
        user_id=current_user.user_id,
        action="accepted_terms",
        metadata={"terms_version": request.terms_version},
    )

    return {"message": "Terms accepted", "terms_version": request.terms_version}


@router.get("/me/terms-status")
async def get_terms_status(current_user: User = Depends(get_current_active_user)):
    """Check if user has accepted current T&C version."""
    from app.database import get_db

    db = get_db()
    user_doc = await db.users.find_one({"user_id": current_user.user_id})

    accepted_version = user_doc.get("terms_version") if user_doc else None
    needs_acceptance = accepted_version != TERMS_VERSION

    return {
        "current_version": TERMS_VERSION,
        "accepted_version": accepted_version,
        "needs_acceptance": needs_acceptance,
    }
