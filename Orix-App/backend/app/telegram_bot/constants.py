"""
Telegram Bot Constants

Text templates, messages, and emoji mappings for Orixy admin bot.
"""

# =============================================================================
# Emoji Mappings
# =============================================================================

STATUS_EMOJI = {
    "active": "[Active]",
    "suspended": "[Suspended]",
    "banned": "[Banned]",
}

ROLE_EMOJI = {
    "head_admin": "[Head Admin]",
    "admin": "[Admin]",
    "user": "[User]",
}


# =============================================================================
# Command Descriptions (ASCII Art Style)
# =============================================================================

HELP_COMMANDS_ALL = r"""
*USER MANAGEMENT*
`/lookup`    - Look up user details
`/search`    - Search by name/email
`/profile`   - Full user profile
`/history`   - User action history
`/users`     - List recent users
`/online`    - Active users now
`/new_users` - New registrations
`/active_riders` - Riders online
`/suspended_users` - Suspended
`/banned_users` - Banned list
`/fcm_status` - FCM token check
`/warn`      - Send warning

*MODERATION*
`/suspend`   - Suspend user
`/reports`   - Pending reports
`/report`    - Report details
`/report_stats` - Statistics
`/user_reports` - User reports
`/resolve`   - Resolve report
`/notify`    - Notify user
`/dm`        - Direct message

*RIDES & GROUPS*
`/groups`    - Active groups
`/group`     - Group details
`/cancel_group` - Cancel group
`/rides`     - Recent requests
`/ride`      - Ride details
`/chat`      - Group chat
`/pending_rides` - Pending
`/completed_rides` - Completed
`/cancelled_rides` - Cancelled
`/msggroup`  - Message group

*SYSTEM*
`/health`    - Service status
`/ping`      - Latency check
`/uptime`    - Server uptime
`/stats`     - System stats
`/logs`      - Admin logs
`/db_stats`  - MongoDB stats
`/redis_stats` - Redis info
`/queue_stats` - Queue status
`/memory`    - Memory usage
`/domains`   - Manage colleges
`/domain_requests` - College requests

*TICKETS*
`/tickets`   - Open tickets
`/reply`     - Reply to ticket
`/close`     - Close ticket

*FUN*
`/flip`      - Coin flip
`/dice`      - Roll dice
`/magic8ball` - Ask 8-ball
`/roast`     - Roast someone
`/motivate`  - Motivation
`/excuse`    - Random excuse
`/fortune`   - Fortune cookie
`/blame`     - Blame something
`/countdown` - Countdown
`/wisdom`    - Random wisdom

*PROMO NOTIFICATIONS*
`/promo`     - View/manage settings
`/promo_list` - List messages
`/promo_send` - Send test now
`/promo_toggle` - Enable/disable
`/promo_interval` - Set hours
`/promo_add` - Add message
`/promo_remove` - Delete message

*ADMIN MANAGEMENT*
`/admins`    - View all admins
"""

HELP_COMMANDS_HEAD_ADMIN = r"""
*HEAD ADMIN ONLY*
`/ban`       - Ban user
`/unban`     - Unban user
`/maintenance` - Toggle mode
`/broadcast` - Notify all
`/announce`  - Announcement
`/alert`     - Urgent alert
`/config`    - View config

*MASTER ADMIN ONLY*
`/ai`        - Toggle Orixy AI
`/ai_clear`  - Wipe AI Context
`/add_headadmin` - Add head admin
`/remove_headadmin` - Remove head
`/clearuser` - Erase user data
`/clearuser_cancel` - Cancel
`/nuke` - ERASE ALL DATA
`/nuke_cancel` - Cancel nuke
`/update_manager` - Manage App Updates (Master)

*TROLL COMMANDS*
`/troll_all` - Prank everyone
`/rickroll`  - Never gonna...
`/fake_update` - Fake update
"""


# =============================================================================
# Message Templates (ORIX Branded)
# =============================================================================

