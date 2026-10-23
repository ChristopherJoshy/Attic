"""
Ratings Router

API endpoints for rating system.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User
from app.models.rating import RatingCreate, RatingResponse
from app.services.rating_service import RatingService


router = APIRouter()
rating_service = RatingService()


@router.post("", response_model=RatingResponse)
async def submit_rating(
    data: RatingCreate, current_user: User = Depends(get_current_user)
):
    """
    Submit a rating for another user after a ride.

    - Must have been in the same ride group
    - Can only rate once per user per ride
    - Rating must be 1-5 stars
    """
    try:
        rating = await rating_service.submit_rating(
            rater_user_id=current_user.user_id, data=data
        )
        return RatingResponse(
            rating_id=rating.rating_id,
            rated_user_id=rating.rated_user_id,
            rating=rating.rating,
            created_at=rating.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/pending")
async def get_all_pending_ratings(
    current_user: User = Depends(get_current_user),
) -> List[str]:
    """
    Get all group IDs where the current user has pending ratings.
    """
    return await rating_service.get_user_pending_rating_groups(current_user.user_id)


@router.get("/pending/{group_id}")
async def get_pending_ratings(
    group_id: str, current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get list of users that haven't been rated yet for a specific ride.

    Returns users with their display name and photo, plus context message.
    """
    return await rating_service.get_pending_ratings_with_context(
        user_id=current_user.user_id, group_id=group_id
    )


@router.get("/average/{user_id}")
async def get_user_rating(
    user_id: str, current_user: User = Depends(get_current_user)
) -> dict:
    """Get a user's average rating."""
    avg = await rating_service.get_user_average_rating(user_id)
    return {"average_rating": avg}
