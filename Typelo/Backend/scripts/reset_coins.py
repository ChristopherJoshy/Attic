#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Reset Coins Script - Resets all user coin values to zero in the database.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# reset_all_coins: Connects to MongoDB and sets coins to 0 for all users.
# main: Entry point that runs the async reset_all_coins function.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# MONGODB_URI: MongoDB connection string from environment or default.
# MONGODB_DATABASE: Database name from environment or default.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# asyncio: For running async code.
# os: For reading environment variables.
# pathlib: For path handling.
# dotenv: For loading .env file.
# motor.motor_asyncio: Async MongoDB driver.

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "evotaion")


async def reset_all_coins() -> None:
    """
    Connect to MongoDB and reset coins to 0 for all users.
    Prints summary of the operation.
    """
    print(f"Connecting to MongoDB: {MONGODB_DATABASE}...")
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DATABASE]
    
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB.")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        return
    
    users_collection = db.users
    
    total_users = await users_collection.count_documents({})
    print(f"Found {total_users} total users in the database.")
    
    users_with_coins = await users_collection.count_documents({"coins": {"$gt": 0}})
    users_without_coins_field = await users_collection.count_documents({"coins": {"$exists": False}})
    print(f"Found {users_with_coins} users with coins > 0.")
    print(f"Found {users_without_coins_field} users without a coins field.")
    
    if users_with_coins == 0 and users_without_coins_field == 0:
        print("All users already have coins set to 0. Exiting.")
        client.close()
        return
    
    confirm = input(f"Are you sure you want to reset/add coins to 0 for ALL {total_users} users? (yes/no): ")
    if confirm.lower() != "yes":
        print("Operation cancelled.")
        client.close()
        return
    
    result = await users_collection.update_many(
        {},
        {"$set": {"coins": 100}}
    )
    
    print(f"Reset complete!")
    print(f"  - Matched: {result.matched_count} users")
    print(f"  - Modified: {result.modified_count} users")
    print(f"  - Users that had coins field added: {users_without_coins_field}")
    
    client.close()
    print("Disconnected from MongoDB.")


def main() -> None:
    """Entry point for the script."""
    print("=" * 60)
    print("EVOTAION - Reset All User Coins Script")
    print("=" * 60)
    asyncio.run(reset_all_coins())


if __name__ == "__main__":
    main()
