"""
ORIX Database Module

MongoDB and Redis connection management.
"""

from typing import Optional

import redis.asyncio as redis
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings


# =============================================================================
# MongoDB Connection
# =============================================================================

class MongoDB:
    """MongoDB connection manager."""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


mongo = MongoDB()


async def init_mongodb():
    """Initialize MongoDB connection and create indexes."""
    mongo.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo.db = mongo.client[settings.mongodb_database]
    
    # Create indexes for users collection
    await mongo.db.users.create_index("user_id", unique=True)
    await mongo.db.users.create_index("firebase_uid", unique=True)
    await mongo.db.users.create_index("email", unique=True)
    
    # Create indexes for ride_requests collection
    await mongo.db.ride_requests.create_index("request_id", unique=True)
    await mongo.db.ride_requests.create_index("user_id")
    await mongo.db.ride_requests.create_index("status")
    await mongo.db.ride_requests.create_index("expires_at")
    await mongo.db.ride_requests.create_index([
        ("pickup.coordinates", "2dsphere")
    ])
    await mongo.db.ride_requests.create_index([
        ("drop.coordinates", "2dsphere")
    ])
    
    # SCALABILITY: Compound index for common user+status queries
    await mongo.db.ride_requests.create_index([
        ("user_id", 1),
        ("status", 1)
    ])
    
    # RACE CONDITION FIX: Partial unique index to prevent duplicate active requests
    # This ensures only ONE pending/matching request per user at database level
    try:
        await mongo.db.ride_requests.create_index(
            [("user_id", 1)],
            unique=True,
            partialFilterExpression={
                "status": {"$in": ["pending", "matching"]}
            },
            name="unique_active_request_per_user"
        )
    except Exception:
        pass  # Index may already exist
    
    # Create indexes for ride_groups collection
    await mongo.db.ride_groups.create_index("group_id", unique=True)
    await mongo.db.ride_groups.create_index("members.user_id")
    await mongo.db.ride_groups.create_index("status")
    
    # SCALABILITY: Compound index for matchmaking group queries
    await mongo.db.ride_groups.create_index([
        ("status", 1),
        ("date", 1)
    ])
    
    # SCALABILITY: Index for group expiration queries
    await mongo.db.ride_groups.create_index([
        ("status", 1),
        ("expires_at", 1)
    ])
    
    # Create indexes for reports collection
    await mongo.db.reports.create_index("report_id", unique=True)
    await mongo.db.reports.create_index("reporter_user_id")
    await mongo.db.reports.create_index("accused_user_id")
    await mongo.db.reports.create_index("status")
    
    # Create indexes for admin_logs collection
    await mongo.db.admin_logs.create_index("log_id", unique=True)
    await mongo.db.admin_logs.create_index("timestamp")
    await mongo.db.admin_logs.create_index("actor_id")
    await mongo.db.admin_logs.create_index("action")
    
    # Create indexes for notifications collection
    await mongo.db.notifications.create_index("notification_id", unique=True)
    await mongo.db.notifications.create_index("user_id")
    await mongo.db.notifications.create_index([("user_id", 1), ("read", 1)])
    
    # Create indexes for chat_messages collection
    await mongo.db.chat_messages.create_index("message_id", unique=True)
    await mongo.db.chat_messages.create_index("group_id")
    await mongo.db.chat_messages.create_index([("group_id", 1), ("created_at", 1)])


async def close_mongodb():
    """Close MongoDB connection."""
    if mongo.client:
        mongo.client.close()


def get_db() -> AsyncIOMotorDatabase:
    """Get database instance."""
    if mongo.db is None:
        raise RuntimeError("Database not initialized")
    return mongo.db


# =============================================================================
# Redis Connection
# =============================================================================

class RedisClient:
    """Redis connection manager."""
    
    client: Optional[redis.Redis] = None


redis_client = RedisClient()


async def init_redis():
    """Initialize Redis connection."""
    redis_client.client = redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        health_check_interval=30,
        socket_connect_timeout=5,
        retry_on_timeout=True,
        socket_keepalive=True
    )


async def close_redis():
    """Close Redis connection."""
    if redis_client.client:
        await redis_client.client.close()


def get_redis() -> redis.Redis:
    """Get Redis client instance."""
    if redis_client.client is None:
        raise RuntimeError("Redis not initialized")
    return redis_client.client


# =============================================================================
# Combined Initialization
# =============================================================================

async def init_db():
    """Initialize all database connections."""
    await init_mongodb()
    await init_redis()


async def close_db():
    """Close all database connections."""
    await close_mongodb()
    await close_redis()
