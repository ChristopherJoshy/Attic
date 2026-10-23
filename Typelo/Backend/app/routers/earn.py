#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Earn API router - Handle coin earning activities like code redemption and quests.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# redeem_code: Endpoint to redeem a promotional code for coins.
# get_quests: Endpoint to fetch user's active daily and weekly quests.
# claim_quest: Endpoint to claim a completed quest reward.
# claim_afk_rewards: Endpoint to claim coins earned in AFK mode.
# assign_user_quests: Helper to assign random quests to user.
# check_and_reset_quests: Helper to reset quests if period expired.
# update_quest_progress: Helper to update quest progress after match.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# PROMO_CODES: Dictionary mapping codes to coin values.
# QUEST_ACTIVE_COUNT: Number of quests assigned per period (4).
# RedeemRequest: Pydantic model for redemption request.
# RedeemResponse: Pydantic model for redemption response.
# QuestResponse: Pydantic model for quest data response.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework.
# pydantic: Validation.
# logging: Logging.
# datetime: Time handling.
# random: Random selection.
# app.database.Database: DB access.
# app.routers.auth: Auth dependency.
# app.models.quest: Quest definitions and pools.

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
import logging
import random

from app.database import Database
from app.routers.auth import get_current_user, UserInfo
from app.models.quest import (
    QuestType,
    QuestCategory,
    QuestDefinition,
    UserQuest,
    DAILY_QUEST_POOL,
    WEEKLY_QUEST_POOL
)

logger = logging.getLogger(__name__)
router = APIRouter()

PROMO_CODES: Dict[str, int] = {
    "beta": 50,
    "techi": 100,
    "legends": 300,
    "thankyou200": 15000
    # Note: Server restart required for new codes to take effect
}

QUEST_ACTIVE_COUNT = 4


class RedeemRequest(BaseModel):
    code: str

class RedeemResponse(BaseModel):
    success: bool
    coins_added: int
    new_balance: int
    message: str

class QuestData(BaseModel):
    quest_id: str
    name: str
    description: str
    reward: int
    target: int
    progress: int
    category: str
    quest_type: str
    claimed: bool
    is_complete: bool

class QuestsResponse(BaseModel):
    daily_quests: List[QuestData]
    weekly_quests: List[QuestData]
    daily_reset_at: str
    weekly_reset_at: str

class ClaimResponse(BaseModel):
    success: bool
    coins_added: int
    new_balance: int
    message: str

class AFKClaimRequest(BaseModel):
    amount: int


def get_daily_reset_time() -> datetime:
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

def get_weekly_reset_time() -> datetime:
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = now + timedelta(days=days_until_monday)
    return next_monday.replace(hour=0, minute=0, second=0, microsecond=0)

def should_reset_daily(last_reset: Optional[datetime]) -> bool:
    if not last_reset:
        return True
    now = datetime.now(timezone.utc)
    today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    return last_reset < today_midnight

def should_reset_weekly(last_reset: Optional[datetime]) -> bool:
    if not last_reset:
        return True
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    this_monday = now - timedelta(days=days_since_monday)
    this_monday = this_monday.replace(hour=0, minute=0, second=0, microsecond=0)
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    return last_reset < this_monday

def assign_quests_from_pool(pool: List[QuestDefinition], count: int) -> List[dict]:
    selected = random.sample(pool, min(count, len(pool)))
    now = datetime.now(timezone.utc)
    quests = []
    for quest_def in selected:
        quest = {
            "quest_id": quest_def.id,
            "name": quest_def.name,
            "description": quest_def.description,
            "reward": quest_def.reward,
            "target": quest_def.target,
            "progress": 0,
            "category": quest_def.category.value,
            "quest_type": quest_def.quest_type.value,
            "claimed": False,
            "assigned_at": now
        }
        quests.append(quest)
    return quests


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_code(request: RedeemRequest, current_user: UserInfo = Depends(get_current_user)):
    code = request.code.lower().strip()
    
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid code")
    
    reward = PROMO_CODES[code]
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    redeemed_codes = user.get("redeemed_codes", [])
    if code in redeemed_codes:
        raise HTTPException(status_code=400, detail="Code already redeemed")
        
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        {
            "$inc": {"coins": reward},
            "$push": {"redeemed_codes": code}
        }
    )
    
    new_balance = user.get("coins", 0) + reward
    
    return RedeemResponse(
        success=True,
        coins_added=reward,
        new_balance=new_balance,
        message=f"Redeemed {code} for {reward} coins!"
    )


