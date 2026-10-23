"""
Matchmaking Worker

Background worker for processing the matchmaking queue.

This worker:
1. Scans Redis for pending ride requests
2. Runs the matching algorithm
3. Creates groups when matches are found
4. Sends notifications to users
5. Handles TTL expiry

Run with: python -m app.workers.matchmaking_worker
"""

import asyncio
import logging
from datetime import datetime

from app.config import settings
from app.database import init_db, get_db
from app.services.matchmaking_service import MatchmakingService
from app.services.group_service import GroupService
from app.services.notification_service import NotificationService
from app.services.notification_tracker import get_notification_tracker
from app.services.redis_service import RedisService
from app.services.audit_service import AuditService
from app.utils.timezone_utils import utc_now


logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


# Services
matchmaking_service = MatchmakingService()
group_service = GroupService()
notification_service = NotificationService()
redis_service = RedisService()
audit_service = AuditService()


async def process_matchmaking_queue():
    """
    Process the matchmaking queue for all dates.

    Runs every 30 seconds to find new matches.
    Supports:
    - Passengers matching with passengers (2+ members)
    - Single passengers matching with riders (1+ members if rider available)
    """
    queue_stats = await redis_service.get_queue_stats()

    for date, count in queue_stats.items():
        if count < 1:
            continue

        logger.info(f"Processing queue for {date}: {count} requests")

        pending_ids = await redis_service.get_pending_requests(date)

        for request_id in pending_ids:
            # Skip if already in confirmation
            if await redis_service.get_pending_confirmation(request_id):
                continue

            # Try to find a group (passenger-to-passenger matching)
            group_members = await matchmaking_service.find_best_group(request_id, date)

            # Check for matching rider (works for 1+ passengers)
            rider_id = None
            rider_match = None
            if group_members and len(group_members) >= 1:
                rider_match = await matchmaking_service.check_riders_for_group(
                    group_members, date
                )

            # If rider found, limit passengers to rider's seat capacity
            if rider_match:
                rider_id, rider_seats = rider_match
                # Only take as many passengers as the rider can carry
                if len(group_members) > rider_seats:
                    group_members = group_members[:rider_seats]
                    logger.info(
                        f"Limited group to {rider_seats} passengers (rider capacity)"
                    )

            # Create group if:
            # - 2+ passengers matched together, OR
            # - 1+ passengers matched with a rider
            should_create_group = (group_members and len(group_members) >= 2) or (
                group_members and len(group_members) >= 1 and rider_id is not None
            )

            if should_create_group:
                # Create the group
                group = await group_service.create_group(
                    request_ids=group_members, rider_user_id=rider_id
                )

                logger.info(
                    f"Created group {
                        group.group_id} with {
                        len(
                            group.members)} members (rider: {
                        rider_id is not None})"
                )

                # Notify all members via push notification and WebSocket
                for member in group.members:
                    # Push notification
                    await notification_service.notify_match_found(
                        user_id=member.user_id,
                        group_id=group.group_id,
                        route_summary=group.route_summary,
                    )

                    await notification_service.notify_readiness_request(
                        user_id=member.user_id,
                        group_id=group.group_id,
                        deadline_minutes=settings.readiness_timeout_minutes,
                    )

                    # WebSocket real-time notification (best-effort)
                    try:
                        from app.routers.websocket import (
                            notify_match_found as ws_notify,
                        )

                        await ws_notify(
                            user_id=member.user_id,
                            group_id=group.group_id,
                            route_summary=group.route_summary,
                        )
                    except Exception as ws_err:
                        logger.debug(
                            f"WebSocket notification failed for {
                                member.user_id}: {ws_err}"
                        )

                await audit_service.log_system_action(
                    action="group_created",
                    target_type="group",
                    target_id=group.group_id,
                    metadata={
                        "member_count": len(group.members),
                        "has_rider": rider_id is not None,
                    },
                )
            else:
                # No match found - check if request has been waiting 30+ seconds
                # If so, create a solo group
                request_data = await redis_service.get_request_data(request_id)
                if request_data and request_data.get("created_at"):
                    try:
                        created_at = datetime.fromisoformat(request_data["created_at"])
                        wait_time = (utc_now() - created_at).total_seconds()

                        if wait_time >= 30:
                            logger.info(
                                f"Creating solo group for {request_id} after {
                                    wait_time:.0f}s wait"
                            )

                            solo_group = await group_service.create_group(
                                request_ids=[request_id], rider_user_id=None
                            )

                            logger.info(
                                f"Created solo group {
                                    solo_group.group_id} for user after 30s wait"
                            )

                            # Notify solo user
                            for member in solo_group.members:
                                await notification_service.notify_match_found(
                                    user_id=member.user_id,
                                    group_id=solo_group.group_id,
                                    route_summary=solo_group.route_summary,
                                )

                                await notification_service.notify_readiness_request(
                                    user_id=member.user_id,
                                    group_id=solo_group.group_id,
                                    deadline_minutes=settings.readiness_timeout_minutes,
                                )

                                try:
                                    from app.routers.websocket import (
                                        notify_match_found as ws_notify,
                                    )

                                    await ws_notify(
                                        user_id=member.user_id,
                                        group_id=solo_group.group_id,
                                        route_summary=solo_group.route_summary,
                                    )
                                except Exception as ws_err:
                                    logger.debug(
                                        f"WebSocket notification failed for {
                                            member.user_id}: {ws_err}"
                                    )

                            await audit_service.log_system_action(
                                action="solo_group_created",
                                target_type="group",
                                target_id=solo_group.group_id,
                                metadata={
                                    "wait_time_seconds": wait_time,
                                    "reason": "no_match_after_30s",
                                },
                            )
                    except (ValueError, TypeError) as e:
                        logger.warning(
                            f"Failed to parse created_at for {request_id}: {e}"
                        )


