"""Rating Model - Model for storing user ratings after rides."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class Rating(BaseModel):
    """
    Rating submitted by one user for another after a ride.
    
    Ratings are used to calculate trust scores.
    """
    rating_id: str = Field(..., description="Unique rating ID")
    rater_user_id: str = Field(..., description="User who gave the rating")
    rated_user_id: str = Field(..., description="User who received the rating")
    group_id: str = Field(..., description="Ride group this rating is for")
    rating: int = Field(..., ge=1, le=5, description="1-5 star rating")
    comment: Optional[str] = Field(None, max_length=200, description="Optional comment")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RatingCreate(BaseModel):
    """Data required to submit a rating."""
    rated_user_id: str
    group_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=200)


class RatingResponse(BaseModel):
    """Rating response for API."""
    rating_id: str
    rated_user_id: str
    rating: int
    created_at: datetime
