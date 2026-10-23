"""
Orixy AI Message Handler

Handles AI message processing and tool execution.
"""

import logging
import asyncio
from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from app.services.ai_service import ai_service
from app.services.audit_service import AuditService
from app.telegram_bot.utils import (
    is_admin_async,
    is_head_admin_async,
    require_master_admin,
)
from app.telegram_bot.ai_tools import get_tool_by_name
from app.telegram_bot.error_humanizer import format_tool_error

logger = logging.getLogger(__name__)
audit_service = AuditService()


HANDLER_MAP = {}


def _get_handler_map():
    """Lazy load handler map to avoid circular imports."""
    global HANDLER_MAP
    if not HANDLER_MAP:
        from app.telegram_bot.handlers import (
            start, lookup, ban, unban, suspend, reports, resolve,
            groups, cancel_group, maintenance, logs, stats, users,
            notify, broadcast, msggroup, history, tickets, reply,
            close_ticket_command, domains,
        )
        from app.telegram_bot.extended_handlers import (
            flip, magic8ball, dice, roast, motivate, excuse, fortune,
            blame, countdown, wisdom_cmd, troll_all, rickroll, fake_update,
            search, profile, online, new_users, active_riders,
            suspended_users, banned_users, warn, fcm_status, health,
            ping, uptime, db_stats, redis_stats, queue_stats, memory,
            config_cmd, rides, ride, group, chat, pending_rides,
            completed_rides, cancelled_rides, report_detail, report_stats,
            user_reports, dm, announce, alert, promo, promo_send,
            promo_toggle, promo_interval, promo_add, promo_list,
            promo_toggle, promo_interval, promo_add, promo_list,
            promo_remove, admins, clear_context,
        )
        
        HANDLER_MAP = {
            "start": start,
            "lookup": lookup,
            "clear_context": clear_context,
            "search": search,
            "profile": profile,
            "history": history,
            "users": users,
            "online": online,
            "new_users": new_users,
            "active_riders": active_riders,
            "suspended_users": suspended_users,
            "banned_users": banned_users,
            "fcm_status": fcm_status,
            "admins": admins,
            "warn": warn,
            "suspend": suspend,
            "ban": ban,
            "unban": unban,
            "notify": notify,
            "dm": dm,
            "broadcast": broadcast,
            "announce": announce,
            "alert": alert,
            "maintenance": maintenance,
            "reports": reports,
            "report_detail": report_detail,
            "report_stats": report_stats,
            "user_reports": user_reports,
            "resolve": resolve,
            "groups": groups,
            "group": group,
            "cancel_group": cancel_group,
            "rides": rides,
            "ride": ride,
            "chat": chat,
            "pending_rides": pending_rides,
            "completed_rides": completed_rides,
            "cancelled_rides": cancelled_rides,
            "msggroup": msggroup,
            "health": health,
            "ping": ping,
            "uptime": uptime,
            "stats": stats,
            "logs": logs,
            "db_stats": db_stats,
            "redis_stats": redis_stats,
            "queue_stats": queue_stats,
            "memory": memory,
            "config_cmd": config_cmd,
            "domains": domains,
            "tickets": tickets,
            "reply": reply,
            "close_ticket_command": close_ticket_command,
            "promo": promo,
            "promo_send": promo_send,
            "promo_toggle": promo_toggle,
            "promo_interval": promo_interval,
            "promo_add": promo_add,
            "promo_list": promo_list,
            "promo_remove": promo_remove,
            "flip": flip,
            "magic8ball": magic8ball,
            "dice": dice,
            "roast": roast,
            "motivate": motivate,
            "excuse": excuse,
            "fortune": fortune,
            "blame": blame,
            "countdown": countdown,
            "wisdom_cmd": wisdom_cmd,
            "troll_all": troll_all,
            "rickroll": rickroll,
            "fake_update": fake_update,
        }
    return HANDLER_MAP


