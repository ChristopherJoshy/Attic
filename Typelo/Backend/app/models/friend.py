#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Friend models - Definitions for friend requests and friendships.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# None

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# FriendRequestStatus: Enum for request status.
# FriendRequest: Model for a friend request.
# FriendRequestUser: Model for user info in a request.
# FriendRequestResponse: Model for API response.
# Friendship: Model for established friendship.
# FriendInfo: Model for friend details in lists.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# pydantic: Data validation.
# datetime: Time handling.
# typing: Type hints.
# enum: Enumerations.

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class FriendRequestStatus(str, Enum):
    """Friend request status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class FriendRequest(BaseModel):
    """Friend request model"""
    id: str
    from_user_id: str
    to_user_id: str
    status: FriendRequestStatus = FriendRequestStatus.PENDING
    created_at: datetime
    updated_at: Optional[datetime] = None


class FriendRequestUser(BaseModel):
    """User info in friend request"""
    uid: str
    display_name: str
    photo_url: Optional[str] = None
    elo_rating: int
    rank: str


class FriendRequestResponse(BaseModel):
    """Friend request response for API"""
    id: str
    from_user: FriendRequestUser
    sent_at: datetime


class Friendship(BaseModel):
    """Friendship model - represents mutual friendship between two users"""
    id: str
    user1_id: str
    user2_id: str
    created_at: datetime


class FriendInfo(BaseModel):
    """Friend info for listing"""
    uid: str
    display_name: str
    photo_url: Optional[str] = None
    elo_rating: int
    rank: str
    is_online: bool = False
    added_at: datetime
