#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Shop API router - Gacha shop and inventory management.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# get_cursors: Returns all available cursors.
# get_effects: Returns all available cursor effects.
# get_inventory: Returns user's coins, unlocked cursors, and effects.
# spin_gacha: Performs a gacha spin for 50 coins.
# equip_cursor: Equips a cursor for the user.
# equip_effect: Equips a cursor effect for the user.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# router: FastAPI router.
# CursorInfo: Pydantic model for cursor data.
# EffectInfo: Pydantic model for effect data.
# InventoryResponse: Pydantic model for inventory data.
# SpinResult: Pydantic model for gacha spin result.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework.
# pydantic: Validation.
# random: For weighted gacha selection.
# app.database.Database: DB access.
# app.constants: Cursor and gacha constants.
# app.routers.auth: Auth dependency.

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging
import random

from app.database import Database
from app.constants import (
    CURSORS, EFFECTS, GACHA_WEIGHTS, SPIN_COST, LUCK_BOOST_WEIGHTS, PITY_STREAK_THRESHOLD,
    PROFILE_BACKGROUNDS, PROFILE_EFFECTS, PROFILE_BORDERS,
    PROFILE_GACHA_WEIGHTS, PROFILE_SPIN_COST, PROFILE_PITY_STREAK_THRESHOLD, PROFILE_LUCK_BOOST_WEIGHTS
)
from app.routers.auth import get_current_user, UserInfo


logger = logging.getLogger(__name__)
router = APIRouter()


class CursorInfo(BaseModel):
    id: str
    name: str
    color: str
    glow: str
    rarity: str

class EffectInfo(BaseModel):
    id: str
    name: str
    color: str
    rarity: str

class InventoryResponse(BaseModel):
    coins: int
    unlocked_cursors: List[str]
    equipped_cursor: str
    unlocked_effects: List[str]
    equipped_effect: Optional[str] = None
    pity_active: bool = False
    pity_streak: int = 0
    crates_opened: int = 0


class SpinResult(BaseModel):
    type: str  # "cursor", "effect", or "coins"
    cursor_id: Optional[str] = None
    cursor_info: Optional[CursorInfo] = None
    effect_id: Optional[str] = None
    effect_info: Optional[EffectInfo] = None
    coins_won: Optional[int] = None
    is_new: bool = False
    pity_activated: bool = False
    pity_streak: int = 0


# Leaderboard Bonus Constants
LEADERBOARD_TOP_N = 10
LEADERBOARD_TOP_3 = 3

# Top 4-10 bonuses (10% - reduced for harder economy)
LEADERBOARD_LUCK_BONUS = 0.10
LEADERBOARD_COIN_REDUCTION = 0.10
LEADERBOARD_COIN_BONUS = 0.10

# Top 3 bonuses (30% - reduced for harder economy)
TOP_3_LUCK_BONUS = 0.30
TOP_3_COIN_REDUCTION = 0.30
TOP_3_COIN_BONUS = 0.30


async def get_leaderboard_bonus(firebase_uid: str) -> dict:
    """Get user's leaderboard bonus rates based on their position.
    
    Returns: {
        'is_top_player': bool,
        'is_top_3': bool,
        'position': int or None,
        'luck_bonus': float,
        'coin_reduction': float,
        'coin_bonus': float
    }
    """
    db = Database.get_db()
    
    # Get top 10 players by elo_rating
    top_players_cursor = db.users.find(
        {},
        {"firebase_uid": 1}
    ).sort("elo_rating", -1).limit(LEADERBOARD_TOP_N)
    
    top_player_uids = [p["firebase_uid"] async for p in top_players_cursor]
    
    if firebase_uid not in top_player_uids:
        return {
            'is_top_player': False,
            'is_top_3': False,
            'position': None,
            'luck_bonus': 0,
            'coin_reduction': 0,
            'coin_bonus': 0
        }
    
    position = top_player_uids.index(firebase_uid) + 1  # 1-indexed
    
    if position <= LEADERBOARD_TOP_3:
        return {
            'is_top_player': True,
            'is_top_3': True,
            'position': position,
            'luck_bonus': TOP_3_LUCK_BONUS,
            'coin_reduction': TOP_3_COIN_REDUCTION,
            'coin_bonus': TOP_3_COIN_BONUS
        }
    else:
        return {
            'is_top_player': True,
            'is_top_3': False,
            'position': position,
            'luck_bonus': LEADERBOARD_LUCK_BONUS,
            'coin_reduction': LEADERBOARD_COIN_REDUCTION,
            'coin_bonus': LEADERBOARD_COIN_BONUS
        }