MSG_UNAUTHORIZED = "\U0001F6AB *Access Denied*\n\nYou are not authorized to use Orixy."
MSG_HEAD_ADMIN_REQUIRED = "\U0001F512 *Head Admin Required*\n\nThis command requires Head Admin privileges."
MSG_USER_NOT_FOUND = "\U0001F50D *User Not Found*\n\n`{identifier}` not found in database."
MSG_GROUP_NOT_FOUND = "\U0001F465 *Group Not Found*\n\n`{group_id}` not found."
MSG_REPORT_NOT_FOUND = "\U0001F4CB *Report Not Found*\n\n`{report_id}` not found."
MSG_NO_PENDING_REPORTS = "\u2705 *No Pending Reports*\n\nAll reports have been resolved!"
MSG_NO_ACTIVE_GROUPS = "\U0001F4AD *No Active Groups*\n\nNo groups currently active."
MSG_NO_RECENT_ACTIONS = "\U0001F4DC *No Recent Actions*\n\nNo admin actions logged recently."
MSG_NO_USERS = "\U0001F464 *No Users Found*\n\nNo users matching your query."
MSG_NO_HISTORY = "\U0001F4C4 *No History*\n\nNo history for `{user_id}`."
MSG_ACTION_CANCELLED = "\u274C *Cancelled*\n\nAction has been cancelled."

MSG_USER_BANNED = """\U0001F6D1 *USER BANNED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F464 *User:* `{email}`
\U0001F4DD *Reason:* {reason}"""

MSG_USER_UNBANNED = """\u2705 *USER UNBANNED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F464 *User:* `{email}`
Status restored to active."""

MSG_USER_SUSPENDED = """\u26a0\ufe0f *USER SUSPENDED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F464 *User:* `{email}`
\u23f0 *Duration:* {hours} hours
\U0001F4DD *Reason:* {reason}"""

MSG_GROUP_CANCELLED = """\U0001F6AB *GROUP CANCELLED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F465 *Group:* `{group_id}`"""

MSG_MAINTENANCE_TOGGLED = "{emoji} *MAINTENANCE MODE*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nStatus: *{status}*"

MSG_REPORT_RESOLVED = """\u2705 *REPORT RESOLVED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2699\ufe0f *Action:* `{action}`"""

MSG_NOTIFICATION_SENT = """\U0001F514 *NOTIFICATION SENT*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F464 *To:* `{email}`"""

MSG_BROADCAST_SENT = """\U0001F4E2 *BROADCAST SENT*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F465 *Recipients:* `{count}` users
\U0001F4AC *Message:* _{message}_"""

MSG_GROUP_MESSAGE_SENT = """\U0001F4AC *MESSAGE SENT*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F465 *Group:* `{group_id}`"""

MSG_ALREADY_ADMIN = "\U0001F44B *Already Admin*\n\nYou already have admin privileges!"

MSG_ACCESS_GRANTED = """\u2705 *ADMIN ACCESS GRANTED*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\U0001F194 Your ID: `{user_id}`

Welcome to the ORIX admin team!
Use /help to see available commands.
:><hello><:
"""

# =============================================================================
# Utility Functions
# =============================================================================

def get_status_emoji(status: str) -> str:
    """Get emoji for user status."""
    emojis = {
        "active": "\U0001F7E2",
        "suspended": "\U0001F7E1",
        "banned": "\U0001F534",
    }
    return emojis.get(status, "\u26AA")

# =============================================================================
# Welcome Message Template
# =============================================================================

def get_welcome_message(role: str, is_head: bool) -> str:
    """Generate welcome message with ASCII art header."""
    
    # Royal ASCII art header
    header = r"""```
   ____  ____  ________  ____  __
  / __ \/ __ \/  _/ __ \/ __ \/ /
 / / / / /_/ // / \ \/ / /_/ / / 
/ /_/ / _, _// /  / /\ \ \__,_/_/  
\____/_/ |_/___/ /_/  \_\____(_) 
                              
  [ ADMIN CONTROL CENTER ]
```"""
    
    # Role display
    if is_head:
        role_line = "*>> HEAD ADMINISTRATOR <<*"
    else:
        role_line = "*>> ADMINISTRATOR <<*"
    
    message = f"{header}\n{role_line}\n"
    message += HELP_COMMANDS_ALL
    
    if is_head:
        message += HELP_COMMANDS_HEAD_ADMIN
    
    message += "\n`---------------------------------`\n_Type /help for this menu_"
    
    return message

# =============================================================================
# New Report Message Template
# =============================================================================

def get_new_report_message(report_id: str) -> str:
    """Generate message for a new report."""
    return (
        f"\u26a0\ufe0f *NEW SAFETY REPORT*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        f"\U0001F4CB *ID:* `{report_id}`\n\n"
        f"Use /report `{report_id}` to view details."
    )
