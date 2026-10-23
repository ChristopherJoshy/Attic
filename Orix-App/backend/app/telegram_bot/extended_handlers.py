"""Extended Telegram Bot Command Handlers - Additional commands for Orixy Admin Bot including: troll/fun commands, user management, system diagnostics, and ride/group management."""

import random
import asyncio
import psutil
from datetime import datetime, timedelta, timezone
from typing import Optional

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode, ChatAction

from app.utils.timezone_utils import utc_now

from app.config import settings
from app.database import get_db, get_redis
from app.telegram_bot.utils import (
    require_admin, 
    require_head_admin, 
    require_master_admin,
    is_head_admin, 
    is_master_admin,
    is_head_admin_async,
    find_user_by_identifier,
    add_head_admin,
    remove_head_admin,
    get_all_head_admins
)

from app.services.user_service import UserService
from app.services.group_service import GroupService
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.services.redis_service import RedisService
from app.services.ai_service import OrixAIService

user_service = UserService()
group_service = GroupService()
audit_service = AuditService()
notification_service = NotificationService()
redis_service = RedisService()
ai_service = OrixAIService()


# =============================================================================
# TROLL COMMANDS (10) - Fun commands with push notification capabilities
# =============================================================================

MAGIC_8_BALL_RESPONSES = [
    "It is certain.", "It is decidedly so.", "Without a doubt.",
    "Yes definitely.", "You may rely on it.", "As I see it, yes.",
    "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
    "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
    "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful."
]

ROASTS = [
    "Their code has more bugs than a rainforest.",
    "They use 'password123' for everything... including their dignity.",
    "Their git commits say 'fixed stuff' every single time.",
    "They think CSS stands for 'Constantly Suffering Syndrome'.",
    "Their IDE has filed for emotional damages.",
    "They put milk before cereal. Need I say more?",
    "They're the reason we have QA teams.",
    "Their Stack Overflow is bookmarked as 'My Brain'.",
    "Legend says they still don't understand async/await.",
    "They once wrote 'Hello World' and it had 3 bugs."
]

EXCUSES = [
    "My cat walked on my keyboard and deleted the database.",
    "I was stuck in a time loop and just got out.",
    "The traffic light was stuck on red for 47 minutes.",
    "My horoscope said not to leave the house today.",
    "I was fighting a bear. Then a larger bear showed up.",
    "My alarm clock is on strike.",
    "I got lost following Google Maps' walking directions.",
    "My coffee machine held me hostage.",
    "I was saving the world from a meteor. You're welcome.",
    "Time zones are confusing and I'm still in yesterday."
]

FORTUNES = [
    "A surprise push notification awaits you... possibly from this bot.",
    "Your future holds many unread notifications.",
    "Beware of users who report bugs at 3 AM.",
    "Today is a good day to check your error logs.",
    "Someone is thinking about your API. They're angry.",
    "A great opportunity to deploy on Friday awaits!",
    "Your lucky number is 500 (Internal Server Error).",
    "The stars say: 'Have you tried turning it off and on again?'",
    "Happiness is: All tests passing on first try.",
    "Someone will make you smile today. Then file a bug report."
]

WISDOM = [
    "He who deploys on Friday shall debug on Saturday.",
    "A watched build never compiles.",
    "With great power comes great rate limiting.",
    "To err is human; to blame the intern, divine.",
    "In the land of spaghetti code, the one who documents is king.",
    "The only thing we learn from production is that we don't learn.",
    "If it works, don't touch it. If you touch it, update your resume.",
    "There are only two hard things: cache invalidation and naming things.",
    "A bug in the hand is worth two in production.",
    "The road to production is paved with 'it works on my machine'."
]

BLAME_TARGETS = [
    "the intern", "cosmic rays", "the network", "Mercury retrograde",
    "the last person who deployed", "JavaScript", "undefined behavior",
    "a rogue semicolon", "the cloud", "legacy code", "technical debt",
    "the PM's requirements", "timezones", "floating point errors"
]


async def flip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Flip a coin with dramatic flair."""
    if not await require_admin(update):
        return
    
    await update.message.reply_text("Flipping coin... [coin spinning]")
    await asyncio.sleep(1)
    result = random.choice(["HEADS", "TAILS"])
    await update.message.reply_text(f"The coin lands on: *{result}*!", parse_mode=ParseMode.MARKDOWN)


async def magic8ball(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ask the Magic 8 Ball."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /magic8ball <your question>")
        return
    
    question = " ".join(context.args)
    await update.message.reply_text("[Shaking the Magic 8 Ball...]")
    await asyncio.sleep(1)
    answer = random.choice(MAGIC_8_BALL_RESPONSES)
    await update.message.reply_text(f"Q: {question}\nA: *{answer}*", parse_mode=ParseMode.MARKDOWN)


async def dice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Roll a dice."""
    if not await require_admin(update):
        return
    
    sides = 6
    if context.args:
        try:
            sides = int(context.args[0])
            if sides < 2 or sides > 100:
                sides = 6
        except ValueError:
            pass
    
    result = random.randint(1, sides)
    await update.message.reply_text(f"Rolling d{sides}... You got: *{result}*!", parse_mode=ParseMode.MARKDOWN)


async def roast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Roast a user (just for fun)."""
    if not await require_admin(update):
        return
    
    target = " ".join(context.args) if context.args else "someone"
    roast_msg = random.choice(ROASTS)
    await update.message.reply_text(f"Roasting {target}:\n\n_{roast_msg}_", parse_mode=ParseMode.MARKDOWN)


async def motivate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get motivation."""
    if not await require_admin(update):
        return
    
    quotes = [
        "You're doing great! The bugs will fix themselves... probably.",
        "Remember: Every expert was once a beginner who didn't give up!",
        "Your code is beautiful. Even the parts that don't work.",
        "Keep pushing! 'git push --force' if necessary.",
        "You've survived 100% of your bad days so far. Nice!",
    ]
    await update.message.reply_text(f"[MOTIVATION]\n\n_{random.choice(quotes)}_", parse_mode=ParseMode.MARKDOWN)


