#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Database - MongoDB connection management and indexing.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# Database.connect: Establishes connection to MongoDB.
# Database.disconnect: Closes connection.
# Database._create_indexes: Creates required indexes for collections.
# Database.check_health: Checks database connectivity.
# Database.get_db: Returns the database instance.
# get_database: FastAPI dependency for database access.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# Database: Static class managing the MongoDB client and database connection.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# motor.motor_asyncio: Async MongoDB driver.
# typing: Type hints.
# logging: Logging.
# app.config.get_settings: App settings.

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class Database:
    """MongoDB database connection manager"""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect(cls) -> None:
        """Establish connection to MongoDB"""
        settings = get_settings()
        try:
            cls.client = AsyncIOMotorClient(settings.mongodb_uri)
            cls.db = cls.client[settings.mongodb_database]
            
            # Verify connection
            await cls.client.admin.command('ping')
            logger.info(f"Connected to MongoDB: {settings.mongodb_database}")
            
            # Create indexes
            await cls._create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    @classmethod
    async def disconnect(cls) -> None:
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            logger.info("Disconnected from MongoDB")
    
    @classmethod
    async def _create_indexes(cls) -> None:
        """Create necessary indexes for collections"""
        if cls.db is None:
            return
        
        # Users collection indexes
        await cls.db.users.create_index("firebase_uid", unique=True)
        await cls.db.users.create_index("email", unique=True, sparse=True)
        await cls.db.users.create_index("elo_rating", background=True)
        await cls.db.users.create_index("rank_tier", background=True)
        # Index for leaderboard queries (active players sorted by elo)
        await cls.db.users.create_index(
            [("total_matches", 1), ("elo_rating", -1)],
            background=True
        )
        # Text index for user search (future feature support)
        await cls.db.users.create_index(
            [("display_name", "text")],
            background=True
        )
        
        # Matches collection indexes
        await cls.db.matches.create_index("created_at", background=True)
        await cls.db.matches.create_index("player1_id", background=True)
        await cls.db.matches.create_index("player2_id", background=True)
        await cls.db.matches.create_index("winner_id", background=True)
        await cls.db.matches.create_index("match_id", unique=True, background=True)
        
        # Match history index for user lookups
        await cls.db.matches.create_index(
            [("player1_id", 1), ("created_at", -1)],
            background=True
        )
        await cls.db.matches.create_index(
            [("player2_id", 1), ("created_at", -1)],
            background=True
        )
        # Compound index for match history queries (both players + time)
        await cls.db.matches.create_index(
            [("player1_id", 1), ("player2_id", 1), ("ended_at", -1)],
            background=True
        )
        
        # Friend requests collection indexes
        await cls.db.friend_requests.create_index("request_id", unique=True)
        await cls.db.friend_requests.create_index(
            [("from_user_id", 1), ("to_user_id", 1), ("status", 1)],
            background=True
        )
        await cls.db.friend_requests.create_index(
            [("to_user_id", 1), ("status", 1)],
            background=True
        )
        
        # Friendships collection indexes
        await cls.db.friendships.create_index("friendship_id", unique=True)
        await cls.db.friendships.create_index("user1_id", background=True)
        await cls.db.friendships.create_index("user2_id", background=True)
        await cls.db.friendships.create_index(
            [("user1_id", 1), ("user2_id", 1)],
            unique=True,
            background=True
        )
        
        # IP logs collection indexes (for alt farming detection)
        await cls.db.ip_logs.create_index("ip_address", background=True)
        await cls.db.ip_logs.create_index("blocked_user_id", background=True)
        await cls.db.ip_logs.create_index("existing_user_id", background=True)
        await cls.db.ip_logs.create_index("timestamp", background=True)
        await cls.db.ip_logs.create_index(
            [("ip_address", 1), ("timestamp", -1)],
            background=True
        )
        
        logger.info("Database indexes created")
    
    @classmethod
    async def check_health(cls) -> bool:
        """Check if database connection is alive"""
        if cls.client is None:
            return False
        try:
            await cls.client.admin.command('ping')
            return True
        except Exception as e:
            logger.warning(f"Database health check failed: {e}")
            return False
    
    @classmethod
    def get_db(cls) -> AsyncIOMotorDatabase:
        """Get database instance"""
        if cls.db is None:
            raise RuntimeError("Database not connected. Call Database.connect() first.")
        return cls.db


# Convenience functions
async def get_database() -> AsyncIOMotorDatabase:
    """Dependency for getting database in routes"""
    return Database.get_db()
