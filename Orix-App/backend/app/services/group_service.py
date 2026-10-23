"""Group Service - Ride group management and confirmation flow."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from app.config import settings
from app.database import get_db
from app.models.ride_group import RideGroup, GroupMember, GroupStatus
from app.models.notification import NotificationType
from app.models.chat_message import ChatMessage, MessageType
from app.services.redis_service import RedisService
from app.services.user_service import UserService
from app.services.notification_service import NotificationService
from app.utils.timezone_utils import utc_now


class GroupService:
    """
    Ride group management service.

    Handles group creation, readiness confirmation, and chat.
    """

    def __init__(self):
        self.redis_service = RedisService()
        self.user_service = UserService()
        self.notification_service = NotificationService()

    async def create_group(
        self, request_ids: List[str], rider_user_id: Optional[str] = None
    ) -> RideGroup:
        """Create a new ride group from matched requests, ensuring a user has at most one active group.

        If any passenger or the rider already belongs to an ACTIVE or CONFIRMING group,
        the existing group is returned instead of creating a new one.
        """
        db = get_db()
        # Gather all user IDs involved in the request list
        user_ids = set()
        for req_id in request_ids:
            request = await db.ride_requests.find_one({"request_id": req_id})
            if request:
                user_ids.add(request["user_id"])
        if rider_user_id:
            user_ids.add(rider_user_id)

        # Look for an existing group where any of these users are members and the group is still active
        existing = await db.ride_groups.find_one(
            {
                "members.user_id": {"$in": list(user_ids)},
                "status": {"$in": [GroupStatus.CONFIRMING, GroupStatus.ACTIVE]},
            }
        )
        if existing:
            # Return the already existing group
            return RideGroup(**existing)

        # No existing group – proceed with normal creation logic
        group_id = str(uuid.uuid4())
        members = []
        pickups = []
        drops = []

        # Create member entries for passengers
        for req_id in request_ids:
            request = await db.ride_requests.find_one({"request_id": req_id})
            if request:
                members.append(
                    GroupMember(
                        user_id=request["user_id"],
                        role="passenger",
                        readiness_confirmed=False,
                    )
                )
                pickups.append(request["pickup_label"])
                drops.append(request["drop_label"])

        # Add rider if present
        if rider_user_id:
            members.append(
                GroupMember(
                    user_id=rider_user_id, role="rider", readiness_confirmed=False
                )
            )

        # Create route summary
        pickup_summary = ", ".join(set(pickups)[:3])
        if len(set(pickups)) > 3:
            pickup_summary += f" and {len(set(pickups)) - 3} more"
        drop_summary = ", ".join(set(drops)[:3])
        if len(set(drops)) > 3:
            drop_summary += f" and {len(set(drops)) - 3} more"
        route_summary = f"{pickup_summary} → {drop_summary}"

        # Determine if any request is female only
        female_only = False
        for req_id in request_ids:
            request = await db.ride_requests.find_one({"request_id": req_id})
            if request and request.get("female_only"):
                female_only = True
                break

        confirmation_deadline = utc_now() + timedelta(
            minutes=settings.readiness_timeout_minutes
        )

        group = RideGroup(
            group_id=group_id,
            members=[m.model_dump() for m in members],
            route_summary=route_summary,
            pickup_summary=pickup_summary,
            drop_summary=drop_summary,
            female_only=female_only,
            status=GroupStatus.CONFIRMING,
            confirmation_deadline=confirmation_deadline,
        )

        # Store in MongoDB
        await db.ride_groups.insert_one(group.model_dump())

        # Verify group was inserted (ensures write is visible to reads)
        verification = await db.ride_groups.find_one({"group_id": group_id})
        if not verification:
            raise Exception(f"Failed to verify group creation for {group_id}")

        # Create tentative group in Redis
        await self.redis_service.create_tentative_group(group_id, request_ids)

        # Update ride requests with group_id
        for req_id in request_ids:
            await db.ride_requests.update_one(
                {"request_id": req_id},
                {"$set": {"status": "matching", "group_id": group_id}},
            )

        # Add system message
        await self._add_system_message(
            group_id,
            "Group created! Please confirm your readiness within the time limit.",
        )

        # Notify all members
        for user_id in user_ids:
            await self.notification_service.notify_group_found(
                user_id=user_id, group_id=group_id
            )

        return group

    async def confirm_readiness(
        self, group_id: str, user_id: str
    ) -> Optional[RideGroup]:
        """
        Confirm a member's readiness to ride.

        Returns updated group, or None if not found/unauthorized.
        Uses atomic update to prevent race conditions.
        """
        db = get_db()

        # RACE CONDITION FIX: Use atomic find_one_and_update with condition
        # Only update if member exists AND has not already confirmed
        result = await db.ride_groups.find_one_and_update(
            {
                "group_id": group_id,
                "members": {
                    "$elemMatch": {
                        "user_id": user_id,
                        "readiness_confirmed": {
                            "$ne": True
                        },  # Only if NOT already confirmed
                    }
                },
            },
            {
                "$set": {
                    "members.$.readiness_confirmed": True,
                    "members.$.confirmed_at": utc_now(),
                }
            },
            return_document=True,
        )

        if not result:
            # Either group doesn't exist, user not a member, or already confirmed
            # Check if it's already confirmed (idempotent case)
            group = await db.ride_groups.find_one({"group_id": group_id})
            if group:
                for member in group.get("members", []):
                    if member["user_id"] == user_id:
                        # User is a member - they must have already confirmed
                        # Just return current state and ensure finalization check
                        await self._check_all_confirmed(group)
                        return RideGroup(**group)
            return None

        # Add system message
        user = await self.user_service.get_user(user_id)
        display_name = user.display_name if user else "A member"
        await self._add_system_message(group_id, f"{display_name} confirmed readiness.")

        # Count unconfirmed members (excluding the user who just confirmed)
        unconfirmed_count = sum(
            1
            for member in result.get("members", [])
            if not member.get("readiness_confirmed", False)
            and member["user_id"] != user_id
        )

        # Send notification to the confirming user
        await self.notification_service.notify_readiness_confirmed(
            user_id=user_id,
            group_id=group_id,
            remaining_members=unconfirmed_count,
        )

        # Check if all confirmed
        await self._check_all_confirmed(result)

        # Re-fetch group after potential status update from _finalize_group
        updated_group = await db.ride_groups.find_one({"group_id": group_id})

        return RideGroup(**updated_group)

    async def _check_all_confirmed(self, group: Dict[str, Any]) -> None:
        """Check if all members confirmed and finalize group."""
        all_confirmed = all(
            member.get("readiness_confirmed", False) for member in group["members"]
        )

        if all_confirmed:
            await self._finalize_group(group["group_id"])

    async def _finalize_group(self, group_id: str) -> None:
        """
        Finalize a group after all members confirm.

        Updates status and marks ride requests as matched.
        Uses atomic find_one_and_update to prevent race conditions.
        """
        db = get_db()

        # RACE CONDITION FIX: Use atomic find_one_and_update with status condition
        # Only one request can transition from CONFIRMING -> ACTIVE
        result = await db.ride_groups.find_one_and_update(
            {
                "group_id": group_id,
                "status": GroupStatus.CONFIRMING,  # Only transition from CONFIRMING
            },
            {"$set": {"status": GroupStatus.ACTIVE, "finalized_at": utc_now()}},
            return_document=True,  # Return the updated document
        )

        if not result:
            # Already finalized, cancelled, or doesn't exist - skip
            return

        # Notify all members (result contains the updated group)
        for member in result.get("members", []):
            await self.notification_service.notify_group_finalized(
                user_id=member["user_id"], group_id=group_id
            )

        # Update ride requests
        await db.ride_requests.update_many(
            {"group_id": group_id}, {"$set": {"status": "matched"}}
        )

        # Clean up Redis
        await self.redis_service.remove_tentative_group(group_id)

        await self._add_system_message(
            group_id, "🎉 All members confirmed! Your ride group is now active."
        )

    async def cancel_group(
        self, group_id: str, reason: str = "Group cancelled"
    ) -> bool:
        """
        Cancel a group and notify members.

        Returns True if cancelled, False if not found.
        """
        db = get_db()

        group = await db.ride_groups.find_one({"group_id": group_id})
        if not group:
            return False

        await db.ride_groups.update_one(
            {"group_id": group_id}, {"$set": {"status": GroupStatus.CANCELLED}}
        )

        # Update ride requests back to pending (or expired)
        for member in group["members"]:
            if member["role"] == "passenger":
                await db.ride_requests.update_one(
                    {"user_id": member["user_id"], "group_id": group_id},
                    {"$set": {"status": "pending", "group_id": None}},
                )

        # Clean up Redis
        await self.redis_service.remove_tentative_group(group_id)

        await self._add_system_message(group_id, f"Group cancelled: {reason}")

        return True

    async def remove_unconfirmed_members(self, group_id: str) -> None:
        """
        Remove members who didn't confirm in time.

        Called by background worker when confirmation deadline passes.
        """
        db = get_db()

        group = await db.ride_groups.find_one({"group_id": group_id})
        if not group or group["status"] != GroupStatus.CONFIRMING:
            return

        confirmed_members = [
            m for m in group["members"] if m.get("readiness_confirmed", False)
        ]
        unconfirmed = [
            m for m in group["members"] if not m.get("readiness_confirmed", False)
        ]

        if not unconfirmed:
            return

        # If too few confirmed members remain, cancel the group
        if len(confirmed_members) < 2:
            await self.cancel_group(group_id, "Not enough members confirmed in time")
            return

        # Remove unconfirmed members
        for member in unconfirmed:
            user = await self.user_service.get_user(member["user_id"])
            name = user.display_name if user else "A member"
            await self._add_system_message(
                group_id, f"{name} was removed (did not confirm in time)"
            )

            # Set their request back to pending
            await db.ride_requests.update_one(
                {"user_id": member["user_id"], "group_id": group_id},
                {"$set": {"status": "pending", "group_id": None}},
            )

        # Update group members
        await db.ride_groups.update_one(
            {"group_id": group_id}, {"$set": {"members": confirmed_members}}
        )

        # Now finalize with remaining members
        await self._finalize_group(group_id)

    async def get_user_groups(
        self, user_id: str, include_completed: bool = False
    ) -> List[RideGroup]:
        """Get user's ride groups, excluding expired CONFIRMING groups."""
        db = get_db()

        query = {"members.user_id": user_id}

        if not include_completed:
            query["status"] = {"$in": [GroupStatus.CONFIRMING, GroupStatus.ACTIVE]}

        cursor = db.ride_groups.find(query).sort("created_at", -1)
        groups = []
        now = utc_now()

        async for doc in cursor:
            group = RideGroup(**doc)

            # Filter out CONFIRMING groups that have expired
            if group.status == GroupStatus.CONFIRMING:
                deadline = group.confirmation_deadline
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)

                # Skip this group if confirmation deadline has passed
                if deadline < now:
                    continue

            groups.append(group)

        return groups

    async def get_available_rides(self, current_user_id: str) -> List[RideGroup]:
        """
        Get available ACTIVE groups that the user is not already part of.

        This endpoint allows users to discover rides they can join.
        """
        db = get_db()

        # Find all ACTIVE groups
        query = {"status": GroupStatus.ACTIVE}

        cursor = db.ride_groups.find(query).sort("created_at", -1)
        available_groups = []

        async for doc in cursor:
            group = RideGroup(**doc)

            # Exclude groups where current user is already a member
            is_member = any(m.user_id == current_user_id for m in group.members)
            if not is_member:
                available_groups.append(group)

        return available_groups

    async def get_group(self, group_id: str) -> Optional[RideGroup]:
        """Get a specific group."""
        db = get_db()
        doc = await db.ride_groups.find_one({"group_id": group_id})
        if doc:
            return RideGroup(**doc)
        return None

    async def get_group_with_members(
        self, group_id: str, requesting_user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get group with full member details.

        SECURITY: Phone numbers are masked until ride is confirmed (group ACTIVE).
        Only after all members confirm readiness, full phone numbers are visible.
        """
        group = await self.get_group(group_id)
        if not group:
            return None

        # Verify requesting user is a member
        is_member = any(m.user_id == requesting_user_id for m in group.members)

        if not is_member:
            return None

        # Get full member details
        members_data = []

        # Check if all members have confirmed (phone should be visible in this case too)
        all_confirmed = all(m.readiness_confirmed for m in group.members)

        # Import rating service for average ratings
        from app.services.rating_service import RatingService

        rating_service = RatingService()

        for member in group.members:
            user = await self.user_service.get_user(member.user_id)
            if user:
                # Show full phone when group is ACTIVE or when ALL members have confirmed
                if group.status == GroupStatus.ACTIVE or all_confirmed:
                    phone_display = user.phone
                else:
                    phone_display = (
                        self.user_service.mask_phone(user.phone) if user.phone else None
                    )

                # Get user's average rating
                avg_rating = await rating_service.get_user_average_rating(
                    member.user_id
                )

                members_data.append(
                    {
                        "user_id": user.user_id,
                        "display_name": user.display_name,
                        "photo_url": user.photo_url,
                        "phone": phone_display,
                        "gender": user.gender,
                        "role": member.role,
                        "readiness_confirmed": member.readiness_confirmed,
                        "is_me": user.user_id == requesting_user_id,
                        "average_rating": avg_rating,
                    }
                )

        return {**group.model_dump(), "members": members_data}

    async def send_chat_message(
        self, group_id: str, user_id: str, content: str
    ) -> Optional[ChatMessage]:
        """
        Send a chat message in a group.

        SECURITY: Only group members can send messages.
        Messages are logged for moderation.
        """
        db = get_db()

        # Verify membership
        group = await db.ride_groups.find_one(
            {"group_id": group_id, "members.user_id": user_id}
        )

        if not group:
            return None

        user = await self.user_service.get_user(user_id)

        message = ChatMessage(
            message_id=str(uuid.uuid4()),
            group_id=group_id,
            user_id=user_id,
            user_display_name=user.display_name if user else "Unknown",
            message_type=MessageType.USER,
            content=content,
        )

        await db.chat_messages.insert_one(message.model_dump())

        # Send WebSocket notification to ALL group members for real-time chat
        member_ids = [m["user_id"] for m in group.get("members", [])]
        try:
            from app.routers.websocket import notify_new_chat_message

            await notify_new_chat_message(
                user_ids=member_ids,
                group_id=group_id,
                message_id=message.message_id,
                sender_name=user.display_name if user else "Group Member",
                content=content,
            )
        except Exception as ws_err:
            # WebSocket notification is best-effort, don't fail the message
            print(f"WebSocket chat notification failed: {ws_err}")

        # Send push notification to other members (not the sender)
        for member in group.get("members", []):
            if member["user_id"] != user_id:
                await self.notification_service.notify_chat_message(
                    user_id=member["user_id"],
                    group_id=group_id,
                    sender_name=user.display_name if user else "Group Member",
                    message_preview=content,
                )

        return message

    async def get_chat_messages(
        self,
        group_id: str,
        user_id: str,
        limit: int = 50,
        before: Optional[datetime] = None,
    ) -> List[ChatMessage]:
        """
        Get chat messages for a group.

        SECURITY: Only group members can read messages.
        """
        db = get_db()

        # Verify membership
        group = await db.ride_groups.find_one(
            {"group_id": group_id, "members.user_id": user_id}
        )

        if not group:
            return []

        query = {"group_id": group_id}
        if before:
            query["created_at"] = {"$lt": before}

        cursor = db.chat_messages.find(query).sort("created_at", -1).limit(limit)

        messages = []
        async for doc in cursor:
            messages.append(ChatMessage(**doc))

        # Reverse to show oldest first
        messages.reverse()

        return messages

    async def _add_system_message(self, group_id: str, content: str) -> None:
        """Add a system message to group chat."""
        db = get_db()

        message = ChatMessage(
            message_id=str(uuid.uuid4()),
            group_id=group_id,
            user_id=None,
            user_display_name=None,
            message_type=MessageType.SYSTEM,
            content=content,
        )

        await db.chat_messages.insert_one(message.model_dump())

    async def _send_rating_notifications(self, group_data: Dict[str, Any]) -> None:
        """Send rating notifications to all group members after ride completion."""
        group_id = group_data.get("group_id")

        for member in group_data.get("members", []):
            user_id = member.get("user_id")
            if user_id:
                await self.notification_service.notify_rating_request(
                    user_id=user_id,
                    group_id=group_id,
                    other_members=[
                        m.get("user_id")
                        for m in group_data.get("members", [])
                        if m.get("user_id") != user_id
                    ],
                )

    async def get_recent_chat_for_report(self, group_id: str, limit: int = 20) -> str:
        """
        Get recent chat excerpt for including in a report.

        Used by moderation to see context.
        """
        db = get_db()

        cursor = (
            db.chat_messages.find({"group_id": group_id})
            .sort("created_at", -1)
            .limit(limit)
        )

        messages = []
        async for doc in cursor:
            name = doc.get("user_display_name") or "System"
            content = doc.get("content", "")
            messages.append(f"[{name}]: {content}")

        messages.reverse()
        return "\n".join(messages)

    async def mark_rider_here(self, group_id: str, user_id: str) -> RideGroup:
        """
        Mark a rider as 'here' at the pickup location.
        Completes the group and triggers rating notifications.
        """
        db = get_db()

        # Get the group
        group_data = await db.ride_groups.find_one({"group_id": group_id})
        if not group_data:
            raise ValueError(f"Group {group_id} not found")

        group = RideGroup(**group_data)

        # Verify user is in the group
        user_in_group = any(m.user_id == user_id for m in group.members)
        if not user_in_group:
            raise ValueError(f"User {user_id} is not a member of group {group_id}")

        # Mark group as completed
        result = await db.ride_groups.find_one_and_update(
            {"group_id": group_id},
            {
                "$set": {
                    "status": GroupStatus.COMPLETED,
                    "completed_at": utc_now(),
                }
            },
            return_document=True,
        )

        if not result:
            raise ValueError(f"Failed to update group {group_id}")

        # Add system message
        user = await self.user_service.get_user(user_id)
        display_name = user.display_name if user else "A member"
        await self._add_system_message(
            group_id, f"{display_name} marked as here. Ride completed!"
        )

        # Send rating notifications to all members
        await self._send_rating_notifications(result)

        return RideGroup(**result)

    async def finish_ride(self, group_id: str, user_id: str) -> Dict[str, Any]:
        """
        Finish a ride for a user.
        - Removes the user from the group
        - If all users have left after completion, immediately delete the group
        - Otherwise, the group will be automatically deleted ~12 hours after completion by the cleanup job
        """
        db = get_db()

        # Get the group
        group_data = await db.ride_groups.find_one({"group_id": group_id})
        if not group_data:
            raise ValueError(f"Group {group_id} not found")

        group = RideGroup(**group_data)

        # Verify user is in the group
        user_in_group = any(m.user_id == user_id for m in group.members)
        if not user_in_group:
            raise ValueError(f"User {user_id} is not a member of group {group_id}")

        now = utc_now()

        # Remove the user from the group and refresh completion metadata/TTL
        result = await db.ride_groups.find_one_and_update(
            {"group_id": group_id},
            {
                "$pull": {"members": {"user_id": user_id}},
                "$set": {
                    "updated_at": now,
                    "status": GroupStatus.COMPLETED,
                    # Ensure we always have a cleanup window for completed groups
                    "expires_at": now + timedelta(hours=12),
                },
            },
            return_document=True,
        )

        if not result:
            raise ValueError(f"Failed to update group {group_id}")

        # Check if all users have left
        remaining_members = result.get("members", [])

        # Update the user's ride request to expired/completed status
        # This prevents the UI from showing stale "Match Found!" status
        await db.ride_requests.update_one(
            {"user_id": user_id, "status": {"$in": ["matched", "matching", "pending"]}},
            {"$set": {"status": "expired", "updated_at": now}},
        )

        # Notify the user that their ride completion/exit was processed
        try:
            await self.notification_service.send_notification(
                user_id=user_id,
                notification_type=NotificationType.RIDE_COMPLETED,
                title="Ride completed",
                body="Your ride has been completed.",
                data={"type": "ride_completed", "group_id": group_id},
                send_push=True,
                high_priority=False,
            )
        except Exception:
            # Do not block completion on notification errors
            pass

        if len(remaining_members) == 0:
            # All users have left, delete the group immediately
            await db.ride_groups.delete_one({"group_id": group_id})
            return {
                "message": "Ride finished. All users have left, group deleted.",
                "group_deleted": True,
            }
        else:
            # Group will be automatically deleted after the retention window by cleanup job
            return {
                "message": "Ride finished. You have left the group.",
                "group_deleted": False,
                "remaining_members": len(remaining_members),
            }
