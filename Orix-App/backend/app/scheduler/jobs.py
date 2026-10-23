"""
Scheduled Jobs for ORIX Backend

Industry-standard scheduled job implementations with:
- Proper error handling and logging
- Job status tracking
- Graceful failure recovery
- Performance monitoring
"""

import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.database import get_db
from app.utils.timezone_utils import utc_now, parse_local_to_utc
from app.services.notification_service import NotificationService
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class ScheduledJob:
    """Base class for scheduled jobs with error handling and logging."""

    def __init__(self, name: str):
        self.name = name
        self.execution_count = 0
        self.failure_count = 0
        self.last_execution = None
        self.last_error = None

    async def execute(self):
        """Execute the job with error handling and metrics."""
        self.execution_count += 1
        start_time = utc_now()

        try:
            logger.info(f"[{self.name}] Starting execution #{self.execution_count}")
            await self._run()
            self.last_execution = utc_now()
            duration = (self.last_execution - start_time).total_seconds()
            logger.info(f"[{self.name}] Completed successfully in {duration:.2f}s")

        except Exception as e:
            self.failure_count += 1
            self.last_error = str(e)
            logger.error(f"[{self.name}] Failed: {e}", exc_info=True)

            # Alert on repeated failures
            if self.failure_count >= 3:
                await self._alert_failure(e)

    async def _run(self):
        """Override this method in subclasses."""
        raise NotImplementedError

    async def _alert_failure(self, error: Exception):
        """Alert admins about repeated job failures."""
        try:
            # Send alert via notification service
            logger.critical(
                f"[{self.name}] CRITICAL: Failed {self.failure_count} times. "
                f"Last error: {error}"
            )
        except Exception:
            pass  # Don't let alert failure crash the job


class HealthCheckJob(ScheduledJob):
    """
    Keep-alive job to prevent service sleep on platforms like Render.

    Industry Pattern: Health check ping
    Frequency: Every 10 minutes
    Purpose: Keep the service warm and responsive
    """

    def __init__(self):
        super().__init__("HealthCheck")

    async def _run(self):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"{settings.api_base_url}/health"
                if settings.telegram_webhook_url:
                    url = f"{settings.telegram_webhook_url}/health"

                response = await client.get(url)
                response.raise_for_status()
                logger.debug(
                    f"[{self.name}] Pinged {url} - Status: {response.status_code}"
                )

        except httpx.TimeoutException:
            logger.warning(f"[{self.name}] Health check timeout")
        except Exception as e:
            # Log but don't fail - health checks are non-critical
            logger.warning(f"[{self.name}] Health check error: {e}")


class RideReminderJob(ScheduledJob):
    """
    Send reminders for upcoming rides.

    Industry Pattern: User engagement notifications
    Frequency: Every 5 minutes
    Purpose: Improve user experience and reduce no-shows
    """

    def __init__(self):
        super().__init__("RideReminder")

    async def _run(self):
        from app.services.ride_reminder_service import check_and_send_ride_reminders

        try:
            await check_and_send_ride_reminders()
        except Exception as e:
            logger.error(f"[{self.name}] Error sending reminders: {e}")
            raise