async def is_top_leaderboard_player(firebase_uid: str) -> bool:
    """Check if user is in top 10 leaderboard (legacy helper)"""
    bonus = await get_leaderboard_bonus(firebase_uid)
    return bonus['is_top_player']


@router.get("/cursors", response_model=List[CursorInfo])
async def get_cursors():
    """Get all available cursors"""
    return [
        CursorInfo(
            id=cursor_id,
            name=data["name"],
            color=data["color"],
            glow=data["glow"],
            rarity=data["rarity"]
        )
        for cursor_id, data in CURSORS.items()
    ]

@router.get("/effects", response_model=List[EffectInfo])
async def get_effects():
    """Get all available effects"""
    return [
        EffectInfo(
            id=effect_id,
            name=data["name"],
            color=data["color"],
            rarity=data["rarity"]
        )
        for effect_id, data in EFFECTS.items()
    ]


@router.get("/stats")
async def get_item_stats():
    """Get ownership statistics for all cursors and effects"""
    db = Database.get_db()
    
    cursor_counts = {}
    effect_counts = {}
    
    # Initialize all items with 0
    for cursor_id in CURSORS.keys():
        cursor_counts[cursor_id] = 0
    for effect_id in EFFECTS.keys():
        effect_counts[effect_id] = 0
    
    # Aggregate counts from all users
    pipeline = [
        {"$project": {
            "unlocked_cursors": {"$ifNull": ["$unlocked_cursors", []]},
            "unlocked_effects": {"$ifNull": ["$unlocked_effects", []]}
        }}
    ]
    
    async for user in db.users.aggregate(pipeline):
        for cursor_id in user.get("unlocked_cursors", []):
            if cursor_id in cursor_counts:
                cursor_counts[cursor_id] += 1
        for effect_id in user.get("unlocked_effects", []):
            if effect_id in effect_counts:
                effect_counts[effect_id] += 1
    
    return {
        "cursor_counts": cursor_counts,
        "effect_counts": effect_counts
    }


@router.get("/inventory", response_model=InventoryResponse)
async def get_inventory(current_user: UserInfo = Depends(get_current_user)):
    """Get user's inventory including coins, unlocked cursors, and effects"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        return InventoryResponse(
            coins=0,
            unlocked_cursors=["default"],
            equipped_cursor="default",
            unlocked_effects=[],
            equipped_effect=None
        )
    
    pity_streak = user.get("pity_streak", 0)
    pity_active = pity_streak >= PITY_STREAK_THRESHOLD

    return InventoryResponse(
        coins=user.get("coins", 0),
        unlocked_cursors=user.get("unlocked_cursors", ["default"]),
        equipped_cursor=user.get("equipped_cursor", "default"),
        unlocked_effects=user.get("unlocked_effects", []),
        equipped_effect=user.get("equipped_effect", None),
        pity_active=pity_active,
        pity_streak=pity_streak,
        crates_opened=user.get("crates_opened", 0)
    )


@router.get("/leaderboard-bonus")
async def get_user_leaderboard_bonus(current_user: UserInfo = Depends(get_current_user)):
    """Get user's leaderboard bonus status for shop price display"""
    bonus = await get_leaderboard_bonus(current_user.uid)
    
    # Calculate actual prices
    gacha_original = SPIN_COST
    gacha_discounted = int(SPIN_COST * (1 - bonus['coin_reduction'])) if bonus['is_top_player'] else SPIN_COST
    
    profile_original = PROFILE_SPIN_COST
    profile_discounted = int(PROFILE_SPIN_COST * (1 - bonus['coin_reduction'])) if bonus['is_top_player'] else PROFILE_SPIN_COST
    
    return {
        "is_top_player": bonus['is_top_player'],
        "is_top_3": bonus['is_top_3'],
        "position": bonus['position'],
        "luck_bonus_percent": int(bonus['luck_bonus'] * 100),
        "coin_reduction_percent": int(bonus['coin_reduction'] * 100),
        "coin_bonus_percent": int(bonus['coin_bonus'] * 100),
        "gacha_original_cost": gacha_original,
        "gacha_discounted_cost": gacha_discounted,
        "profile_original_cost": profile_original,
        "profile_discounted_cost": profile_discounted
    }

