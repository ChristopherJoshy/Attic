#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Daily Rewards API router - Login streak and daily rewards system.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# get_daily_status: Returns current streak and available reward info.
# claim_daily_reward: Claims today's reward if available.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# router: FastAPI router.
# DailyStatus: Response model for status endpoint.
# ClaimResult: Response model for claim endpoint.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework.
# pydantic: Validation.
# datetime: Time handling.

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import logging

from app.database import Database
from app.constants import DAILY_REWARDS, DAILY_STREAK_RESET_HOURS
from app.routers.auth import get_current_user, UserInfo


logger = logging.getLogger(__name__)
router = APIRouter()


class DailyStatus(BaseModel):
    streak: int
    current_day: int  # 1-7
    can_claim: bool
    next_reward: dict
    hours_until_reset: Optional[float] = None
    last_claim: Optional[str] = None


class ClaimResult(BaseModel):
    success: bool
    reward: dict
    new_streak: int
    coins_added: int
    new_balance: int
    effect_added: Optional[str] = None
    cursor_added: Optional[str] = None
    luck_boost_added: int = 0


@router.get("/status", response_model=DailyStatus)
async def get_daily_status(current_user: UserInfo = Depends(get_current_user)):
    """Get current daily reward status"""
    db = Database.get_db()
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    last_claim = user.get("last_daily_claim")
    streak = user.get("daily_streak", 0)
    
    now = datetime.utcnow()
    can_claim = True
    hours_until_reset = None
    
    if last_claim:
        hours_since_claim = (now - last_claim).total_seconds() / 3600
        
        # Check if streak should reset (more than 48 hours)
        if hours_since_claim >= DAILY_STREAK_RESET_HOURS:
            streak = 0
        # Check if already claimed today (less than 24 hours)
        elif hours_since_claim < 24:
            can_claim = False
            hours_until_reset = 24 - hours_since_claim
    
    # Current day in cycle (1-7)
    current_day = (streak % 7) + 1
    next_reward = DAILY_REWARDS.get(current_day, DAILY_REWARDS[1])
    
    return DailyStatus(
        streak=streak,
        current_day=current_day,
        can_claim=can_claim,
        next_reward=next_reward,
        hours_until_reset=hours_until_reset,
        last_claim=last_claim.isoformat() if last_claim else None
    )


@router.post("/claim", response_model=ClaimResult)
async def claim_daily_reward(current_user: UserInfo = Depends(get_current_user)):
    """Claim today's daily reward"""
    db = Database.get_db()
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Guest users now have full access to daily rewards (restrictions removed)
    
    last_claim = user.get("last_daily_claim")
    streak = user.get("daily_streak", 0)
    now = datetime.utcnow()
    
    # Check claim eligibility
    if last_claim:
        hours_since_claim = (now - last_claim).total_seconds() / 3600
        
        if hours_since_claim < 24:
            raise HTTPException(status_code=400, detail="Already claimed today")
        
        if hours_since_claim >= DAILY_STREAK_RESET_HOURS:
            streak = 0
    
    # Increment streak
    new_streak = streak + 1
    
    # Get reward for current day (1-7 cycle)
    current_day = ((streak) % 7) + 1
    reward = DAILY_REWARDS.get(current_day, DAILY_REWARDS[1])
    
    # Build update operations
    coins_to_add = reward.get("coins", 0)
    
    # All users get full coin rewards (guest restrictions removed)
    current_coins = user.get("coins", 0)
    new_balance = current_coins + coins_to_add
    
    update_ops = {
        "$set": {
            "last_daily_claim": now,
            "daily_streak": new_streak,
            "coins": new_balance
        }
    }
    
    effect_added = None
    cursor_added = None
    luck_boost_added = 0
    
    # Handle special rewards
    if reward["type"] == "effect":
        effect_id = reward.get("effect")
        if effect_id:
            current_effects = user.get("unlocked_effects", [])
            if effect_id not in current_effects:
                update_ops["$push"] = {"unlocked_effects": effect_id}
                effect_added = effect_id
    
    elif reward["type"] == "cursor":
        cursor_id = reward.get("cursor")
        if cursor_id:
            current_cursors = user.get("unlocked_cursors", ["default"])
            if cursor_id not in current_cursors:
                update_ops["$push"] = {"unlocked_cursors": cursor_id}
                cursor_added = cursor_id
    
    elif reward["type"] == "special":
        luck_boost = reward.get("luck_boost", 0)
        if luck_boost > 0:
            current_luck = user.get("luck_boost_spins", 0)
            update_ops["$set"]["luck_boost_spins"] = current_luck + luck_boost
            luck_boost_added = luck_boost
    
    # Apply update
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        update_ops
    )
    
    logger.info(f"User {current_user.uid} claimed daily reward: Day {current_day}, Streak {new_streak}")
    
    return ClaimResult(
        success=True,
        reward=reward,
        new_streak=new_streak,
        coins_added=coins_to_add,
        new_balance=new_balance,
        effect_added=effect_added,
        cursor_added=cursor_added,
        luck_boost_added=luck_boost_added
    )