class RideAlarmJob(ScheduledJob):
    """
    Send alarm notifications when it's time to catch the ride.

    Industry Pattern: Time-critical user notifications
    Frequency: Every 1 minute
    Purpose: Alert users to be at pickup location

    NOTE: This is now redundant with ride_reminder_service 0-minute reminder.
    Kept for backwards compatibility but should be removed in future.
    """

    def __init__(self):
        super().__init__("RideAlarm")
        self.notification_service = NotificationService()

    async def _run(self):
        from app.services.notification_tracker import get_notification_tracker

        db = get_db()
        tracker = get_notification_tracker()
        now = utc_now()

        # Find all pending/active/confirming groups where ride time is NOW (within 2 minute tolerance)
        # FIXED: Include 'pending' status groups that show "All Ready!" in UI
        active_groups = await db.ride_groups.find(
            {"status": {"$in": ["pending", "active", "confirming"]}}
        ).to_list(1000)

        for group in active_groups:
            try:
                await self._check_and_send_alarm(db, tracker, group, now)
            except Exception as e:
                logger.error(
                    f"[{self.name}] Error processing group {group.get('group_id')}: {e}"
                )

    async def _check_and_send_alarm(self, db, tracker, group: dict, now):
        """Check if alarm notification should be sent for this group.

        Also auto-completes the group when ride time is reached.
        """
        time_window = group.get("time_window")
        if not time_window or not time_window.get("start"):
            return

        ride_date = group.get("date")
        if not ride_date:
            return

        tz_offset = group.get("timezone_offset_minutes")
        if tz_offset is None:
            return

        start_time_str = time_window["start"]

        try:
            ride_datetime_utc = parse_local_to_utc(ride_date, start_time_str, tz_offset)
        except (ValueError, TypeError):
            return

        # Calculate time until ride start
        time_until_ride = (ride_datetime_utc - now).total_seconds()
        group_id = group["group_id"]
        notif_type = "ride_alarm"

        # Send alarm 5 minutes before ride start time (within a 2-minute window to avoid missing it)
        # Alarm window: 7 minutes before to 5 minutes before ride start
        alarm_time_seconds = time_until_ride - 300  # 5 minutes before in seconds

        if -120 <= alarm_time_seconds <= 120:  # Within 2 minutes of alarm time
            # Send alarm to all members (with deduplication)
            for member in group.get("members", []):
                user_id = member.get("user_id")
                if not user_id:
                    continue

                # Check if already sent (prevents spam on restart/multiple runs)
                already_sent = await tracker.was_sent(notif_type, group_id, user_id)
                if already_sent:
                    continue

                try:
                    await self.notification_service.notify_catch_your_ride(
                        user_id=user_id,
                        group_id=group_id,
                        ride_time=start_time_str,
                        pickup_summary=group.get("pickup_summary", ""),
                    )

                    # Mark as sent (2-hour TTL)
                    await tracker.mark_sent(notif_type, group_id, user_id, ttl_hours=2)

                    logger.info(
                        f"[{self.name}] Sent alarm to {user_id} for group {group_id}"
                    )
                except Exception as e:
                    logger.error(
                        f"[{self.name}] Failed to send alarm to {user_id}: {e}"
                    )

        # Auto-complete group when ride start time has passed
        # This ensures the group is marked completed at the actual ride start time
        if time_until_ride <= 0:
            try:
                result = await db.ride_groups.find_one_and_update(
                    {
                        "group_id": group_id,
                        "status": {"$in": ["pending", "active", "confirming"]},
                    },
                    {
                        "$set": {
                            "status": "completed",
                            "completed_at": now,
                        }
                    },
                    return_document=True,
                )

                if result:
                    logger.info(f"[{self.name}] Auto-completed group {group_id}")

                    # Send rating notifications to all members
                    try:
                        from app.services.group_service import GroupService

                        group_service = GroupService()
                        await group_service._send_rating_notifications(result)
                    except Exception as e:
                        logger.error(
                            f"[{self.name}] Failed to send rating notifications for "
                            f"group {group_id}: {e}"
                        )
            except Exception as e:
                logger.error(
                    f"[{self.name}] Failed to auto-complete group {group_id}: {e}"
                )


class PromotionalNotificationJob(ScheduledJob):
    """
    Send promotional notifications to users.

    Industry Pattern: Marketing automation
    Frequency: Every 30 minutes (configurable)
    Purpose: User engagement and feature discovery
    """

    def __init__(self):
        super().__init__("PromotionalNotification")

    async def _run(self):
        db = get_db()

        # Check if promos are enabled
        config = await db.promo_config.find_one({"_id": "promo_settings"})
        if config and not config.get("enabled", True):
            logger.debug(f"[{self.name}] Skipped - disabled in config")
            return

        # Rate limiting check
        interval_hours = config.get("interval_hours", 1) if config else 1
        last_sent = config.get("last_sent_at") if config else None

        if last_sent:
            # Ensure timezone-aware
            if last_sent.tzinfo is None:
                from datetime import timezone

                last_sent = last_sent.replace(tzinfo=timezone.utc)

            next_send_time = last_sent + timedelta(hours=interval_hours)
            if utc_now() < next_send_time:
                logger.debug(f"[{self.name}] Skipped - next send at {next_send_time}")
                return

        logger.info(f"[{self.name}] Executing (interval: {interval_hours}h)")
        # Add promotional notification logic here


