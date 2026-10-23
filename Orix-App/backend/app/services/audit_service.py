"""Audit Service - Comprehensive audit logging for all significant actions."""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.database import get_db
from app.models.admin_log import AdminLog, AdminLogCreate, ActorType
from app.config import settings
from app.utils.timezone_utils import utc_now, format_ist


class AuditService:
    """
    Audit logging service.

    SECURITY: All significant actions are logged for accountability.
    Logs include:
    - Admin actions (ban, suspend, moderation)
    - System actions (auto-expire, matchmaking)
    - Security-relevant user actions
    """

    def _format_timestamp_ist(self, dt: datetime = None) -> str:
        """Format timestamp in IST for display in Telegram logs."""
        if dt is None:
            dt = utc_now()
        return format_ist(dt)

    def _get_full_avatar_url(self, photo_url: str) -> str:
        """Convert relative photo_url to full URL for Telegram display."""
        if not photo_url:
            return ""
        # If already a full URL (starts with http), return as-is
        if photo_url.startswith("http"):
            return photo_url
        # Otherwise, prepend base URL
        base_url = settings.api_base_url.rstrip("/")
        return f"{base_url}{photo_url}"

    # =========================================================================
    # Message Styling Constants
    # =========================================================================

    # Box drawing characters for premium look
    LINE = "\u2500" * 22
    LINE_THIN = "\u2508" * 22
    CORNER_TL = "\u250c"
    CORNER_TR = "\u2510"
    CORNER_BL = "\u2514"
    CORNER_BR = "\u2518"
    VERT = "\u2502"

    # Category emojis
    EMOJI = {
        # Status
        "online": "\U0001f7e2",
        "offline": "\U0001f534",
        "warning": "\U0001f7e1",
        "error": "\U0001f534",
        "success": "\u2705",
        "pending": "\U0001f7e0",
        # Actions
        "login": "\U0001f511",
        "logout": "\U0001f6aa",
        "match": "\U0001f50d",
        "matched": "\U0001f91d",
        "group": "\U0001f465",
        "chat": "\U0001f4ac",
        "notification": "\U0001f514",
        "admin": "\U0001f6e1\ufe0f",
        "system": "\u2699\ufe0f",
        "user": "\U0001f464",
        "time": "\u23f0",
        "email": "\U0001f4e7",
        "phone": "\U0001f4f1",
        "location": "\U0001f4cd",
        "car": "\U0001f697",
        "rider": "\U0001f6b4",
        "report": "\u26a0\ufe0f",
        "ban": "\U0001f6d1",
        "session": "\u23f1\ufe0f",
    }

    def _format_header(self, emoji_key: str, title: str) -> str:
        """Create a styled header for messages."""
        emoji = self.EMOJI.get(emoji_key, "\U0001f697")
        return f"{emoji} *{title}*\n{self.LINE}"

    def _format_field(self, label: str, value: str, emoji_key: str = None) -> str:
        """Format a single field with optional emoji."""
        emoji = self.EMOJI.get(emoji_key, "") if emoji_key else ""
        prefix = f"{emoji} " if emoji else "   \u2022 "
        return f"\n{prefix}{label}: `{value}`"

    def _format_user_block(
        self, name: str, email: str = None, extra: dict = None
    ) -> str:
        """Format user info block."""
        block = f"\n\n{self.EMOJI['user']} *{name}*"
        if email:
            block += f"\n{self.EMOJI['email']} `{email}`"
        if extra:
            for key, val in extra.items():
                emoji = self.EMOJI.get(key, "")
                prefix = f"{emoji} " if emoji else "   "
                block += f"\n{prefix}{val}"
        return block

    async def log(
        self,
        actor_type: ActorType,
        actor_id: str,
        action: str,
        actor_email: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AdminLog:
        """
        Log an action.

        Args:
            actor_type: user, admin, or system
            actor_id: ID of the actor
            action: Description of the action
            actor_email: Email if known (for admin actions)
            target_type: Type of target (user, group, report, etc.)
            target_id: ID of the target
            before_state: State before the action
            after_state: State after the action
            metadata: Additional context
        """
        db = get_db()

        log_entry = AdminLog(
            log_id=str(uuid.uuid4()),
            timestamp=utc_now(),
            actor_type=actor_type,
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before_state,
            after_state=after_state,
            metadata=metadata,
        )

        await db.admin_logs.insert_one(log_entry.model_dump())

        return log_entry

    async def log_action(
        self,
        user_id: str,
        action: str,
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AdminLog:
        """Convenience wrapper to log a user action without breaking callers.

        This mirrors the existing `log` API but defaults actor_type to USER and
        maps fields expected by our routers.
        """

        try:
            return await self.log(
                actor_type=ActorType.USER,
                actor_id=user_id,
                action=action,
                target_type=object_type,
                target_id=object_id,
                metadata=details,
            )
        except Exception as e:
            # Do not propagate logging failures to API callers
            await self.log_exception("audit.log_action", e)
            return None

    async def get_recent_admin_actions(self, limit: int = 20) -> List[AdminLog]:
        """Get recent admin actions for dashboard."""
        return await self.get_logs(limit=limit, actor_type=ActorType.ADMIN)

    async def log_exception(self, context: str, error: Exception):
        """Log an exception to Telegram."""
        import traceback

        try:
            timestamp = self._format_timestamp_ist()
            tb = traceback.format_exc()

            msg = (
                f"\u26a0\ufe0f *ORIX SYSTEM ERROR*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}`\n"
                f"\U0001f4cd {context}\n\n"
                f"\u274c *Error:* `{str(error)}`\n"
                f"```python\n{tb}\n```"
            )
            await self._send_to_head_admin(msg)
        except Exception:
            pass

    async def _send_telegram_log(self, text: str):
        """Send log to admin group (for reports/updates)."""
        await self._send_to_admin_group(text)

    async def _send_to_head_admin(self, text: str):
        """Send log to Head Admin's DM (for system logs)."""
        import httpx

        if not settings.telegram_bot_token or not settings.head_admin_id:
            return

        try:
            url = (
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
            )
            async with httpx.AsyncClient() as client:
                await client.post(
                    url,
                    json={
                        "chat_id": settings.head_admin_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
        except Exception as e:
            import logging

            logging.warning(f"Failed to send to Head Admin: {e}")

    async def _send_to_admin_group(self, text: str):
        """Send log to Admin Group (for reports)."""
        import httpx

        if not settings.telegram_bot_token or not settings.telegram_log_chat_id:
            return

        try:
            url = (
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
            )
            async with httpx.AsyncClient() as client:
                await client.post(
                    url,
                    json={
                        "chat_id": settings.telegram_log_chat_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
        except Exception as e:
            import logging

            logging.warning(f"Failed to send to Admin Group: {e}")

    async def _send_photo_to_head_admin(self, photo_url: str, caption: str):
        """Send photo with caption to Head Admin DM."""
        import httpx

        if not settings.telegram_bot_token or not settings.head_admin_id:
            return

        if not photo_url:
            await self._send_to_head_admin(caption)
            return

        try:
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendPhoto"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    json={
                        "chat_id": settings.head_admin_id,
                        "photo": photo_url,
                        "caption": caption,
                        "parse_mode": "Markdown",
                    },
                )
                if response.status_code != 200:
                    await self._send_to_head_admin(caption)
        except Exception:
            await self._send_to_head_admin(caption)

    async def _send_telegram_photo(self, photo_url: str, caption: str):
        """Send photo with caption to Head Admin (system logs with photos)."""
        await self._send_photo_to_head_admin(photo_url, caption)

    async def log_admin_action(
        self,
        admin_id: str,
        admin_email: str,
        action: str,
        target_type: str,
        target_id: str,
        reason: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
    ) -> AdminLog:
        """
        Log an admin action.

        SECURITY: All admin actions must be logged.
        """
        log_entry = await self.log(
            actor_type=ActorType.ADMIN,
            actor_id=admin_id,
            actor_email=admin_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_state=before_state,
            after_state=after_state,
            metadata={"reason": reason} if reason else None,
        )

        try:
            timestamp = self._format_timestamp_ist()

            msg = (
                f"\U0001f6e1\ufe0f *ORIX ADMIN ACTION*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}`\n"
                f"\U0001f464 *Admin:* {admin_email}\n"
                f"\u2699\ufe0f *Action:* `{action}`\n"
                f"\U0001f3af *Target:* `{target_type}` \u2192 `{target_id}`"
            )

            if reason:
                msg += f"\n\U0001f4dd *Reason:* {reason}"

            await self._send_telegram_log(msg)
        except Exception:
            pass

        return log_entry

    async def log_system_action(
        self,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AdminLog:
        """Log a system action (automated processes)."""
        return await self.log(
            actor_type=ActorType.SYSTEM,
            actor_id="system",
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata,
        )

    async def log_user_action(
        self,
        user_id: str,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AdminLog:
        """Log a security-relevant user action."""
        return await self.log(
            actor_type=ActorType.USER,
            actor_id=user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata,
        )

    async def get_logs(
        self,
        limit: int = 100,
        skip: int = 0,
        actor_type: Optional[ActorType] = None,
        action: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> List[AdminLog]:
        """
        Query audit logs with pagination.

        SECURITY: Only admins should have access to this.
        """
        db = get_db()

        query: Dict[str, Any] = {}

        if actor_type:
            query["actor_type"] = actor_type
        if action:
            query["action"] = {"$regex": action, "$options": "i"}
        if target_type:
            query["target_type"] = target_type
        if target_id:
            query["target_id"] = target_id
        if since:
            query["timestamp"] = {"$gte": since}

        cursor = db.admin_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)

        logs = []
        async for doc in cursor:
            logs.append(AdminLog(**doc))

        return logs

    async def get_logs_count(self) -> int:
        """Get total count of admin logs."""
        db = get_db()
        return await db.admin_logs.count_documents({})

    async def get_user_history(self, user_id: str, limit: int = 50) -> List[AdminLog]:
        """
        Get all logs related to a user (as actor or target).

        Useful for admin review of user history.
        """
        db = get_db()

        cursor = (
            db.admin_logs.find({"$or": [{"actor_id": user_id}, {"target_id": user_id}]})
            .sort("timestamp", -1)
            .limit(limit)
        )

        logs = []
        async for doc in cursor:
            logs.append(AdminLog(**doc))

        return logs

    async def log_matchmaking_event(self, event_type: str, details: Dict[str, Any]):
        """Log detailed matchmaking event to Telegram with premium styling."""
        try:
            timestamp = self._format_timestamp_ist()

            # Event-specific styling
            event_config = {
                "STARTED": ("match", "SEARCHING", "\U0001f50e"),
                "MATCH_FOUND": ("matched", "MATCH FOUND", "\U0001f91d"),
                "GROUP_CREATED": ("group", "NEW GROUP", "\U0001f465"),
                "NO_MATCH": ("warning", "NO MATCH", "\U0001f6ab"),
            }

            emoji_key, title, icon = event_config.get(
                event_type, ("car", event_type, "\U0001f697")
            )

            msg = self._format_header(emoji_key, f"ORIX {title}")
            msg += f"\n{self.EMOJI['time']} `{timestamp}`"

            # Format details with smart field rendering
            for key, value in details.items():
                if isinstance(value, datetime):
                    value = value.strftime("%H:%M")

                # Smart emoji selection based on field name
                field_emoji = ""
                if "user" in key.lower():
                    field_emoji = self.EMOJI["user"]
                elif "group" in key.lower():
                    field_emoji = self.EMOJI["group"]
                elif "from" in key.lower() or "to" in key.lower():
                    field_emoji = self.EMOJI["location"]
                elif "time" in key.lower():
                    field_emoji = self.EMOJI["time"]

                key_fmt = key.replace("_", " ").title()
                prefix = f"{field_emoji} " if field_emoji else "   \u2022 "
                msg += f"\n{prefix}{key_fmt}: `{value}`"

            await self._send_to_head_admin(msg)
        except Exception:
            pass

    async def log_chat_message(
        self, group_id: str, sender_id: str, sender_name: str, message: str
    ):
        """Log chat message to Telegram."""
        try:
            timestamp = self._format_timestamp_ist()
            msg = (
                f"\U0001f4ac *ORIX CHAT*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}` \u2022 Group `{group_id[:8]}...`\n\n"
                f"\U0001f464 *{sender_name}:*\n"
                f"_{message}_"
            )
            await self._send_to_head_admin(msg)
        except Exception:
            pass

    async def log_login_event(self, user_id: str, email: str, method: str):
        """Log user login."""
        try:
            timestamp = self._format_timestamp_ist()
            msg = (
                f"\U0001f511 *ORIX LOGIN*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}` \u2022 {method}\n"
                f"\U0001f4e7 {email}"
            )
            await self._send_to_head_admin(msg)
        except Exception:
            pass

    async def log_connection_event(self, user_id: str, status: str):
        """
        Log user online/offline status to Telegram with photo.
        status: 'online' or 'offline'

        Tracks session duration using Redis.
        """
        from app.database import get_redis
        from app.services.redis_service import RedisKeys

        try:
            timestamp = self._format_timestamp_ist()

            # Fetch user info
            display = user_id[:8] + "..."
            email = ""
            photo_url = ""
            try:
                db = get_db()
                user = await db.users.find_one({"user_id": user_id})
                if user:
                    display = user.get("display_name") or user.get("email", user_id[:8])
                    email = user.get("email", "")
                    raw_photo = user.get("photo_url", "")
                    photo_url = self._get_full_avatar_url(raw_photo)
            except Exception:
                pass

            # Track session duration
            duration_text = ""
            try:
                redis = get_redis()
                session_key = RedisKeys.user_session(user_id)

                if status == "online":
                    await redis.set(session_key, utc_now().isoformat(), ex=86400)
                else:
                    session_start_str = await redis.get(session_key)
                    if session_start_str:
                        session_start = datetime.fromisoformat(session_start_str)
                        duration = utc_now() - session_start

                        total_seconds = int(duration.total_seconds())
                        if total_seconds < 60:
                            duration_text = f"{total_seconds}s"
                        elif total_seconds < 3600:
                            mins = total_seconds // 60
                            secs = total_seconds % 60
                            duration_text = f"{mins}m {secs}s"
                        else:
                            hours = total_seconds // 3600
                            mins = (total_seconds % 3600) // 60
                            duration_text = f"{hours}h {mins}m"

                        await redis.delete(session_key)
            except Exception:
                pass

            # Build styled message
            if status == "online":
                header = "\U0001f7e2 *ORIX USER ONLINE*"
            else:
                header = "\U0001f534 *ORIX USER OFFLINE*"

            msg = (
                f"{header}\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}`\n\n"
                f"\U0001f464 *{display}*"
            )

            if email:
                msg += f"\n\U0001f4e7 `{email}`"
            if duration_text:
                msg += f"\n\u23f1\ufe0f Session: *{duration_text}*"

            # Send with photo if available
            if photo_url:
                await self._send_photo_to_head_admin(photo_url, msg)
            else:
                await self._send_to_head_admin(msg)
        except Exception:
            pass

    async def log_user_activity(
        self,
        user_id: str,
        action_type: str,
        screen: str,
        target: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Log user activity/action to Telegram.
        Tracks screen navigation, button taps, feature usage.
        """
        try:
            timestamp = self._format_timestamp_ist()

            display = user_id[:8] + "..."
            email = ""
            try:
                db = get_db()
                user = await db.users.find_one({"user_id": user_id})
                if user:
                    display = user.get("display_name") or user.get("email", user_id[:8])
                    email = user.get("email", "")
            except Exception:
                pass

            msg = (
                f"\U0001f4f1 *ORIX USER ACTION*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}` \u2022 {action_type}\n\n"
                f"\U0001f464 *{display}*"
            )
            if email:
                msg += f" (`{email}`)"
            msg += f"\n\U0001f4cd Screen: `{screen}`"
            if target:
                msg += f"\n\U0001f3af Target: `{target}`"
            if metadata:
                for k, v in metadata.items():
                    msg += f"\n\u2022 {k}: `{v}`"

            await self._send_to_head_admin(msg)

            await self.log(
                actor_type=ActorType.USER,
                actor_id=user_id,
                action=f"activity:{action_type}",
                metadata={"screen": screen, "target": target, **(metadata or {})},
            )
        except Exception:
            pass

    async def log_notification_sent(
        self,
        user_id: str,
        notification_type: str,
        title: str,
        body: str,
        notification_id: Optional[str] = None,
    ):
        """Log when a notification is sent to a user."""
        try:
            timestamp = self._format_timestamp_ist()

            display = user_id[:8] + "..."
            try:
                db = get_db()
                user = await db.users.find_one({"user_id": user_id})
                if user:
                    display = user.get("display_name") or user.get("email", user_id[:8])
            except Exception:
                pass

            msg = (
                f"\U0001f514 *ORIX NOTIFICATION*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}` \u2022 {notification_type}\n\n"
                f"\U0001f464 *To:* {display}\n"
                f"\U0001f4e2 *{title}*\n"
                f"_{body[:100]}{'...' if len(body) > 100 else ''}_"
            )

            await self._send_telegram_log(msg)
        except Exception:
            pass

    async def log_notification_received(
        self, user_id: str, notification_id: str, action: str = "received"
    ):
        """Log when user receives/opens/interacts with a notification."""
        try:
            timestamp = self._format_timestamp_ist()

            display = user_id[:8] + "..."
            try:
                db = get_db()
                user = await db.users.find_one({"user_id": user_id})
                if user:
                    display = user.get("display_name") or user.get("email", user_id[:8])
            except Exception:
                pass

            action_icon = {
                "received": "[NOTIF RECEIVED]",
                "opened": "[NOTIF OPENED]",
                "dismissed": "[NOTIF DISMISSED]",
                "clicked": "[NOTIF CLICKED]",
            }.get(action, "[NOTIF ACTION]")

            msg = (
                f"{action_icon}\n"
                f"`{timestamp}` | {action.upper()}\n"
                f"User: {display}\n"
                f"Notification: `{notification_id[:8]}`"
            )

            await self._send_telegram_log(msg)
        except Exception:
            pass

    async def log_ai_tool_execution(
        self,
        admin_id: int,
        admin_username: str,
        tool_name: str,
        params: dict,
        result: str,
        is_head_admin: bool = False,
    ):
        """Log AI tool execution to Telegram admin channel."""
        try:
            timestamp = self._format_timestamp_ist()

            role = "Head Admin" if is_head_admin else "Admin"
            params_str = (
                ", ".join(f"{k}={v}" for k, v in params.items()) if params else "none"
            )
            result_preview = result[:200] + "..." if len(result) > 200 else result

            msg = (
                f"\U0001f916 *ORIXY AI TOOL*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                f"\u23f0 `{timestamp}`\n"
                f"\U0001f464 *{role}:* @{admin_username} (`{admin_id}`)\n"
                f"\u2699\ufe0f *Tool:* `{tool_name}`\n"
                f"\U0001f4cb *Params:* `{params_str[:100]}`\n"
                f"\U0001f4e4 *Result:*\n`{result_preview}`"
            )

            # Send to all admin chat IDs
            await self._send_to_admin_chat_ids(msg)
        except Exception:
            pass

    async def _send_to_admin_chat_ids(self, text: str):
        """Send message to all admin chat IDs from .env."""
        import httpx

        if not settings.telegram_bot_token:
            return

        for chat_id in settings.admin_chat_ids_list:
            try:
                url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
                async with httpx.AsyncClient() as client:
                    await client.post(
                        url,
                        json={
                            "chat_id": chat_id,
                            "text": text,
                            "parse_mode": "Markdown",
                        },
                    )
            except Exception:
                pass

    async def log_client_bug(
        self,
        level: str,
        message: str,
        context: str,
        stack_trace: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Log client-side bug/error to Telegram with full details."""
        try:
            timestamp = self._format_timestamp_ist()

            level_tag = {
                "error": "[CLIENT ERROR]",
                "warning": "[CLIENT WARNING]",
                "info": "[CLIENT INFO]",
                "debug": "[CLIENT DEBUG]",
            }.get(level, "[CLIENT LOG]")

            user_info = "Anonymous"
            if user_email:
                user_info = f"{user_email}"
                if user_id:
                    user_info += f" ({user_id[:8]})"
            elif user_id:
                user_info = f"ID: {user_id[:8]}"

            msg = (
                f"{level_tag}\n"
                f"`{timestamp}` | {context}\n"
                f"User: {user_info}\n\n"
                f"Error: `{message}`"
            )

            if stack_trace:
                trace = stack_trace
                msg += f"\n```dart\n{trace}\n```"

            if metadata:
                msg += "\nMetadata:\n"
                for k, v in metadata.items():
                    msg += f"  {k}: `{v}`\n"

            await self._send_telegram_log(msg)

            await self.log(
                actor_type=ActorType.USER if user_id else ActorType.SYSTEM,
                actor_id=user_id or "anonymous",
                action=f"client_{level}",
                metadata={"context": context, "message": message, **(metadata or {})},
            )
        except Exception:
            pass
