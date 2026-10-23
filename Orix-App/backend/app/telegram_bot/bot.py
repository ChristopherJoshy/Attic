"""
ORIX Telegram Admin Bot (Orixy)

Admin bot for managing moderation and system operations.

Total Commands: 95

BASIC COMMANDS:
- /start, /help - Show commands
- /ping - Latency check
- /uptime - Server uptime

USER MANAGEMENT (All Admins):
- /lookup <email|user_id> - Look up user details
- /search <query> - Search users by name/email
- /profile <user_id> - Full user profile
- /history <user_id> - View user action history
- /users [count] - List recent users
- /online - Currently online users
- /new_users [days] - New registrations
- /active_riders - List active riders
- /suspended_users - List suspended users
- /banned_users - List banned users
- /fcm_status <user> - Check FCM token status
- /warn <user> <msg> - Send warning

MODERATION (All Admins):
- /suspend <user> <hours> <reason> - Suspend a user
- /reports - View pending reports
- /report <id> - Detailed report info
- /report_stats - Report statistics
- /user_reports <user> - Reports involving user
- /resolve <id> <action> [note] - Resolve a report
- /notify <user_id> <message> - Send notification

RIDES & GROUPS (All Admins):
- /groups - View active groups
- /group <id> - Detailed group info
- /rides [count] - Recent ride requests
- /ride <id> - Detailed ride info
- /chat <group_id> - View group chat
- /pending_rides - Pending ride requests
- /completed_rides [days] - Completed rides
- /cancelled_rides [days] - Cancelled rides

SYSTEM & DIAGNOSTICS (All Admins):
- /health - Check all services
- /stats - System statistics
- /logs [count] - Admin logs
- /db_stats - MongoDB stats
- /redis_stats - Redis stats
- /queue_stats - Matchmaking queue
- /memory - Memory usage
- /domains - View/edit supported college domains (GUI)
- /domain_requests - View pending college domain requests

PROMOTIONAL NOTIFICATIONS:
- /promo - View/manage promo settings (GUI)
- /promo_toggle <on|off> - Enable/disable promos
- /promo_interval <hours> - Set sending interval (1-24h)
- /promo_add <title>|<body> - Add custom message
- /promo_list - List all promo messages
- /promo_remove <id> - Remove custom message
- /promo_send - Send test promo now

ADMIN MANAGEMENT:
- /admins - View all admins (regular + head)
- /add_headadmin <id> - Add head admin (Master only)
- /remove_headadmin <id> - Remove head admin (Master only)

DANGEROUS (Master Only):
- /nuke - Erase ALL data (4 confirmations required)
- /nuke_cancel - Cancel nuke in progress
- /clearuser <user> - Clear ALL user data (Head Admin, 4 confirmations)
- /clearuser_cancel - Cancel clearuser in progress

TICKETS (All Admins):
- /tickets - View open support tickets  
- /reply <id> <message> - Reply to ticket
- /close <id> [reason] - Close ticket

TROLL/FUN COMMANDS (All Admins):
- /flip - Flip a coin
- /magic8ball <question> - Ask the 8-ball
- /dice [sides] - Roll dice
- /roast [target] - Generate roast
- /motivate - Motivation quote
- /excuse - Random excuse
- /fortune - Fortune cookie
- /blame - Blame something
- /countdown [seconds] - Countdown timer
- /wisdom - Random wisdom

HEAD ADMIN ONLY:
- /ban <user> <reason> - Ban permanently
- /unban <user> - Unban user
- /cancel_group <id> <reason> - Cancel group
- /maintenance <on|off> - Toggle maintenance
- /broadcast <message> - Message all users
- /announce <message> - System announcement
- /alert <message> - Urgent alert
- /config - View safe config values
- /phoneverification <on|off> - Toggle OTP check (Alias: /pv)
- /update_manager - Manage app updates (GUI)

TROLL WITH NOTIFICATIONS (Head Admin):
- /troll_all - Funny notification to all
- /rickroll - Rickroll all users
- /fake_update - Fake update notification
- /dm <user> <msg> - Direct message user
- /msggroup <group_id> <msg> - Message group
"""

import asyncio
import logging

from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)

from app.config import settings
from app.database import init_db

# Import handlers from modular file
from app.telegram_bot.handlers import (
    start,
    lookup,
    ban,
    suspend,
    unban,
    reports,
    resolve,
    groups,
    cancel_group,
    maintenance,
    logs,
    stats,
    users,
    notify,
    broadcast,
    msggroup,
    history,
    button_callback,
    handle_secret_passphrase,
    tickets,
    reply,
    close_ticket_command,
    domains,
    domain_requests,
    handle_domain_name_reply,
)