class DataCleanupJob(ScheduledJob):
    """
    Clean up expired data and maintain database health.

    Industry Pattern: Data retention and cleanup
    Frequency: Every 5 minutes
    Purpose: Maintain database performance and data consistency
    """

    def __init__(self):
        super().__init__("DataCleanup")
        self.notification_service = NotificationService()

    async def _run(self):
        db = get_db()
        now = utc_now()

        # Metrics
        stats = {
            "expired_requests": 0,
            "expired_groups": 0,
            "completed_groups": 0,
            "deleted_groups": 0,
        }

        # 1. Expire old ride groups
        result = await db.ride_groups.update_many(
            {
                "expires_at": {"$lte": now},
                "status": {"$nin": ["completed", "cancelled", "expired"]},
            },
            {"$set": {"status": "expired"}},
        )
        stats["expired_groups"] = result.modified_count

        # 2. Expire old ride requests
        result = await db.ride_requests.update_many(
            {
                "expires_at": {"$lte": now},
                "status": {"$in": ["pending", "matching"]},
            },
            {"$set": {"status": "expired"}},
        )
        stats["expired_requests"] = result.modified_count

        # 3. Expire requests with past dates
        today_str = now.strftime("%Y-%m-%d")
        current_time_str = now.strftime("%H:%M")

        result = await db.ride_requests.update_many(
            {
                "status": {"$in": ["pending", "matching"]},
                "$or": [
                    {"date": {"$lt": today_str}},
                    {
                        "date": today_str,
                        "time_window.start": {"$lt": current_time_str},
                    },
                ],
            },
            {"$set": {"status": "expired"}},
        )
        stats["expired_requests"] += result.modified_count

        # 4. Delete expired ride requests older than 1 hour
        expired_cutoff = now - timedelta(hours=1)
        result = await db.ride_requests.delete_many(
            {"status": "expired", "expires_at": {"$lt": expired_cutoff}}
        )
        if result.deleted_count > 0:
            logger.info(
                f"[{self.name}] Deleted {result.deleted_count} old expired requests"
            )

        # 5. Auto-complete any overdue groups (fallback if RideAlarm missed)
        overdue_groups = await db.ride_groups.find(
            {"status": {"$in": ["pending", "active", "confirming"]}}
        ).to_list(1000)

        for group in overdue_groups:
            try:
                completed = await self._auto_complete_if_due(db, group, now)
                if completed:
                    stats["completed_groups"] += 1
            except Exception as e:
                logger.error(
                    f"[{self.name}] Error auto-completing group "
                    f"{group.get('group_id')}: {e}"
                )

        # 5. Delete completed groups outside the retention window
        # Groups are auto-completed by RideAlarmJob when ride time reaches
        completed_groups = await db.ride_groups.find({"status": "completed"}).to_list(
            1000
        )

        for group in completed_groups:
            try:
                await self._check_group_for_deletion(db, group, now, stats)
            except Exception as e:
                logger.error(
                    f"[{self.name}] Error processing completed group "
                    f"{group.get('group_id')}: {e}"
                )

        # Log summary if any changes
        if any(stats.values()):
            logger.info(
                f"[{self.name}] Cleanup summary: "
                f"expired_requests={stats['expired_requests']}, "
                f"expired_groups={stats['expired_groups']}, "
                f"completed={stats['completed_groups']}, "
                f"deleted={stats['deleted_groups']}"
            )

    async def _check_group_for_deletion(self, db, group: dict, now, stats: dict):
        """Check if a completed group should be deleted (retention window).

        We keep completed groups for 12 hours to allow ratings and history
        views. Deletion time is calculated from:
        1. completed_at field if available (preferred)
        2. ride start time if available
        3. skip deletion if timestamps are missing

        Additionally, groups with 0 or 1 member are immediately deleted
        regardless of retention window.
        """
        group_id = group.get("group_id")
        retention_hours = 12

        # Check if group has too few members (0 or 1) - delete immediately
        members = group.get("members", [])
        if len(members) <= 1:
            result = await db.ride_groups.delete_one({"group_id": group_id})
            if result.deleted_count > 0:
                stats["deleted_groups"] += 1
                logger.info(
                    f"[{self.name}] Deleted completed group {group_id} "
                    f"with {len(members)} member(s)"
                )
            return

        # If we have an explicit expires_at on the group and it's passed,
        # mark the group expired and delete it immediately. This ensures
        # completed groups with lingering members are cleared without manual
        # intervention.
        expires_at = group.get("expires_at")
        if expires_at:
            try:
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
            except Exception:
                expires_at = None

            if expires_at and expires_at <= now:
                await db.ride_groups.update_one(
                    {"group_id": group_id}, {"$set": {"status": "expired"}}
                )
                result = await db.ride_groups.delete_one({"group_id": group_id})
                if result.deleted_count > 0:
                    stats["deleted_groups"] += 1
                    logger.info(
                        f"[{self.name}] Deleted expired completed group {group_id}"
                    )
                return

        # Try to get deletion time from completed_at first
        completed_at = group.get("completed_at")
        if completed_at:
            # Normalize to aware UTC
            if isinstance(completed_at, str):
                try:
                    from datetime import datetime

                    completed_at = datetime.fromisoformat(completed_at)
                except ValueError:
                    completed_at = None

            if completed_at and completed_at.tzinfo is None:
                from datetime import timezone

                completed_at = completed_at.replace(tzinfo=timezone.utc)

            if completed_at:
                deletion_time = completed_at + timedelta(hours=retention_hours)
                # If still within retention window, keep the group
                if now < deletion_time:
                    return
                if now >= deletion_time:
                    result = await db.ride_groups.delete_one({"group_id": group_id})
                    if result.deleted_count > 0:
                        stats["deleted_groups"] += 1
                        logger.info(f"[{self.name}] Deleted completed group {group_id}")
                    return

        # Fallback: calculate from ride start time
        time_window = group.get("time_window")
        if not time_window or not time_window.get("start"):
            return

        ride_date = group.get("date")
        if not ride_date:
            return

        tz_offset = group.get("timezone_offset_minutes")
        if tz_offset is None:
            return

        start_time_str = time_window["start"]

        try:
            ride_datetime_utc = parse_local_to_utc(ride_date, start_time_str, tz_offset)
        except (ValueError, TypeError):
            return

        # Delete if retention window has passed since ride start time
        deletion_time = ride_datetime_utc + timedelta(hours=retention_hours)
        if now < deletion_time:
            return

        if now >= deletion_time:
            result = await db.ride_groups.delete_one({"group_id": group_id})
            if result.deleted_count > 0:
                stats["deleted_groups"] += 1
                logger.info(
                    f"[{self.name}] Deleted completed group {group_id} after {retention_hours} hours"
                )

    async def _auto_complete_if_due(self, db, group: dict, now):
        """Auto-complete groups whose ride start time has passed.

        This is a fallback for cases where RideAlarmJob didn't run in time
        (e.g., scheduler downtime). Works for pending/active/confirming groups.
        Returns True if the group was transitioned to completed.
        """

        time_window = group.get("time_window")
        if not time_window or not time_window.get("start"):
            return False

        ride_date = group.get("date")
        if not ride_date:
            return False

        tz_offset = group.get("timezone_offset_minutes")
        if tz_offset is None:
            return False

        start_time_str = time_window.get("start")

        try:
            ride_datetime_utc = parse_local_to_utc(ride_date, start_time_str, tz_offset)
        except (ValueError, TypeError):
            return False

        if ride_datetime_utc > now:
            return False

        group_id = group.get("group_id")
        try:
            result = await db.ride_groups.find_one_and_update(
                {
                    "group_id": group_id,
                    "status": {"$in": ["pending", "active", "confirming"]},
                },
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": now,
                    }
                },
                return_document=True,
            )

            if result:
                logger.info(f"[{self.name}] Fallback auto-completed group {group_id}")

                try:
                    from app.services.group_service import GroupService

                    group_service = GroupService()
                    await group_service._send_rating_notifications(result)
                except Exception as e:
                    logger.error(
                        f"[{self.name}] Failed to send rating notifications for "
                        f"group {group_id}: {e}"
                    )
                return True
        except Exception as e:
            logger.error(
                f"[{self.name}] Failed fallback auto-complete for group {group_id}: {e}"
            )

        return False

    async def _send_rating_notifications(self, group: dict):
        """Send rating notifications to group members."""
        db = get_db()
        members = group.get("members", [])

        for member in members:
            try:
                user = await db.users.find_one({"user_id": member["user_id"]})
                if user and user.get("fcm_token"):
                    from app.models.notification import NotificationType

                    await self.notification_service.send_notification(
                        user_id=member["user_id"],
                        notification_type=NotificationType.RIDE_COMPLETED,
                        title="Rate Your Ride! ⭐",
                        body="How was your ride? Rate your fellow travelers!",
                        data={
                            "type": "ride_completed",
                            "group_id": group["group_id"],
                            "action": "rate",
                        },
                        high_priority=True,
                    )
            except Exception as e:
                logger.warning(f"Failed to send rating notification: {e}")

    async def _delete_old_completed_group(self, db, group: dict, now, stats: dict):
        """Delete old completed groups based on retention policy."""
        time_window = group.get("time_window")
        if not time_window or not time_window.get("start"):
            return

        ride_date = group.get("date")
        if not ride_date:
            return

        tz_offset = group.get("timezone_offset_minutes")
        if tz_offset is None:
            return

        start_time_str = time_window["start"]
        try:
            ride_datetime_utc = parse_local_to_utc(ride_date, start_time_str, tz_offset)
        except ValueError:
            return

        # Retention policy: 5 min for confirming, 1 hour for active
        was_confirming = group.get("was_confirming", False)
        deletion_delay = timedelta(minutes=5) if was_confirming else timedelta(hours=1)
        expiration_time = ride_datetime_utc + deletion_delay

        if now > expiration_time:
            await db.ride_groups.delete_one({"group_id": group["group_id"]})
            stats["deleted_groups"] += 1
            logger.debug(f"[{self.name}] Deleted completed group {group['group_id']}")


# Job instances (singleton pattern)
health_check_job = HealthCheckJob()
ride_reminder_job = RideReminderJob()
ride_alarm_job = RideAlarmJob()
promotional_notification_job = PromotionalNotificationJob()
data_cleanup_job = DataCleanupJob()