@router.get("/quests", response_model=QuestsResponse)
async def get_quests(current_user: UserInfo = Depends(get_current_user)):
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    daily_quests = user.get("daily_quests", [])
    weekly_quests = user.get("weekly_quests", [])
    daily_last_reset = user.get("daily_quests_last_reset")
    weekly_last_reset = user.get("weekly_quests_last_reset")
    
    updates = {}
    
    if should_reset_daily(daily_last_reset):
        daily_quests = assign_quests_from_pool(DAILY_QUEST_POOL, QUEST_ACTIVE_COUNT)
        updates["daily_quests"] = daily_quests
        updates["daily_quests_last_reset"] = datetime.now(timezone.utc)
        
        for quest in daily_quests:
            if quest["category"] == QuestCategory.LOGIN.value:
                quest["progress"] = 1
    
    if should_reset_weekly(weekly_last_reset):
        weekly_quests = assign_quests_from_pool(WEEKLY_QUEST_POOL, QUEST_ACTIVE_COUNT)
        updates["weekly_quests"] = weekly_quests
        updates["weekly_quests_last_reset"] = datetime.now(timezone.utc)
    
    if updates:
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": updates}
        )
    
    daily_quest_data = []
    for q in daily_quests:
        daily_quest_data.append(QuestData(
            quest_id=q["quest_id"],
            name=q["name"],
            description=q["description"],
            reward=q["reward"],
            target=q["target"],
            progress=q["progress"],
            category=q["category"],
            quest_type=q["quest_type"],
            claimed=q["claimed"],
            is_complete=q["progress"] >= q["target"]
        ))
    
    weekly_quest_data = []
    for q in weekly_quests:
        weekly_quest_data.append(QuestData(
            quest_id=q["quest_id"],
            name=q["name"],
            description=q["description"],
            reward=q["reward"],
            target=q["target"],
            progress=q["progress"],
            category=q["category"],
            quest_type=q["quest_type"],
            claimed=q["claimed"],
            is_complete=q["progress"] >= q["target"]
        ))
    
    return QuestsResponse(
        daily_quests=daily_quest_data,
        weekly_quests=weekly_quest_data,
        daily_reset_at=get_daily_reset_time().isoformat(),
        weekly_reset_at=get_weekly_reset_time().isoformat()
    )


@router.post("/quests/claim/{quest_id}", response_model=ClaimResponse)
async def claim_quest(quest_id: str, current_user: UserInfo = Depends(get_current_user)):
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    daily_quests = user.get("daily_quests", [])
    weekly_quests = user.get("weekly_quests", [])
    
    quest_found = None
    quest_list_key = None
    quest_index = None
    
    for i, q in enumerate(daily_quests):
        if q["quest_id"] == quest_id:
            quest_found = q
            quest_list_key = "daily_quests"
            quest_index = i
            break
    
    if not quest_found:
        for i, q in enumerate(weekly_quests):
            if q["quest_id"] == quest_id:
                quest_found = q
                quest_list_key = "weekly_quests"
                quest_index = i
                break
    
    if not quest_found:
        raise HTTPException(status_code=404, detail="Quest not found")
    
    if quest_found["claimed"]:
        raise HTTPException(status_code=400, detail="Quest already claimed")
    
    if quest_found["progress"] < quest_found["target"]:
        raise HTTPException(status_code=400, detail="Quest not yet complete")
    
    reward = quest_found["reward"]
    
    # All users get full quest rewards (guest restrictions removed)
    
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        {
            "$inc": {"coins": reward},
            "$set": {f"{quest_list_key}.{quest_index}.claimed": True}
        }
    )
    
    new_balance = user.get("coins", 0) + reward
    
    logger.info(f"User {current_user.uid} claimed quest {quest_id} for {reward} coins")
    
    return ClaimResponse(
        success=True,
        coins_added=reward,
        new_balance=new_balance,
        message=f"Claimed {quest_found['name']} reward: +{reward} coins!"
    )


