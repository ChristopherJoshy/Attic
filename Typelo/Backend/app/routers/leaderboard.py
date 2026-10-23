#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Leaderboard API router - MongoDB based. Handles fetching top players, pagination, and user rankings.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# validate_user_id: Helper to validate user ID format.
# get_leaderboard_entries: Core logic to fetch and format leaderboard entries from DB.
# get_top_leaderboard: Endpoint to get the top N players.
# get_leaderboard_page: Endpoint to get a specific page of the leaderboard.
# get_user_rank: Endpoint to get a specific user's rank, percentile, and potential position.
# get_leaderboard_around_user: Endpoint to get leaderboard entries surrounding a specific user.
# get_leaderboard_stats: Endpoint to get overall game statistics and rank distribution.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# router: FastAPI APIRouter instance.
# LeaderboardResponse: Pydantic model for leaderboard data.
# UserRankResponse: Pydantic model for specific user rank data.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework components.
# pydantic: Data validation.
# typing: Type hints.
# datetime: Time utilities.
# logging: Logging.
# re: Regex.
# app.database.Database: DB connection.
# app.models.user: User models and helpers.

from fastapi import APIRouter, Query, HTTPException, Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging
import re

from app.database import Database
from app.models.user import LeaderboardEntry, UserPublic, Rank, get_rank_from_elo


logger = logging.getLogger(__name__)
router = APIRouter()


def validate_user_id(user_id: str) -> None:
    if not user_id or len(user_id) > 128:
        raise HTTPException(status_code=400, detail="Invalid user ID length")
    if not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")


class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total_players: int
    last_updated: datetime


class UserRankResponse(BaseModel):
    position: int
    peak_elo: int
    rank: Rank
    percentile: float
    is_on_leaderboard: bool = True
    potential_position: Optional[int] = None


async def get_leaderboard_entries(skip: int = 0, limit: int = 10) -> List[LeaderboardEntry]:
    db = Database.get_db()
    
    # All users can appear on leaderboard (guest restrictions removed)
    base_filter = {}
    
    active_count = await db.users.count_documents({**base_filter, "total_matches": {"$gt": 0}})
    
    if active_count > 0:
        cursor = db.users.find(
            {**base_filter, "total_matches": {"$gt": 0}}
        ).sort("elo_rating", -1).skip(skip).limit(limit)
    else:
        cursor = db.users.find(
            {**base_filter, "elo_rating": {"$gt": 0}}
        ).sort("elo_rating", -1).skip(skip).limit(limit)
    
    entries = []
    position = skip + 1
    
    async for user in cursor:
        elo = user.get("elo_rating", 0)
        entry = LeaderboardEntry(
            position=position,
            user=UserPublic(
                uid=user.get("firebase_uid"),
                display_name=user.get("display_name", "Anonymous"),
                photo_url=user.get("photo_url"),
                current_elo=elo,
                peak_elo=user.get("peak_elo", elo),
                rank=get_rank_from_elo(elo),
                best_wpm=user.get("best_wpm", 0),
                equipped_border=user.get("equipped_border"),
                equipped_profile_effect=user.get("equipped_profile_effect"),
                equipped_background=user.get("equipped_background")
            )
        )
        entries.append(entry)
        position += 1
    
    return entries


@router.get("/top", response_model=LeaderboardResponse)
async def get_top_leaderboard(
    limit: int = Query(default=10, ge=1, le=100)
):
    db = Database.get_db()
    
    # All users counted in leaderboard (guest restrictions removed)
    base_filter = {}
    
    active_players = await db.users.count_documents({**base_filter, "total_matches": {"$gt": 0}})
    
    if active_players > 0:
        total_players = active_players
    else:
        total_players = await db.users.count_documents({**base_filter, "elo_rating": {"$gt": 0}})
    
    entries = await get_leaderboard_entries(skip=0, limit=limit)
    
    return LeaderboardResponse(
        entries=entries,
        total_players=total_players,
        last_updated=datetime.now(timezone.utc)
    )