async def process_confirmation_timeouts():
    """
    Process groups with expired confirmation deadlines.

    Runs every minute to check for timed-out confirmations.
    """
    db = get_db()

    # Find groups past confirmation deadline
    cursor = db.ride_groups.find(
        {"status": "confirming", "confirmation_deadline": {"$lt": utc_now()}}
    )

    async for group in cursor:
        logger.info(f"Processing timeout for group {group['group_id']}")

        await group_service.remove_unconfirmed_members(group["group_id"])

        await audit_service.log_system_action(
            action="confirmation_timeout_processed",
            target_type="group",
            target_id=group["group_id"],
        )


async def process_expired_requests():
    """
    Process expired ride requests.

    Runs every 5 minutes to clean up expired requests.
    """
    db = get_db()

    # Find expired pending requests
    cursor = db.ride_requests.find(
        {"status": {"$in": ["pending", "matching"]}, "expires_at": {"$lt": utc_now()}}
    )

    count = 0
    async for request in cursor:
        # Update status
        await db.ride_requests.update_one(
            {"request_id": request["request_id"]}, {"$set": {"status": "expired"}}
        )

        # Remove from Redis
        await redis_service.remove_from_queue(
            request_id=request["request_id"],
            user_id=request["user_id"],
            date=request["date"],
        )

        # Notify user
        await notification_service.notify_match_expired(
            user_id=request["user_id"], request_id=request["request_id"]
        )

        count += 1

    if count > 0:
        logger.info(f"Expired {count} ride requests")

        await audit_service.log_system_action(
            action="requests_expired", metadata={"count": count}
        )


async def process_expired_groups():
    """
    Process expired ride groups (1 hour after ride start).

    Mark them as COMPLETED to clean up active lists.
    """
    db = get_db()
    from app.models.ride_group import GroupStatus

    # Find active groups past their expiration time
    cursor = db.ride_groups.find(
        {
            "status": {
                "$in": [GroupStatus.PENDING, GroupStatus.CONFIRMING, GroupStatus.ACTIVE]
            },
            "expires_at": {"$lt": utc_now()},
        }
    )

    count = 0
    async for group in cursor:
        # Update status to COMPLETED (assuming ride finished)
        await db.ride_groups.update_one(
            {"group_id": group["group_id"]}, {"$set": {"status": GroupStatus.COMPLETED}}
        )

        # Log action
        logger.info(f"Auto-completing expired group {group['group_id']}")
        count += 1

    if count > 0:
        logger.info(f"Completed {count} expired groups")

        await audit_service.log_system_action(
            action="groups_completed_by_expiry", metadata={"count": count}
        )


