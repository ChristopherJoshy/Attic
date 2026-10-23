"""
Rating Service

Handles rating submission and trust score calculation.
"""

import uuid
from typing import List, Optional

from app.database import get_db
from app.models.rating import Rating, RatingCreate
from app.services.audit_service import AuditService


class RatingService:
    """Service for managing user ratings and trust scores."""

    def __init__(self):
        self.audit = AuditService()

    async def submit_rating(
        self, rater_user_id: str, data: RatingCreate
    ) -> Optional[Rating]:
        """
        Submit a rating for another user.

        Validates:
        - Rater was in the same group
        - Hasn't already rated this user for this ride
        - Not rating themselves
        """
        db = get_db()

        if rater_user_id == data.rated_user_id:
            raise ValueError("Cannot rate yourself")

        # Verify rater was in the group
        group = await db.ride_groups.find_one(
            {"group_id": data.group_id, "members.user_id": rater_user_id}
        )

        if not group:
            raise ValueError("You were not part of this ride")

        # Verify rated user was in the group
        rated_in_group = any(
            m["user_id"] == data.rated_user_id for m in group.get("members", [])
        )
        if not rated_in_group:
            raise ValueError("Rated user was not in this ride")

        # Check for duplicate rating
        existing = await db.ratings.find_one(
            {
                "rater_user_id": rater_user_id,
                "rated_user_id": data.rated_user_id,
                "group_id": data.group_id,
            }
        )

        if existing:
            raise ValueError("You have already rated this user for this ride")

        rating = Rating(
            rating_id=str(uuid.uuid4()),
            rater_user_id=rater_user_id,
            rated_user_id=data.rated_user_id,
            group_id=data.group_id,
            rating=data.rating,
            comment=data.comment,
        )

        await db.ratings.insert_one(rating.model_dump())

        # Update trust score
        await self.update_trust_score(data.rated_user_id)

        # Log to audit
        await self.audit.log_system_action(
            action="rating_submitted",
            target_type="user",
            target_id=data.rated_user_id,
            metadata={
                "rater": rater_user_id,
                "rating": data.rating,
                "group_id": data.group_id,
            },
        )

        return rating

    async def update_trust_score(self, user_id: str) -> float:
        """
        Calculate and update trust score based on all ratings.

        Trust score = average rating normalized to 0.0-1.0
        New users start at 0.5, moves based on ratings.
        """
        db = get_db()

        # Get all ratings for this user
        cursor = db.ratings.find({"rated_user_id": user_id})
        ratings = []
        async for doc in cursor:
            ratings.append(doc["rating"])

        if not ratings:
            return 0.5  # Default

        # Calculate average (1-5) and normalize to (0-1)
        avg = sum(ratings) / len(ratings)
        trust_score = (avg - 1) / 4  # Convert 1-5 to 0-1

        # Apply slight weight towards 0.5 for low sample sizes
        sample_weight = min(len(ratings) / 10, 1.0)
        trust_score = trust_score * sample_weight + 0.5 * (1 - sample_weight)

        # Update user
        await db.users.update_one(
            {"user_id": user_id}, {"$set": {"trust_score": round(trust_score, 3)}}
        )

        return trust_score

    async def get_pending_ratings(self, user_id: str, group_id: str) -> List[dict]:
        """
        Get users that haven't been rated yet by this user for a group.
        """
        db = get_db()

        # Get group members
        group = await db.ride_groups.find_one({"group_id": group_id})
        if not group:
            return []

        members = group.get("members", [])
        member_ids = [m["user_id"] for m in members if m["user_id"] != user_id]

        # Get already rated
        cursor = db.ratings.find({"rater_user_id": user_id, "group_id": group_id})
        rated_ids = set()
        async for doc in cursor:
            rated_ids.add(doc["rated_user_id"])

        # Get unrated users
        pending = []
        for uid in member_ids:
            if uid not in rated_ids:
                user = await db.users.find_one({"user_id": uid})
                if user:
                    pending.append(
                        {
                            "user_id": uid,
                            "display_name": user.get("display_name", "User"),
                            "photo_url": user.get("photo_url"),
                        }
                    )

        return pending

    async def get_pending_ratings_with_context(
        self, user_id: str, group_id: str
    ) -> dict:
        """
        Get users that haven't been rated yet by this user for a group,
        with additional context about why the list might be empty.

        Returns:
            {
                "pending_users": [...],
                "total_members": int,
                "message": Optional[str]  # Explanation if list is empty
            }
        """
        db = get_db()

        # Get group members
        group = await db.ride_groups.find_one({"group_id": group_id})
        if not group:
            return {
                "pending_users": [],
                "total_members": 0,
                "message": "Ride group not found",
            }

        members = group.get("members", [])
        total_members = len(members)
        member_ids = [m["user_id"] for m in members if m["user_id"] != user_id]

        # Check if user was alone in the ride
        if len(member_ids) == 0:
            return {
                "pending_users": [],
                "total_members": total_members,
                "message": "You were the only person in this ride",
            }

        # Get already rated
        cursor = db.ratings.find({"rater_user_id": user_id, "group_id": group_id})
        rated_ids = set()
        async for doc in cursor:
            rated_ids.add(doc["rated_user_id"])

        # Get unrated users
        pending = []
        for uid in member_ids:
            if uid not in rated_ids:
                user = await db.users.find_one({"user_id": uid})
                if user:
                    pending.append(
                        {
                            "user_id": uid,
                            "display_name": user.get("display_name", "User"),
                            "photo_url": user.get("photo_url"),
                        }
                    )

        # Determine message
        message = None
        if len(pending) == 0 and len(rated_ids) > 0:
            message = "You've already rated everyone from this ride"

        return {
            "pending_users": pending,
            "total_members": total_members,
            "message": message,
        }

    async def get_user_average_rating(self, user_id: str) -> Optional[float]:
        """Get user's average rating."""
        db = get_db()

        cursor = db.ratings.find({"rated_user_id": user_id})
        ratings = []
        async for doc in cursor:
            ratings.append(doc["rating"])

        if not ratings:
            return None

        return round(sum(ratings) / len(ratings), 1)

    async def get_user_pending_rating_groups(self, user_id: str) -> List[str]:
        """
        Get list of group IDs that have pending ratings for the user.
        Only returns groups that are currently 'completed' (active in DB).
        """
        db = get_db()
        pending_groups = []

        # Find all completed groups where user is a member
        cursor = db.ride_groups.find(
            {"status": "completed", "members.user_id": user_id}
        )

        async for group in cursor:
            group_id = group["group_id"]

            # Check if there are any unrated members in this group
            members = group.get("members", [])
            other_member_ids = [
                m["user_id"] for m in members if m["user_id"] != user_id
            ]

            if not other_member_ids:
                continue

            # Count ratings submitted by this user for this group
            rating_count = await db.ratings.count_documents(
                {"rater_user_id": user_id, "group_id": group_id}
            )

            # If ratings count < other members count, they have pending ratings
            if rating_count < len(other_member_ids):
                pending_groups.append(group_id)

        return pending_groups
