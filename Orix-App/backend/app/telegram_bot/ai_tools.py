"""
MCP Tool Definitions for Orixy AI

85 tools mapped to existing command handlers.
No direct DB access - all operations through command handlers.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional


class Permission(Enum):
    ADMIN = "admin"
    HEAD_ADMIN = "head_admin"


class ToolCategory(Enum):
    USER_INFO = "user_information"
    MODERATION = "moderation"
    REPORTS = "reports"
    RIDES = "rides_groups"
    SYSTEM = "system"
    TICKETS = "tickets"
    PROMO = "promo"
    COMMUNICATION = "communication"
    FUN = "fun"
    TROLL = "troll"


@dataclass
class MCPTool:
    name: str
    description: str
    parameters: dict
    permission: Permission
    category: ToolCategory
    destructive: bool
    handler: str


TOOLS: dict[str, MCPTool] = {
    # =========================================================================
    # USER INFORMATION (12 tools)
    # =========================================================================
    "lookup_user": MCPTool(
        name="lookup_user",
        description="Look up user details by email or user_id. Use this when you have an exact identifier (ID, email, phone).",
        parameters={"identifier": {"type": "string", "description": "Email, user_id, or phone number", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="lookup"
    ),
    "search_users": MCPTool(
        name="search_users",
        description="Search users by name/email/phone. Do NOT use if you already found the ID in a previous message - just use the ID.",
        parameters={"query": {"type": "string", "description": "Search term", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="search"
    ),
    "get_user_profile": MCPTool(
        name="get_user_profile",
        description="Get full detailed profile for a user including ride history stats.",
        parameters={"user_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="profile"
    ),
    "get_user_history": MCPTool(
        name="get_user_history",
        description="Get action history for a user (logins, rides, reports, etc).",
        parameters={"user_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="history"
    ),
    "list_users": MCPTool(
        name="list_users",
        description="List recent users with optional count limit.",
        parameters={"count": {"type": "integer", "default": 20, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="users"
    ),
    "list_online_users": MCPTool(
        name="list_online_users",
        description="List currently online/active users.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="online"
    ),
    "list_new_users": MCPTool(
        name="list_new_users",
        description="List new user registrations in last N days.",
        parameters={"days": {"type": "integer", "default": 7, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="new_users"
    ),
    "list_suspended_users": MCPTool(
        name="list_suspended_users",
        description="List all currently suspended users.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="suspended_users"
    ),
    "list_banned_users": MCPTool(
        name="list_banned_users",
        description="List all banned users.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="banned_users"
    ),
    "list_active_riders": MCPTool(
        name="list_active_riders",
        description="List all active riders who offer rides.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="active_riders"
    ),
    "check_fcm_status": MCPTool(
        name="check_fcm_status",
        description="Check if user has push notifications enabled (FCM token status).",
        parameters={"identifier": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="fcm_status"
    ),
    "view_admins": MCPTool(
        name="view_admins",
        description="View all administrators (regular + head admins).",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.USER_INFO,
        destructive=False,
        handler="admins"
    ),

    # =========================================================================
    # MODERATION (10 tools)
    # =========================================================================
    "warn_user": MCPTool(
        name="warn_user",
        description="Send a warning notification to a user.",
        parameters={
            "identifier": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.MODERATION,
        destructive=False,
        handler="warn"
    ),
    "suspend_user": MCPTool(
        name="suspend_user",
        description="Temporarily suspend a user for N hours. DESTRUCTIVE - requires confirmation.",
        parameters={
            "identifier": {"type": "string", "required": True},
            "hours": {"type": "integer", "required": True},
            "reason": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.MODERATION,
        destructive=True,
        handler="suspend"
    ),
    "ban_user": MCPTool(
        name="ban_user",
        description="Permanently ban a user. HEAD ADMIN only. DESTRUCTIVE - requires confirmation.",
        parameters={
            "identifier": {"type": "string", "required": True},
            "reason": {"type": "string", "required": True}
        },
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.MODERATION,
        destructive=True,
        handler="ban"
    ),
    "unban_user": MCPTool(
        name="unban_user",
        description="Unban a previously banned user. HEAD ADMIN only.",
        parameters={"identifier": {"type": "string", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.MODERATION,
        destructive=False,
        handler="unban"
    ),
    "notify_user": MCPTool(
        name="notify_user",
        description="Send a push notification to a specific user.",
        parameters={
            "identifier": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.MODERATION,
        destructive=False,
        handler="notify"
    ),
    "dm_user": MCPTool(
        name="dm_user",
        description="Direct message a user (sends as admin message).",
        parameters={
            "identifier": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.MODERATION,
        destructive=False,
        handler="dm"
    ),
    "broadcast": MCPTool(
        name="broadcast",
        description="Broadcast message to ALL users. HEAD ADMIN. DESTRUCTIVE - requires confirmation.",
        parameters={"message": {"type": "string", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.COMMUNICATION,
        destructive=True,
        handler="broadcast"
    ),
    "announce": MCPTool(
        name="announce",
        description="System announcement to all users. HEAD ADMIN. DESTRUCTIVE.",
        parameters={"message": {"type": "string", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.COMMUNICATION,
        destructive=True,
        handler="announce"
    ),
    "alert": MCPTool(
        name="alert",
        description="Urgent alert to all users. HEAD ADMIN. DESTRUCTIVE.",
        parameters={"message": {"type": "string", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.COMMUNICATION,
        destructive=True,
        handler="alert"
    ),
    "toggle_maintenance": MCPTool(
        name="toggle_maintenance",
        description="Toggle maintenance mode. HEAD ADMIN. DESTRUCTIVE.",
        parameters={"state": {"type": "string", "enum": ["on", "off"], "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=True,
        handler="maintenance"
    ),
    "clear_context": MCPTool(
        name="clear_context",
        description="Wipe the AI's memory/context for this chat. Use when bugged or confused.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=True,
        handler="clear_context"
    ),

    # =========================================================================
    # REPORTS (5 tools)
    # =========================================================================
    "list_reports": MCPTool(
        name="list_reports",
        description="List all pending reports that need review.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.REPORTS,
        destructive=False,
        handler="reports"
    ),
    "get_report": MCPTool(
        name="get_report",
        description="Get detailed info about a specific report.",
        parameters={"report_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.REPORTS,
        destructive=False,
        handler="report_detail"
    ),
    "get_report_stats": MCPTool(
        name="get_report_stats",
        description="Get report statistics (total, pending, resolved counts).",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.REPORTS,
        destructive=False,
        handler="report_stats"
    ),
    "get_user_reports": MCPTool(
        name="get_user_reports",
        description="Get reports involving a specific user (as reporter or accused).",
        parameters={"identifier": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.REPORTS,
        destructive=False,
        handler="user_reports"
    ),
    "resolve_report": MCPTool(
        name="resolve_report",
        description="Resolve a report with an action (dismiss, warn, ban).",
        parameters={
            "report_id": {"type": "string", "required": True},
            "action": {"type": "string", "enum": ["dismiss", "warn", "ban"], "required": True},
            "note": {"type": "string", "required": False}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.REPORTS,
        destructive=False,
        handler="resolve"
    ),

    # =========================================================================
    # RIDES & GROUPS (11 tools)
    # =========================================================================
    "list_groups": MCPTool(
        name="list_groups",
        description="List all active ride groups.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="groups"
    ),
    "get_group": MCPTool(
        name="get_group",
        description="Get detailed info about a specific group.",
        parameters={"group_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="group"
    ),
    "cancel_group": MCPTool(
        name="cancel_group",
        description="Cancel a ride group. HEAD ADMIN. DESTRUCTIVE.",
        parameters={
            "group_id": {"type": "string", "required": True},
            "reason": {"type": "string", "required": True}
        },
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.RIDES,
        destructive=True,
        handler="cancel_group"
    ),
    "list_rides": MCPTool(
        name="list_rides",
        description="List recent ride requests.",
        parameters={"count": {"type": "integer", "default": 10, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="rides"
    ),
    "get_ride": MCPTool(
        name="get_ride",
        description="Get detailed info about a specific ride request.",
        parameters={"ride_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="ride"
    ),
    "get_group_chat": MCPTool(
        name="get_group_chat",
        description="View recent chat messages from a ride group.",
        parameters={"group_id": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="chat"
    ),
    "list_pending_rides": MCPTool(
        name="list_pending_rides",
        description="List all pending/waiting ride requests.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="pending_rides"
    ),
    "list_completed_rides": MCPTool(
        name="list_completed_rides",
        description="List completed rides in last N days.",
        parameters={"days": {"type": "integer", "default": 7, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="completed_rides"
    ),
    "list_cancelled_rides": MCPTool(
        name="list_cancelled_rides",
        description="List cancelled rides in last N days.",
        parameters={"days": {"type": "integer", "default": 7, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="cancelled_rides"
    ),
    "message_group": MCPTool(
        name="message_group",
        description="Send a message to a ride group's chat.",
        parameters={
            "group_id": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.RIDES,
        destructive=False,
        handler="msggroup"
    ),
    "view_config": MCPTool(
        name="view_config",
        description="View safe configuration values. HEAD ADMIN only.",
        parameters={},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="config_cmd"
    ),

    # =========================================================================
    # SYSTEM DIAGNOSTICS (9 tools)
    # =========================================================================
    "health_check": MCPTool(
        name="health_check",
        description="Check status of all services (DB, Redis, FCM).",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="health"
    ),
    "ping": MCPTool(
        name="ping",
        description="Check bot latency/response time.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="ping"
    ),
    "uptime": MCPTool(
        name="uptime",
        description="Get server uptime.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="uptime"
    ),
    "get_stats": MCPTool(
        name="get_stats",
        description="Get system statistics (users, rides, groups counts).",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="stats"
    ),
    "get_logs": MCPTool(
        name="get_logs",
        description="Get recent admin action logs with optional page.",
        parameters={"page": {"type": "integer", "default": 1, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="logs"
    ),
    "get_db_stats": MCPTool(
        name="get_db_stats",
        description="Get MongoDB statistics and collection counts.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="db_stats"
    ),
    "get_redis_stats": MCPTool(
        name="get_redis_stats",
        description="Get Redis memory and key statistics.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="redis_stats"
    ),
    "get_queue_stats": MCPTool(
        name="get_queue_stats",
        description="Get matchmaking queue status.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="queue_stats"
    ),
    "get_memory": MCPTool(
        name="get_memory",
        description="Get server memory usage breakdown.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="memory"
    ),

    # =========================================================================
    # TICKETS (3 tools)
    # =========================================================================
    "list_tickets": MCPTool(
        name="list_tickets",
        description="List all open support tickets.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.TICKETS,
        destructive=False,
        handler="tickets"
    ),
    "reply_ticket": MCPTool(
        name="reply_ticket",
        description="Reply to a support ticket.",
        parameters={
            "ticket_id": {"type": "string", "required": True},
            "message": {"type": "string", "required": True}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.TICKETS,
        destructive=False,
        handler="reply"
    ),
    "close_ticket": MCPTool(
        name="close_ticket",
        description="Close a support ticket with optional reason.",
        parameters={
            "ticket_id": {"type": "string", "required": True},
            "reason": {"type": "string", "required": False}
        },
        permission=Permission.ADMIN,
        category=ToolCategory.TICKETS,
        destructive=False,
        handler="close_ticket_command"
    ),

    # =========================================================================
    # PROMO (7 tools)
    # =========================================================================
    "view_promo": MCPTool(
        name="view_promo",
        description="View promotional notification settings.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo"
    ),
    "promo_send": MCPTool(
        name="promo_send",
        description="Send a test promotional notification now.",
        parameters={},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_send"
    ),
    "promo_toggle": MCPTool(
        name="promo_toggle",
        description="Enable or disable promotional notifications.",
        parameters={"state": {"type": "string", "enum": ["on", "off"], "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_toggle"
    ),
    "promo_interval": MCPTool(
        name="promo_interval",
        description="Set promotional notification interval in hours (1-24).",
        parameters={"hours": {"type": "integer", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_interval"
    ),
    "promo_add": MCPTool(
        name="promo_add",
        description="Add a custom promotional message (title|body format).",
        parameters={
            "title": {"type": "string", "required": True},
            "body": {"type": "string", "required": True}
        },
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_add"
    ),
    "promo_list": MCPTool(
        name="promo_list",
        description="List all promotional messages (default + custom).",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_list"
    ),
    "promo_remove": MCPTool(
        name="promo_remove",
        description="Remove a custom promotional message by ID.",
        parameters={"message_id": {"type": "string", "required": True}},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.PROMO,
        destructive=False,
        handler="promo_remove"
    ),

    # =========================================================================
    # DOMAINS (1 tool)
    # =========================================================================
    "view_domains": MCPTool(
        name="view_domains",
        description="View supported college domains.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="domains"
    ),

    # =========================================================================
    # FUN (10 tools)
    # =========================================================================
    "flip_coin": MCPTool(
        name="flip_coin",
        description="Flip a coin - returns heads or tails.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="flip"
    ),
    "magic_8ball": MCPTool(
        name="magic_8ball",
        description="Ask the magic 8 ball a question.",
        parameters={"question": {"type": "string", "required": True}},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="magic8ball"
    ),
    "roll_dice": MCPTool(
        name="roll_dice",
        description="Roll a dice with specified sides (default 6).",
        parameters={"sides": {"type": "integer", "default": 6, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="dice"
    ),
    "roast": MCPTool(
        name="roast",
        description="Generate a programming roast for someone.",
        parameters={"target": {"type": "string", "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="roast"
    ),
    "motivate": MCPTool(
        name="motivate",
        description="Get a motivation quote.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="motivate"
    ),
    "excuse": MCPTool(
        name="excuse",
        description="Generate a random excuse.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="excuse"
    ),
    "fortune": MCPTool(
        name="fortune",
        description="Get a fortune cookie message.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="fortune"
    ),
    "blame": MCPTool(
        name="blame",
        description="Randomly blame something for a problem.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="blame"
    ),
    "countdown": MCPTool(
        name="countdown",
        description="Start a dramatic countdown timer.",
        parameters={"seconds": {"type": "integer", "default": 5, "required": False}},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="countdown"
    ),
    "wisdom": MCPTool(
        name="wisdom",
        description="Dispense random tech wisdom.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.FUN,
        destructive=False,
        handler="wisdom_cmd"
    ),

    # =========================================================================
    # TROLL (3 tools - Head Admin only)
    # =========================================================================
    "troll_all": MCPTool(
        name="troll_all",
        description="Send a funny push notification to ALL users. DESTRUCTIVE.",
        parameters={},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.TROLL,
        destructive=True,
        handler="troll_all"
    ),
    "rickroll": MCPTool(
        name="rickroll",
        description="Rickroll all users with a push notification. DESTRUCTIVE.",
        parameters={},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.TROLL,
        destructive=True,
        handler="rickroll"
    ),
    "fake_update": MCPTool(
        name="fake_update",
        description="Send fake app update notification. DESTRUCTIVE.",
        parameters={},
        permission=Permission.HEAD_ADMIN,
        category=ToolCategory.TROLL,
        destructive=True,
        handler="fake_update"
    ),

    # =========================================================================
    # BOT (2 tools)
    # =========================================================================
    "show_help": MCPTool(
        name="show_help",
        description="Show the help menu with all available commands.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="start"
    ),
    "show_start": MCPTool(
        name="show_start",
        description="Show the welcome/start message.",
        parameters={},
        permission=Permission.ADMIN,
        category=ToolCategory.SYSTEM,
        destructive=False,
        handler="start"
    ),
}


def get_tools_for_permission(permission: Permission) -> list[MCPTool]:
    """Get tools available for a given permission level."""
    tools = []
    for tool in TOOLS.values():
        if permission == Permission.HEAD_ADMIN:
            tools.append(tool)
        elif tool.permission == Permission.ADMIN:
            tools.append(tool)
    return tools


def get_tool_by_name(name: str) -> Optional[MCPTool]:
    """Get a tool by name."""
    return TOOLS.get(name)


def get_destructive_tools() -> list[str]:
    """Get list of destructive tool names."""
    return [name for name, tool in TOOLS.items() if tool.destructive]


def format_tools_for_groq(permission: Permission) -> list[dict]:
    """Format tools for Groq function calling API."""
    tools = get_tools_for_permission(permission)
    formatted = []
    
    for tool in tools:
        params_schema = {
            "type": "object",
            "properties": {},
            "required": []
        }
        
        for param_name, param_def in tool.parameters.items():
            params_schema["properties"][param_name] = {
                "type": param_def.get("type", "string"),
                "description": param_def.get("description", "")
            }
            if param_def.get("enum"):
                params_schema["properties"][param_name]["enum"] = param_def["enum"]
            if param_def.get("required", False):
                params_schema["required"].append(param_name)
        
        formatted.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": params_schema
            }
        })
    
    return formatted
