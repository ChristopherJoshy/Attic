
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.constants import CURSORS, EFFECTS

# Load env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "evotaion")

TARGET_USER_UID = "xOAB2eOuwpcsSBgbLxOfGMEWF5f1"

async def unlock_all():
    print(f"Connecting to MongoDB: {MONGODB_DATABASE}...")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DATABASE]
    
    try:
        await client.admin.command('ping')
        print("Connected.")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # Prepare all items
    all_cursors = list(CURSORS.keys())
    all_effects = list(EFFECTS.keys())
    
    print(f"Unlocking {len(all_cursors)} cursors and {len(all_effects)} effects for user: {TARGET_USER_UID}")
    
    result = await db.users.update_one(
        {"firebase_uid": TARGET_USER_UID},
        {"$set": {
            "unlocked_cursors": all_cursors,
            "unlocked_effects": all_effects
        }}
    )
    
    if result.matched_count > 0:
        print("Success! User inventory updated.")
        if result.modified_count > 0:
            print("Changes applied.")
        else:
            print("User already had all items unlocked.")
    else:
        print("User not found!")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(unlock_all())