class MockContext:
    """Mock context to pass arguments to handlers."""
    def __init__(self, args: list, bot):
        self.args = args
        self.bot = bot
        self.user_data = {}


class CaptureMessage:
    """Captures messages sent via reply_text."""
    def __init__(self, original_message):
        self.original = original_message
        self.captured_text = []
    
    async def reply_text(self, text, **kwargs):
        """Capture the text and also send it."""
        self.captured_text.append(text)
        return await self.original.reply_text(text, **kwargs)
    
    async def edit_text(self, text, **kwargs):
        """Forward edit_text."""
        return await self.original.edit_text(text, **kwargs)
    
    @property
    def from_user(self):
        return self.original.from_user
    
    @property
    def chat(self):
        return self.original.chat
    
    def __getattr__(self, name):
        return getattr(self.original, name)


class CaptureUpdate:
    """Wraps Update to capture reply_text calls."""
    def __init__(self, original_update):
        self.original = original_update
        self.message = CaptureMessage(original_update.message)
        self.captured_output = []
    
    @property
    def effective_user(self):
        return self.original.effective_user
    
    @property
    def effective_chat(self):
        return self.original.effective_chat
    
    @property
    def effective_message(self):
        return self.original.effective_message
    
    def get_captured_text(self) -> str:
        """Get all captured text as a single string."""
        return "\n".join(self.message.captured_text)
    
    def __getattr__(self, name):
        return getattr(self.original, name)


async def execute_tool(
    tool_name: str,
    params: dict,
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
) -> str:
    """Execute a tool by calling its handler and return captured output."""
    tool = get_tool_by_name(tool_name)
    if not tool:
        return f"Tool {tool_name} not found"
    
    handler_name = tool.handler
    handler_map = _get_handler_map()
    handler = handler_map.get(handler_name)
    
    if not handler:
        return f"Handler {handler_name} not found"
    
    args = []
    if "identifier" in params:
        args.append(params["identifier"])
    if "user_id" in params:
        args.append(params["user_id"])
    if "group_id" in params:
        args.append(params["group_id"])
    if "report_id" in params:
        args.append(params["report_id"])
    if "ticket_id" in params:
        args.append(params["ticket_id"])
    if "ride_id" in params:
        args.append(params["ride_id"])
    if "message" in params:
        args.append(params["message"])
    if "hours" in params:
        args.append(str(params["hours"]))
    if "reason" in params:
        args.append(params["reason"])
    if "count" in params:
        args.append(str(params["count"]))
    if "days" in params:
        args.append(str(params["days"]))
    if "page" in params:
        args.append(str(params["page"]))
    if "state" in params:
        args.append(params["state"])
    if "action" in params:
        args.append(params["action"])
    if "note" in params:
        args.append(params["note"])
    if "query" in params:
        args.append(params["query"])
    if "question" in params:
        args.append(params["question"])
    if "target" in params:
        args.append(params["target"])
    if "seconds" in params:
        args.append(str(params["seconds"]))
    if "sides" in params:
        args.append(str(params["sides"]))
    if "title" in params and "body" in params:
        args.append(f"{params['title']}|{params['body']}")
    if "message_id" in params:
        args.append(params["message_id"])
    
    mock_context = MockContext(args, context.bot)
    mock_context.user_data = context.user_data
    
    # Create capture wrapper to intercept output
    capture_update = CaptureUpdate(update)
    
    # Check cache first (#26)
    cached = ai_service.get_cached_result(tool_name, params)
    if cached:
        logger.debug(f"Using cached result for {tool_name}")
        return f"[cached] {cached}"
    
    try:
        # Execute with timeout (#56)
        await asyncio.wait_for(
            handler(capture_update, mock_context),
            timeout=ai_service.TOOL_TIMEOUT
        )
        
        # Return the captured output
        captured = capture_update.get_captured_text()
        result = captured if captured else "Command executed successfully"
        
        # Truncate long results (#57)
        if len(result) > 1500:
            result = result[:1500] + "\n...[truncated, showing first 1500 chars]"
        
        # Cache the result
        ai_service.cache_result(tool_name, params, result)
        
        return result
    except asyncio.TimeoutError:
        logger.error(f"Tool {tool_name} timed out after {ai_service.TOOL_TIMEOUT}s")
        return format_tool_error(tool_name, "timeout - operation took too long")
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return format_tool_error(tool_name, e)


