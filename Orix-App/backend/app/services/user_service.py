"""User Service - User profile management and rider toggle logic."""

import json
import logging
from datetime import timedelta
from typing import Optional

from app.config import settings
from app.database import get_db, get_redis
from app.models.user import User, UserUpdate, RiderInfo, UserStatus
from app.utils.timezone_utils import utc_now

logger = logging.getLogger(__name__)

# Cache configuration
USER_CACHE_TTL = 300  # 5 minutes
USER_CACHE_PREFIX = "user:"


class UserService:
    """
    User profile and rider management service.
    """
    
    def _cache_key(self, user_id: str) -> str:
        """Generate cache key for user."""
        return f"{USER_CACHE_PREFIX}{user_id}"
    
    async def _get_from_cache(self, user_id: str) -> Optional[User]:
        """Get user from Redis cache."""
        redis = get_redis()
        if not redis:
            return None
        
        try:
            cached = await redis.get(self._cache_key(user_id))
            if cached:
                return User(**json.loads(cached))
        except Exception as e:
            logger.debug(f"Cache miss for {user_id}: {e}")
        return None
    
    async def _set_cache(self, user: User):
        """Cache user in Redis."""
        redis = get_redis()
        if not redis:
            return
        
        try:
            await redis.setex(
                self._cache_key(user.user_id),
                USER_CACHE_TTL,
                user.model_dump_json()
            )
        except Exception as e:
            logger.debug(f"Cache set failed: {e}")
    
    async def _invalidate_cache(self, user_id: str):
        """Remove user from cache."""
        redis = get_redis()
        if not redis:
            return
        
        try:
            await redis.delete(self._cache_key(user_id))
        except Exception:
            pass
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID (cached for 5 min)."""
        # Check cache first (#61)
        cached = await self._get_from_cache(user_id)
        if cached:
            return cached
        
        db = get_db()
        doc = await db.users.find_one({"user_id": user_id})
        if doc:
            user = User(**doc)
            await self._set_cache(user)
            return user
        return None
    
    async def update_user(self, user_id: str, update: UserUpdate) -> Optional[User]:
        """
        Update user profile.
        
        SECURITY: Only allowed fields can be updated via UserUpdate model.
        """
        db = get_db()
        
        update_data = {
            k: v for k, v in update.model_dump().items()
            if v is not None
        }
        
        if not update_data:
            return await self.get_user(user_id)
        
        update_data["updated_at"] = utc_now()
        
        result = await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            await self._invalidate_cache(user_id)  # Invalidate on update
            return await self.get_user(user_id)
        return None
    
    async def complete_onboarding(
        self,
        user_id: str,
        phone: str,
        gender: Optional[str],
        safety_consent: bool
    ) -> Optional[User]:
        """
        Complete user onboarding.
        
        Required:
        - phone: User's phone number
        - safety_consent: Must be True to proceed
        
        Optional:
        - gender: M/F/O or None
        """
        if not safety_consent:
            raise ValueError("Safety consent is required")
        
        if not phone or len(phone) < 10:
            raise ValueError("Valid phone number is required")
        
        db = get_db()
        
        update_data = {
            "phone": phone,
            "safety_consent": True,
            "onboarding_completed": True,
            "updated_at": utc_now()
        }
        
        if gender in ["M", "F", "O"]:
            update_data["gender"] = gender
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        return await self.get_user(user_id)
    
    async def enable_rider_mode(
        self,
        user_id: str,
        vehicle_type: str,
        from_lat: float,
        from_lng: float,
        from_label: str,
        to_lat: float,
        to_lng: float,
        to_label: str,
        date: str,
        time_window_start: str,
        time_window_end: str,
        seats: int
    ) -> Optional[User]:
        """
        Enable rider mode with vehicle and availability info.
        
        Rider availability expires after:
        - First successful ride, OR
        - 24 hours (configurable)
        """
        db = get_db()
        
        expires_at = utc_now() + timedelta(hours=settings.rider_availability_hours)
        
        rider_info = RiderInfo(
            vehicle_type=vehicle_type,
            from_location={"lat": from_lat, "lng": from_lng},
            from_label=from_label,
            to_location={"lat": to_lat, "lng": to_lng},
            to_label=to_label,
            date=date,
            time_window_start=time_window_start,
            time_window_end=time_window_end,
            seats=seats,
            expires_at=expires_at
        )
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "is_rider": True,
                "rider_info": rider_info.model_dump(),
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)
    
    async def disable_rider_mode(self, user_id: str) -> Optional[User]:
        """Disable rider mode."""
        db = get_db()
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "is_rider": False,
                "rider_info": None,
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)
    
    async def expire_rider_after_ride(self, user_id: str) -> None:
        """
        Expire rider availability after successful ride.
        
        Called when a rider's group is finalized.
        """
        await self.disable_rider_mode(user_id)
    
    async def update_fcm_token(self, user_id: str, fcm_token: str) -> None:
        """Update user's FCM token for push notifications."""
        db = get_db()
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "fcm_token": fcm_token,
                "updated_at": utc_now()
            }}
        )
    
    async def suspend_user(
        self,
        user_id: str,
        duration_hours: int,
        reason: Optional[str] = None
    ) -> Optional[User]:
        """
        Suspend a user for a specified duration.
        
        SECURITY: Admin action, must be logged.
        """
        db = get_db()
        
        expires_at = utc_now() + timedelta(hours=duration_hours)
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": UserStatus.SUSPENDED,
                "suspension_expires_at": expires_at,
                "ban_reason": reason,
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)
    
    async def ban_user(self, user_id: str, reason: str) -> Optional[User]:
        """
        Permanently ban a user.
        
        SECURITY: Admin action, must be logged.
        """
        db = get_db()
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": UserStatus.BANNED,
                "ban_reason": reason,
                "suspension_expires_at": None,
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)
    
    async def unban_user(self, user_id: str) -> Optional[User]:
        """
        Unban or unsuspend a user.
        
        SECURITY: Admin action, must be logged.
        """
        db = get_db()
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "status": UserStatus.ACTIVE,
                "ban_reason": None,
                "suspension_expires_at": None,
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)
    
    def mask_phone(self, phone: str) -> str:
        """
        Mask phone number for display in lists.
        
        Example: "555-123-4567" -> "***-***-4567"
        """
        if not phone or len(phone) < 4:
            return "***"
        return f"***-***-{phone[-4:]}"
    
    async def check_suspension_expired(self, user: User) -> bool:
        """
        Check if suspension has expired and update status if so.
        
        Returns True if user is now active.
        """
        if user.status != UserStatus.SUSPENDED:
            return user.status == UserStatus.ACTIVE
        
        if user.suspension_expires_at and user.suspension_expires_at < utc_now():
            db = get_db()
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {
                    "status": UserStatus.ACTIVE,
                    "suspension_expires_at": None,
                    "updated_at": utc_now()
                }}
            )
            return True
        
        return False
        
    async def search_users(self, query: str, limit: int = 5) -> list[User]:
        """
        Search users by name or email.
        """
        if not query or len(query) < 2:
            return []
            
        db = get_db()
        regex = {"$regex": query, "$options": "i"}
        
        cursor = db.users.find({
            "$or": [
                {"display_name": regex},
                {"email": regex}
            ]
        }).limit(limit)
        
        users = []
        async for doc in cursor:
            users.append(User(**doc))
            
        return users

    async def update_profile_image(self, user_id: str, image_data: bytes, content_type: str) -> Optional[User]:
        """
        Store profile image in MongoDB and update user photo_url.
        
        Using a separate collection 'user_avatars' to keep user documents light.
        """
        db = get_db()
        
        # 1. Upsert image data
        await db.user_avatars.update_one(
            {"user_id": user_id},
            {"$set": {
                "image_data": image_data,
                "content_type": content_type,
                "updated_at": utc_now()
            }},
            upsert=True
        )
        
        # 2. Update user photo_url to point to API
        # Store the relative path from domain root.
        from app.config import settings
        full_path = f"{settings.api_v1_str}/users/{user_id}/avatar"
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "photo_url": full_path,
                "updated_at": utc_now()
            }}
        )
        
        return await self.get_user(user_id)

    async def get_profile_image(self, user_id: str) -> Optional[dict]:
        """
        Get profile image data.
        Returns dict with 'image_data' (bytes) and 'content_type' (str).
        """
        db = get_db()
        doc = await db.user_avatars.find_one({"user_id": user_id})
        return doc