# Import extended handlers
from app.telegram_bot.extended_handlers import (
    # Troll commands
    flip,
    magic8ball,
    dice,
    roast,
    motivate,
    excuse,
    fortune,
    blame,
    countdown,
    wisdom_cmd,
    # Troll with notifications
    troll_all,
    rickroll,
    fake_update,
    # User management
    search,
    profile,
    online,
    new_users,
    active_riders,
    suspended_users,
    banned_users,
    warn,
    fcm_status,
    # System diagnostics
    health,
    ping,
    uptime,
    db_stats,
    redis_stats,
    queue_stats,
    memory,
    config_cmd,
    # Ride & Group
    rides,
    ride,
    group,
    chat,
    pending_rides,
    completed_rides,
    cancelled_rides,
    # Moderation
    report_detail,
    report_stats,
    user_reports,
    # Communication
    dm,
    announce,
    alert,
    # Promo management
    promo,
    promo_send,
    promo_toggle,
    promo_interval,
    promo_add,
    promo_list,
    promo_remove,
    # Admin management
    admins,
    add_headadmin,
    remove_headadmin,
    # Nuke
    nuke,
    nuke_cancel,
    clear_context,
    # Clear user data
    clearuser,
    clearuser_cancel,

)

# Update Manager
from app.telegram_bot.update_conversation import update_conversation_handler

# AI Handler
from app.telegram_bot.ai_handler import ai_toggle, handle_ai_message


logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)


# =============================================================================
# Bot Creation
# =============================================================================

