import asyncio
import os
import sys

# Add project root to path (Backend directory)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Database
from app.models.user import Rank, get_rank_from_elo

RANK_BG_MAP = {
    Rank.BRONZE: "rank_bronze",
    Rank.GOLD: "rank_gold",
    Rank.PLATINUM: "rank_platinum",
    Rank.RANKER: "rank_ranker"
}

async def fix_rank_rewards():
    print("Connecting to database...")
    await Database.connect()
    db = Database.get_db()
    
    print("Scanning users...")
    cursor = db.users.find({})
    count = 0
    async for user in cursor:
        uid = user.get("firebase_uid")
        if not uid: continue
        
        elo = user.get("elo_rating", 1000)
        rank = get_rank_from_elo(elo)
        
        target_bg = RANK_BG_MAP.get(rank)
        
        # Determine updates
        if not target_bg:
            continue
            
        unlocked = user.get("unlocked_backgrounds", [])
        equipped = user.get("equipped_background")
        
        updates_set = {}
        updates_pull = []
        updates_unset = {}
        
        # 1. Grant target BG if missing
        if target_bg not in unlocked:
            # We can't batch $addToSet and $pull easily in one go if collision?
            # Actually we can use different operators.
             updates_set["unlocked_backgrounds"] = target_bg
        
        # 2. Remove other rank BGs
        other_ranks = [bg for r, bg in RANK_BG_MAP.items() if bg != target_bg]
        to_remove = [bg for bg in other_ranks if bg in unlocked]
        
        if to_remove:
            updates_pull.extend(to_remove)
            
        # 3. Unequip if utilizing a removed BG
        if equipped in to_remove:
            updates_unset["equipped_background"] = ""
            
        # Perform updates
        if updates_set or updates_pull or updates_unset:
            print(f"Updating {uid} (Rank: {rank}): +{target_bg} -{to_remove}")
            
            if updates_set:
                await db.users.update_one({"firebase_uid": uid}, {"$addToSet": {"unlocked_backgrounds": updates_set["unlocked_backgrounds"]}})
            
            if updates_pull:
                await db.users.update_one({"firebase_uid": uid}, {"$pull": {"unlocked_backgrounds": {"$in": updates_pull}}})
                
            if updates_unset:
                await db.users.update_one({"firebase_uid": uid}, {"$unset": updates_unset})
                
            count += 1
            
    print(f"Finished. Updated {count} users.")

if __name__ == "__main__":
    asyncio.run(fix_rank_rewards())
