"""
ORIX Database Cleanup Script

Clears all test data from MongoDB and Redis (preserves user data).

Usage:
    cd backend
    python scripts/cleanup_db.py
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import init_db, close_db, get_db, get_redis


async def cleanup_database():
    """Clear all test data except users."""
    print("\n[CLEANUP] Cleaning up database...")
    
    await init_db()
    
    db = get_db()
    redis = get_redis()
    
    # MongoDB collections to clear (preserve users)
    collections_to_clear = [
        "ride_requests",
        "ride_groups", 
        "chat_messages",
        "notifications",
        "reports",
        "admin_logs",
        "bans",
    ]
    
    for collection in collections_to_clear:
        try:
            result = await db[collection].delete_many({})
            print(f"  Cleared {collection}: {result.deleted_count} documents")
        except Exception as e:
            print(f"  Warning: Could not clear {collection}: {e}")
    
    # Clear Redis matchmaking keys
    cursor = 0
    deleted_count = 0
    while True:
        cursor, keys = await redis.scan(cursor, match="orix:*", count=100)
        if keys:
            await redis.delete(*keys)
            deleted_count += len(keys)
        if cursor == 0:
            break
    
    print(f"  Cleared Redis: {deleted_count} keys")
    print("  [OK] Database cleanup complete\n")
    
    await close_db()
    print("[DB] Database connections closed")


if __name__ == "__main__":
    asyncio.run(cleanup_database())
