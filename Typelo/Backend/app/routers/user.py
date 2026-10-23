#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# User API router - User profile and match history.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# get_my_profile: Fetches detailed profile of the currently logged-in user.
# get_user_profile: Fetches public profile of any user by ID.
# get_match_history: Fetches paginated match history for current user.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# router: FastAPI router.
# UserProfile: Pydantic model for user stats.
# MatchHistoryEntry: Pydantic model for single match history item.
# MatchHistoryResponse: Pydantic model for match history list response.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework.
# pydantic: Validation.
# typing: Hints.
# datetime: Time.
# logging: Logs.
# re: Regex validation.
# app.database.Database: DB access.
# app.models.user: user enums/helpers.
# app.routers.auth: auth dependency.

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging
import re

from app.database import Database
from app.models.user import Rank, get_rank_from_elo
from app.routers.auth import get_current_user, UserInfo


logger = logging.getLogger(__name__)
router = APIRouter()


class UserProfile(BaseModel):
    uid: str
    email: str
    display_name: str
    photo_url: Optional[str] = None
    elo_rating: int
    peak_elo: int
    rank: Rank
    best_wpm: int
    avg_wpm: float
    avg_accuracy: float
    total_matches: int
    wins: int
    losses: int
    win_rate: float
    created_at: Optional[datetime] = None
    coins: int = 0
    unlocked_cursors: List[str] = ["default"]
    equipped_cursor: str = "default"
    invited_count: int = 0
    # Profile customization
    equipped_background: Optional[str] = None
    equipped_profile_effect: Optional[str] = None
    equipped_border: Optional[str] = None


class MatchHistoryEntry(BaseModel):
    match_id: str
    opponent_name: str
    opponent_photo_url: Optional[str] = None
    opponent_is_bot: bool
    your_wpm: float
    opponent_wpm: float
    your_accuracy: float
    your_score: float
    elo_change: int
    result: str
    played_at: datetime


class MatchHistoryResponse(BaseModel):
    matches: List[MatchHistoryEntry]
    total_matches: int
    page: int
    limit: int


@router.get("/profile", response_model=UserProfile)
async def get_my_profile(current_user: UserInfo = Depends(get_current_user)):
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        return UserProfile(
            uid=current_user.uid,
            email=current_user.email,
            display_name=current_user.display_name,
            photo_url=current_user.photo_url,
            elo_rating=1000,
            peak_elo=1000,
            rank=Rank.UNRANKED,
            best_wpm=0,
            avg_wpm=0.0,
            avg_accuracy=0.0,
            total_matches=0,
            wins=0,
            losses=0,
            win_rate=0.0
        )
    
    total_matches = user.get("total_matches", 0)
    wins = user.get("wins", 0)
    win_rate = (wins / total_matches * 100) if total_matches > 0 else 0.0
    elo = user.get("elo_rating", 1000)
    
    return UserProfile(
        uid=current_user.uid,
        email=current_user.email,
        display_name=user.get("display_name", current_user.display_name),
        photo_url=user.get("photo_url", current_user.photo_url),
        elo_rating=elo,
        peak_elo=user.get("peak_elo", elo),
        rank=get_rank_from_elo(elo),
        best_wpm=user.get("best_wpm", 0),
        avg_wpm=round(user.get("avg_wpm", 0.0), 1),
        avg_accuracy=round(user.get("avg_accuracy", 0.0), 1),
        total_matches=total_matches,
        wins=wins,
        losses=user.get("losses", 0),
        win_rate=round(win_rate, 1),
        created_at=user.get("created_at"),
        coins=user.get("coins", 0),
        unlocked_cursors=user.get("unlocked_cursors", ["default"]),
        equipped_cursor=user.get("equipped_cursor", "default"),
        invited_count=user.get("invited_count", 0),
        equipped_background=user.get("equipped_background"),
        equipped_profile_effect=user.get("equipped_profile_effect"),
        equipped_border=user.get("equipped_border")
    )


