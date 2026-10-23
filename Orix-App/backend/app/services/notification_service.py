"""
Notification Service - Push notifications via FCM and in-app
notification center.
"""

import uuid
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.models.notification import Notification, NotificationType
from app.utils.timezone_utils import utc_now


# =============================================================================
# FCM Configuration
# =============================================================================
# Firebase Cloud Messaging is configured through the Firebase Admin SDK.
# The same service account used for auth verification is used for FCM.
#
# TODO: Configure Firebase service account in .env to enable push
# notifications.
# =============================================================================


class NotificationService:
    """
    Notification service for push and in-app notifications.

    Supports:
    - FCM push notifications (requires Firebase Admin SDK)
    - In-app notification center stored in MongoDB
    """

    async def send_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        send_push: bool = True,
        high_priority: bool = False,
    ) -> Notification:
        """
        Send a notification to a user.

        Creates an in-app notification and optionally sends FCM push.
        high_priority: If True, sends as alarm-style notification
        """
        db = get_db()

        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=user_id,
            type=notification_type,
            title=title,
            body=body,
            data=data,
            read=False,
        )

        await db.notifications.insert_one(notification.model_dump())

        if send_push:
            await self._send_fcm_push(
                user_id, title, body, data, high_priority=high_priority
            )

        from app.services.audit_service import AuditService

        audit = AuditService()
        notif_type = (
            notification_type.value
            if hasattr(notification_type, "value")
            else str(notification_type)
        )
        await audit.log_notification_sent(
            user_id=user_id,
            notification_type=notif_type,
            title=title,
            body=body,
            notification_id=notification.notification_id,
        )

        return notification

    async def _send_fcm_topic(
        self, topic: str, title: str, body: str, data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send FCM push notification to a topic.
        """
        try:
            from firebase_admin import messaging

            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={str(k): str(v) for k, v in (data or {}).items()},
                topic=topic,
            )

            result = messaging.send(message)
            print(
                f"[FCM] Topic push sent to '{topic}': {title} "
                f"(message_id: {result})"
            )
            return True

        except ImportError:
            print("[FCM] Firebase Admin SDK not configured for topic push")
            return False
        except Exception as e:
            print(f"[FCM] Topic push to '{topic}' failed: {e}")
            return False

    async def _send_fcm_push(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        high_priority: bool = False,
    ) -> bool:
        """
        Send FCM push notification.

        SECURITY: FCM credentials are loaded from Firebase Admin SDK.
        """
        try:
            from firebase_admin import messaging

            db = get_db()
            user = await db.users.find_one({"user_id": user_id})

            if not user:
                print(f"[FCM] User {user_id} not found in database")
                return False

            if not user.get("fcm_token"):
                print(f"[FCM] User {user_id} has no FCM token registered")
                return False

            # Configure Android for high priority alarm
            android_config = None
            if high_priority:
                # Check if custom sound is requested in data
                sound_uri = None
                if data and data.get("sound") == "ringtone":
                    # Use device's default ringtone
                    sound_uri = "android.resource://android/raw/ringtone"

                android_notification = messaging.AndroidNotification(
                    channel_id="ride_alarm_channel",
                    priority="max",
                    default_sound=True,
                    default_vibrate_timings=True,
                )

                # Set custom sound if requested
                if sound_uri:
                    android_notification.sound = sound_uri

                android_config = messaging.AndroidConfig(
                    priority="high",
                    notification=android_notification,
                )

            # For RIDE_ALARM type, send DATA-ONLY message (no notification payload)
            # This ensures background handler runs and can trigger full-screen alarm
            is_alarm = data and data.get("type") == "RIDE_ALARM"

            if is_alarm:
                message = messaging.Message(
                    data={str(k): str(v) for k, v in (data or {}).items()},
                    token=user["fcm_token"],
                    android=android_config,
                )
            else:
                message = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data={str(k): str(v) for k, v in (data or {}).items()},
                    token=user["fcm_token"],
                    android=android_config,
                )

            result = messaging.send(message)
            print(f"[FCM] Push sent to {user_id}: {title} " f"(message_id: {result})")
            return True

        except ImportError:
            print("[FCM] Firebase Admin SDK not configured")
            return False
        except Exception as e:
            print(f"[FCM] Push failed for {user_id}: {e}")
            return False

    async def get_notifications(
        self, user_id: str, limit: int = 50, unread_only: bool = False
    ) -> List[Notification]:
        """Get user's notifications."""
        db = get_db()

        query = {"user_id": user_id}
        if unread_only:
            query["read"] = False

        cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)

        notifications = []
        async for doc in cursor:
            notifications.append(Notification(**doc))

        return notifications

    async def get_unread_count(self, user_id: str) -> int:
        """Get count of unread notifications."""
        db = get_db()
        return await db.notifications.count_documents(
            {"user_id": user_id, "read": False}
        )

    async def mark_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        db = get_db()

        result = await db.notifications.update_one(
            {"notification_id": notification_id, "user_id": user_id},
            {"$set": {"read": True}},
        )

        return result.modified_count > 0

    async def delete_all_notifications(self, user_id: str) -> int:
        """Delete all notifications for a user."""
        db = get_db()

        result = await db.notifications.delete_many({"user_id": user_id})
        return result.deleted_count

    async def mark_all_read(self, user_id: str) -> int:
        """Mark all notifications as read. Returns count marked."""
        db = get_db()

        result = await db.notifications.update_many(
            {"user_id": user_id, "read": False}, {"$set": {"read": True}}
        )

        return result.modified_count

    # =========================================================================
    # Notification Templates - Using randomized variants
    # =========================================================================

    async def notify_match_found(
        self, user_id: str, group_id: str, route_summary: str
    ) -> Notification:
        """Notify user that a match was found."""
        from app.services.notification_content import (
            MATCH_FOUND_TITLES,
            MATCH_FOUND_BODIES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.MATCH_FOUND,
            title=pick(MATCH_FOUND_TITLES),
            body=pick(MATCH_FOUND_BODIES),
            data={"group_id": group_id, "action": "view_group"},
        )

    async def notify_readiness_request(
        self, user_id: str, group_id: str, deadline_minutes: int
    ) -> Notification:
        """Notify user to confirm readiness."""
        from app.services.notification_content import (
            READINESS_REQUEST_TITLES,
            READINESS_REQUEST_BODIES,
            pick,
        )

        body = pick(READINESS_REQUEST_BODIES).replace(
            "{minutes}", str(deadline_minutes)
        )
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.READINESS_REQUEST,
            title=pick(READINESS_REQUEST_TITLES),
            body=body,
            data={"group_id": group_id, "action": "confirm_readiness"},
        )

    async def notify_readiness_confirmed(
        self, user_id: str, group_id: str, remaining_members: int
    ) -> Notification:
        """Notify user that their readiness has been confirmed."""
        from app.services.notification_content import (
            READINESS_CONFIRMED_TITLES,
            READINESS_CONFIRMED_BODIES,
            pick,
        )

        body = pick(READINESS_CONFIRMED_BODIES).replace(
            "{remaining}", str(remaining_members)
        )
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.READINESS_CONFIRMED,
            title=pick(READINESS_CONFIRMED_TITLES),
            body=body,
            data={"group_id": group_id, "action": "view_group"},
        )

    async def notify_group_finalized(self, user_id: str, group_id: str) -> Notification:
        """Notify user that group is finalized."""
        from app.services.notification_content import (
            GROUP_CONFIRMED_TITLES,
            GROUP_CONFIRMED_BODIES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.GROUP_FINALIZED,
            title=pick(GROUP_CONFIRMED_TITLES),
            body=pick(GROUP_CONFIRMED_BODIES),
            data={"group_id": group_id, "action": "view_group"},
        )

    async def notify_group_cancelled(
        self, user_id: str, group_id: str, reason: str
    ) -> Notification:
        """Notify user that group was cancelled."""
        from app.services.notification_content import (
            GROUP_CANCELLED_TITLES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.GROUP_CANCELLED,
            title=pick(GROUP_CANCELLED_TITLES),
            body=reason,
            data={"group_id": group_id},
        )

    async def notify_match_expired(self, user_id: str, request_id: str) -> Notification:
        """Notify user that match expired without finding a group."""
        from app.services.notification_content import (
            MATCH_EXPIRED_TITLES,
            MATCH_EXPIRED_BODIES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.MATCH_EXPIRED,
            title=pick(MATCH_EXPIRED_TITLES),
            body=pick(MATCH_EXPIRED_BODIES),
            data={"request_id": request_id, "action": "create_ride"},
        )

    async def notify_report_action(
        self, user_id: str, action: str, reason: Optional[str] = None
    ) -> Notification:
        """Notify user about action taken on a report about them."""
        body = f"Action taken: {action}"
        if reason:
            body += f". Reason: {reason}"

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.REPORT_ACTION,
            title="Account Notice",
            body=body,
            data={"action": action},
        )

    async def notify_suspension(
        self, user_id: str, hours: int, reason: str
    ) -> Notification:
        """Notify user of account suspension."""
        from app.routers.websocket import notify_account_status
        from app.services.notification_content import (
            SUSPENSION_TITLE,
            SUSPENSION_BODY,
        )

        await notify_account_status(user_id, "suspended", reason)

        body = SUSPENSION_BODY.replace("{hours}", str(hours)).replace(
            "{reason}", reason
        )
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.SUSPENSION,
            title=SUSPENSION_TITLE,
            body=body,
            data={"duration_hours": hours},
            send_push=True,
        )

    async def notify_ban(self, user_id: str, reason: str) -> Notification:
        """Notify user of account ban."""
        from app.routers.websocket import notify_account_status
        from app.services.notification_content import BAN_TITLE, BAN_BODY

        await notify_account_status(user_id, "banned", reason)

        body = BAN_BODY.replace("{reason}", reason)
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.BAN,
            title=BAN_TITLE,
            body=body,
            data={},
            send_push=True,
        )

    async def broadcast_random_promotion(self) -> bool:
        """Send a random promotion to all subscribed users.

        Checks promo_config for:
        - enabled: Whether promos are active
        - custom_messages: Additional messages to include in random
          selection
        """
        import random
        from app.services.notification_content import (
            PROMO_VERSES,
            PROMO_TITLES,
            pick,
        )

        db = get_db()

        # Check if promos are enabled
        config = await db.promo_config.find_one({"_id": "promo_settings"})
        if config and not config.get("enabled", True):
            print("[Promo] Promotional notifications are disabled")
            return False

        # Build message pool from defaults + custom
        titles = list(PROMO_TITLES)
        bodies = list(PROMO_VERSES)

        custom_messages = config.get("custom_messages", []) if config else []

        # If custom messages exist, randomly choose default or custom
        if custom_messages and random.random() < 0.4:
            custom = random.choice(custom_messages)
            title = custom.get("title", pick(titles))
            body = custom.get("body", pick(bodies))
        else:
            title = pick(titles)
            body = pick(bodies)

        result = await self._send_fcm_topic(
            topic="promotions", title=title, body=body, data={"action": "open_home"}
        )

        # Update last_sent_at
        if result:
            await db.promo_config.update_one(
                {"_id": "promo_settings"},
                {"$set": {"last_sent_at": utc_now()}},
                upsert=True,
            )

        return result

    async def broadcast_to_all_users(self, title: str, message: str) -> int:
        """
        Broadcast a custom message to all users with FCM tokens.

        Returns the count of successfully sent notifications.
        Automatically removes invalid/expired FCM tokens.
        """
        db = get_db()

        cursor = db.users.find(
            {"fcm_token": {"$exists": True, "$ne": None}},
            {"user_id": 1, "fcm_token": 1},
        )

        success_count = 0
        invalid_tokens = []

        try:
            from firebase_admin import messaging
            from firebase_admin.exceptions import NotFoundError

            async for user in cursor:
                try:
                    msg = messaging.Message(
                        notification=messaging.Notification(title=title, body=message),
                        data={"type": "broadcast", "action": "open_home"},
                        token=user["fcm_token"],
                    )

                    messaging.send(msg)
                    success_count += 1
                except NotFoundError:
                    # Token is invalid/expired - mark for cleanup
                    invalid_tokens.append(user["user_id"])
                    print(
                        f"[FCM] Invalid token for user {
                            user['user_id']} - will clean up"
                    )
                except Exception as e:
                    if "not found" in str(e).lower() or "not a valid FCM" in str(e):
                        invalid_tokens.append(user["user_id"])
                        print(
                            f"[FCM] Invalid token for user {
                                user['user_id']} - will clean up"
                        )
                    else:
                        print(
                            f"[FCM] Broadcast failed for user {
                                user['user_id']}: {e}"
                        )

            # Clean up invalid tokens
            if invalid_tokens:
                await db.users.update_many(
                    {"user_id": {"$in": invalid_tokens}}, {"$unset": {"fcm_token": ""}}
                )
                print(f"[FCM] Cleaned up {len(invalid_tokens)} invalid tokens")

            print(f"[FCM] Broadcast sent to {success_count} users")
            return success_count

        except ImportError:
            print("[FCM] Firebase Admin SDK not configured for broadcast")
            return 0
        except Exception as e:
            print(f"[FCM] Broadcast error: {e}")
            return success_count

    async def notify_member_joined(
        self, user_id: str, group_id: str, member_name: str
    ) -> Notification:
        """Notify that someone joined the group."""
        from app.services.notification_content import (
            MEMBER_JOINED_TITLES,
            MEMBER_JOINED_BODIES,
            pick,
        )

        body = pick(MEMBER_JOINED_BODIES).replace("{name}", member_name)
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.MEMBER_JOINED,
            title=pick(MEMBER_JOINED_TITLES),
            body=body,
            data={"group_id": group_id, "action": "view_group"},
        )

    async def notify_chat_message(
        self, user_id: str, group_id: str, sender_name: str, message_preview: str
    ) -> Notification:
        """Notify of a new chat message."""
        from app.services.notification_content import CHAT_MESSAGE_TITLES, pick

        title = pick(CHAT_MESSAGE_TITLES).replace("{sender}", sender_name)
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.CHAT_MESSAGE,
            title=title,
            body=message_preview,
            data={"group_id": group_id, "action": "view_chat"},
        )

    async def notify_ride_start_warning(
        self, user_id: str, group_id: str, minutes_remaining: int
    ) -> Notification:
        """Notify that ride is starting soon - sends as alarm notification."""
        from app.services.notification_content import (
            RIDE_REMINDER_TITLES,
            RIDE_REMINDER_BODIES,
            pick,
        )

        body = pick(RIDE_REMINDER_BODIES).replace("{minutes}", str(minutes_remaining))
        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.RIDE_START_WARNING,
            title=pick(RIDE_REMINDER_TITLES),
            body=body,
            data={
                "group_id": group_id,
                "action": "view_group",
                "type": "ride_reminder",
            },
            high_priority=True,
        )

    async def notify_group_found(self, user_id: str, group_id: str) -> Notification:
        """Notify that a group has been found (merged/matched)."""
        from app.services.notification_content import (
            GROUP_FOUND_TITLES,
            GROUP_FOUND_BODIES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.GROUP_FOUND,
            title=pick(GROUP_FOUND_TITLES),
            body=pick(GROUP_FOUND_BODIES),
            data={"group_id": group_id, "action": "view_group"},
        )

    async def notify_group_accepted(self, user_id: str, group_id: str) -> Notification:
        """Notify that group is accepted/confirmed."""
        from app.services.notification_content import (
            GROUP_CONFIRMED_TITLES,
            GROUP_CONFIRMED_BODIES,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.GROUP_ACCEPTED,
            title=pick(GROUP_CONFIRMED_TITLES),
            body=pick(GROUP_CONFIRMED_BODIES),
            data={"group_id": group_id, "action": "view_group"},
        )

    # =========================================================================
    # Matchmaking Notifications
    # =========================================================================

    async def notify_matchmaking_started(
        self, user_id: str, request_id: str, route_summary: str
    ) -> Notification:
        """Notify user that matchmaking has started."""
        from app.services.notification_content import (
            MATCHMAKING_SEARCHING,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="Searching for Rides",
            body=pick(MATCHMAKING_SEARCHING),
            data={"request_id": request_id, "action": "view_matching"},
        )

    async def notify_matchmaking_reminder(
        self, user_id: str, request_id: str
    ) -> Notification:
        """Send a friendly reminder during matchmaking."""
        from app.services.notification_content import (
            MATCHMAKING_STILL_SEARCHING,
            pick,
        )

        return await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="Still Searching",
            body=pick(MATCHMAKING_STILL_SEARCHING),
            data={"request_id": request_id, "action": "view_matching"},
        )

    async def notify_catch_your_ride(
        self, user_id: str, group_id: str, ride_time: str, pickup_summary: str
    ) -> Notification:
        """
        Send DATA-ONLY alarm notification when it's time to catch the ride.

        Uses data-only payload so Flutter can trigger full-screen alarm UI
        via local notification with full-screen intent.
        """
        # Store in database
        notification = await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="🔔 Catch Your Ride!",
            body=f"Your ride starts at {ride_time}. Head to {pickup_summary} now!",
            data={
                "type": "RIDE_ALARM",
                "group_id": group_id,
                "ride_time": ride_time,
                "pickup_summary": pickup_summary,
                "action": "show_alarm",
            },
            send_push=True,
            high_priority=True,
        )

        return notification

    async def notify_rating_request(
        self, user_id: str, group_id: str, other_members: List[str]
    ) -> Notification:
        """
        Send notification requesting ride rating after group completion.
        Uses NotificationTracker to prevent duplicate rating requests.
        """
        from app.services.notification_tracker import get_notification_tracker
        from app.services.notification_content import (
            RIDE_COMPLETED_TITLES,
            RIDE_COMPLETED_BODIES,
            pick,
        )

        tracker = get_notification_tracker()
        notif_type = "rating_request"

        # Check if rating notification already sent in the last 24 hours
        already_sent = await tracker.was_sent(notif_type, group_id, user_id)
        if already_sent:
            logger.debug(
                f"Skipping duplicate rating notification for user {user_id} in group {group_id}"
            )
            return None

        # Send notification with random title/body
        result = await self.send_notification(
            user_id=user_id,
            notification_type=NotificationType.RIDE_COMPLETED,
            title=pick(RIDE_COMPLETED_TITLES),
            body=pick(RIDE_COMPLETED_BODIES),
            data={
                "group_id": group_id,
                "action": "show_rating",
                "other_members": ",".join(other_members) if other_members else "",
            },
            send_push=True,
            high_priority=True,
        )

        # Mark as sent with 24-hour TTL
        await tracker.mark_sent(notif_type, group_id, user_id, ttl_hours=24)

        return result