async def update_quest_progress(
    user_uid: str,
    category: QuestCategory,
    value: int = 1,
    is_increment: bool = True,
    check_threshold: bool = False
):
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": user_uid})
    if not user:
        return
    
    daily_quests = user.get("daily_quests", [])
    weekly_quests = user.get("weekly_quests", [])
    
    updates = {}
    
    for i, quest in enumerate(daily_quests):
        if quest["category"] == category.value and not quest["claimed"]:
            if check_threshold:
                if value >= quest["target"]:
                    updates[f"daily_quests.{i}.progress"] = quest["target"]
            else:
                if is_increment:
                    new_progress = min(quest["progress"] + value, quest["target"])
                else:
                    new_progress = min(value, quest["target"])
                updates[f"daily_quests.{i}.progress"] = new_progress
    
    for i, quest in enumerate(weekly_quests):
        if quest["category"] == category.value and not quest["claimed"]:
            if check_threshold:
                if value >= quest["target"]:
                    updates[f"weekly_quests.{i}.progress"] = quest["target"]
            else:
                if is_increment:
                    new_progress = min(quest["progress"] + value, quest["target"])
                else:
                    new_progress = min(value, quest["target"])
                updates[f"weekly_quests.{i}.progress"] = new_progress
    
    if updates:
        await db.users.update_one(
            {"firebase_uid": user_uid},
            {"$set": updates}
        )
        logger.debug(f"Updated quest progress for {user_uid}: {updates}")


async def update_match_quest_progress(
    user_uid: str,
    won: bool,
    wpm: float,
    accuracy: float,
    is_training: bool = False,
    current_streak: int = 0
):
    await update_quest_progress(user_uid, QuestCategory.MATCHES, 1, is_increment=True)
    
    if won:
        await update_quest_progress(user_uid, QuestCategory.WINS, 1, is_increment=True)
    
    await update_quest_progress(user_uid, QuestCategory.WPM, int(wpm), check_threshold=True)
    
    await update_quest_progress(user_uid, QuestCategory.ACCURACY, int(accuracy), check_threshold=True)
    
    if is_training:
        await update_quest_progress(user_uid, QuestCategory.TRAINING, 1, is_increment=True)
    
    if current_streak > 0:
        await update_quest_progress(user_uid, QuestCategory.STREAK, current_streak, is_increment=False)


async def update_invite_quest_progress(user_uid: str, invite_count: int = 1):
    await update_quest_progress(user_uid, QuestCategory.INVITE, invite_count, is_increment=True)


@router.post("/afk", response_model=ClaimResponse)
async def claim_afk_rewards(request: AFKClaimRequest, current_user: UserInfo = Depends(get_current_user)):
    # Validate amount to prevent exploitation
    # The frontend sends exactly 1000 coins every 30 minutes
    if request.amount != 1000:
        raise HTTPException(status_code=400, detail="Invalid AFK reward amount")
        
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # All users get full AFK rewards (guest restrictions removed)
    actual_amount = request.amount
    
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        {
            "$inc": {"coins": actual_amount}
        }
    )
    
    new_balance = user.get("coins", 0) + actual_amount
    
    return ClaimResponse(
        success=True,
        coins_added=actual_amount,
        new_balance=new_balance,
        message=f"Claimed +{actual_amount} coins from AFK mode!"
    )