@router.get("/profile/{user_id}", response_model=UserProfile)
async def get_user_profile(
    user_id: str = Path(
        ..., 
        min_length=1, 
        max_length=128,
        description="User's Firebase UID"
    )
):
    if not re.match(r'^[a-zA-Z0-9_-]+$', user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": user_id})
    
    if not user:
        return UserProfile(
            uid=user_id,
            email="",
            display_name="New Player",
            photo_url=None,
            elo_rating=1000,
            peak_elo=1000,
            rank=Rank.BRONZE,
            best_wpm=0,
            avg_wpm=0.0,
            avg_accuracy=0.0,
            total_matches=0,
            wins=0,
            losses=0,
            win_rate=0.0,
            created_at=None
        )
    
    total_matches = user.get("total_matches", 0)
    wins = user.get("wins", 0)
    win_rate = (wins / total_matches * 100) if total_matches > 0 else 0.0
    elo = user.get("elo_rating", 1000)
    
    return UserProfile(
        uid=user_id,
        email="",
        display_name=user.get("display_name", "Anonymous"),
        photo_url=user.get("photo_url"),
        elo_rating=elo,
        peak_elo=user.get("peak_elo", elo),
        rank=get_rank_from_elo(elo),
        best_wpm=user.get("best_wpm", 0),
        avg_wpm=round(user.get("avg_wpm", 0.0), 1),
        avg_accuracy=round(user.get("avg_accuracy", 0.0), 1),
        total_matches=total_matches,
        wins=wins,
        losses=user.get("losses", 0),
        win_rate=round(win_rate, 1),
        created_at=user.get("created_at"),
        equipped_background=user.get("equipped_background"),
        equipped_profile_effect=user.get("equipped_profile_effect"),
        equipped_border=user.get("equipped_border")
    )


@router.get("/matches", response_model=MatchHistoryResponse)
async def get_match_history(
    page: int = Query(default=1, ge=1, le=1000, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    skip = (page - 1) * limit
    
    total_matches = await db.matches.count_documents({
        "$or": [
            {"player1_id": current_user.uid},
            {"player2_id": current_user.uid}
        ]
    })
    
    cursor = db.matches.find({
        "$or": [
            {"player1_id": current_user.uid},
            {"player2_id": current_user.uid}
        ]
    }).sort("ended_at", -1).skip(skip).limit(limit)
    
    match_list = await cursor.to_list(length=limit)
    
    opponent_ids = set()
    for match in match_list:
        is_player1 = match.get("player1_id") == current_user.uid
        opponent_is_bot = match.get("is_bot_match", False) if is_player1 else False
        if not opponent_is_bot:
            opponent_id = match.get("player2_id") if is_player1 else match.get("player1_id")
            if opponent_id and opponent_id != "BOT":
                opponent_ids.add(opponent_id)
    
    opponent_map = {}
    if opponent_ids:
        opponent_cursor = db.users.find({"firebase_uid": {"$in": list(opponent_ids)}})
        async for opp in opponent_cursor:
            uid = opp.get("firebase_uid")
            opponent_map[uid] = {
                "display_name": opp.get("display_name", "Unknown"),
                "photo_url": opp.get("photo_url")
            }
    
    matches = []
    for match in match_list:
        is_player1 = match.get("player1_id") == current_user.uid
        
        if is_player1:
            your_wpm = match.get("player1_wpm", 0)
            your_accuracy = match.get("player1_accuracy", 0)
            your_score = match.get("player1_score", 0)
            elo_change = match.get("player1_elo_change", 0)
            opponent_wpm = match.get("player2_wpm", 0)
            opponent_is_bot = match.get("is_bot_match", False)
            opponent_id = match.get("player2_id", "Unknown")
        else:
            your_wpm = match.get("player2_wpm", 0)
            your_accuracy = match.get("player2_accuracy", 0)
            your_score = match.get("player2_score", 0)
            elo_change = match.get("player2_elo_change", 0)
            opponent_wpm = match.get("player1_wpm", 0)
            opponent_is_bot = False
            opponent_id = match.get("player1_id", "Unknown")
        
        winner_id = match.get("winner_id")
        if winner_id == current_user.uid:
            result = "win"
        elif winner_id is None:
            result = "tie"
        else:
            result = "loss"
        
        if opponent_is_bot:
            opponent_name = "typelo Bot"
            opponent_photo_url = None
        elif opponent_id in opponent_map:
            opponent_name = opponent_map[opponent_id]["display_name"]
            opponent_photo_url = opponent_map[opponent_id]["photo_url"]
        else:
            opponent_name = opponent_id
            opponent_photo_url = None
        
        entry = MatchHistoryEntry(
            match_id=match.get("match_id", ""),
            opponent_name=opponent_name,
            opponent_photo_url=opponent_photo_url,
            opponent_is_bot=opponent_is_bot,
            your_wpm=your_wpm,
            opponent_wpm=opponent_wpm,
            your_accuracy=your_accuracy,
            your_score=your_score,
            elo_change=elo_change,
            result=result,
            played_at=match.get("ended_at", match.get("created_at", datetime.now(timezone.utc)))
        )
        matches.append(entry)
    
    return MatchHistoryResponse(
        matches=matches,
        total_matches=total_matches,
        page=page,
        limit=limit
    )