async def ai_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle AI on/off (Master Admin only)."""
    if not await require_master_admin(update):
        return
    
    current_state = await ai_service.is_enabled()
    
    if context.args:
        arg = context.args[0].lower()
        if arg == "on":
            new_state = True
        elif arg == "off":
            new_state = False
        else:
            await update.message.reply_text("Usage: /ai [on|off]")
            return
    else:
        new_state = not current_state
    
    await ai_service.toggle(new_state, update.effective_user.id)
    
    status = "ENABLED 🟢" if new_state else "DISABLED 🔴"
    await update.message.reply_text(
        f"*Orixy AI is now {status}*",
        parse_mode=ParseMode.MARKDOWN
    )


async def handle_ai_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Handle a potential AI message. Returns True if handled."""
    
    if not update.message or not update.message.text:
        return False
    
    if not await ai_service.is_enabled():
        return False
    
    user_id = update.effective_user.id
    
    if not await is_admin_async(user_id):
        return False
    
    message_text = update.message.text
    bot_username = (await context.bot.get_me()).username
    
    is_mention = f"@{bot_username}" in message_text
    is_reply_to_bot = (
        update.message.reply_to_message and
        update.message.reply_to_message.from_user and
        update.message.reply_to_message.from_user.id == context.bot.id
    )
    
    orixy_triggers = ["orixy", "hey orixy", "orixy,", "@orixy"]
    has_orixy_trigger = any(trigger in message_text.lower() for trigger in orixy_triggers)
    
    if not (is_mention or is_reply_to_bot or has_orixy_trigger):
        return False
    
    clean_message = message_text.replace(f"@{bot_username}", "").strip()
    for trigger in orixy_triggers:
        clean_message = clean_message.lower().replace(trigger, "").strip()
    
    if not clean_message:
        await update.message.reply_text(
            "what? you just pinged me with nothing to say? rude.",
            parse_mode=ParseMode.MARKDOWN
        )
        return True
    
    await ai_service.add_to_context(
        chat_id=update.effective_chat.id,
        user_id=user_id,
        username=update.effective_user.username or update.effective_user.first_name or "Unknown",
        text=message_text
    )
    
    # Detect and track user language
    lang_code, lang_name = ai_service.detect_language(message_text)
    if lang_code != "en":
        await ai_service.track_user_language(update.effective_chat.id, lang_code, lang_name)
    
    is_head_admin = await is_head_admin_async(user_id)
    
    # Show thinking message to appear more human
    import random
    thinking_phrases = [
        "hmm let me think...",
        "ugh fine, thinking...",
        "*sighs* hold on...",
        "processing...",
        "lemme check real quick...",
        "okay thinking about this...",
        "*rolls eyes* give me a sec...",
        "bruh hold on...",
        "wait lemme see...",
        "thinking... (this better be worth it)",
    ]
    thinking_msg = await update.message.reply_text(
        random.choice(thinking_phrases)
    )
    
    response = await ai_service.process_message(
        message=clean_message,
        user_id=user_id,
        username=update.effective_user.username or update.effective_user.first_name or "Unknown",
        is_head_admin=is_head_admin,
        chat_id=update.effective_chat.id,
        message_id=update.message.message_id
    )
    
    # Delete thinking message
    try:
        await thinking_msg.delete()
    except Exception:
        pass
    
    # ALWAYS send the text response if present
    if response.message:
        await update.message.reply_text(response.message)
        
        # Save AI response to context for conversation continuity
        await ai_service.add_to_context(
            chat_id=update.effective_chat.id,
            user_id=0,  # 0 indicates AI
            username="Orixy",
            text=response.message,
            is_ai=True
        )
    
    # Then acknowledge/process tool calls
    if response.tool_calls:
        tool_outputs = []
        
        # Rate limiting (#44) - prevent runaway tool calls
        max_tools = ai_service.MAX_TOOL_CALLS_PER_MESSAGE
        if len(response.tool_calls) > max_tools:
            await update.message.reply_text(
                f"_sigh_ you're asking for {len(response.tool_calls)} things at once. I'm capping it at {max_tools} because I have boundaries.",
                parse_mode=ParseMode.MARKDOWN
            )
        
        for tool_call in response.tool_calls[:max_tools]:
            if tool_call.get("confirmed", False) or not get_tool_by_name(tool_call["name"]).destructive:
                await update.message.reply_text(
                    f"*executing:* `{tool_call['name']}`",
                    parse_mode=ParseMode.MARKDOWN
                )
                output = await execute_tool(
                    tool_call["name"],
                    tool_call["params"],
                    update,
                    context
                )
                tool_outputs.append(f"[{tool_call['name']}]: {output[:1000]}")
                
                # Log tool execution to Telegram channel
                await audit_service.log_ai_tool_execution(
                    admin_id=user_id,
                    admin_username=update.effective_user.username or update.effective_user.first_name or "Unknown",
                    tool_name=tool_call["name"],
                    params=tool_call["params"],
                    result=output,
                    is_head_admin=is_head_admin
                )
                
                # Store tool result for conversation continuity
                await ai_service.add_tool_result_to_context(
                    chat_id=update.effective_chat.id,
                    tool_name=tool_call["name"],
                    params=tool_call["params"],
                    result=output
                )
                
                # Track entities mentioned in tool results for pronoun resolution
                if tool_call["name"] in ["lookup_user", "search_users", "get_user_profile"]:
                    # Extract user info from lookup results
                    if "identifier" in tool_call["params"]:
                        await ai_service.track_entity(
                            chat_id=update.effective_chat.id,
                            entity_type="user",
                            entity_id=tool_call["params"]["identifier"],
                            display_name=tool_call["params"]["identifier"]
                        )
                elif tool_call["name"] in ["get_group_details", "list_active_groups"]:
                    if "group_id" in tool_call["params"]:
                        await ai_service.track_entity(
                            chat_id=update.effective_chat.id,
                            entity_type="group",
                            entity_id=tool_call["params"]["group_id"],
                            display_name=f"Group {tool_call['params']['group_id'][:8]}"
                        )
                elif tool_call["name"] in ["list_tickets", "reply_ticket"]:
                    if "ticket_id" in tool_call["params"]:
                        await ai_service.track_entity(
                            chat_id=update.effective_chat.id,
                            entity_type="ticket",
                            entity_id=tool_call["params"]["ticket_id"],
                            display_name=tool_call["params"]["ticket_id"]
                        )
        
        # If we have tool outputs, get AI follow-up response
        if tool_outputs:
            combined_output = "\n".join(tool_outputs)
            
            # Get AI commentary on the tool output
            follow_up = await ai_service.process_message(
                message=f"[TOOL_OUTPUT]\n{combined_output}\n[/TOOL_OUTPUT]\n\nGive a brief, sassy commentary on this result. Don't repeat all the data, just react to it naturally.",
                user_id=user_id,
                username="System",
                is_head_admin=is_head_admin,
                chat_id=update.effective_chat.id,
                message_id=update.message.message_id
            )
            
            if follow_up.message and not follow_up.tool_calls:
                await update.message.reply_text(follow_up.message)
                
                # Save AI commentary to context
                await ai_service.add_to_context(
                    chat_id=update.effective_chat.id,
                    user_id=0,
                    username="Orixy",
                    text=follow_up.message,
                    is_ai=True
                )
