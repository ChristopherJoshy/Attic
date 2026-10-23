"""
Ride Service

Ride request creation and management.
"""

import uuid
from datetime import timedelta
from typing import Optional, List

from app.config import settings
from app.database import get_db
from app.models.ride_request import (
    RideRequest,
    RideRequestCreate,
    RideRequestStatus,
    GeoPoint,
    TimeWindow,
)
from app.services.redis_service import RedisService
from app.utils.timezone_utils import utc_now, parse_local_to_utc


class RideService:
    """
    Ride request management service.
    """

    def __init__(self):
        self.redis_service = RedisService()

    async def create_ride_request(
        self, user_id: str, data: RideRequestCreate
    ) -> RideRequest:
        """
        Create a new ride request and add to matchmaking queue.

        Smart matchmaking flow:
        1. Try to find an existing compatible group
        2. If found, add user to that group (status = MATCHED)
        3. If not found, create a new group with user as first member (status = MATCHING)

        SECURITY: User must be authenticated and have completed onboarding.
        """
        from app.services.matchmaking_service import MatchmakingService

        db = get_db()
        matchmaking = MatchmakingService()

        # Check if user already has an active request (not expired or cancelled)
        existing = await db.ride_requests.find_one(
            {
                "user_id": user_id,
                "status": {
                    "$in": [RideRequestStatus.PENDING, RideRequestStatus.MATCHING]
                },
                "expires_at": {"$gt": utc_now()},
            }
        )

        if existing:
            raise ValueError(
                "You already have a pending ride request. Cancel it first."
            )

        # Check if user is already in an ACTIVE/PENDING/CONFIRMING group
        from app.models.ride_group import GroupStatus

        existing_group = await db.ride_groups.find_one(
            {
                "members.user_id": user_id,
                "status": {
                    "$in": [
                        GroupStatus.PENDING,
                        GroupStatus.CONFIRMING,
                        GroupStatus.ACTIVE,
                    ]
                },
            }
        )

        if existing_group:
            raise ValueError(
                "You already have an active ride group. Please leave it before creating a new request."
            )

        # Note: Time validation removed - users can book for any future time

        request_id = str(uuid.uuid4())
        req_expires_at = utc_now() + timedelta(minutes=settings.matchmaking_ttl_minutes)

        tz_offset_minutes = data.timezone_offset_minutes
        ride_dt_utc = parse_local_to_utc(
            data.date, data.time_window_start, tz_offset_minutes
        )
        group_expires_at = ride_dt_utc + timedelta(hours=1)

        ride_request = RideRequest(
            request_id=request_id,
            user_id=user_id,
            pickup=GeoPoint.from_lat_lng(data.pickup_lat, data.pickup_lng),
            pickup_label=data.pickup_label,
            drop=GeoPoint.from_lat_lng(data.drop_lat, data.drop_lng),
            drop_label=data.drop_label,
            date=data.date,
            time_window=TimeWindow(
                start=data.time_window_start, end=data.time_window_end
            ),
            timezone_offset_minutes=data.timezone_offset_minutes,
            allow_riders=data.allow_riders,
            female_only=data.female_only,
            status=RideRequestStatus.PENDING,
            expires_at=req_expires_at,
        )

        # Store in MongoDB
        # RACE CONDITION FIX: The partial unique index on (user_id) where status in [pending, matching]
        # will cause DuplicateKeyError if user already has an active request
        from pymongo.errors import DuplicateKeyError

        try:
            await db.ride_requests.insert_one(ride_request.model_dump())
        except DuplicateKeyError:
            raise ValueError(
                "You already have a pending ride request. Cancel it first."
            )

        # Add to Redis matchmaking queue
        await self.redis_service.add_to_match_queue(
            request_id=request_id,
            user_id=user_id,
            date=data.date,
            pickup_lat=data.pickup_lat,
            pickup_lng=data.pickup_lng,
            drop_lat=data.drop_lat,
            drop_lng=data.drop_lng,
            time_start=data.time_window_start,
            time_end=data.time_window_end,
            female_only=data.female_only,
            allow_riders=data.allow_riders,
        )

        # SMART MATCHMAKING: Try to find an existing matching group
        from app.services.audit_service import AuditService

        audit = AuditService()
        await audit.log_matchmaking_event(
            "STARTED",
            {
                "User": user_id,
                "From": data.pickup_label,
                "To": data.drop_label,
                "Time": f"{data.time_window_start}-{data.time_window_end}",
                "Date": data.date,
                "Woman Only": "Yes" if data.female_only else "No",
            },
        )

        matching_group_id = await matchmaking.find_matching_group(
            request_id=request_id,
            date=data.date,
            pickup_lat=data.pickup_lat,
            pickup_lng=data.pickup_lng,
            drop_lat=data.drop_lat,
            drop_lng=data.drop_lng,
            time_start=data.time_window_start,
            time_end=data.time_window_end,
            female_only=data.female_only,
        )

        group_id = None

        if matching_group_id:
            # Found a matching group - try to add user to it
            success = await matchmaking.add_user_to_group(
                group_id=matching_group_id, user_id=user_id, request_id=request_id
            )
            if success:
                ride_request.status = RideRequestStatus.MATCHED
                ride_request.group_id = matching_group_id

                await audit.log_matchmaking_event(
                    "MATCH_FOUND",
                    {
                        "User": user_id,
                        "Group ID": matching_group_id,
                        "Outcome": "User added to existing group",
                    },
                )

                # Send real-time WebSocket notification to user
                try:
                    from app.routers.websocket import notify_match_found

                    route_summary = f"{data.pickup_label} → {data.drop_label}"
                    await notify_match_found(
                        user_id=user_id,
                        group_id=matching_group_id,
                        route_summary=route_summary,
                    )
                except Exception as ws_err:
                    # WebSocket notification is best-effort, don't fail the request
                    print(f"WebSocket notification failed: {ws_err}")
            else:
                # Failed to join (e.g., race condition/full) - create new group
                group_id = await matchmaking.create_group_for_user(
                    user_id=user_id,
                    request_id=request_id,
                    date=data.date,
                    pickup_label=data.pickup_label,
                    drop_label=data.drop_label,
                    time_window={
                        "start": data.time_window_start,
                        "end": data.time_window_end,
                    },
                    expires_at=group_expires_at,
                    female_only=data.female_only,
                    timezone_offset_minutes=tz_offset_minutes,
                )
                ride_request.status = RideRequestStatus.MATCHING
                ride_request.group_id = group_id

                await audit.log_matchmaking_event(
                    "GROUP_CREATED",
                    {
                        "User": user_id,
                        "New Group ID": group_id,
                        "Reason": "Join failed (full/race condition)",
                    },
                )
        else:
            # No matching group found - create new group with user as first member
            group_id = await matchmaking.create_group_for_user(
                user_id=user_id,
                request_id=request_id,
                date=data.date,
                pickup_label=data.pickup_label,
                drop_label=data.drop_label,
                time_window={
                    "start": data.time_window_start,
                    "end": data.time_window_end,
                },
                expires_at=group_expires_at,  # Use 4-hour expiration for group
                female_only=data.female_only,
                timezone_offset_minutes=tz_offset_minutes,
            )
            ride_request.status = RideRequestStatus.MATCHING
            ride_request.group_id = group_id

            await audit.log_matchmaking_event(
                "NO_MATCH",
                {
                    "User": user_id,
                    "Action": "Created new group",
                    "New Group ID": group_id,
                },
            )

        # Send matchmaking started notification
        from app.services.notification_service import NotificationService

        notification_service = NotificationService()
        route_summary = f"{data.pickup_label} → {data.drop_label}"
        await notification_service.notify_matchmaking_started(
            user_id=user_id, request_id=request_id, route_summary=route_summary
        )

        return ride_request

    async def cancel_ride_request(self, user_id: str, request_id: str) -> bool:
        """
        Cancel a ride request.

        SECURITY: Only the request owner can cancel.
        Idempotent: If already cancelled, returns True.
        """
        db = get_db()

        # Get the request (relaxed query to debug)
        request = await db.ride_requests.find_one({"request_id": request_id})

        if not request:
            # Request not found - expected in some scenarios
            return False

        # Verify ownership
        if str(request.get("user_id")) != str(user_id):
            # User mismatch - unauthorized cancel
            return False

        current_status = str(request.get("status")).lower()

        # If already cancelled, consider it success (idempotent)
        if current_status == "cancelled":
            return True

        # Can only cancel pending, active(matching), or matched requests
        # Using string literals to avoid Enum issues
        if current_status not in ["pending", "matching", "matched"]:
            return False

        # Update status
        await db.ride_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": RideRequestStatus.CANCELLED}},
        )

        # Remove from group if matched/matching
        if request.get("group_id"):
            await db.ride_groups.update_one(
                {"group_id": request["group_id"]},
                {"$pull": {"members": {"user_id": user_id}}},
            )

        # Remove from Redis queue
        await self.redis_service.remove_from_queue(
            request_id=request_id, user_id=user_id, date=request["date"]
        )

        # Notify user (in-app + push)
        from app.services.notification_service import NotificationService

        notification_service = NotificationService()
        await notification_service.send_notification(
            user_id=user_id,
            notification_type="group_cancelled",  # Reusing generic type or new one
            title="Ride Cancelled",
            body="You have successfully left the group/cancelled your request.",
            data={"request_id": request_id},
        )

        # Log to Audit/Bot
        from app.services.audit_service import AuditService

        audit = AuditService()
        await audit.log_matchmaking_event(
            "CANCELLED",
            {
                "User": user_id,
                "Request ID": request_id,
                "Group ID": request.get("group_id", "N/A"),
                "Action": "User cancelled manually",
            },
        )

        return True

    async def get_user_requests(
        self, user_id: str, include_history: bool = False
    ) -> List[RideRequest]:
        """Get user's ride requests."""
        db = get_db()

        query = {"user_id": user_id}

        if not include_history:
            query["status"] = {
                "$in": [
                    RideRequestStatus.PENDING,
                    RideRequestStatus.MATCHING,
                    RideRequestStatus.MATCHED,
                ]
            }

        cursor = db.ride_requests.find(query).sort("created_at", -1)
        requests = []

        async for doc in cursor:
            requests.append(RideRequest(**doc))

        return requests

    async def get_request(self, request_id: str) -> Optional[RideRequest]:
        """Get a specific ride request."""
        db = get_db()
        doc = await db.ride_requests.find_one({"request_id": request_id})
        if doc:
            return RideRequest(**doc)
        return None

    async def get_matchmaking_status(self, user_id: str) -> Optional[dict]:
        """
        Get current matchmaking status for a user.

        Returns request info with time remaining.
        """
        db = get_db()

        request = await db.ride_requests.find_one(
            {
                "user_id": user_id,
                "status": {
                    "$in": [
                        RideRequestStatus.PENDING,
                        RideRequestStatus.MATCHING,
                        RideRequestStatus.MATCHED,
                    ]
                },
            }
        )

        if not request:
            return None

        now = utc_now()
        expires_at = request["expires_at"]

        if isinstance(expires_at, str):
            from datetime import datetime

            expires_at = datetime.fromisoformat(expires_at)

        # Ensure expires_at is timezone-aware if it's not (assuming it's UTC)
        if expires_at.tzinfo is None:
            from datetime import timezone

            expires_at = expires_at.replace(tzinfo=timezone.utc)

        time_remaining = max(0, int((expires_at - now).total_seconds()))

        # Lazy expiration: If time is up but status is still active (and NOT matched), expire it
        if time_remaining == 0 and request["status"] != RideRequestStatus.MATCHED:
            print(f"Lazy expiring request {request['request_id']}")  # Debug log
            await self.expire_request(request["request_id"])
            return None

        # Check if matched or pending confirmation
        pending_group_id = request.get("group_id")

        # If not in request (e.g. status is MATCHING/PENDING but group exists in Redis), try Redis
        if not pending_group_id:
            pending_group_id = await self.redis_service.get_pending_confirmation(
                request["request_id"]
            )

        my_readiness_confirmed = False
        group_status = None

        if pending_group_id:
            group = await db.ride_groups.find_one({"group_id": pending_group_id})
            if group:
                group_status = group.get("status")
                # Group found and loaded
                for member in group.get("members", []):
                    # Debug member
                    m_uid = str(member.get("user_id", ""))
                    target_uid = str(user_id)
                    m_conf = member.get("readiness_confirmed", False)
                    # print(f"DEBUG: Checking member {m_uid} vs {target_uid}. Ready: {m_conf}")

                    if m_uid == target_uid:
                        my_readiness_confirmed = m_conf
                        break

                # Fallback: If group is ACTIVE, everyone is effectively confirmed
                if group_status == "active":
                    my_readiness_confirmed = True
            else:
                # Group was deleted or expired - expire the dangling request
                pending_group_id = None
                if request["status"] == RideRequestStatus.MATCHED:
                    await db.ride_requests.update_one(
                        {"request_id": request["request_id"]},
                        {
                            "$set": {
                                "status": RideRequestStatus.EXPIRED,
                                "group_id": None,
                                "updated_at": now,
                                "expires_at": now,
                            }
                        },
                    )
                    request["status"] = RideRequestStatus.EXPIRED

        # Determine final status to return
        # If group is completed/expired, override the request status
        display_status = request["status"]
        if group_status in ["completed", "expired"]:
            display_status = group_status

        return {
            "request_id": request["request_id"],
            "status": display_status,
            "pickup_label": request["pickup_label"],
            "drop_label": request["drop_label"],
            "date": request["date"],
            "time_window": request["time_window"],
            "time_remaining_seconds": time_remaining,
            "expires_at": expires_at.isoformat(),
            "pending_confirmation_group_id": pending_group_id,
            "my_readiness_confirmed": my_readiness_confirmed,
        }

    async def expire_request(self, request_id: str) -> None:
        """
        Mark a request as expired.

        Called by background worker when TTL expires.
        """
        db = get_db()

        request = await db.ride_requests.find_one({"request_id": request_id})
        if not request:
            return

        await db.ride_requests.update_one(
            {"request_id": request_id}, {"$set": {"status": RideRequestStatus.EXPIRED}}
        )

        # NOTE: We DO NOT remove the user from the group here.
        # This allows the user to remain as a "passive" member in the group
        # waiting for others to join, even if their active polling has finished.

        # Remove from Redis
        await self.redis_service.remove_from_queue(
            request_id=request_id, user_id=request["user_id"], date=request["date"]
        )

    async def mark_matched(self, request_id: str, group_id: str) -> None:
        """Mark a request as matched to a group."""
        db = get_db()

        await db.ride_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": RideRequestStatus.MATCHED,
                    "group_id": group_id,
                    "matched_at": utc_now(),
                }
            },
        )
