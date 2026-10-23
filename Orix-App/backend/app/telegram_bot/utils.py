"""
Telegram Bot Utilities

Admin verification and helper functions for Orixy admin bot.
"""

from typing import Optional
from telegram import Update

from app.config import settings
from app.database import get_db


# =============================================================================
# Admin Verification Functions
# =============================================================================

def is_head_admin(user_id: int) -> bool:
    """
    Check if Telegram user is the head admin.
    
    DEPRECATED: Use is_head_admin_async() for full check including database.
    Sync version only checks static env config.
    """
    head_admin = settings.head_admin_id
    return head_admin is not None and user_id == head_admin


def is_master_admin(user_id: int) -> bool:
    """
    Check if Telegram user is the MASTER admin (from .env).
    
    SECURITY: Master admin is the original head admin from .env.
    This is the highest privilege level - cannot be removed or modified.
    Only master admin can add/remove other head admins.
    """
    master_admin = settings.head_admin_id
    return master_admin is not None and user_id == master_admin


async def is_head_admin_async(user_id: int) -> bool:
    """
    Check if Telegram user is a head admin (async version with DB check).
    
    Head admins include:
    1. Master admin (from .env TELEGRAM_HEAD_ADMIN_ID)
    2. Head admins stored in MongoDB (added via /add_headadmin)
    """
    if is_master_admin(user_id):
        return True
    
    db = get_db()
    head_admin_doc = await db.telegram_head_admins.find_one({"telegram_id": user_id})
    return head_admin_doc is not None


def is_admin(user_id: int) -> bool:
    """
    DEPRECATED: Use is_admin_async() for full check including database.
    
    Sync check for admin status (only static config).
    """
    if is_head_admin(user_id):
        return True
    return user_id in settings.admin_chat_ids_list


async def is_admin_async(user_id: int) -> bool:
    """
    Check if Telegram user is an admin (async version with DB check).
    
    SECURITY: Users become admins by:
    1. Being the master admin (TELEGRAM_HEAD_ADMIN_ID in .env)
    2. Being a head admin (in telegram_head_admins collection)
    3. Having their ID in TELEGRAM_ADMIN_CHAT_IDS env var
    4. Having their ID in the telegram_admins collection (via passphrase)
    """
    if await is_head_admin_async(user_id):
        return True
    if user_id in settings.admin_chat_ids_list:
        return True
    
    db = get_db()
    admin_doc = await db.telegram_admins.find_one({"telegram_id": user_id})
    return admin_doc is not None


async def add_telegram_admin(telegram_id: int, username: str = None) -> bool:
    """
    Add a new admin to the database after passphrase verification.
    
    Returns True if added, False if already exists.
    """
    from datetime import datetime, timezone
    
    db = get_db()
    
    existing = await db.telegram_admins.find_one({"telegram_id": telegram_id})
    if existing:
        return False
    
    await db.telegram_admins.insert_one({
        "telegram_id": telegram_id,
        "username": username,
        "added_at": datetime.now(timezone.utc),
        "added_via": "passphrase"
    })
    return True


async def add_head_admin(telegram_id: int, username: str = None, added_by: int = None) -> bool:
    """
    Add a new head admin to the database (Master admin only).
    
    Returns True if added, False if already exists.
    """
    from datetime import datetime, timezone
    
    # Can't add master admin to DB
    if is_master_admin(telegram_id):
        return False
    
    db = get_db()
    
    existing = await db.telegram_head_admins.find_one({"telegram_id": telegram_id})
    if existing:
        return False
    
    await db.telegram_head_admins.insert_one({
        "telegram_id": telegram_id,
        "username": username,
        "added_at": datetime.now(timezone.utc),
        "added_by": added_by
    })
    return True


async def remove_head_admin(telegram_id: int) -> bool:
    """
    Remove a head admin from the database.
    
    Returns True if removed, False if not found.
    Cannot remove master admin.
    """
    if is_master_admin(telegram_id):
        return False
    
    db = get_db()
    result = await db.telegram_head_admins.delete_one({"telegram_id": telegram_id})
    return result.deleted_count > 0