def create_bot() -> Application:
    """Create and configure the Telegram bot with all 93 commands."""
    if not settings.telegram_bot_token or settings.telegram_bot_token == "YOUR_TELEGRAM_BOT_TOKEN":
        raise ValueError(
            "Telegram bot token not configured. "
            "Set TELEGRAM_BOT_TOKEN in .env"
        )
    
    from telegram.ext import Defaults
    from telegram.request import HTTPXRequest
    
    # Configure request with timeouts to prevent hanging
    request = HTTPXRequest(
        connection_pool_size=8,
        connect_timeout=10.0,
        read_timeout=20.0,
        write_timeout=20.0,
        pool_timeout=10.0,
    )
    
    application = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .request(request)
        .get_updates_request(request)
        .build()
    )
    
    # ===========================================
    # Core Commands
    # ===========================================
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", start))
    
    # ===========================================
    # User Management
    # ===========================================
    application.add_handler(CommandHandler("lookup", lookup))
    application.add_handler(CommandHandler("search", search))
    application.add_handler(CommandHandler("profile", profile))
    application.add_handler(CommandHandler("history", history))
    application.add_handler(CommandHandler("users", users))
    application.add_handler(CommandHandler("online", online))
    application.add_handler(CommandHandler("new_users", new_users))
    application.add_handler(CommandHandler("active_riders", active_riders))
    application.add_handler(CommandHandler("suspended_users", suspended_users))
    application.add_handler(CommandHandler("banned_users", banned_users))
    application.add_handler(CommandHandler("fcm_status", fcm_status))
    application.add_handler(CommandHandler("warn", warn))
    
    # ===========================================
    # Moderation
    # ===========================================
    application.add_handler(CommandHandler("ban", ban))
    application.add_handler(CommandHandler("unban", unban))
    application.add_handler(CommandHandler("suspend", suspend))
    application.add_handler(CommandHandler("reports", reports))
    application.add_handler(CommandHandler("report", report_detail))
    application.add_handler(CommandHandler("report_stats", report_stats))
    application.add_handler(CommandHandler("user_reports", user_reports))
    application.add_handler(CommandHandler("resolve", resolve))
    application.add_handler(CommandHandler("notify", notify))
    
    # ===========================================
    # Rides & Groups
    # ===========================================
    application.add_handler(CommandHandler("groups", groups))
    application.add_handler(CommandHandler("group", group))
    application.add_handler(CommandHandler("cancel_group", cancel_group))
    application.add_handler(CommandHandler("rides", rides))
    application.add_handler(CommandHandler("ride", ride))
    application.add_handler(CommandHandler("chat", chat))
    application.add_handler(CommandHandler("pending_rides", pending_rides))
    application.add_handler(CommandHandler("completed_rides", completed_rides))
    application.add_handler(CommandHandler("cancelled_rides", cancelled_rides))
    application.add_handler(CommandHandler("msggroup", msggroup))
    
    # ===========================================
    # System & Diagnostics
    # ===========================================
    application.add_handler(CommandHandler("health", health))
    application.add_handler(CommandHandler("ping", ping))
    application.add_handler(CommandHandler("uptime", uptime))
    application.add_handler(CommandHandler("stats", stats))
    application.add_handler(CommandHandler("logs", logs))
    application.add_handler(CommandHandler("db_stats", db_stats))
    application.add_handler(CommandHandler("redis_stats", redis_stats))
    application.add_handler(CommandHandler("queue_stats", queue_stats))
    application.add_handler(CommandHandler("memory", memory))
    application.add_handler(CommandHandler("config", config_cmd))
    application.add_handler(CommandHandler("maintenance", maintenance))
    application.add_handler(CommandHandler("domains", domains))
    application.add_handler(CommandHandler("domain_requests", domain_requests))
    
    # ===========================================
    # Promotional Notification Management
    # ===========================================
    application.add_handler(CommandHandler("promo", promo))
    application.add_handler(CommandHandler("promo_send", promo_send))
    application.add_handler(CommandHandler("promo_toggle", promo_toggle))
    application.add_handler(CommandHandler("promo_interval", promo_interval))
    application.add_handler(CommandHandler("promo_add", promo_add))
    application.add_handler(CommandHandler("promo_list", promo_list))
    application.add_handler(CommandHandler("promo_remove", promo_remove))
    
    # ===========================================
    # Admin Management
    # ===========================================
    application.add_handler(CommandHandler("admins", admins))
    application.add_handler(CommandHandler("add_headadmin", add_headadmin))
    application.add_handler(CommandHandler("remove_headadmin", remove_headadmin))
    
    # ===========================================
    # Dangerous Commands (Master Admin Only)
    # ===========================================
    application.add_handler(CommandHandler("nuke", nuke))
    application.add_handler(CommandHandler("nuke_cancel", nuke_cancel))
    application.add_handler(CommandHandler("clearuser", clearuser))
    application.add_handler(CommandHandler("clearuser_cancel", clearuser_cancel))

    application.add_handler(CommandHandler("clearuser", clearuser))
    application.add_handler(CommandHandler("clearuser_cancel", clearuser_cancel))

    # ===========================================


    # App Version Management
    application.add_handler(update_conversation_handler)
    
    # ===========================================
    # Support Tickets
    # ===========================================
    application.add_handler(CommandHandler("tickets", tickets))
    application.add_handler(CommandHandler("reply", reply))
    application.add_handler(CommandHandler("close", close_ticket_command))
    
    # ===========================================
    # Communication
    # ===========================================
    application.add_handler(CommandHandler("broadcast", broadcast))
    application.add_handler(CommandHandler("announce", announce))
    application.add_handler(CommandHandler("alert", alert))
    application.add_handler(CommandHandler("dm", dm))
    
    # ===========================================
    # Troll/Fun Commands
    # ===========================================
    application.add_handler(CommandHandler("flip", flip))
    application.add_handler(CommandHandler("magic8ball", magic8ball))
    application.add_handler(CommandHandler("dice", dice))
    application.add_handler(CommandHandler("roast", roast))
    application.add_handler(CommandHandler("motivate", motivate))
    application.add_handler(CommandHandler("excuse", excuse))
    application.add_handler(CommandHandler("fortune", fortune))
    application.add_handler(CommandHandler("blame", blame))
    application.add_handler(CommandHandler("countdown", countdown))
    application.add_handler(CommandHandler("wisdom", wisdom_cmd))
    
    # Troll with push notifications (Head Admin)
    application.add_handler(CommandHandler("troll_all", troll_all))
    application.add_handler(CommandHandler("rickroll", rickroll))
    application.add_handler(CommandHandler("fake_update", fake_update))
    
    # ===========================================
    # Callback & Message Handlers
    # ===========================================
    application.add_handler(CallbackQueryHandler(button_callback))
    
    # ===========================================
    # AI Command (Master Admin)
    # ===========================================
    application.add_handler(CommandHandler("ai", ai_toggle))
    application.add_handler(CommandHandler("ai_clear", clear_context))
    
    # Combined text handler: AI + domain name edits + secret passphrase
    async def handle_text_message(update, context):
        # First try AI handler (mentions/replies to bot)
        if await handle_ai_message(update, context):
            return
        # Then check if user is editing a domain name
        if await handle_domain_name_reply(update, context):
            return
        # Otherwise check for admin passphrase
        await handle_secret_passphrase(update, context)
    
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_text_message
    ))
    
    return application


async def run_bot():
    """Run the Orixy Telegram bot."""
    await init_db()
    
    application = create_bot()
    
    logger.info("Starting Orixy Admin Bot with 95 commands...")
    await application.run_polling()


if __name__ == "__main__":
    asyncio.run(run_bot())