@router.get("/page", response_model=LeaderboardResponse)
async def get_leaderboard_page(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100)
):
    db = Database.get_db()
    
    # All users on leaderboard (guest restrictions removed)
    base_filter = {}
    
    skip = (page - 1) * limit
    total_players = await db.users.count_documents({**base_filter, "total_matches": {"$gt": 0}})
    entries = await get_leaderboard_entries(skip=skip, limit=limit)
    
    return LeaderboardResponse(
        entries=entries,
        total_players=total_players,
        last_updated=datetime.now(timezone.utc)
    )


@router.get("/user/{user_id}", response_model=Optional[UserRankResponse])
async def get_user_rank(user_id: str = Path(..., min_length=1, max_length=128)):
    validate_user_id(user_id)
    
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_elo = user.get("elo_rating", 0)
    user_matches = user.get("total_matches", 0)
    
    is_on_leaderboard = user_matches > 0 or user_elo > 0
    
    higher_count = await db.users.count_documents({
        "elo_rating": {"$gt": user_elo},
        "total_matches": {"$gt": 0}
    })
    
    total_active = await db.users.count_documents({"total_matches": {"$gt": 0}})
    
    if total_active > 0:
        if user_matches > 0:
            position = higher_count + 1
        else:
            position = total_active + 1
    else:
        higher_with_elo = await db.users.count_documents({
            "elo_rating": {"$gt": user_elo}
        })
        position = higher_with_elo + 1
    
    total_for_percentile = total_active if total_active > 0 else await db.users.count_documents({"elo_rating": {"$gt": 0}})
    if total_for_percentile == 0:
        percentile = 0.0
    else:
        percentile = (position / total_for_percentile) * 100
    
    potential_position = None
    if higher_count > 0 and user_matches == 0:
        potential_position = higher_count + 1
    
    return UserRankResponse(
        position=position,
        peak_elo=user.get("peak_elo", user_elo),
        rank=get_rank_from_elo(user_elo),
        percentile=round(percentile, 1),
        is_on_leaderboard=is_on_leaderboard,
        potential_position=potential_position
    )


@router.get("/around/{user_id}", response_model=LeaderboardResponse)
async def get_leaderboard_around_user(
    user_id: str = Path(..., min_length=1, max_length=128),
    range_size: int = Query(default=5, ge=1, le=10)
):
    validate_user_id(user_id)
    
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_elo = user.get("elo_rating", 1000)
    
    higher_count = await db.users.count_documents({
        "elo_rating": {"$gt": user_elo},
        "total_matches": {"$gt": 0}
    })
    
    user_position = higher_count + 1
    
    skip = max(0, user_position - range_size - 1)
    limit = range_size * 2 + 1
    
    entries = await get_leaderboard_entries(skip=skip, limit=limit)
    total_players = await db.users.count_documents({"total_matches": {"$gt": 0}})
    
    return LeaderboardResponse(
        entries=entries,
        total_players=total_players,
        last_updated=datetime.now(timezone.utc)
    )


@router.get("/stats")
async def get_leaderboard_stats():
    db = Database.get_db()
    
    total_players = await db.users.count_documents({})
    active_players = await db.users.count_documents({"total_matches": {"$gt": 0}})
    total_matches = await db.matches.count_documents({})
    
    rank_distribution = {
        "unranked": await db.users.count_documents({"elo_rating": {"$lt": 1000}}),
        "bronze": await db.users.count_documents({"elo_rating": {"$gte": 1000, "$lt": 2000}}),
        "gold": await db.users.count_documents({"elo_rating": {"$gte": 2000, "$lt": 3000}}),
        "platinum": await db.users.count_documents({"elo_rating": {"$gte": 3000, "$lt": 10000}}),
        "ranker": await db.users.count_documents({"elo_rating": {"$gte": 10000}})
    }
    
    return {
        "total_players": total_players,
        "active_players": active_players,
        "total_matches": total_matches,
        "rank_distribution": rank_distribution,
        "last_updated": datetime.now(timezone.utc)
    }