async def send_matchmaking_reminders():
    """
    Send funny auto rickshaw reminders to users in matchmaking.

    Runs every 30 minutes to keep users engaged while waiting.
    Uses NotificationTracker to prevent duplicate reminders.
    """
    db = get_db()
    notification_service = NotificationService()
    tracker = get_notification_tracker()
    now = utc_now()

    # Find users who have been matching for at least 30 minutes
    cursor = db.ride_requests.find({"status": "matching", "expires_at": {"$gt": now}})

    count = 0
    async for request in cursor:
        user_id = request["user_id"]
        request_id = request["request_id"]
        created_at = request.get("created_at", now)

        # Calculate minutes since creation
        if isinstance(created_at, datetime):
            minutes_waiting = (now - created_at).total_seconds() / 60
        else:
            minutes_waiting = 0

        # Only send reminders if waiting for at least 30 minutes
        if minutes_waiting >= 30:
            # Use NotificationTracker for persistent deduplication
            notif_type = "matchmaking_reminder"

            # Check if already sent in the last 30 minutes
            already_sent = await tracker.was_sent(notif_type, request_id, user_id)
            if already_sent:
                continue

            # Send reminder
            await notification_service.notify_matchmaking_reminder(
                user_id=user_id, request_id=request_id
            )

            # Mark as sent with 30-minute TTL
            await tracker.mark_sent(notif_type, request_id, user_id, ttl_hours=0.5)

            count += 1

    if count > 0:
        logger.info(f"Sent {count} matchmaking reminders")


async def reconcile_redis():
    """
    Reconcile Redis state with MongoDB on startup.

    Rehydrates pending requests from MongoDB to Redis.
    """
    db = get_db()

    # Clear existing queue data to avoid duplicates
    # (In production, you might want to be more careful here)

    # Get pending requests from MongoDB
    cursor = db.ride_requests.find(
        {"status": {"$in": ["pending", "matching"]}, "expires_at": {"$gt": utc_now()}}
    )

    count = 0
    async for request in cursor:
        await redis_service.add_to_match_queue(
            request_id=request["request_id"],
            user_id=request["user_id"],
            date=request["date"],
            pickup_lat=request["pickup"]["coordinates"][1],
            pickup_lng=request["pickup"]["coordinates"][0],
            drop_lat=request["drop"]["coordinates"][1],
            drop_lng=request["drop"]["coordinates"][0],
            time_start=request["time_window"]["start"],
            time_end=request["time_window"]["end"],
            female_only=request.get("female_only", False),
            allow_riders=request.get("allow_riders", True),
        )
        count += 1

    logger.info(f"Reconciliation complete. Rehydrated {count} requests to Redis.")

    await audit_service.log_system_action(
        action="worker_reconciliation", metadata={"requests_rehydrated": count}
    )


async def run_worker():
    """Main worker loop."""
    logger.info("Starting matchmaking worker...")

    # Initialize database connections
    await init_db()

    # Reconcile on startup
    await reconcile_redis()

    logger.info("Worker started. Processing queues...")

    # Track last promo hour to send only once per hour
    last_promo_hour = -1

    while True:
        try:
            # Check maintenance mode
            if await redis_service.is_maintenance_mode():
                logger.info("Maintenance mode active, skipping...")
                await asyncio.sleep(60)
                continue

            # Process matchmaking queue
            await process_matchmaking_queue()

            # Process confirmation timeouts
            await process_confirmation_timeouts()

            # Process expired requests
            await process_expired_requests()

            # Process expired groups (1 hour after ride start)
            await process_expired_groups()

            # Send funny reminders to users waiting for match
            await send_matchmaking_reminders()

            # Send hourly promotional push notification
            current_hour = utc_now().hour
            if current_hour != last_promo_hour:
                await send_hourly_promo()
                last_promo_hour = current_hour

        except Exception as e:
            logger.error(f"Worker error: {e}")

        # Wait before next iteration
        await asyncio.sleep(30)


async def send_hourly_promo():
    """Send random promotional push notification to subscribed users via FCM topic."""
    try:
        success = await notification_service.broadcast_random_promotion()
        if success:
            logger.info("✨ Hourly promotional notification sent to 'promotions' topic")
        else:
            logger.warning(
                "Failed to send hourly promo (FCM not configured or no subscribers)"
            )
    except Exception as e:
        logger.error(f"Error sending hourly promo: {e}")


if __name__ == "__main__":
    asyncio.run(run_worker())