@router.post("/spin", response_model=SpinResult)
async def spin_gacha(current_user: UserInfo = Depends(get_current_user)):
    """Perform a gacha spin for 50 coins"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_coins = user.get("coins", 0)
    
    # Check for leaderboard bonus (50% for top 3, 20% for top 4-10)
    bonus = await get_leaderboard_bonus(current_user.uid)
    
    # Apply coin reduction based on leaderboard position
    actual_spin_cost = int(SPIN_COST * (1 - bonus['coin_reduction'])) if bonus['is_top_player'] else SPIN_COST
    
    if current_coins < actual_spin_cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough coins. Need {actual_spin_cost}, have {current_coins}"
        )
    
    # Deduct coins
    new_coins = current_coins - actual_spin_cost
    
    # --- Pity System Logic ---
    pity_streak = user.get("pity_streak", 0)
    last_spin_result = user.get("last_spin_result", None)
    luck_boost_spins = user.get("luck_boost_spins", 0)
    
    # Check if boost is active for THIS spin (pity threshold, paid luck boost, OR leaderboard bonus)
    use_luck_boost = pity_streak >= PITY_STREAK_THRESHOLD or luck_boost_spins > 0 or bonus['is_top_player']
    
    current_weights = LUCK_BOOST_WEIGHTS.copy() if use_luck_boost else GACHA_WEIGHTS.copy()
    
    if use_luck_boost:
        # Smart Luck: Prevent rolling rarities that are fully collected to avoid coin fallback
        unlocked_cursors_set = set(user.get("unlocked_cursors", ["default"]))
        unlocked_effects_set = set(user.get("unlocked_effects", []))
        
        # Check availability
        has_available = {
            "common": False, "uncommon": False, "rare": False, "epic": False, 
            "legendary": False, "legendary_effect": False, "mythical": False
        }
        
        for c_id, c_data in CURSORS.items():
            if c_id not in unlocked_cursors_set:
                has_available[c_data["rarity"]] = True
                
        for e_id, e_data in EFFECTS.items():
            if e_id not in unlocked_effects_set:
                has_available["legendary_effect"] = True # All effects are legendary currently

        # Zero out weights for fully collected rarities
        available_weight_sum = 0
        for r_key in ["common", "uncommon", "rare", "epic", "legendary", "legendary_effect", "mythical"]:
            if r_key in current_weights:
                if not has_available.get(r_key, False):
                    current_weights[r_key] = 0
                available_weight_sum += current_weights[r_key]
        
        # If user has collected EVERYTHING available in the luck pool, 
        # we must fallback to something (coins) to avoid crash.
        # But if there is at least one item type available, we guarantee an item.
        if available_weight_sum == 0:
            # Fallback: Restore 'legendary' weight to allowed coins fallback via invalid item
            # Or just use default weights which allow coins?
            # Let's just reset to coins_10 to give them money.
             current_weights = {"coins_10": 100}

    # Select Outcome
    outcomes = list(current_weights.keys())
    weights = list(current_weights.values())
    result = random.choices(outcomes, weights=weights, k=1)[0]
    
    # True Pity System:
    # "Bad Luck" results increment the streak.
    # "Good Luck" results reset the streak.
    
    # Define what counts as "Bad Luck" (eligible for pity building)
    bad_luck_results = {
        "better_luck_next_time",
        "coins_5", "coins_10", 
        "common", "common_effect",
        "uncommon", "uncommon_effect"
    }

    is_bad_luck = result in bad_luck_results
    
    new_streak = 0
    if is_bad_luck:
        new_streak = pity_streak + 1
    else:
        new_streak = 0  # High tier item resets streak
        
    # If this spin used the luck boost, the streak is consumed regardless of the result
    if use_luck_boost:
        new_streak = 0
        
    # If we used the boost, reset streak
    # (Already handled by high-tier reset if result was good, but if we got lucky boost and STILL got common, 
    # we usually want to consume the boost usage anyway).
    # But wait, if logic above set new_streak = pity_streak + 1, and we used a boost...
    # The requirement: after 3 bad rolls, get a boost.
    # If the boosted roll is ALSO bad (possible with current weights?), does it reset?
    # Yes, typically "Pity" is "Guaranteed Higher Rate". It is CONSUMED on use.
    if use_luck_boost:
        # If result was bad, we technically failed the boosted roll.
        # But we must consume the "Active Pity" state.
        # So we reset streak to 0 (or 1 if we count this bad result as start of next streak).
        # Let's say reset to 0 to be safe and clear.
        new_streak = 0
    
    unlocked_cursors = user.get("unlocked_cursors", ["default"])
    unlocked_effects = user.get("unlocked_effects", [])
    
    spin_result_obj = None
    
    if result == "better_luck_next_time":
        # 95% chance - No reward, just bad luck
        spin_result_obj = SpinResult(type="nothing", coins_won=0)
    
    elif result == "coins_5":
        new_coins += 5
        spin_result_obj = SpinResult(type="coins", coins_won=5)
    
    elif result == "coins_10":
        new_coins += 10
        spin_result_obj = SpinResult(type="coins", coins_won=10)
    
    elif result.endswith("_effect"):
        # Effect roll - extract rarity from result (e.g., "common_effect" -> "common")
        effect_rarity = result.replace("_effect", "")
        # Pick from effects of this rarity
        all_effects_of_rarity = [e for e, d in EFFECTS.items() if d["rarity"] == effect_rarity]
        
        if not all_effects_of_rarity:
            # Fallback if no effects of this rarity exist
            new_coins += 10
            spin_result_obj = SpinResult(type="coins", coins_won=10)
        else:
            won_effect = random.choice(all_effects_of_rarity)
            effect_data = EFFECTS[won_effect]
            
            if won_effect in unlocked_effects:
                # Duplicate - give 10 coins instead
                new_coins += 10
                spin_result_obj = SpinResult(type="coins", coins_won=10)
            else:
                # New effect
                unlocked_effects.append(won_effect)
                spin_result_obj = SpinResult(
                    type="effect",
                    effect_id=won_effect,
                    effect_info=EffectInfo(id=won_effect, **effect_data),
                    is_new=True
                )
        
    else: # Cursor (common, uncommon, rare, epic, legendary, ultra, divine, mythical)
        rarity = result
        # Pick from ALL cursors of this rarity (duplicates allowed)
        all_cursors_of_rarity = [c for c, d in CURSORS.items() if d["rarity"] == rarity]
        if not all_cursors_of_rarity:
            # Fallback if no cursors of this rarity exist
            new_coins += 10
            spin_result_obj = SpinResult(type="coins", coins_won=10)
        else:
            won_cursor = random.choice(all_cursors_of_rarity)
            cursor_data = CURSORS[won_cursor]
            
            if won_cursor in unlocked_cursors:
                # Duplicate - give 10 coins instead
                new_coins += 10
                spin_result_obj = SpinResult(type="coins", coins_won=10)
            else:
                # New cursor
                unlocked_cursors.append(won_cursor)
                spin_result_obj = SpinResult(
                    type="cursor",
                    cursor_id=won_cursor,
                    cursor_info=CursorInfo(id=won_cursor, **cursor_data),
                    is_new=True
                )

    # Set pity activation flag for frontend animation
    spin_result_obj.pity_streak = new_streak
    spin_result_obj.pity_activated = (new_streak >= PITY_STREAK_THRESHOLD) and (not use_luck_boost) 
    # Only "activated" if we just crossed the threshold, OR maybe just return if it IS active next time?
    # Actually, simpler: just return the new pity state via inventory fetch or let frontend use pity_activated to show a special effect?
    # Let's say "pity_activated" means "You just earned a boost!".
    
    # Calculate net coin change
    # new_coins was calculated securely above (current - cost + winnings)
    # But for atomic update we want the delta
    coin_delta = -SPIN_COST
    if spin_result_obj.coins_won:
        coin_delta += spin_result_obj.coins_won
    
    # Build increment operations
    inc_ops = {"coins": coin_delta, "crates_opened": 1}
    
    # If luck boost was from daily reward spins, decrement
    if luck_boost_spins > 0:
        inc_ops["luck_boost_spins"] = -1
        
    update_result = await db.users.update_one(
        {
            "firebase_uid": current_user.uid,
            "coins": {"$gte": SPIN_COST}
        },
        {
            "$inc": inc_ops,
            "$set": {
                "unlocked_cursors": unlocked_cursors,
                "unlocked_effects": unlocked_effects,
                "pity_streak": new_streak,
                "last_spin_result": result # Just store exact result for logs/future, logic doesn't depend on it anymore
            }
        }
    )
    
    if update_result.matched_count == 0:
        # Race condition: User had enough coins at start, but not anymore
        raise HTTPException(
            status_code=400, 
            detail="Transaction failed: Insufficient coins (concurrent request detected)"
        )
    
    return spin_result_obj


class EquipRequest(BaseModel):
    item_id: str
    item_type: str = "cursor" # "cursor" or "effect"


@router.post("/equip")
async def equip_item(
    request: EquipRequest,
    current_user: UserInfo = Depends(get_current_user)
):
    """Equip a cursor or effect"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.item_type == "cursor":
        unlocked_cursors = user.get("unlocked_cursors", ["default"])
        if request.item_id not in unlocked_cursors:
            raise HTTPException(status_code=400, detail="Cursor not unlocked")
        
        if request.item_id not in CURSORS:
            raise HTTPException(status_code=400, detail="Invalid cursor ID")
            
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": {"equipped_cursor": request.item_id}}
        )
        
    elif request.item_type == "effect":
        if request.item_id == "none": # Allow un-equipping
             await db.users.update_one(
                {"firebase_uid": current_user.uid},
                {"$set": {"equipped_effect": None}}
            )
             return {"status": "success", "equipped_effect": None}

        unlocked_effects = user.get("unlocked_effects", [])
        if request.item_id not in unlocked_effects:
             raise HTTPException(status_code=400, detail="Effect not unlocked")
             
        if request.item_id not in EFFECTS:
             raise HTTPException(status_code=400, detail="Invalid effect ID")
             
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": {"equipped_effect": request.item_id}}
        )
        return {"status": "success", "equipped_effect": request.item_id}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    return {"status": "success", "equipped_item": request.item_id}


