"""Ride Reminder Scheduler - Background job to send ride start reminders."""

from app.database import get_db
from app.services.notification_service import NotificationService
from app.services.notification_tracker import get_notification_tracker
from app.models.ride_group import GroupStatus
from app.utils.timezone_utils import utc_now, parse_local_to_utc


async def check_and_send_ride_reminders():
    """Check for active groups with rides starting soon and send reminders."""
    print("[Ride Reminders] Checking for upcoming rides...")

    db = get_db()
    notification_service = NotificationService()
    tracker = get_notification_tracker()
    now = utc_now()
    today = now.strftime("%Y-%m-%d")

    active_groups = await db.ride_groups.find(
        {
            # FIXED: Include 'pending' status groups (shown as "All Ready!" in UI)
            "status": {
                "$in": [GroupStatus.ACTIVE.value, "pending", "active", "confirming"]
            },
            "date": today,
        }
    ).to_list(100)

    if not active_groups:
        print("[Ride Reminders] No active rides for today")
        return

    print(f"[Ride Reminders] Found {len(active_groups)} active groups for today")

    reminders_sent = 0

    for group in active_groups:
        group_id = group["group_id"]
        time_window = group.get("time_window")

        if not time_window or not time_window.get("start"):
            continue

        tz_offset = group.get("timezone_offset_minutes")
        if tz_offset is None:
            continue

        try:
            start_time_str = time_window["start"]
            ride_date = group.get("date", today)
            ride_datetime = parse_local_to_utc(ride_date, start_time_str, tz_offset)
        except (ValueError, KeyError) as e:
            print(f"[Ride Reminders] Error parsing time for group {group_id}: {e}")
            continue

        # Calculate minutes until ride
        time_until_ride = ride_datetime - now
        minutes_until = int(time_until_ride.total_seconds() / 60)

        # Determine which reminder to send based on time remaining
        # Use wider windows to ensure delivery even if job runs early/late
        reminder_minutes = None
        if 28 <= minutes_until <= 32:
            reminder_minutes = 30
        elif 13 <= minutes_until <= 17:
            reminder_minutes = 15
        elif 3 <= minutes_until <= 7:
            reminder_minutes = 5
        elif -2 <= minutes_until <= 2:
            reminder_minutes = 0

        if reminder_minutes is not None:
            await _send_reminders_to_group(
                notification_service, tracker, group, reminder_minutes
            )
            reminders_sent += 1

    print(f"[Ride Reminders] Sent {reminders_sent} reminder batches")


async def _send_reminders_to_group(
    notification_service: NotificationService, tracker, group: dict, minutes: int
):
    """Send ride start reminder to all members of a group."""
    group_id = group["group_id"]
    members = group.get("members", [])

    # Use consistent key for ride alarm (0min) to deduplicate across schedulers
    notif_type = "ride_alarm" if minutes == 0 else f"ride_reminder_{minutes}min"
    print(f"[Ride Reminders] Sending {minutes}-min reminder for group {group_id}")

    for member in members:
        user_id = member.get("user_id")
        if not user_id:
            continue

        # Check if we already sent this reminder to this user
        already_sent = await tracker.was_sent(notif_type, group_id, user_id)
        if already_sent:
            print(f"[Ride Reminders] Skipping duplicate for {user_id}")
            continue

        try:
            if minutes == 0:
                await notification_service.notify_catch_your_ride(
                    user_id=user_id,
                    group_id=group_id,
                    ride_time=group.get("time_window", {}).get("start", ""),
                    pickup_summary=group.get("pickup_summary", ""),
                )
            else:
                await notification_service.notify_ride_start_warning(
                    user_id=user_id, group_id=group_id, minutes_remaining=minutes
                )

            # Mark as sent with 2-hour TTL (covers reminder + ride duration)
            await tracker.mark_sent(notif_type, group_id, user_id, ttl_hours=2)

        except Exception as e:
            print(f"[Ride Reminders] Failed to notify {user_id}: {e}")
