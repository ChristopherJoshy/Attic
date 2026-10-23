#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# User models - Definitions for user profiles, stats, and ranks.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# get_rank_from_elo: Calculates rank enum from numeric Elo.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# Rank: Enum for ranking tiers (Bronze, Silver, etc).
# UserBase: Base model for user identification.
# UserStats: Model for gameplay statistics.
# User: Full user document model.
# UserPublic: Publicly visible user profile model.
# LeaderboardEntry: Model for leaderboard rows.

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


class Rank(str, Enum):
    """Player rank tiers"""
    UNRANKED = "Unranked"
    BRONZE = "Bronze"
    GOLD = "Gold"
    PLATINUM = "Platinum"
    RANKER = "Ranker"


def get_rank_from_elo(elo: int) -> Rank:
    """Determine rank based on Elo rating"""
    if elo < 1000:
        return Rank.UNRANKED
    elif elo < 2000:
        return Rank.BRONZE
    elif elo < 3000:
        return Rank.GOLD
    elif elo < 10000:
        return Rank.PLATINUM
    else:
        return Rank.RANKER


class UserBase(BaseModel):
    """Base user model"""
    uid: str
    email: str
    display_name: str
    photo_url: Optional[str] = None


class UserStats(BaseModel):
    """User statistics"""
    current_elo: int = 1000  # Start at 1000 Elo (Bronze tier)
    peak_elo: int = 1000
    rank: Rank = Rank.BRONZE  # 1000 Elo = Bronze
    total_matches: int = 0
    wins: int = 0
    losses: int = 0
    avg_wpm: float = 0.0
    avg_accuracy: float = 0.0
    best_wpm: int = 0
    coins: int = 0
    unlocked_cursors: list = ["default"]
    equipped_cursor: str = "default"
    redeemed_codes: list = []
    invited_count: int = 0
    crates_opened: int = 0


class User(UserBase):
    """Complete user model"""
    created_at: datetime
    last_login: datetime
    referred_by: Optional[str] = None
    stats: UserStats = UserStats()
    
    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user info for leaderboards"""
    uid: str
    display_name: str
    photo_url: Optional[str] = None
    current_elo: int  # Current Elo rating (for sorting)
    peak_elo: int     # Peak Elo rating (for reference)
    rank: Rank
    best_wpm: int
    # Profile customization
    equipped_border: Optional[str] = None
    equipped_profile_effect: Optional[str] = None
    equipped_background: Optional[str] = None


class LeaderboardEntry(BaseModel):
    """Leaderboard entry"""
    position: int
    user: UserPublic