# ============================================================================
# PROFILE CRATE SYSTEM ENDPOINTS
# ============================================================================

class ProfileBackgroundInfo(BaseModel):
    id: str
    name: str
    path: str
    rarity: str
    text_color: str = "light"

class ProfileEffectInfo(BaseModel):
    id: str
    name: str
    color: str
    animation: str
    rarity: str

class ProfileBorderInfo(BaseModel):
    id: str
    name: str
    style: str
    color: Optional[str] = None
    colors: Optional[List[str]] = None
    width: int = 3
    animation: Optional[str] = None
    rarity: str

class ProfileInventoryResponse(BaseModel):
    unlocked_backgrounds: List[str]
    equipped_background: Optional[str] = None
    unlocked_profile_effects: List[str]
    equipped_profile_effect: Optional[str] = None
    unlocked_borders: List[str]
    equipped_border: Optional[str] = None
    profile_pity_active: bool = False
    profile_pity_streak: int = 0
    profile_crates_opened: int = 0

class ProfileSpinResult(BaseModel):
    type: str  # "background", "profile_effect", or "border"
    item_id: Optional[str] = None
    background_info: Optional[ProfileBackgroundInfo] = None
    effect_info: Optional[ProfileEffectInfo] = None
    border_info: Optional[ProfileBorderInfo] = None
    is_new: bool = False
    pity_activated: bool = False
    pity_streak: int = 0