async def excuse(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate a random excuse."""
    if not await require_admin(update):
        return
    
    await update.message.reply_text(f"Here's your excuse:\n\n_{random.choice(EXCUSES)}_", parse_mode=ParseMode.MARKDOWN)


async def fortune(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get a fortune cookie message."""
    if not await require_admin(update):
        return
    
    await update.message.reply_text(f"[FORTUNE COOKIE]\n\n_{random.choice(FORTUNES)}_", parse_mode=ParseMode.MARKDOWN)


async def blame(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Randomly blame something."""
    if not await require_admin(update):
        return
    
    target = random.choice(BLAME_TARGETS)
    await update.message.reply_text(f"I blame *{target}* for this.", parse_mode=ParseMode.MARKDOWN)


async def countdown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dramatic countdown timer."""
    if not await require_admin(update):
        return
    
    seconds = 5
    if context.args:
        try:
            seconds = min(int(context.args[0]), 10)  # Max 10 seconds
        except ValueError:
            pass
    
    msg = await update.message.reply_text(f"Countdown: {seconds}")
    for i in range(seconds - 1, 0, -1):
        await asyncio.sleep(1)
        await msg.edit_text(f"Countdown: {i}")
    await asyncio.sleep(1)
    await msg.edit_text("[BOOM] Time's up!")


async def wisdom_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dispense random wisdom."""
    if not await require_admin(update):
        return
    
    await update.message.reply_text(f"[ANCIENT WISDOM]\n\n_{random.choice(WISDOM)}_", parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# TROLL COMMANDS WITH PUSH NOTIFICATIONS (Head Admin Only)
# =============================================================================

async def troll_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a funny push notification to ALL users (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    messages = [
        ("Did you forget something?", "Just kidding. Or did you? [wink]"),
        ("Breaking News!", "We just wanted to say hi. That's all."),
        ("URGENT: Action Required", "...to have a great day! [smile]"),
        ("Your ride is here!", "Nope, it's just us testing notifications."),
        ("You've won!", "Our appreciation for using this app!"),
    ]
    
    title, body = random.choice(messages)
    
    await update.message.reply_text(f"Sending troll notification to all users...\n\nTitle: {title}\nBody: {body}")
    
    try:
        count = await notification_service.broadcast_to_all_users(title=title, message=body)
        await update.message.reply_text(f"[SUCCESS] Trolled {count} users!")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


async def rickroll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Rickroll all users with a push notification (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    await update.message.reply_text("Rickrolling all users...")
    
    try:
        count = await notification_service.broadcast_to_all_users(
            title="You've Been Chosen!",
            message="Never gonna give you up, never gonna let you down..."
        )
        await update.message.reply_text(f"[SUCCESS] Rickrolled {count} users!")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


async def fake_update(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send fake app update notification (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    await update.message.reply_text("Sending fake update notification...")
    
    try:
        count = await notification_service.broadcast_to_all_users(
            title="App Update Available!",
            message="Just kidding! But while you're here, have a great day!"
        )
        await update.message.reply_text(f"[SUCCESS] Pranked {count} users!")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


# =============================================================================
# USER MANAGEMENT COMMANDS (15)
# =============================================================================

async def search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Search users by name, email, or phone."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /search <query>")
        return
    
    query = " ".join(context.args)
    users = await user_service.search_users(query, limit=10)
    
    if not users:
        await update.message.reply_text(f"No users found matching: {query}")
        return
    
    msg = f"*Search Results for '{query}':*\n\n"
    for u in users:
        status_icon = "[OK]" if u.status == "active" else "[X]"
        msg += f"{status_icon} `{u.user_id}`\n"
        msg += f"   {u.display_name} ({u.email})\n\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Get full user profile."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /profile <user_id or email>")
        return
    
    identifier = context.args[0]
    db = get_db()
    user = await find_user_by_identifier(db, identifier)
    
    if not user:
        await update.message.reply_text(f"User not found: {identifier}")
        return
    
    created = user.get('created_at', 'Unknown')
    if isinstance(created, datetime):
        created = created.strftime("%Y-%m-%d %H:%M")
    
    msg = (
        f"*User Profile*\n\n"
        f"ID: `{user['user_id']}`\n"
        f"Name: {user.get('display_name', 'N/A')}\n"
        f"Email: `{user.get('email', 'N/A')}`\n"
        f"Phone: `{user.get('phone', 'Not set')}`\n"
        f"Gender: {user.get('gender', 'Not set')}\n"
        f"Status: {user.get('status', 'active')}\n"
        f"Role: {user.get('role', 'user')}\n"
        f"Is Rider: {user.get('is_rider', False)}\n"
        f"Onboarding: {'Complete' if user.get('onboarding_completed') else 'Incomplete'}\n"
        f"FCM Token: {'Set' if user.get('fcm_token') else 'Not set'}\n"
        f"Created: {created}\n"
    )
    
    if user.get('ban_reason'):
        msg += f"\nBan Reason: {user['ban_reason']}"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def online(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List currently online users (users with recent activity)."""
    if not await require_admin(update):
        return
    
    db = get_db()
    # Users active in last 5 minutes
    five_mins_ago = utc_now() - timedelta(minutes=5)
    
    cursor = db.users.find({
        "updated_at": {"$gte": five_mins_ago}
    }).limit(20)
    
    users = await cursor.to_list(length=20)
    
    if not users:
        await update.message.reply_text("No users currently online (active in last 5 mins)")
        return
    
    msg = f"*Online Users ({len(users)})*\n\n"
    for u in users:
        msg += f"- {u.get('display_name')} (`{u.get('email')}`)\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def new_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show new user registrations."""
    if not await require_admin(update):
        return
    
    days = 7
    if context.args:
        try:
            days = int(context.args[0])
        except ValueError:
            pass
    
    db = get_db()
    since = utc_now() - timedelta(days=days)
    
    count = await db.users.count_documents({"created_at": {"$gte": since}})
    cursor = db.users.find({"created_at": {"$gte": since}}).sort("created_at", -1).limit(10)
    users = await cursor.to_list(length=10)
    
    msg = f"*New Users (Last {days} days): {count}*\n\n"
    for u in users:
        created = u.get('created_at', utc_now()).strftime("%m/%d")
        msg += f"- {created}: {u.get('display_name')} ({u.get('email')})\n"
    
    if count > 10:
        msg += f"\n... and {count - 10} more"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def active_riders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List all active riders."""
    if not await require_admin(update):
        return
    
    db = get_db()
    cursor = db.users.find({"is_rider": True}).limit(10)
    riders = await cursor.to_list(length=10)
    
    if not riders:
        await update.message.reply_text("No active riders currently.")
        return
    
    msg = f"*Active Riders ({len(riders)})*\n\n"
    for r in riders:
        info = r.get('rider_info', {})
        msg += f"- {r.get('display_name')}\n"
        msg += f"  Route: {info.get('from_label', '?')} -> {info.get('to_label', '?')}\n"
        msg += f"  Seats: {info.get('seats', '?')}\n\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def suspended_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List suspended users."""
    if not await require_admin(update):
        return
    
    db = get_db()
    cursor = db.users.find({"status": "suspended"}).limit(20)
    users = await cursor.to_list(length=20)
    
    if not users:
        await update.message.reply_text("No suspended users.")
        return
    
    msg = f"*Suspended Users ({len(users)})*\n\n"
    for u in users:
        expires = u.get('suspension_expires_at')
        exp_str = expires.strftime("%Y-%m-%d %H:%M") if expires else "N/A"
        msg += f"- {u.get('display_name')} ({u.get('email')})\n"
        msg += f"  Expires: {exp_str}\n"
        msg += f"  Reason: {u.get('ban_reason', 'No reason')}\n\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def banned_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List banned users."""
    if not await require_admin(update):
        return
    
    db = get_db()
    cursor = db.users.find({"status": "banned"}).limit(20)
    users = await cursor.to_list(length=20)
    
    if not users:
        await update.message.reply_text("No banned users.")
        return
    
    msg = f"*Banned Users ({len(users)})*\n\n"
    for u in users:
        msg += f"- {u.get('display_name')} ({u.get('email')})\n"
        msg += f"  Reason: {u.get('ban_reason', 'No reason')}\n\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def warn(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send warning to a user."""
    if not await require_admin(update):
        return
    
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /warn <user_id> <message>")
        return
    
    user_id = context.args[0]
    message = " ".join(context.args[1:])
    
    db = get_db()
    user = await find_user_by_identifier(db, user_id)
    
    if not user:
        await update.message.reply_text(f"User not found: {user_id}")
        return
    
    try:
        from app.models.notification import NotificationType
        await notification_service.send_notification(
            user_id=user['user_id'],
            notification_type=NotificationType.SYSTEM,
            title="[Warning] Admin Notice",
            body=message,
            data={"type": "admin_warning"}
        )
        await update.message.reply_text(f"Warning sent to {user['display_name']}")
    except Exception as e:
        await update.message.reply_text(f"Failed to send warning: {str(e)}")


async def fcm_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check user's FCM token status."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /fcm_status <user_id or email>")
        return
    
    db = get_db()
    user = await find_user_by_identifier(db, context.args[0])
    
    if not user:
        await update.message.reply_text("User not found")
        return
    
    token = user.get('fcm_token')
    status = "Set" if token else "Not set"
    token_preview = f"...{token[-20:]}" if token else "N/A"
    
    msg = (
        f"*FCM Status for {user['display_name']}*\n\n"
        f"Status: {status}\n"
        f"Token: `{token_preview}`"
    )
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# SYSTEM & DIAGNOSTICS COMMANDS (12)
# =============================================================================

async def health(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check all services status."""
    if not await require_admin(update):
        return
    
    await update.effective_chat.send_action(ChatAction.TYPING)
    
    msg = "\u2764\ufe0f *ORIX SYSTEM HEALTH*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    
    # MongoDB
    try:
        db = get_db()
        await db.client.admin.command('ping')
        msg += "\U0001F7E2 *MongoDB:* Connected\n"
    except Exception as e:
        msg += f"\U0001F534 *MongoDB:* Error\n"
    
    # Redis
    try:
        redis = get_redis()
        await redis.ping()
        msg += "\U0001F7E2 *Redis:* Connected\n"
    except Exception as e:
        msg += f"\U0001F534 *Redis:* Error\n"
    
    # Maintenance mode
    try:
        is_maint = await redis_service.is_maintenance_mode()
        if is_maint:
            msg += "\U0001F7E1 *Maintenance:* ON\n"
        else:
            msg += "\U0001F7E2 *Maintenance:* OFF\n"
    except:
        msg += "\u26AA *Maintenance:* Unknown\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bot latency check."""
    if not await require_admin(update):
        return
    
    start = utc_now()
    msg = await update.message.reply_text("Pinging...")
    latency = (utc_now() - start).total_seconds() * 1000
    await msg.edit_text(f"Pong! Latency: {latency:.0f}ms")


async def uptime(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Server uptime (approximate via process start)."""
    if not await require_admin(update):
        return
    
    try:
        import os
        process = psutil.Process(os.getpid())
        create_time = datetime.fromtimestamp(process.create_time(), timezone.utc)
        uptime_delta = utc_now() - create_time
        
        days = uptime_delta.days
        hours, remainder = divmod(uptime_delta.seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        
        msg = f"*Server Uptime*\n\n{days}d {hours}h {minutes}m"
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Could not determine uptime: {str(e)}")


async def db_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """MongoDB collection counts."""
    if not await require_admin(update):
        return
    
    db = get_db()
    
    collections = ['users', 'ride_requests', 'ride_groups', 'reports', 'notifications', 'chat_messages', 'admin_logs', 'support_tickets']
    
    msg = "*Database Statistics*\n\n"
    for coll in collections:
        try:
            count = await db[coll].count_documents({})
            msg += f"{coll}: `{count}`\n"
        except:
            msg += f"{coll}: `error`\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def redis_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Redis memory and key info."""
    if not await require_admin(update):
        return
    
    try:
        redis = get_redis()
        info = await redis.info('memory')
        
        used_memory = info.get('used_memory_human', 'N/A')
        peak_memory = info.get('used_memory_peak_human', 'N/A')
        
        # Get queue stats
        queue_stats = await redis_service.get_queue_stats()
        
        msg = (
            f"*Redis Statistics*\n\n"
            f"Memory Used: `{used_memory}`\n"
            f"Peak Memory: `{peak_memory}`\n\n"
            f"*Matchmaking Queues:*\n"
        )
        
        if queue_stats:
            for date, count in queue_stats.items():
                msg += f"- {date}: {count} requests\n"
        else:
            msg += "No active queues\n"
        
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Redis stats error: {str(e)}")


async def queue_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Matchmaking queue status."""
    if not await require_admin(update):
        return
    
    try:
        stats = await redis_service.get_queue_stats()
        
        if not stats:
            await update.message.reply_text("No active matchmaking queues.")
            return
        
        msg = "*Matchmaking Queue Status*\n\n"
        total = 0
        for date, count in sorted(stats.items()):
            msg += f"{date}: `{count}` pending\n"
            total += count
        
        msg += f"\n*Total:* `{total}` requests"
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")


async def memory(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Memory usage stats."""
    if not await require_admin(update):
        return
    
    try:
        import os
        process = psutil.Process(os.getpid())
        mem = process.memory_info()
        
        rss_mb = mem.rss / (1024 * 1024)
        vms_mb = mem.vms / (1024 * 1024)
        
        # System memory
        sys_mem = psutil.virtual_memory()
        
        msg = (
            f"*Memory Usage*\n\n"
            f"Process RSS: `{rss_mb:.1f} MB`\n"
            f"Process VMS: `{vms_mb:.1f} MB`\n\n"
            f"System Total: `{sys_mem.total / (1024**3):.1f} GB`\n"
            f"System Used: `{sys_mem.percent}%`"
        )
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")


async def config_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View safe config values (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    msg = (
        f"*Configuration (Safe Values)*\n\n"
        f"Debug Mode: `{settings.debug}`\n"
        f"Rate Limit: `{settings.rate_limit_per_minute}/min`\n"
        f"Matchmaking TTL: `{settings.matchmaking_ttl_minutes} min`\n"
        f"Readiness Timeout: `{settings.readiness_timeout_minutes} min`\n"
        f"Max Pickup Distance: `{settings.max_pickup_distance_km} km`\n"
        f"Rider Availability: `{settings.rider_availability_hours} hrs`\n"
    )
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)





# =============================================================================
# RIDE & GROUP MANAGEMENT (12)  
# =============================================================================

async def rides(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View recent ride requests."""
    if not await require_admin(update):
        return
    
    limit = 10
    if context.args:
        try:
            limit = min(int(context.args[0]), 20)
        except ValueError:
            pass
    
    db = get_db()
    cursor = db.ride_requests.find().sort("created_at", -1).limit(limit)
    requests = await cursor.to_list(length=limit)
    
    if not requests:
        await update.message.reply_text("No ride requests found.")
        return
    
    msg = f"*Recent Ride Requests ({len(requests)})*\n\n"
    for r in requests:
        status = r.get('status', 'unknown')
        status_icon = {"pending": "[..]", "matching": "[~]", "matched": "[OK]", "cancelled": "[X]", "expired": "[X]"}.get(status, "[?]")
        msg += f"{status_icon} `{r.get('request_id', 'N/A')}`\n"
        msg += f"   Status: {status}\n\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def ride(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Detailed ride request info."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /ride <request_id>")
        return
    
    request_id = context.args[0]
    db = get_db()
    
    req = await db.ride_requests.find_one({"request_id": {"$regex": f"^{request_id}"}})
    
    if not req:
        await update.message.reply_text(f"Ride request not found: {request_id}")
        return
    
    user = await db.users.find_one({"user_id": req.get('user_id')})
    user_name = user.get('display_name', 'Unknown') if user else 'Unknown'
    
    msg = (
        f"*Ride Request Details*\n\n"
        f"ID: `{req['request_id']}`\n"
        f"User: {user_name}\n"
        f"Status: {req.get('status', 'unknown')}\n"
        f"Date: {req.get('date', 'N/A')}\n"
        f"Time: {req.get('time_window', {}).get('start', 'N/A')} - {req.get('time_window', {}).get('end', 'N/A')}\n"
        f"Female Only: {req.get('female_only', False)}\n"
        f"Allow Riders: {req.get('allow_riders', True)}\n"
    )
    
    if req.get('group_id'):
        msg += f"Group: `{req['group_id']}`\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Detailed group info."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /group <group_id>")
        return
    
    group_id = context.args[0]
    db = get_db()
    
    grp = await db.ride_groups.find_one({"group_id": {"$regex": f"^{group_id}"}})
    
    if not grp:
        await update.message.reply_text(f"Group not found: {group_id}")
        return
    
    msg = (
        f"*Group Details*\n\n"
        f"ID: `{grp['group_id']}`\n"
        f"Status: {grp.get('status', 'unknown')}\n"
        f"Route: {grp.get('route_summary', 'N/A')}\n"
        f"Members:\n"
    )
    
    for member in grp.get('members', []):
        user = await db.users.find_one({"user_id": member.get('user_id')})
        name = user.get('display_name', 'Unknown') if user else 'Unknown'
        confirmed = "[OK]" if member.get('readiness_confirmed') else "[..]"
        msg += f"  {confirmed} {name} ({member.get('role', 'passenger')})\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View recent chat messages for a group."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /chat <group_id>")
        return
    
    group_id = context.args[0]
    db = get_db()
    
    cursor = db.chat_messages.find({"group_id": {"$regex": f"^{group_id}"}}).sort("created_at", -1).limit(20)
    messages = await cursor.to_list(length=20)
    
    if not messages:
        await update.message.reply_text("No messages found for this group.")
        return
    
    msg = f"*Recent Chat ({len(messages)} messages)*\n\n"
    for m in reversed(messages):
        sender = m.get('sender_name', 'Unknown')
        content = m.get('content', '')[:50]
        msg += f"{sender}: {content}\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def pending_rides(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show pending ride requests."""
    if not await require_admin(update):
        return
    
    db = get_db()
    count = await db.ride_requests.count_documents({"status": "pending"})
    cursor = db.ride_requests.find({"status": "pending"}).limit(10)
    requests = await cursor.to_list(length=10)
    
    msg = f"*Pending Rides: {count}*\n\n"
    for r in requests:
        msg += f"- `{r['request_id']}` (Date: {r.get('date', 'N/A')})\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def completed_rides(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show completed rides in last N days."""
    if not await require_admin(update):
        return
    
    days = 7
    if context.args:
        try:
            days = int(context.args[0])
        except ValueError:
            pass
    
    db = get_db()
    since = utc_now() - timedelta(days=days)
    
    count = await db.ride_groups.count_documents({
        "status": "completed",
        "finalized_at": {"$gte": since}
    })
    
    await update.message.reply_text(f"Completed rides in last {days} days: *{count}*", parse_mode=ParseMode.MARKDOWN)


async def cancelled_rides(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show cancelled rides in last N days."""
    if not await require_admin(update):
        return
    
    days = 7
    if context.args:
        try:
            days = int(context.args[0])
        except ValueError:
            pass
    
    db = get_db()
    since = utc_now() - timedelta(days=days)
    
    count = await db.ride_requests.count_documents({
        "status": "cancelled",
        "updated_at": {"$gte": since}
    })
    
    await update.message.reply_text(f"Cancelled rides in last {days} days: *{count}*", parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# MODERATION COMMANDS (6)
# =============================================================================

async def report_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Detailed report info."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /report <report_id>")
        return
    
    report_id = context.args[0]
    db = get_db()
    
    report = await db.reports.find_one({"report_id": {"$regex": f"^{report_id}"}})
    
    if not report:
        await update.message.reply_text(f"Report not found: {report_id}")
        return
    
    reporter = await db.users.find_one({"user_id": report.get('reporter_user_id')})
    accused = await db.users.find_one({"user_id": report.get('accused_user_id')})
    
    reporter_name = reporter.get('display_name', 'Unknown') if reporter else 'Unknown'
    accused_name = accused.get('display_name', 'Unknown') if accused else 'Unknown'
    
    msg = (
        f"*Report Details*\n\n"
        f"ID: `{report['report_id']}`\n"
        f"Status: {report.get('status', 'pending')}\n"
        f"Reporter: {reporter_name}\n"
        f"Accused: {accused_name}\n"
        f"Reason: {report.get('note', 'No reason')}\n"
    )
    
    if report.get('resolution'):
        msg += f"\nResolution: {report['resolution']}"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def report_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Report statistics."""
    if not await require_admin(update):
        return
    
    db = get_db()
    
    pending = await db.reports.count_documents({"status": "pending"})
    resolved = await db.reports.count_documents({"status": "resolved"})
    total = pending + resolved
    
    msg = (
        f"*Report Statistics*\n\n"
        f"Total: `{total}`\n"
        f"Pending: `{pending}`\n"
        f"Resolved: `{resolved}`"
    )
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def user_reports(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reports involving a specific user."""
    if not await require_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /user_reports <user_id or email>")
        return
    
    db = get_db()
    user = await find_user_by_identifier(db, context.args[0])
    
    if not user:
        await update.message.reply_text("User not found")
        return
    
    user_id = user['user_id']
    
    reported = await db.reports.count_documents({"accused_user_id": user_id})
    made = await db.reports.count_documents({"reporter_user_id": user_id})
    
    msg = (
        f"*Reports for {user['display_name']}*\n\n"
        f"Reports against user: `{reported}`\n"
        f"Reports made by user: `{made}`"
    )
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# COMMUNICATION COMMANDS (5)
# =============================================================================

async def dm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Direct message a user."""
    if not await require_admin(update):
        return
    
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /dm <user_id> <message>")
        return
    
    user_id = context.args[0]
    message = " ".join(context.args[1:])
    
    db = get_db()
    user = await find_user_by_identifier(db, user_id)
    
    if not user:
        await update.message.reply_text(f"User not found: {user_id}")
        return
    
    try:
        from app.models.notification import NotificationType
        await notification_service.send_notification(
            user_id=user['user_id'],
            notification_type=NotificationType.SYSTEM,
            title="Message from Admin",
            body=message,
            data={"type": "admin_dm"}
        )
        await update.message.reply_text(f"Message sent to {user['display_name']}")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


async def announce(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """System announcement to all users (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /announce <message>")
        return
    
    message = " ".join(context.args)
    
    await update.message.reply_text("Sending announcement to all users...")
    
    try:
        count = await notification_service.broadcast_to_all_users(
            title="System Announcement",
            message=message
        )
        await update.message.reply_text(f"Announcement sent to {count} users!")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


async def alert(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send urgent alert (Head Admin only)."""
    if not await require_head_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /alert <message>")
        return
    
    message = " ".join(context.args)
    
    await update.message.reply_text("Sending URGENT alert to all users...")
    
    try:
        count = await notification_service.broadcast_to_all_users(
            title="[URGENT] Alert",
            message=message
        )
        await update.message.reply_text(f"Alert sent to {count} users!")
    except Exception as e:
        await update.message.reply_text(f"Failed: {str(e)}")


# =============================================================================
# PROMOTIONAL NOTIFICATION MANAGEMENT
# =============================================================================

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


async def _get_promo_config():
    """Get or create promo configuration from MongoDB."""
    db = get_db()
    config = await db.promo_config.find_one({"_id": "promo_settings"})
    if not config:
        config = {
            "_id": "promo_settings",
            "enabled": True,
            "interval_hours": 1,
            "last_sent_at": None,
            "custom_messages": []
        }
        await db.promo_config.insert_one(config)
    return config


async def _update_promo_config(updates: dict):
    """Update promo configuration in MongoDB."""
    db = get_db()
    await db.promo_config.update_one(
        {"_id": "promo_settings"},
        {"$set": updates},
        upsert=True
    )


async def promo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View promotional notification settings (GUI)."""
    if not await require_admin(update):
        return
    
    config = await _get_promo_config()
    
    status = "ON" if config.get("enabled", True) else "OFF"
    interval = config.get("interval_hours", 1)
    custom_count = len(config.get("custom_messages", []))
    last_sent = config.get("last_sent_at")
    
    if last_sent:
        if isinstance(last_sent, datetime):
            # Convert to IST
            ist_offset = timedelta(hours=5, minutes=30)
            last_sent_ist = last_sent + ist_offset
            last_sent_str = last_sent_ist.strftime("%d/%m %H:%M IST")
        else:
            last_sent_str = str(last_sent)
    else:
        last_sent_str = "Never"
    
    msg = (
        "*Promotional Notification Settings*\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Status: *{status}*\n"
        f"Interval: *Every {interval} hour(s)*\n"
        f"Custom Messages: *{custom_count}*\n"
        f"Last Sent: `{last_sent_str}`\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "_Use buttons below or commands:_\n"
        "`/promo_toggle on|off`\n"
        "`/promo_interval <hours>`\n"
        "`/promo_add <title>|<body>`\n"
        "`/promo_list`\n"
        "`/promo_remove <id>`\n"
        "`/promo_send`"
    )
    
    # Create inline keyboard
    toggle_text = "Disable" if config.get("enabled", True) else "Enable"
    toggle_data = "off" if config.get("enabled", True) else "on"
    
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(f"{'🔴' if config.get('enabled') else '🟢'} {toggle_text}", callback_data=f"promo_toggle_{toggle_data}"),
            InlineKeyboardButton("📋 List Messages", callback_data="promo_list")
        ],
        [
            InlineKeyboardButton("📤 Send Test Now", callback_data="promo_send"),
            InlineKeyboardButton("🔄 Refresh", callback_data="promo_refresh")
        ]
    ])
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)


async def promo_send(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a test promotional notification now (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    await update.message.reply_text("Sending promotional notification...")
    
    try:
        result = await notification_service.broadcast_random_promotion()
        if result:
            await update.message.reply_text("Promotional notification sent successfully!")
            
            # Update last_sent_at
            await _update_promo_config({"last_sent_at": utc_now()})
        else:
            await update.message.reply_text("Failed to send (FCM not configured or no subscribers)")
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")


async def promo_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Enable or disable promotional notifications (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    if not context.args or context.args[0].lower() not in ["on", "off"]:
        await update.message.reply_text("Usage: /promo_toggle <on|off>")
        return
    
    enabled = context.args[0].lower() == "on"
    await _update_promo_config({"enabled": enabled})
    
    status = "ENABLED" if enabled else "DISABLED"
    await update.message.reply_text(f"Promotional notifications are now *{status}*", parse_mode=ParseMode.MARKDOWN)


async def promo_interval(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Set promotional notification interval in hours (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /promo_interval <hours>\nExample: /promo_interval 2")
        return
    
    try:
        hours = int(context.args[0])
        if hours < 1 or hours > 24:
            await update.message.reply_text("Interval must be between 1 and 24 hours.")
            return
    except ValueError:
        await update.message.reply_text("Invalid number. Use: /promo_interval <hours>")
        return
    
    await _update_promo_config({"interval_hours": hours})
    await update.message.reply_text(
        f"Promotional notifications will now be sent every *{hours} hour(s)*",
        parse_mode=ParseMode.MARKDOWN
    )


async def promo_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add a custom promotional message (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text(
            "Usage: /promo_add <title>|<body>\n"
            "Example: /promo_add Big Savings|Share your ride and save money!"
        )
        return
    
    full_text = " ".join(context.args)
    
    if "|" not in full_text:
        await update.message.reply_text("Format: /promo_add <title>|<body>")
        return
    
    parts = full_text.split("|", 1)
    title = parts[0].strip()
    body = parts[1].strip()
    
    if len(title) < 2 or len(body) < 2:
        await update.message.reply_text("Title and body must be at least 2 characters each.")
        return
    
    if len(title) > 50:
        await update.message.reply_text("Title too long (max 50 characters).")
        return
    
    if len(body) > 200:
        await update.message.reply_text("Body too long (max 200 characters).")
        return
    
    # Generate unique ID
    import uuid
    msg_id = str(uuid.uuid4())[:8]
    
    db = get_db()
    await db.promo_config.update_one(
        {"_id": "promo_settings"},
        {"$push": {"custom_messages": {"id": msg_id, "title": title, "body": body}}},
        upsert=True
    )
    
    await update.message.reply_text(
        f"Added custom promo message!\n\n"
        f"ID: `{msg_id}`\n"
        f"Title: *{title}*\n"
        f"Body: _{body}_",
        parse_mode=ParseMode.MARKDOWN
    )


async def promo_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List all promotional messages (default + custom)."""
    if not await require_admin(update):
        return
    
    from app.services.notification_content import PROMO_TITLES, PROMO_VERSES
    
    config = await _get_promo_config()
    custom_messages = config.get("custom_messages", [])
    
    msg = (
        "*Promotional Messages*\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
        f"*Default Messages:* {len(PROMO_TITLES)} titles, {len(PROMO_VERSES)} bodies\n"
        "_These are randomly combined when sending._\n\n"
    )
    
    if custom_messages:
        msg += f"*Custom Messages ({len(custom_messages)}):*\n\n"
        for i, cm in enumerate(custom_messages, 1):
            msg += f"{i}. ID: `{cm['id']}`\n"
            msg += f"   Title: {cm['title']}\n"
            msg += f"   Body: _{cm['body']}_\n\n"
    else:
        msg += "*Custom Messages:* None\n"
        msg += "_Add with /promo_add <title>|<body>_\n"
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def promo_remove(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove a custom promotional message (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text("Usage: /promo_remove <id>\nUse /promo_list to see IDs.")
        return
    
    msg_id = context.args[0]
    
    db = get_db()
    result = await db.promo_config.update_one(
        {"_id": "promo_settings"},
        {"$pull": {"custom_messages": {"id": msg_id}}}
    )
    
    if result.modified_count > 0:
        await update.message.reply_text(f"Removed custom message with ID `{msg_id}`", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(f"Message with ID `{msg_id}` not found.", parse_mode=ParseMode.MARKDOWN)


async def _handle_promo_callback(query, data: str, context: ContextTypes.DEFAULT_TYPE):
    """Handle promo management button callbacks."""
    
    if data == "promo_refresh":
        config = await _get_promo_config()
        
        status = "ON" if config.get("enabled", True) else "OFF"
        interval = config.get("interval_hours", 1)
        custom_count = len(config.get("custom_messages", []))
        last_sent = config.get("last_sent_at")
        
        if last_sent:
            if isinstance(last_sent, datetime):
                ist_offset = timedelta(hours=5, minutes=30)
                last_sent_ist = last_sent + ist_offset
                last_sent_str = last_sent_ist.strftime("%d/%m %H:%M IST")
            else:
                last_sent_str = str(last_sent)
        else:
            last_sent_str = "Never"
        
        msg = (
            "*Promotional Notification Settings*\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"Status: *{status}*\n"
            f"Interval: *Every {interval} hour(s)*\n"
            f"Custom Messages: *{custom_count}*\n"
            f"Last Sent: `{last_sent_str}`\n\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "_Use buttons below or commands_"
        )
        
        toggle_text = "Disable" if config.get("enabled", True) else "Enable"
        toggle_data = "off" if config.get("enabled", True) else "on"
        
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton(f"{'🔴' if config.get('enabled') else '🟢'} {toggle_text}", callback_data=f"promo_toggle_{toggle_data}"),
                InlineKeyboardButton("📋 List Messages", callback_data="promo_list")
            ],
            [
                InlineKeyboardButton("📤 Send Test Now", callback_data="promo_send"),
                InlineKeyboardButton("🔄 Refresh", callback_data="promo_refresh")
            ]
        ])
        
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return
    
    if data.startswith("promo_toggle_"):
        action = data.replace("promo_toggle_", "")
        enabled = action == "on"
        await _update_promo_config({"enabled": enabled})
        
        # Refresh the view
        await _handle_promo_callback(query, "promo_refresh", context)
        await query.answer(f"Promos {'enabled' if enabled else 'disabled'}!")
        return
    
    if data == "promo_send":
        result = await notification_service.broadcast_random_promotion()
        if result:
            await _update_promo_config({"last_sent_at": utc_now()})
            await query.answer("Promotional notification sent!")
            await _handle_promo_callback(query, "promo_refresh", context)
        else:
            await query.answer("Failed to send (FCM not configured)", show_alert=True)
        return
    
    if data == "promo_list":
        from app.services.notification_content import PROMO_TITLES, PROMO_VERSES
        
        config = await _get_promo_config()
        custom_messages = config.get("custom_messages", [])
        
        msg = (
            "*Promotional Messages*\n"
            "━━━━━━━━━━━━━━━━━━━━\n\n"
            f"*Default:* {len(PROMO_TITLES)} titles, {len(PROMO_VERSES)} bodies\n\n"
        )
        
        if custom_messages:
            msg += f"*Custom ({len(custom_messages)}):*\n\n"
            for cm in custom_messages:
                msg += f"`{cm['id']}`: {cm['title']}\n"
        else:
            msg += "_No custom messages_\n"
        
        msg += "\n_Use /promo_list for full list_"
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("← Back", callback_data="promo_refresh")]
        ])
        
        await query.message.edit_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return


# =============================================================================
# ADMIN MANAGEMENT (Master Admin Only)
# =============================================================================

async def admins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View all administrators (regular + head admins)."""
    if not await require_admin(update):
        return
    
    db = get_db()
    bot = context.bot
    
    # Helper to get username from Telegram
    async def get_telegram_username(telegram_id: int) -> str:
        try:
            chat = await bot.get_chat(telegram_id)
            if chat.username:
                return f"@{chat.username}"
            elif chat.first_name:
                return chat.first_name
        except Exception:
            pass
        return ""
    
    # Get head admins
    head_admins = await get_all_head_admins()
    head_admin_ids = {ha['telegram_id'] for ha in head_admins}
    
    # Get regular admins from DB (exclude head admins)
    regular_admins = []
    cursor = db.telegram_admins.find({})
    async for doc in cursor:
        # Skip if this admin is also a head admin
        if doc["telegram_id"] in head_admin_ids:
            continue
        regular_admins.append({
            "telegram_id": doc["telegram_id"],
            "username": doc.get("username"),
            "added_at": doc.get("added_at")
        })
    
    msg = (
        "*Administrator List*\n"
        "━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    
    # Head Admins section
    msg += f"*Head Admins* ({len(head_admins)}):\n"
    for ha in head_admins:
        role = "👑" if ha.get("is_master") else "🔷"
        # Try to get username from stored or fetch from Telegram
        username = ""
        if ha.get("username"):
            username = f"@{ha['username']}"
        else:
            username = await get_telegram_username(ha['telegram_id'])
        
        role_text = "Master" if ha.get("is_master") else "Head"
        msg += f"  {role} {role_text}: `{ha['telegram_id']}` {username}\n"
    
    msg += f"\n*Regular Admins* ({len(regular_admins)}):\n"
    if regular_admins:
        for ra in regular_admins:
            # Try to get username from stored or fetch from Telegram
            username = ""
            if ra.get("username"):
                username = f"@{ra['username']}"
            else:
                username = await get_telegram_username(ra['telegram_id'])
            msg += f"  🔹 `{ra['telegram_id']}` {username}\n"
    else:
        msg += "  None\n"
    
    # Check if master admin
    if is_master_admin(update.effective_user.id):
        msg += (
            "\n━━━━━━━━━━━━━━━━━━━━\n"
            "Master Commands:\n"
            "/add\\_headadmin ID\n"
            "/remove\\_headadmin ID"
        )
    
    await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)


async def add_headadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Add a new head admin (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    db = get_db()
    
    if not context.args:
        await update.message.reply_text("Usage: /add\\_headadmin TELEGRAM\\_ID")
        return
    
    try:
        telegram_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Invalid Telegram ID. Must be a number.")
        return
    
    # Check if already master admin
    if is_master_admin(telegram_id):
        await update.message.reply_text("This user is already the Master Admin.")
        return
    
    # Fetch username from Telegram
    username = None
    display_name = str(telegram_id)
    try:
        chat = await context.bot.get_chat(telegram_id)
        if chat.username:
            username = chat.username
            display_name = f"@{chat.username}"
        elif chat.first_name:
            display_name = chat.first_name
    except Exception:
        pass
    
    # Try to add
    added = await add_head_admin(
        telegram_id=telegram_id,
        username=username,
        added_by=update.effective_user.id
    )
    
    if added:
        # Also remove from regular admins if they were there
        await db.telegram_admins.delete_one({"telegram_id": telegram_id})
        
        await update.message.reply_text(
            f"*Head Admin Added*\n\n"
            f"ID: `{telegram_id}`\n"
            f"User: {display_name}",
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        await update.message.reply_text(
            f"User `{telegram_id}` is already a head admin.",
            parse_mode=ParseMode.MARKDOWN
        )


async def remove_headadmin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Remove a head admin (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    if not context.args:
        await update.message.reply_text(
            "Usage: /remove_headadmin <telegram_id>\n"
            "Use /admins to see the list of head admins."
        )
        return
    
    try:
        telegram_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Invalid Telegram ID. Must be a number.")
        return
    
    # Check if trying to remove master admin
    if is_master_admin(telegram_id):
        await update.message.reply_text("Cannot remove Master Admin.")
        return
    
    # Try to remove
    removed = await remove_head_admin(telegram_id)
    
    if removed:
        await update.message.reply_text(
            f"*Head Admin Removed*\n\n"
            f"ID: `{telegram_id}` no longer has head admin privileges.",
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        await update.message.reply_text(
            f"User `{telegram_id}` is not a head admin.",
            parse_mode=ParseMode.MARKDOWN
        )


# =============================================================================
# NUKE COMMAND (Master Admin Only - DANGEROUS)
# =============================================================================

# Store nuke confirmation state
_nuke_confirmations = {}

async def nuke(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    DANGEROUS: Erase ALL user and matchmaking data.
    Requires 4 confirmations before execution.
    Master Admin only.
    """
    if not await require_master_admin(update):
        return
    
    user_id = update.effective_user.id
    
    # Check current confirmation state
    current_step = _nuke_confirmations.get(user_id, 0)
    
    if current_step == 0:
        # First call - start confirmation process
        _nuke_confirmations[user_id] = 1
        await update.message.reply_text(
            "⚠️ *NUKE COMMAND INITIATED*\n\n"
            "This will permanently DELETE:\n"
            "• All users\n"
            "• All groups\n"
            "• All rides\n"
            "• All reports and tickets\n"
            "• All matchmaking data\n"
            "• All Redis cache\n\n"
            "*DATA CANNOT BE RECOVERED*\n\n"
            "Type `/nuke` again to confirm (1/4)",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if current_step == 1:
        _nuke_confirmations[user_id] = 2
        await update.message.reply_text(
            "🔴 *CONFIRMATION 2/4*\n\n"
            "Are you absolutely sure?\n"
            "This action is IRREVERSIBLE.\n\n"
            "Type `/nuke` again to continue.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if current_step == 2:
        _nuke_confirmations[user_id] = 3
        await update.message.reply_text(
            "🔴🔴 *CONFIRMATION 3/4*\n\n"
            "FINAL WARNING!\n"
            "All production data will be erased.\n\n"
            "Type `/nuke` ONE MORE TIME to execute.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if current_step == 3:
        _nuke_confirmations[user_id] = 4
        await update.message.reply_text(
            "💀 *CONFIRMATION 4/4*\n\n"
            "LAST CHANCE TO ABORT.\n"
            "Send `/nuke` to PERMANENTLY DELETE ALL DATA.\n"
            "Send anything else to cancel.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if current_step == 4:
        # Execute the nuke
        _nuke_confirmations.pop(user_id, None)
        
        await update.message.reply_text("💥 *NUKING DATABASE...*", parse_mode=ParseMode.MARKDOWN)
        
        try:
            db = get_db()
            redis_client = get_redis()
            
            deleted_counts = {}
            
            # Delete all collections
            collections_to_nuke = [
                "users",
                "groups", 
                "rides",
                "reports",
                "support_tickets",
                "matchmaking_queue",
                "fcm_tokens",
                "notifications",
                "user_preferences",
                "chat_messages",
                "audit_logs"
            ]
            
            for collection in collections_to_nuke:
                try:
                    result = await db[collection].delete_many({})
                    deleted_counts[collection] = result.deleted_count
                except Exception:
                    deleted_counts[collection] = "error"
            
            # Clear Redis
            redis_deleted = 0
            if redis_client:
                try:
                    redis_deleted = await redis_client.flushdb()
                except Exception:
                    redis_deleted = "error"
            
            # Build report
            msg = "💥 *NUKE COMPLETE*\n\n"
            msg += "*Deleted from MongoDB:*\n"
            for coll, count in deleted_counts.items():
                msg += f"  {coll}: {count}\n"
            msg += f"\n*Redis flushed:* {redis_deleted}\n\n"
            msg += "All data has been erased."
            
            await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
            
        except Exception as e:
            await update.message.reply_text(f"Nuke failed: {str(e)}")
        
        return


async def nuke_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel an ongoing nuke confirmation."""
    user_id = update.effective_user.id
    if user_id in _nuke_confirmations:
        _nuke_confirmations.pop(user_id, None)
        await update.message.reply_text("Nuke cancelled.")

    else:
        await update.message.reply_text("No nuke in progress.")


async def clear_context(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Clear AI context/memory for the current chat."""
    if not await require_admin(update):
        return

    await ai_service.clear_chat_context(update.effective_chat.id)
    await update.message.reply_text(
        "*AI context wiped.* I have forgotten everything. Who are you again? 😵‍💫",
        parse_mode=ParseMode.MARKDOWN
    )


# =============================================================================
# CLEAR USER DATA COMMAND (Head Admin Only)
# =============================================================================

_clearuser_confirmations = {}

async def clearuser(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Clear all data for a specific user. Head Admin only.
    4-step confirmation process to prevent accidental deletion.
    
    Usage: /clearuser <user_id or email>
    """
    if not await require_head_admin(update):
        return
    
    admin_id = update.effective_user.id
    
    if not context.args:
        await update.message.reply_text(
            "*Clear User Data*\n\n"
            "Usage: `/clearuser <user_id or email>`\n\n"
            "This command permanently deletes ALL data for a user:\n"
            "- User profile\n"
            "- Ride requests & groups\n"
            "- Notifications\n"
            "- Support tickets\n"
            "- Chat messages\n"
            "- Reports (by/against)\n"
            "- All Redis cache entries\n\n"
            "⚠️ This action cannot be undone!",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    identifier = context.args[0]
    
    if admin_id not in _clearuser_confirmations:
        db = get_db()
        user = await find_user_by_identifier(db, identifier)
        
        if not user:
            await update.message.reply_text(f"User not found: {identifier}")
            return
        
        _clearuser_confirmations[admin_id] = {
            "user_id": user["user_id"],
            "display_name": user.get("display_name", "Unknown"),
            "email": user.get("email", "Unknown"),
            "step": 1,
            "started_at": datetime.now(timezone.utc)
        }
        
        await update.message.reply_text(
            f"⚠️ *CONFIRMATION STEP 1/4*\n\n"
            f"You are about to delete ALL data for:\n"
            f"- Name: {user.get('display_name')}\n"
            f"- Email: `{user.get('email')}`\n"
            f"- ID: `{user['user_id']}`\n\n"
            f"Type `/clearuser {identifier}` again to proceed to step 2.\n"
            f"Type `/clearuser_cancel` to abort.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    conf = _clearuser_confirmations[admin_id]
    
    if (datetime.now(timezone.utc) - conf["started_at"]).total_seconds() > 120:
        _clearuser_confirmations.pop(admin_id, None)
        await update.message.reply_text("Confirmation timed out. Start again.")
        return
    
    if conf["step"] == 1:
        conf["step"] = 2
        await update.message.reply_text(
            f"⚠️ *CONFIRMATION STEP 2/4*\n\n"
            f"Please confirm: You want to DELETE user `{conf['email']}`?\n\n"
            f"Type `/clearuser {identifier}` again to proceed.\n"
            f"Type `/clearuser_cancel` to abort.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if conf["step"] == 2:
        conf["step"] = 3
        await update.message.reply_text(
            f"⚠️ *CONFIRMATION STEP 3/4*\n\n"
            f"This is your FINAL WARNING.\n\n"
            f"User `{conf['display_name']}` and ALL associated data will be *permanently deleted*.\n\n"
            f"Type `/clearuser {identifier}` ONE MORE TIME to execute.\n"
            f"Type `/clearuser_cancel` to abort.",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    
    if conf["step"] == 3:
        conf["step"] = 4
        target_user_id = conf["user_id"]
        _clearuser_confirmations.pop(admin_id, None)
        
        await update.message.reply_text("🗑️ *DELETING USER DATA...*", parse_mode=ParseMode.MARKDOWN)
        
        try:
            db = get_db()
            redis_client = get_redis()
            
            deleted = {}
            
            result = await db.users.delete_one({"user_id": target_user_id})
            deleted["users"] = result.deleted_count
            
            result = await db.ride_requests.delete_many({"user_id": target_user_id})
            deleted["ride_requests"] = result.deleted_count
            
            result = await db.ride_groups.update_many(
                {},
                {"$pull": {"members": {"user_id": target_user_id}}}
            )
            deleted["group_memberships"] = result.modified_count
            
            result = await db.notifications.delete_many({"user_id": target_user_id})
            deleted["notifications"] = result.deleted_count
            
            result = await db.support_tickets.delete_many({"user_id": target_user_id})
            deleted["support_tickets"] = result.deleted_count
            
            result = await db.chat_messages.delete_many({"sender_id": target_user_id})
            deleted["chat_messages"] = result.deleted_count
            
            result = await db.reports.delete_many({
                "$or": [
                    {"reporter_user_id": target_user_id},
                    {"reported_user_id": target_user_id}
                ]
            })
            deleted["reports"] = result.deleted_count
            
            result = await db.admin_logs.delete_many({"user_id": target_user_id})
            deleted["audit_logs"] = result.deleted_count
            
            if redis_client:
                try:
                    keys = await redis_client.keys(f"*{target_user_id}*")
                    if keys:
                        await redis_client.delete(*keys)
                    deleted["redis_keys"] = len(keys) if keys else 0
                except Exception:
                    deleted["redis_keys"] = "error"
            
            await audit_service.log_admin_action(
                admin_id=str(admin_id),
                action="clear_user_data",
                target_user_id=target_user_id,
                details={"deleted": deleted}
            )
            
            msg = f"🗑️ *USER DATA CLEARED*\n\n"
            msg += f"Deleted user: `{conf['email']}`\n\n"
            msg += "*Deleted records:*\n"
            for collection, count in deleted.items():
                msg += f"  {collection}: {count}\n"
            
            await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
            
        except Exception as e:
            await update.message.reply_text(f"Error deleting user data: {str(e)}")
        
        return


async def clearuser_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel an ongoing clearuser confirmation."""
    admin_id = update.effective_user.id
    if admin_id in _clearuser_confirmations:
        target = _clearuser_confirmations.pop(admin_id, None)
        await update.message.reply_text(
            f"Clear user operation cancelled for `{target['email']}`.",
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        await update.message.reply_text("No clearuser operation in progress.")

# =============================================================================
# SYSTEM CONFIGURATION COMMANDS
# =============================================================================


