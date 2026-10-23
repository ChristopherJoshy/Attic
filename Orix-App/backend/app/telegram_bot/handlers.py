
"""Telegram Bot Command Handlers - Implements all command logic for Orixy Admin Bot."""
import logging
import asyncio
from typing import Optional, List
from datetime import timedelta

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from app.utils.timezone_utils import utc_now

from app.config import settings
from app.telegram_bot.utils import (
    require_admin,
    require_head_admin,
    is_head_admin,
    is_head_admin_async,
    is_admin,
    get_role_display,
    get_role_display_async,
    find_user_by_identifier,
    get_status_emoji
)
from app.telegram_bot.constants import (
    HELP_COMMANDS_ALL,
    HELP_COMMANDS_HEAD_ADMIN,
    MSG_UNAUTHORIZED,
    MSG_HEAD_ADMIN_REQUIRED,
    MSG_USER_NOT_FOUND,
    MSG_GROUP_NOT_FOUND,
    MSG_REPORT_NOT_FOUND,
    MSG_NO_PENDING_REPORTS,
    MSG_NO_ACTIVE_GROUPS,
    MSG_NO_RECENT_ACTIONS,
    MSG_NO_USERS,
    MSG_NO_HISTORY,
    MSG_ACTION_CANCELLED,
    MSG_USER_BANNED,
    MSG_USER_UNBANNED,
    MSG_USER_SUSPENDED,
    MSG_GROUP_CANCELLED,
    MSG_MAINTENANCE_TOGGLED,
    MSG_REPORT_RESOLVED,
    MSG_NOTIFICATION_SENT,
    MSG_BROADCAST_SENT,
    MSG_GROUP_MESSAGE_SENT,
    MSG_ALREADY_ADMIN,
    MSG_ACCESS_GRANTED,
    get_welcome_message
)

# Services
from app.services.user_service import UserService
from app.services.group_service import GroupService
from app.services.audit_service import AuditService
from app.services.support_service import SupportService
from app.services.notification_service import NotificationService
from app.services.redis_service import RedisService
from app.services.report_service import ReportService
from app.routers.auth import DOMAIN_NAMES
from app.database import get_db

user_service = UserService()
group_service = GroupService()
audit_service = AuditService()
support_service = SupportService()
notification_service = NotificationService()
redis_service = RedisService()
report_service = ReportService()


# =============================================================================
# Basic Commands
# =============================================================================

# =============================================================================
# Domain Management (GUI)
# =============================================================================