@router.get("/backgrounds", response_model=List[ProfileBackgroundInfo])
async def get_backgrounds():
    """Get all available profile backgrounds"""
    return [
        ProfileBackgroundInfo(
            id=bg_id,
            name=data["name"],
            path=data["path"],
            rarity=data["rarity"],
            text_color=data.get("text_color", "light")
        )
        for bg_id, data in PROFILE_BACKGROUNDS.items()
    ]

@router.get("/profile-effects", response_model=List[ProfileEffectInfo])
async def get_profile_effects():
    """Get all available profile effects"""
    return [
        ProfileEffectInfo(
            id=effect_id,
            name=data["name"],
            color=data["color"],
            animation=data["animation"],
            rarity=data["rarity"]
        )
        for effect_id, data in PROFILE_EFFECTS.items()
    ]

@router.get("/borders", response_model=List[ProfileBorderInfo])
async def get_borders():
    """Get all available profile borders"""
    return [
        ProfileBorderInfo(
            id=border_id,
            name=data["name"],
            style=data["style"],
            color=data.get("color"),
            colors=data.get("colors"),
            width=data.get("width", 3),
            animation=data.get("animation"),
            rarity=data["rarity"]
        )
        for border_id, data in PROFILE_BORDERS.items()
    ]


@router.get("/profile-inventory", response_model=ProfileInventoryResponse)
async def get_profile_inventory(current_user: UserInfo = Depends(get_current_user)):
    """Get user's profile inventory"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        return ProfileInventoryResponse(
            unlocked_backgrounds=[],
            equipped_background=None,
            unlocked_profile_effects=[],
            equipped_profile_effect=None,
            unlocked_borders=[],
            equipped_border=None
        )
    
    pity_streak = user.get("profile_pity_streak", 0)
    pity_active = pity_streak >= PROFILE_PITY_STREAK_THRESHOLD
    
    return ProfileInventoryResponse(
        unlocked_backgrounds=user.get("unlocked_backgrounds", []),
        equipped_background=user.get("equipped_background", None),
        unlocked_profile_effects=user.get("unlocked_profile_effects", []),
        equipped_profile_effect=user.get("equipped_profile_effect", None),
        unlocked_borders=user.get("unlocked_borders", []),
        equipped_border=user.get("equipped_border", None),
        profile_pity_active=pity_active,
        profile_pity_streak=pity_streak,
        profile_crates_opened=user.get("profile_crates_opened", 0)
    )


@router.post("/profile-spin", response_model=ProfileSpinResult)
async def spin_profile_crate(current_user: UserInfo = Depends(get_current_user)):
    """Perform a profile crate spin for 1000 coins"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_coins = user.get("coins", 0)
    
    # Check for leaderboard bonus (50% for top 3, 20% for top 4-10)
    bonus = await get_leaderboard_bonus(current_user.uid)
    
    # Apply coin reduction based on leaderboard position
    actual_spin_cost = int(PROFILE_SPIN_COST * (1 - bonus['coin_reduction'])) if bonus['is_top_player'] else PROFILE_SPIN_COST
    
    if current_coins < actual_spin_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough coins. Need {actual_spin_cost}, have {current_coins}"
        )
    
    # Pity system (also includes leaderboard luck boost)
    pity_streak = user.get("profile_pity_streak", 0)
    use_luck_boost = pity_streak >= PROFILE_PITY_STREAK_THRESHOLD or bonus['is_top_player']
    
    current_weights = PROFILE_LUCK_BOOST_WEIGHTS.copy() if use_luck_boost else PROFILE_GACHA_WEIGHTS.copy()
    
    # Select outcome
    outcomes = list(current_weights.keys())
    weights = list(current_weights.values())
    result = random.choices(outcomes, weights=weights, k=1)[0]
    
    # Handle better_luck_next_time (95% chance - no reward)
    if result == "better_luck_next_time":
        new_streak = pity_streak + 1 if not use_luck_boost else 0
        
        # Update database
        await db.users.update_one(
            {"firebase_uid": current_user.uid, "coins": {"$gte": actual_spin_cost}},
            {
                "$inc": {"coins": -actual_spin_cost, "profile_crates_opened": 1},
                "$set": {"profile_pity_streak": new_streak}
            }
        )
        
        return ProfileSpinResult(
            type="nothing",
            is_new=False,
            pity_activated=(new_streak >= PROFILE_PITY_STREAK_THRESHOLD) and not use_luck_boost,
            pity_streak=new_streak
        )
    
    # Parse result type and rarity
    parts = result.rsplit("_", 1)
    if len(parts) == 2 and parts[1] in ["bg", "effect", "border"]:
        rarity = parts[0]
        item_type = parts[1]
    else:
        # Fallback
        rarity = "common"
        item_type = "bg"
    
    # Determine if bad luck (for pity)
    bad_luck_rarities = {"common"}
    is_bad_luck = rarity in bad_luck_rarities
    
    new_streak = 0
    if use_luck_boost:
        new_streak = 0
    elif is_bad_luck:
        new_streak = pity_streak + 1
    else:
        new_streak = 0
    
    # Get user's current unlocked items
    unlocked_backgrounds = user.get("unlocked_backgrounds", [])
    unlocked_profile_effects = user.get("unlocked_profile_effects", [])
    unlocked_borders = user.get("unlocked_borders", [])
    
    spin_result_obj = None
    
    if item_type == "bg":
        # Rank backgrounds should never drop from crates - only awarded via rank achievement
        RANK_BACKGROUNDS = {"rank_bronze", "rank_gold", "rank_platinum", "rank_ranker"}
        
        # Pick background of this rarity, excluding rank backgrounds
        all_bgs_of_rarity = [
            b for b, d in PROFILE_BACKGROUNDS.items() 
            if d["rarity"] == rarity and b not in RANK_BACKGROUNDS
        ]
        if not all_bgs_of_rarity:
            # Fallback to common (excluding rank backgrounds)
            all_bgs_of_rarity = [
                b for b, d in PROFILE_BACKGROUNDS.items() 
                if d["rarity"] == "common" and b not in RANK_BACKGROUNDS
            ]
        
        won_bg = random.choice(all_bgs_of_rarity)
        bg_data = PROFILE_BACKGROUNDS[won_bg]
        
        if won_bg in unlocked_backgrounds:
            # Duplicate - try another of same rarity
            available = [b for b in all_bgs_of_rarity if b not in unlocked_backgrounds]
            if available:
                won_bg = random.choice(available)
                bg_data = PROFILE_BACKGROUNDS[won_bg]
                unlocked_backgrounds.append(won_bg)
                spin_result_obj = ProfileSpinResult(
                    type="background",
                    item_id=won_bg,
                    background_info=ProfileBackgroundInfo(id=won_bg, **bg_data),
                    is_new=True
                )
            else:
                # All of this rarity owned - return as duplicate (no item added)
                spin_result_obj = ProfileSpinResult(
                    type="background",
                    item_id=won_bg,
                    background_info=ProfileBackgroundInfo(id=won_bg, **bg_data),
                    is_new=False
                )
        else:
            unlocked_backgrounds.append(won_bg)
            spin_result_obj = ProfileSpinResult(
                type="background",
                item_id=won_bg,
                background_info=ProfileBackgroundInfo(id=won_bg, **bg_data),
                is_new=True
            )
    
    elif item_type == "effect":
        # Pick profile effect of this rarity
        all_effects_of_rarity = [e for e, d in PROFILE_EFFECTS.items() if d["rarity"] == rarity]
        if not all_effects_of_rarity:
            all_effects_of_rarity = [e for e, d in PROFILE_EFFECTS.items() if d["rarity"] == "common"]
        
        won_effect = random.choice(all_effects_of_rarity)
        effect_data = PROFILE_EFFECTS[won_effect]
        
        if won_effect in unlocked_profile_effects:
            available = [e for e in all_effects_of_rarity if e not in unlocked_profile_effects]
            if available:
                won_effect = random.choice(available)
                effect_data = PROFILE_EFFECTS[won_effect]
                unlocked_profile_effects.append(won_effect)
                spin_result_obj = ProfileSpinResult(
                    type="profile_effect",
                    item_id=won_effect,
                    effect_info=ProfileEffectInfo(id=won_effect, **effect_data),
                    is_new=True
                )
            else:
                spin_result_obj = ProfileSpinResult(
                    type="profile_effect",
                    item_id=won_effect,
                    effect_info=ProfileEffectInfo(id=won_effect, **effect_data),
                    is_new=False
                )
        else:
            unlocked_profile_effects.append(won_effect)
            spin_result_obj = ProfileSpinResult(
                type="profile_effect",
                item_id=won_effect,
                effect_info=ProfileEffectInfo(id=won_effect, **effect_data),
                is_new=True
            )
    
    elif item_type == "border":
        # Pick border of this rarity
        all_borders_of_rarity = [b for b, d in PROFILE_BORDERS.items() if d["rarity"] == rarity]
        if not all_borders_of_rarity:
            all_borders_of_rarity = [b for b, d in PROFILE_BORDERS.items() if d["rarity"] == "common"]
        
        won_border = random.choice(all_borders_of_rarity)
        border_data = PROFILE_BORDERS[won_border]
        
        if won_border in unlocked_borders:
            available = [b for b in all_borders_of_rarity if b not in unlocked_borders]
            if available:
                won_border = random.choice(available)
                border_data = PROFILE_BORDERS[won_border]
                unlocked_borders.append(won_border)
                spin_result_obj = ProfileSpinResult(
                    type="border",
                    item_id=won_border,
                    border_info=ProfileBorderInfo(
                        id=won_border,
                        name=border_data["name"],
                        style=border_data["style"],
                        color=border_data.get("color"),
                        colors=border_data.get("colors"),
                        width=border_data.get("width", 3),
                        animation=border_data.get("animation"),
                        rarity=border_data["rarity"]
                    ),
                    is_new=True
                )
            else:
                spin_result_obj = ProfileSpinResult(
                    type="border",
                    item_id=won_border,
                    border_info=ProfileBorderInfo(
                        id=won_border,
                        name=border_data["name"],
                        style=border_data["style"],
                        color=border_data.get("color"),
                        colors=border_data.get("colors"),
                        width=border_data.get("width", 3),
                        animation=border_data.get("animation"),
                        rarity=border_data["rarity"]
                    ),
                    is_new=False
                )
        else:
            unlocked_borders.append(won_border)
            spin_result_obj = ProfileSpinResult(
                type="border",
                item_id=won_border,
                border_info=ProfileBorderInfo(
                    id=won_border,
                    name=border_data["name"],
                    style=border_data["style"],
                    color=border_data.get("color"),
                    colors=border_data.get("colors"),
                    width=border_data.get("width", 3),
                    animation=border_data.get("animation"),
                    rarity=border_data["rarity"]
                ),
                is_new=True
            )
    
    # Set pity info
    spin_result_obj.pity_streak = new_streak
    spin_result_obj.pity_activated = (new_streak >= PROFILE_PITY_STREAK_THRESHOLD) and (not use_luck_boost)
    
    # Update database
    update_result = await db.users.update_one(
        {
            "firebase_uid": current_user.uid,
            "coins": {"$gte": actual_spin_cost}
        },
        {
            "$inc": {"coins": -actual_spin_cost, "profile_crates_opened": 1},
            "$set": {
                "unlocked_backgrounds": unlocked_backgrounds,
                "unlocked_profile_effects": unlocked_profile_effects,
                "unlocked_borders": unlocked_borders,
                "profile_pity_streak": new_streak
            }
        }
    )
    
    if update_result.matched_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Transaction failed: Insufficient coins (concurrent request detected)"
        )
    
    return spin_result_obj