async def get_all_head_admins() -> list:
    """Get all head admins (master + DB stored)."""
    from datetime import datetime, timezone
    
    head_admins = []
    
    # Add master admin first
    if settings.head_admin_id:
        head_admins.append({
            "telegram_id": settings.head_admin_id,
            "username": None,
            "is_master": True,
            "added_at": None
        })
    
    # Add DB head admins
    db = get_db()
    cursor = db.telegram_head_admins.find({})
    async for doc in cursor:
        head_admins.append({
            "telegram_id": doc["telegram_id"],
            "username": doc.get("username"),
            "is_master": False,
            "added_at": doc.get("added_at")
        })
    
    return head_admins


async def is_existing_admin(telegram_id: int) -> bool:
    """Check if user is already an admin (static or dynamic)."""
    return await is_admin_async(telegram_id)


async def require_admin(update: Update) -> bool:
    """
    Verify admin, group, and mention requirements.
    
    RULES:
    1. If allowed group is configured, commands ONLY work in that group
    2. In the allowed admin group, no bot mention required (admins only)
    3. User must be an admin
    """
    from app.telegram_bot.constants import MSG_UNAUTHORIZED
    
    message = update.message
    if not message:
        return False
    
    # Get chat info
    current_chat_id = str(update.effective_chat.id)
    allowed_group = settings.telegram_allowed_group_id or settings.telegram_log_chat_id or ""
    
    # If allowed group is configured, only respond in that group
    if allowed_group:
        if current_chat_id != allowed_group:
            # Silently ignore commands from other chats
            return False
        # In allowed group - no mention required, proceed to admin check
    else:
        # No allowed group configured - ignore group chats entirely
        if update.effective_chat.type in ["group", "supergroup"]:
            return False
    
    # Check if user is admin (async check includes DB)
    if not await is_admin_async(update.effective_user.id):
        await message.reply_text(MSG_UNAUTHORIZED)
        return False
        
    return True




async def require_head_admin(update: Update) -> bool:
    """
    Verify user is a head admin (master admin or DB head admin).
    
    STRICT: Head admins can use critical commands like ban, unban,
    maintenance mode, broadcast, and cancel_group.
    """
    from app.telegram_bot.constants import MSG_HEAD_ADMIN_REQUIRED
    
    if not await require_admin(update):
        return False
    
    if not await is_head_admin_async(update.effective_user.id):
        await update.message.reply_text(MSG_HEAD_ADMIN_REQUIRED)
        return False
    
    return True


async def require_master_admin(update: Update) -> bool:
    """
    Verify user is the MASTER admin (from .env only).
    
    STRICTEST: Only master admin can:
    - Add/remove head admins
    - Manage promo notifications
    - Manage domains
    - Other critical system-level commands
    """
    from app.telegram_bot.constants import MSG_HEAD_ADMIN_REQUIRED
    
    if not await require_admin(update):
        return False
    
    if not is_master_admin(update.effective_user.id):
        await update.message.reply_text(
            "🔒 *Master Admin Required*\n\nThis command requires Master Admin privileges."
        )
        return False
    
    return True


# =============================================================================
# Helper Functions
# =============================================================================

def get_status_emoji(status: str) -> str:
    """Get emoji for user status."""
    from app.telegram_bot.constants import STATUS_EMOJI
    return STATUS_EMOJI.get(status, "[?]")


def get_role_display(user_id: int) -> str:
    """Get role display string for user."""
    from app.telegram_bot.constants import ROLE_EMOJI
    if is_head_admin(user_id):
        return f"{ROLE_EMOJI['head_admin']} Head Admin"
    return f"{ROLE_EMOJI['admin']} Admin"


async def get_role_display_async(user_id: int) -> str:
    """Get role display string for user (async with DB check for head admins)."""
    from app.telegram_bot.constants import ROLE_EMOJI
    if await is_head_admin_async(user_id):
        return f"{ROLE_EMOJI['head_admin']} Head Admin"
    return f"{ROLE_EMOJI['admin']} Admin"


async def find_user_by_identifier(db, identifier: str) -> Optional[dict]:
    """Find user by email or user_id."""
    user = await db.users.find_one({"email": identifier.lower()})
    if not user:
        user = await db.users.find_one({"user_id": identifier})
    return user