async def domains(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View and manage supported college domains."""
    if not await require_admin(update):
        return
    
    msg, keyboard = await _format_domains_view()
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)


async def _format_domains_view():
    """Format domains list with action buttons."""
    from app.config import settings
    
    db = get_db()
    
    # Get domains from MongoDB (primary source)
    domains_list = []
    try:
        cursor = db.domain_names.find({})
        async for doc in cursor:
            domains_list.append({"domain": doc["domain"], "name": doc.get("name", doc["domain"].split(".")[0].upper())})
    except Exception:
        pass
    
    # Fallback: if MongoDB empty, seed from .env
    if not domains_list:
        env_domains = settings.allowed_domains_list
        for domain in env_domains:
            name = DOMAIN_NAMES.get(domain) or domain.split(".")[0].upper()
            domains_list.append({"domain": domain, "name": name})
            # Seed MongoDB
            try:
                await db.domain_names.update_one(
                    {"domain": domain},
                    {"$setOnInsert": {"domain": domain, "name": name}},
                    upsert=True
                )
            except Exception:
                pass
    
    msg = (
        "*Supported Colleges*\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    
    for d in domains_list:
        msg += f"🏫 *{d['name']}*\n"
        msg += f"   `@{d['domain']}`\n\n"
    
    msg += (
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"_Total: {len(domains_list)} domains_\n\n"
        "_Tap a domain to edit or remove_"
    )
    
    # Create buttons for each domain
    buttons = []
    for d in domains_list:
        short_name = d['name'][:20] + "..." if len(d['name']) > 20 else d['name']
        buttons.append([InlineKeyboardButton(f"✏️ {short_name}", callback_data=f"domain_edit_{d['domain']}")])
    
    buttons.append([InlineKeyboardButton("➕ Add Domain", callback_data="domain_add")])
    buttons.append([InlineKeyboardButton("🔄 Refresh", callback_data="domain_refresh")])
    
    keyboard = InlineKeyboardMarkup(buttons)
    return msg, keyboard


async def _handle_domain_callback(query, data: str, context: ContextTypes.DEFAULT_TYPE):
    """Handle domain management button callbacks."""
    db = get_db()
    
    if data == "domain_refresh":
        msg, keyboard = await _format_domains_view()
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data == "domain_add":
        context.user_data["adding_domain"] = True
        msg = (
            "*Add New Domain*\n\n"
            "Reply with the domain in the format:\n"
            "`domain.edu, College Name`\n\n"
            "Example: `newcollege.ac.in, New College Name`"
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("❌ Cancel", callback_data="domain_cancel")]
        ])
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("domain_edit_"):
        domain = data.replace("domain_edit_", "")
        
        # Get current name
        doc = await db.domain_names.find_one({"domain": domain})
        current_name = doc["name"] if doc else DOMAIN_NAMES.get(domain, domain)
        
        # Store domain in user_data for the reply handler
        context.user_data["editing_domain"] = domain
        
        msg = (
            f"*Edit Domain*\n\n"
            f"Domain: `{domain}`\n"
            f"Current Name: *{current_name}*\n\n"
            f"_Reply with the new display name, or tap Delete._"
        )
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🗑️ Delete", callback_data=f"domain_delete_{domain}")],
            [InlineKeyboardButton("❌ Cancel", callback_data="domain_cancel")]
        ])
        
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("domain_delete_"):
        domain = data.replace("domain_delete_", "")
        msg = (
            f"*Delete Domain?*\n\n"
            f"Are you sure you want to remove `{domain}`?\n"
            f"Users with this domain will no longer be able to sign in."
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Yes, Delete", callback_data=f"domain_confirm_delete_{domain}")],
            [InlineKeyboardButton("❌ Cancel", callback_data="domain_cancel")]
        ])
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("domain_confirm_delete_"):
        domain = data.replace("domain_confirm_delete_", "")
        await db.domain_names.delete_one({"domain": domain})
        await query.answer(f"Deleted {domain}")
        msg, keyboard = await _format_domains_view()
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data == "domain_cancel":
        if "editing_domain" in context.user_data:
            del context.user_data["editing_domain"]
        if "adding_domain" in context.user_data:
            del context.user_data["adding_domain"]
        msg, keyboard = await _format_domains_view()
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("domain_save_"):
        # This is handled by the message handler
        return


# =============================================================================
# Domain Requests Management
# =============================================================================

async def domain_requests(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View pending college domain requests."""
    if not await require_admin(update):
        return
    
    msg, keyboard = await _format_domain_requests_view()
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)