class ProfileEquipRequest(BaseModel):
    item_id: str
    item_type: str  # "background", "profile_effect", or "border"


@router.post("/profile-equip")
async def equip_profile_item(
    request: ProfileEquipRequest,
    current_user: UserInfo = Depends(get_current_user)
):
    """Equip a profile background, effect, or border"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.item_type == "background":
        if request.item_id == "none":
            await db.users.update_one(
                {"firebase_uid": current_user.uid},
                {"$set": {"equipped_background": None}}
            )
            return {"status": "success", "equipped_background": None}
        
        unlocked = user.get("unlocked_backgrounds", [])
        if request.item_id not in unlocked:
            raise HTTPException(status_code=400, detail="Background not unlocked")
        if request.item_id not in PROFILE_BACKGROUNDS:
            raise HTTPException(status_code=400, detail="Invalid background ID")
        
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": {"equipped_background": request.item_id}}
        )
        return {"status": "success", "equipped_background": request.item_id}
    
    elif request.item_type == "profile_effect":
        if request.item_id == "none":
            await db.users.update_one(
                {"firebase_uid": current_user.uid},
                {"$set": {"equipped_profile_effect": None}}
            )
            return {"status": "success", "equipped_profile_effect": None}
        
        unlocked = user.get("unlocked_profile_effects", [])
        if request.item_id not in unlocked:
            raise HTTPException(status_code=400, detail="Profile effect not unlocked")
        if request.item_id not in PROFILE_EFFECTS:
            raise HTTPException(status_code=400, detail="Invalid profile effect ID")
        
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": {"equipped_profile_effect": request.item_id}}
        )
        return {"status": "success", "equipped_profile_effect": request.item_id}
    
    elif request.item_type == "border":
        if request.item_id == "none":
            await db.users.update_one(
                {"firebase_uid": current_user.uid},
                {"$set": {"equipped_border": None}}
            )
            return {"status": "success", "equipped_border": None}
        
        unlocked = user.get("unlocked_borders", [])
        if request.item_id not in unlocked:
            raise HTTPException(status_code=400, detail="Border not unlocked")
        if request.item_id not in PROFILE_BORDERS:
            raise HTTPException(status_code=400, detail="Invalid border ID")
        
        await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$set": {"equipped_border": request.item_id}}
        )
        return {"status": "success", "equipped_border": request.item_id}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid item type. Use 'background', 'profile_effect', or 'border'")

@router.post("/claim-rank-rewards")
async def claim_rank_rewards(current_user: UserInfo = Depends(get_current_user)):
    """Manually claim rank-based rewards (idempotent)"""
    db = Database.get_db()
    
    user = await db.users.find_one({"firebase_uid": current_user.uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Determine correct rank background
    # Need to import Rank utils or logic
    # Using local helper or imports
    from app.models.user import get_rank_from_elo, Rank
    
    elo = user.get("elo_rating", 1000)
    rank = get_rank_from_elo(elo)
    
    rank_bg_map = {
        Rank.BRONZE: "rank_bronze",
        Rank.GOLD: "rank_gold",
        Rank.PLATINUM: "rank_platinum",
        Rank.RANKER: "rank_ranker"
    }
    
    target_bg = rank_bg_map.get(rank)
    if not target_bg:
        return {"status": "no_reward", "message": "No specific background for this rank"}
        
    unlocked = user.get("unlocked_backgrounds", [])
    
    if target_bg in unlocked:
        return {"status": "already_owned", "message": "Reward already claimed"}
        
    # Grant it
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        {"$addToSet": {"unlocked_backgrounds": target_bg}}
    )
    
    # Optional: Clean up old backgrounds? manual claim usually just ADDs.
    # But for consistency with auto-logic, removing old ones is good.
    # Let's keep it simple: Add only. 
    # Actually, if they demoted and claim, they get the demoted one. They shouldn't keep the higher one.
    # But removing items on "Claim" feels punitive if they didn't expect it.
    # The auto-logic removes it. I'll stick to auto-logic rules: You only have ONE rank BG.
    
    other_ranks = [bg for r, bg in rank_bg_map.items() if bg != target_bg]
    await db.users.update_one(
        {"firebase_uid": current_user.uid},
        {"$pull": {"unlocked_backgrounds": {"$in": other_ranks}}}
    )
    
    # Unequip if currently equipping a removed one
    if user.get("equipped_background") in other_ranks:
         await db.users.update_one(
            {"firebase_uid": current_user.uid},
            {"$unset": {"equipped_background": ""}}
         )
         
    return {"status": "success", "claimed_item": target_bg}
