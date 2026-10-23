"""
Database Index Creation Script

Optimizes MongoDB queries by creating necessary indexes.
Run this script after deployment or when setting up a new database.
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_indexes():
    """Create all necessary indexes for optimal query performance."""
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_database]
    
    logger.info("Creating database indexes...")
    
    # Users collection indexes
    logger.info("Creating users indexes...")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email")
    await db.users.create_index("telegram_id")
    await db.users.create_index("status")
    await db.users.create_index("created_at")
    await db.users.create_index([("display_name", "text"), ("email", "text")])  # Text search
    
    # Rides collection indexes
    logger.info("Creating rides indexes...")
    await db.rides.create_index("ride_id", unique=True)
    await db.rides.create_index("user_id")
    await db.rides.create_index("status")
    await db.rides.create_index([("status", 1), ("created_at", -1)])
    await db.rides.create_index([("user_id", 1), ("status", 1)])
    
    # Groups collection indexes
    logger.info("Creating groups indexes...")
    await db.groups.create_index("group_id", unique=True)
    await db.groups.create_index("status")
    await db.groups.create_index("created_at")
    await db.groups.create_index([("status", 1), ("created_at", -1)])
    
    # Reports collection indexes
    logger.info("Creating reports indexes...")
    await db.reports.create_index("report_id", unique=True)
    await db.reports.create_index("reporter_id")
    await db.reports.create_index("reported_id")
    await db.reports.create_index("status")
    await db.reports.create_index([("status", 1), ("created_at", -1)])
    
    # Support tickets indexes
    logger.info("Creating tickets indexes...")
    await db.support_tickets.create_index("ticket_id", unique=True)
    await db.support_tickets.create_index("user_id")
    await db.support_tickets.create_index("status")
    await db.support_tickets.create_index([("status", 1), ("created_at", -1)])
    
    # AI context indexes
    logger.info("Creating AI context indexes...")
    await db.ai_chat_context.create_index("chat_id", unique=True)
    await db.ai_pending_confirmations.create_index("chat_id")
    await db.ai_pending_confirmations.create_index([("status", 1), ("expires_at", 1)])
    
    # Admin list indexes
    logger.info("Creating admin indexes...")
    await db.telegram_admins.create_index("telegram_id", unique=True)
    
    # Audit logs indexes
    logger.info("Creating audit indexes...")
    await db.audit_logs.create_index("admin_id")
    await db.audit_logs.create_index("action")
    await db.audit_logs.create_index("created_at")
    await db.audit_logs.create_index([("admin_id", 1), ("created_at", -1)])
    
    # Performance metrics indexes
    logger.info("Creating metrics indexes...")
    await db.performance_metrics.create_index("command")
    await db.performance_metrics.create_index("timestamp")
    await db.performance_metrics.create_index([("command", 1), ("timestamp", -1)])
    
    logger.info("All indexes created successfully!")
    client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