async def _format_domain_requests_view():
    """Format pending domain requests with action buttons."""
    db = get_db()
    
    # Get pending requests
    requests = []
    try:
        cursor = db.domain_requests.find({"status": "pending"}).sort("created_at", -1).limit(20)
        async for doc in cursor:
            requests.append(doc)
    except Exception:
        pass
    
    if not requests:
        msg = (
            "*Domain Requests*\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            "No pending requests!\n\n"
            "_All college requests have been processed._"
        )
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔄 Refresh", callback_data="dreq_refresh")]
        ])
        return msg, keyboard
    
    msg = (
        f"*Pending Domain Requests* ({len(requests)})\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    
    for r in requests:
        req_id = str(r["_id"])[:8]
        msg += f"*{r.get('college_name', 'Unknown')}*\n"
        msg += f"   Domain: `{r.get('domain', 'N/A')}`\n"
        msg += f"   City: {r.get('city', 'N/A')}\n"
        msg += f"   Email: `{r.get('email', 'N/A')}`\n"
        msg += f"   ID: `{req_id}`\n"
        if r.get("created_at_ist"):
            msg += f"   Time: {r['created_at_ist']}\n"
        if r.get("message"):
            msg += f"   Note: {r['message'][:50]}...\n" if len(r.get("message", "")) > 50 else f"   Note: {r['message']}\n"
        msg += "\n"
    
    msg += (
        "━━━━━━━━━━━━━━━━━━━━\n"
        "_Tap a request to approve or reject_"
    )
    
    # Create buttons for each request
    buttons = []
    for r in requests[:10]:  # Limit to 10 buttons
        req_id = str(r["_id"])
        college = r.get("college_name", "Unknown")[:15]
        buttons.append([
            InlineKeyboardButton(f"✅ {college}", callback_data=f"dreq_approve_{req_id}"),
            InlineKeyboardButton("❌", callback_data=f"dreq_reject_{req_id}")
        ])
    
    buttons.append([InlineKeyboardButton("🔄 Refresh", callback_data="dreq_refresh")])
    
    keyboard = InlineKeyboardMarkup(buttons)
    return msg, keyboard


async def _handle_domain_request_callback(query, data: str, context: ContextTypes.DEFAULT_TYPE):
    """Handle domain request management button callbacks."""
    from bson import ObjectId
    
    db = get_db()
    
    if data == "dreq_refresh":
        msg, keyboard = await _format_domain_requests_view()
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("dreq_approve_"):
        req_id = data.replace("dreq_approve_", "")
        try:
            request = await db.domain_requests.find_one({"_id": ObjectId(req_id)})
            if not request:
                await query.answer("Request not found")
                return
            
            domain = request.get("domain")
            college_name = request.get("college_name", domain.split(".")[0].upper() if domain else "Unknown")
            
            # Add domain to domain_names collection
            await db.domain_names.update_one(
                {"domain": domain},
                {"$setOnInsert": {"domain": domain, "name": college_name}},
                upsert=True
            )
            
            # Update request status
            await db.domain_requests.update_one(
                {"_id": ObjectId(req_id)},
                {"$set": {"status": "approved", "processed_at": utc_now()}}
            )
            
            await query.answer(f"Approved! {domain} added")
            
            # Refresh view
            msg, keyboard = await _format_domain_requests_view()
            await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        except Exception as e:
            await query.answer(f"Error: {str(e)[:50]}")
        return
    
    if data.startswith("dreq_reject_"):
        req_id = data.replace("dreq_reject_", "")
        try:
            # Update request status
            await db.domain_requests.update_one(
                {"_id": ObjectId(req_id)},
                {"$set": {"status": "rejected", "processed_at": utc_now()}}
            )
            
            await query.answer("Request rejected")
            
            # Refresh view
            msg, keyboard = await _format_domain_requests_view()
            await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        except Exception as e:
            await query.answer(f"Error: {str(e)[:50]}")
        return


async def handle_domain_name_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle reply with new domain name or adding new domain."""
    if not await require_admin(update):
        return False
    
    db = get_db()
    
    # Handle adding new domain
    if context.user_data.get("adding_domain"):
        text = update.message.text.strip()
        
        if "," not in text:
            await update.message.reply_text(
                "Invalid format. Use: `domain.edu, College Name`",
                parse_mode=ParseMode.MARKDOWN
            )
            return True
        
        parts = text.split(",", 1)
        domain = parts[0].strip().lower()
        name = parts[1].strip()
        
        if not domain or "." not in domain:
            await update.message.reply_text("Invalid domain format.")
            return True
        
        if not name or len(name) < 2:
            await update.message.reply_text("Name too short.")
            return True
        
        # Check if domain already exists
        existing = await db.domain_names.find_one({"domain": domain})
        if existing:
            await update.message.reply_text(f"Domain `{domain}` already exists.", parse_mode=ParseMode.MARKDOWN)
            return True
        
        # Add to MongoDB
        await db.domain_names.insert_one({"domain": domain, "name": name})
        del context.user_data["adding_domain"]
        
        await update.message.reply_text(
            f"✅ Added!\n\n`{domain}` → *{name}*",
            parse_mode=ParseMode.MARKDOWN
        )
        
        # Show updated list
        msg, keyboard = await _format_domains_view()
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return True
    
    # Handle editing existing domain
    if "editing_domain" not in context.user_data:
        return False
    
    domain = context.user_data["editing_domain"]
    new_name = update.message.text.strip()
    
    if not new_name or len(new_name) < 2:
        await update.message.reply_text("Name too short. Please try again.")
        return True
    
    if len(new_name) > 100:
        await update.message.reply_text("Name too long (max 100 chars). Please try again.")
        return True
    
    # Save to MongoDB
    await db.domain_names.update_one(
        {"domain": domain},
        {"$set": {"domain": domain, "name": new_name}},
        upsert=True
    )
    
    del context.user_data["editing_domain"]
    
    await update.message.reply_text(
        f"✅ Updated!\n\n`{domain}` → *{new_name}*",
        parse_mode=ParseMode.MARKDOWN
    )
    
    # Show updated list
    msg, keyboard = await _format_domains_view()
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
    
    return True


# =============================================================================
# Basic Commands (Original)
# =============================================================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start command - show help and status."""
    if not await require_admin(update):
        return

    user_id = update.effective_user.id
    is_head = await is_head_admin_async(user_id)
    role_display = await get_role_display_async(user_id)
    
    welcome_msg = get_welcome_message(role_display, is_head)
    await update.message.reply_text(welcome_msg, parse_mode=ParseMode.MARKDOWN)


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show system statistics."""
    if not await require_admin(update):
        return

    # Basic stats placeholder
    db = get_db()
    user_count = await db.users.count_documents({})
    group_count = await db.groups.count_documents({"status": "active"})
    report_count = await db.reports.count_documents({"status": "pending"})
    
    msg = (
        "*System Statistics*\n\n"
        f"Users: `{user_count}`\n"
        f"Active Groups: `{group_count}`\n"
        f"Pending Reports: `{report_count}`\n"
    )
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View recent admin logs with pagination."""
    if not await require_admin(update):
        return
    
    page = 0
    per_page = 5
    
    if context.args:
        try:
            page = max(0, int(context.args[0]) - 1)
        except ValueError:
            pass
    
    msg, keyboard = await _format_logs_page(page, per_page)
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)


async def _format_logs_page(page: int, per_page: int = 5):
    """Format logs page with detailed entries and pagination."""
    skip = page * per_page
    admin_logs = await audit_service.get_logs(limit=per_page, skip=skip)
    total_count = await audit_service.get_logs_count()
    
    total_pages = max(1, (total_count + per_page - 1) // per_page)
    
    if not admin_logs:
        return MSG_NO_RECENT_ACTIONS, None
    
    # Header with page info
    msg = (
        f"📋 *ADMIN LOGS*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Page {page + 1} of {total_pages} | Total: {total_count}\n\n"
    )
    
    for i, log in enumerate(admin_logs, 1):
        timestamp = log.timestamp.strftime("%d/%m %H:%M") if log.timestamp else "N/A"
        
        # Use action directly without escaping (backticks handle special chars)
        action = str(log.action)
        
        # Action icon based on type
        icon = "🔹"
        if "ban" in action.lower():
            icon = "🚫"
        elif "suspend" in action.lower():
            icon = "⏸️"
        elif "login" in action.lower() or "online" in action.lower():
            icon = "🟢"
        elif "offline" in action.lower():
            icon = "🔴"
        elif "report" in action.lower():
            icon = "⚠️"
        elif "rider" in action.lower():
            icon = "🏍️"
        elif "profile" in action.lower():
            icon = "👤"
        elif "group" in action.lower():
            icon = "👥"
        
        msg += f"{icon} `{action}`\n"
        msg += f"   ⏰ {timestamp}\n"
        
        # Actor info - show full ID
        if log.actor_email:
            msg += f"   👤 Actor: `{log.actor_email}`\n"
        elif log.actor_id:
            msg += f"   👤 Actor: `{log.actor_id}`\n"
        
        # Target info - show full ID
        if log.target_id:
            target_type = str(log.target_type or "item")
            msg += f"   🎯 {target_type}: `{log.target_id}`\n"
        
        msg += "\n"
    
    msg += f"━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"_Use /logs [page] or buttons below_"
    
    # Pagination buttons
    buttons = []
    if page > 0:
        buttons.append(InlineKeyboardButton("⬅️ Previous", callback_data=f"logs_page_{page - 1}"))
    if page < total_pages - 1:
        buttons.append(InlineKeyboardButton("Next ➡️", callback_data=f"logs_page_{page + 1}"))
    
    keyboard = InlineKeyboardMarkup([buttons]) if buttons else None
    
    return msg, keyboard


# =============================================================================
# User Management
# =============================================================================

async def lookup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Look up user details."""
    if not await require_admin(update):
        return

    if not context.args:
        await update.message.reply_text("Usage: /lookup <email|user_id>")
        return

    identifier = context.args[0]
    db = get_db()
    user = await find_user_by_identifier(db, identifier)
    
    if not user:
        await update.message.reply_text(MSG_USER_NOT_FOUND.format(identifier=identifier))
        return
        
    # Format user details
    status_emoji = get_status_emoji(user.get("status", "active"))
    msg = (
        f"*User Details* {status_emoji}\n\n"
        f"ID: `{user['user_id']}`\n"
        f"Name: {user.get('display_name', 'N/A')}\n"
        f"Email: `{user.get('email', 'N/A')}`\n"
        f"Phone: `{user.get('phone', 'N/A')}`\n"
        f"Role: {user.get('role', 'user')}\n"
        f"Status: {user.get('status', 'active')}\n"
    )
    
    if user.get("is_rider"):
        msg += "[Rider Profile Active]\n"
        
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List recent users."""
    if not await require_admin(update):
        return
        
    limit = 5
    if context.args:
        try:
            limit = int(context.args[0])
        except ValueError:
            pass
            
    db = get_db()
    cursor = db.users.find().sort("created_at", -1).limit(limit)
    users_list = await cursor.to_list(length=limit)
    
    if not users_list:
        await update.message.reply_text(MSG_NO_USERS)
        return
        
    msg = f"*Recent {len(users_list)} Users*\n\n"
    for u in users_list:
        msg += f"- {u.get('display_name')} (`{u.get('email')}`)\n"
        
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View user action history."""
    if not await require_admin(update):
        return
        
    if not context.args:
        await update.message.reply_text("Usage: /history <user_id>")
        return
        
    user_id = context.args[0]
    
    # Try to find user first
    db = get_db()
    user = await find_user_by_identifier(db, user_id)
    
    if not user:
        await update.message.reply_text(f"User not found: {user_id}")
        return
    
    user_logs = await audit_service.get_user_history(user['user_id'], limit=15)
    
    if not user_logs:
        await update.message.reply_text(MSG_NO_HISTORY.format(user_id=user['display_name']))
        return
    
    msg = f"*History for {user['display_name']}*\n\n"
    for log in user_logs:
        timestamp = log.timestamp.strftime("%m/%d %H:%M") if log.timestamp else "N/A"
        msg += f"`{timestamp}` {log.action}\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# Moderation (Ban/Suspend)
# =============================================================================

async def ban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ban a user permanently (Head Admin only)."""
    if not await require_head_admin(update):
        return

    if len(context.args) < 2:
        await update.message.reply_text("Usage: /ban <email|user_id> <reason>")
        return

    identifier = context.args[0]
    reason = " ".join(context.args[1:])
    
    db = get_db()
    user = await find_user_by_identifier(db, identifier)
    
    if not user:
        await update.message.reply_text(MSG_USER_NOT_FOUND.format(identifier=identifier))
        return

    # Execute ban
    await user_service.ban_user(user['user_id'], reason)
    
    await update.message.reply_text(
        MSG_USER_BANNED.format(email=user['email'], reason=reason),
        parse_mode=ParseMode.MARKDOWN
    )


async def unban(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Unban a user (Head Admin only)."""
    if not await require_head_admin(update):
        return

    if not context.args:
        await update.message.reply_text("Usage: /unban <email|user_id>")
        return

    identifier = context.args[0]
    db = get_db()
    user = await find_user_by_identifier(db, identifier)
    
    if not user:
        await update.message.reply_text(MSG_USER_NOT_FOUND.format(identifier=identifier))
        return

    await user_service.unban_user(user['user_id'])
    await update.message.reply_text(MSG_USER_UNBANNED.format(email=user['email']), parse_mode=ParseMode.MARKDOWN)


async def suspend(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Suspend a user."""
    if not await require_admin(update):
        return

    if len(context.args) < 3:
        await update.message.reply_text("Usage: /suspend <email|user_id> <hours> <reason>")
        return

    identifier = context.args[0]
    try:
        hours = int(context.args[1])
    except ValueError:
        await update.message.reply_text("Hours must be a number.")
        return
        
    reason = " ".join(context.args[2:])
    
    db = get_db()
    user = await find_user_by_identifier(db, identifier)
    
    if not user:
        await update.message.reply_text(MSG_USER_NOT_FOUND.format(identifier=identifier))
        return

    await user_service.suspend_user(user['user_id'], hours, reason)
    
    await update.message.reply_text(
        MSG_USER_SUSPENDED.format(email=user['email'], hours=hours, reason=reason),
        parse_mode=ParseMode.MARKDOWN
    )


# =============================================================================
# Reports & Support
# =============================================================================

async def reports(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View pending reports."""
    if not await require_admin(update):
        return

    pending_reports = await report_service.get_pending_reports()
    
    if not pending_reports:
        await update.message.reply_text(MSG_NO_PENDING_REPORTS)
        return

    msg = f"*Pending Reports* ({len(pending_reports)})\n"
    msg += "━━━━━━━━━━━━━━━━━━━━\n\n"
    
    for r in pending_reports:
        # Escape special chars in reason
        reason = r.reason.replace("_", "\\_").replace("*", "\\*") if r.reason else "No reason"
        msg += (
            f"ID: `{r.report_id}`\n"
            f"Reason: {reason}\n"
            f"Reporter: `{r.reporter_id}`\n"
            f"Reported: `{r.reported_user_id}`\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
        )
    
    msg += "\nResolve: `/resolve ID ACTION`\n"
    msg += "Actions: dismiss, warn, ban"
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def resolve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Resolve a report."""
    if not await require_admin(update):
        return

    if len(context.args) < 1:
        await update.message.reply_text(
            "Usage: /resolve REPORT\\_ID ACTION [note]\n"
            "Actions: dismiss, warn, ban"
        )
        return

    report_id = context.args[0]
    action = context.args[1] if len(context.args) > 1 else "dismiss"
    note = " ".join(context.args[2:]) if len(context.args) > 2 else "Resolved via Telegram"

    try:
        await report_service.resolve_report(
            report_id=report_id,
            action=action,
            resolution_notes=note,
            resolved_by=f"telegram:{update.effective_user.id}"
        )
        await update.message.reply_text(
            f"*Report Resolved*\n\n"
            f"ID: `{report_id}`\n"
            f"Action: *{action.upper()}*\n"
            f"Note: {note}",
            parse_mode=ParseMode.MARKDOWN
        )
    except ValueError as e:
        await update.message.reply_text(f"Report `{report_id}` not found.", parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")


async def tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View all open support tickets."""
    if not await require_admin(update):
        return
    
    try:
        tickets_list = await support_service.get_all_open_tickets()
    except Exception as e:
        await update.message.reply_text(f"Failed to fetch tickets: {str(e)[:100]}")
        return
        
    if not tickets_list:
        await update.message.reply_text("No open tickets!")
        return
        
    message = "*Open Tickets*\n\n"
    for ticket in tickets_list:
        emoji = "[Issue]" if ticket.type == "issue" else "[Feature]" if ticket.type == "feature" else "[Alert]"
        msg_count = len(ticket.messages) if ticket.messages else 0
        message += (
            f"{emoji} `{ticket.ticket_id}`\n"
            f"Subject: {ticket.subject}\n"
            f"User: `{ticket.user_id}`\n"
            f"Msgs: {msg_count} | Status: {ticket.status}\n\n"
        )
        
    message += "Use `/reply <ticket_id> <message>` to respond."
    await update.message.reply_text(message, parse_mode=ParseMode.MARKDOWN)


async def reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reply to a support ticket."""
    if not await require_admin(update):
        return
        
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /reply <ticket_id> <message>")
        return
        
    ticket_id = context.args[0]
    message_content = " ".join(context.args[1:])
    
    admin_id = f"telegram:{update.effective_user.id}"
    
    try:
        updated_ticket = await support_service.add_admin_reply(ticket_id, admin_id, message_content)
        
        if updated_ticket:
            await update.message.reply_text(f"Reply sent to ticket `{ticket_id}`", parse_mode=ParseMode.MARKDOWN)
        else:
            await update.message.reply_text(f"Ticket `{ticket_id}` not found.", parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Error sending reply: {str(e)}")


async def close_ticket_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Close a support ticket."""
    if not await require_admin(update):
        return

    if len(context.args) < 1:
        await update.message.reply_text("Usage: /close <ticket_id> [reason]")
        return
        
    ticket_id = context.args[0]
    reason = " ".join(context.args[1:]) if len(context.args) > 1 else "Closed by admin"
    
    try:
        admin_id = f"telegram:{update.effective_user.id}"
        result = await support_service.close_ticket(ticket_id, admin_id) # Simplify call if possible
        if result:
            await update.message.reply_text(f"Ticket `{ticket_id}` closed.", parse_mode=ParseMode.MARKDOWN)
        else:
            await update.message.reply_text(f"Failed to close ticket `{ticket_id}`.")
    except Exception as e:
        await update.message.reply_text(f"Error closing ticket: {str(e)}")


# =============================================================================
# Group Management
# =============================================================================

async def groups(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View active groups."""
    if not await require_admin(update):
        return

    db = get_db()
    active_groups = await db.groups.find({"status": "active"}).to_list(length=5)
    
    if not active_groups:
        await update.message.reply_text(MSG_NO_ACTIVE_GROUPS)
        return
        
    msg = "*Active Groups*\n\n"
    for g in active_groups:
        msg += f"`{g['group_id']}` | Riders: {len(g.get('riders', []))}\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def cancel_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel a group (Head Admin only)."""
    if not await require_head_admin(update):
        return

    if len(context.args) < 2:
        await update.message.reply_text("Usage: /cancel_group <group_id> <reason>")
        return
        
    group_id = context.args[0]
    reason = " ".join(context.args[1:])
    
    try:
        # Assuming group_service has a cancel method
        # If not, implement a basic db update
        db = get_db()
        result = await db.groups.update_one(
            {"group_id": group_id},
            {"$set": {"status": "cancelled", "cancel_reason": reason}}
        )
        
        if result.modified_count > 0:
            await update.message.reply_text(MSG_GROUP_CANCELLED.format(group_id=group_id), parse_mode=ParseMode.MARKDOWN)
        else:
            await update.message.reply_text(MSG_GROUP_NOT_FOUND.format(group_id=group_id))
            
    except Exception as e:
        await update.message.reply_text(f"Error cancelling group: {str(e)}")


async def msggroup(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a message to all members of a ride group."""
    if not await require_admin(update):
        return
        
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /msggroup <group_id> <message>")
        return
        
    group_id = context.args[0]
    message = " ".join(context.args[1:])
    
    db = get_db()
    
    grp = await db.ride_groups.find_one({"group_id": {"$regex": f"^{group_id}"}})
    
    if not grp:
        await update.message.reply_text(f"Group not found: `{group_id}`", parse_mode=ParseMode.MARKDOWN)
        return
    
    members = grp.get("members", [])
    
    if not members:
        await update.message.reply_text("Group has no members.")
        return
    
    sent_count = 0
    failed_count = 0
    
    for member in members:
        user_id = member.get("user_id")
        if not user_id:
            continue
        
        try:
            from app.models.notification import NotificationType
            await notification_service.send_notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title="Admin Message",
                body=message,
                data={"type": "admin_group_message", "group_id": grp["group_id"]}
            )
            sent_count += 1
        except Exception:
            failed_count += 1
    
    await update.message.reply_text(
        f"*Message Sent to Group*\n\n"
        f"Group: `{grp['group_id']}`\n"
        f"Sent to: {sent_count} members\n"
        f"Failed: {failed_count}",
        parse_mode=ParseMode.MARKDOWN
    )


# =============================================================================
# Communication (Broadcast/Notify)
# =============================================================================

async def notify(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a notification to a specific user."""
    if not await require_admin(update):
        return

    if len(context.args) < 2:
        await update.message.reply_text("Usage: /notify <user_id> <message>")
        return
        
    user_id = context.args[0]
    message = " ".join(context.args[1:])
    
    try:
        from app.models.notification import NotificationType
        await notification_service.send_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="Admin Notification",
            body=message,
            data={"type": "admin_message"}
        )
        await update.message.reply_text(MSG_NOTIFICATION_SENT.format(email=user_id), parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Failed to notify: {str(e)}")


async def broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Broadcast message to all users (Head Admin only)."""
    if not await require_head_admin(update):
        return

    if not context.args:
        await update.message.reply_text("Usage: /broadcast <message>")
        return
        
    message = " ".join(context.args)
    
    await update.message.reply_text(f"Broadcasting to all users...")
    
    try:
        count = await notification_service.broadcast_to_all_users(
            title="Announcement",
            message=message
        )
        
        await update.message.reply_text(
            MSG_BROADCAST_SENT.format(count=count, message=message[:50] + "..." if len(message) > 50 else message),
            parse_mode=ParseMode.MARKDOWN
        )
    except Exception as e:
        await update.message.reply_text(f"Broadcast failed: {str(e)}")


# =============================================================================
# System Management
# =============================================================================

async def maintenance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle maintenance mode (Head Admin only)."""
    if not await require_head_admin(update):
        return

    if not context.args or context.args[0] not in ["on", "off"]:
        await update.message.reply_text("Usage: /maintenance <on|off>")
        return
        
    mode = context.args[0]
    enable = mode == "on"
    
    await redis_service.set_maintenance_mode(enable)
    
    emoji = "[STOP]" if enable else "[OK]"
    status_text = "ENABLED" if enable else "DISABLED"
    
    await update.message.reply_text(
        MSG_MAINTENANCE_TOGGLED.format(emoji=emoji, status=status_text),
        parse_mode=ParseMode.MARKDOWN
    )


async def handle_secret_passphrase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle secret password to become admin."""
    msg_text = update.message.text.strip() if update.message and update.message.text else ""
    
    if msg_text == settings.telegram_secret_admin_passphrase:
        from app.telegram_bot.utils import add_telegram_admin, is_existing_admin
        
        user_id = update.effective_user.id
        username = update.effective_user.username
        
        if await is_existing_admin(user_id):
            await update.message.reply_text(
                MSG_ALREADY_ADMIN,
                parse_mode=ParseMode.MARKDOWN
            )
            return
        
        was_added = await add_telegram_admin(user_id, username)
        
        if was_added:
            await update.message.reply_text(
                MSG_ACCESS_GRANTED.format(user_id=str(user_id)),
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            await update.message.reply_text(
                MSG_ALREADY_ADMIN,
                parse_mode=ParseMode.MARKDOWN
            )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button callbacks."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    # Logs pagination
    if data.startswith("logs_page_"):
        try:
            page = int(data.replace("logs_page_", ""))
            msg, keyboard = await _format_logs_page(page, 5)
            await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        except Exception as e:
            await query.message.reply_text(f"Error loading page: {str(e)}")
        return
    
    # Domain management callbacks
    if data.startswith("domain_"):
        try:
            await _handle_domain_callback(query, data, context)
        except Exception as e:
            await query.message.reply_text(f"Error: {str(e)}")
        return
    
    # Domain requests callbacks
    if data.startswith("dreq_"):
        try:
            await _handle_domain_request_callback(query, data, context)
        except Exception as e:
            await query.message.reply_text(f"Error: {str(e)}")
        return
    
    # Promo management callbacks
    if data.startswith("promo_"):
        try:
            from app.telegram_bot.extended_handlers import _handle_promo_callback
            await _handle_promo_callback(query, data, context)
        except Exception as e:
            await query.message.reply_text(f"Error: {str(e)}")
        return
    
    # Update Manager callbacks (session expired)
    if data.startswith("upd_"):
        await query.message.reply_text("Session expired. Please run /update_manager again.")
        try:
            # Try to remove the buttons from the old message
            await query.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        return

    # Default handler for unknown callbacks
    await query.message.reply_text(f"Unknown action: {data}")


