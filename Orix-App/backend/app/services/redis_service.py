"""Redis Service - Redis key management for ephemeral matchmaking state."""

import json
from datetime import timedelta
from typing import Optional, List, Dict, Any

from app.config import settings
from app.database import get_redis
from app.utils.timezone_utils import utc_now


# =============================================================================
# Redis Key Naming Convention
# =============================================================================
#
# All keys are namespaced under "orix:" prefix.
#
# Key patterns:
# - orix:match:queue:{date}     - Sorted set of pending requests for a date
# - orix:match:request:{id}     - Hash containing request details
# - orix:match:user:{user_id}   - String containing user's active request_id
# - orix:match:group:{id}       - Hash containing tentative group details
# - orix:match:confirm:{req_id} - String containing group_id awaiting confirmation
#
# TTL rules:
# - Request data: 15 hours (MATCHMAKING_TTL_HOURS)
# - Tentative groups: 60 minutes (READINESS_TIMEOUT_MINUTES)
# - User active request: 15 hours (same as request)
#
# =============================================================================


class RedisKeys:
    """Redis key builders with documentation."""
    
    @staticmethod
    def match_queue(date: str) -> str:
        """
        Sorted set of pending requests for a specific date.
        Score is the request creation timestamp for FIFO ordering.
        """
        return f"orix:match:queue:{date}"
    
    @staticmethod
    def match_request(request_id: str) -> str:
        """
        Hash containing request details for matchmaking.
        Fields: user_id, pickup_lat, pickup_lng, drop_lat, drop_lng,
                time_start, time_end, female_only, allow_riders, created_at
        """
        return f"orix:match:request:{request_id}"
    
    @staticmethod
    def user_active_request(user_id: str) -> str:
        """
        String containing user's active request_id.
        Users can only have one active request at a time.
        """
        return f"orix:match:user:{user_id}"
    
    @staticmethod
    def tentative_group(group_id: str) -> str:
        """
        Hash containing tentative group awaiting confirmation.
        Fields: member_ids (JSON array), deadline, created_at
        """
        return f"orix:match:group:{group_id}"
    
    @staticmethod
    def confirm_pending(request_id: str) -> str:
        """
        String containing group_id that request is awaiting confirmation for.
        """
        return f"orix:match:confirm:{request_id}"
    
    @staticmethod
    def maintenance_mode() -> str:
        """Flag indicating maintenance mode is active."""
        return "orix:maintenance"
    
    @staticmethod
    def user_session(user_id: str) -> str:
        """String containing user's session start timestamp (ISO format)."""
        return f"orix:session:{user_id}"


class RedisService:
    """
    Redis service for matchmaking state management.
    
    All matchmaking state is ephemeral and stored in Redis with TTL.
    MongoDB is the source of truth; Redis state can be reconciled
    from MongoDB on startup.
    """
    
    def __init__(self):
        self.ttl_seconds = settings.matchmaking_ttl_minutes * 60
        self.confirm_ttl_seconds = settings.readiness_timeout_minutes * 60
    
    async def add_to_match_queue(
        self,
        request_id: str,
        user_id: str,
        date: str,
        pickup_lat: float,
        pickup_lng: float,
        drop_lat: float,
        drop_lng: float,
        time_start: str,
        time_end: str,
        female_only: bool,
        allow_riders: bool
    ) -> bool:
        """
        Add a ride request to the matchmaking queue.
        
        Returns True if successfully added.
        Uses atomic SETNX to prevent race conditions.
        """
        redis = get_redis()
        
        # RACE CONDITION FIX: Use atomic SETNX instead of check-then-set
        # This ensures only one request can claim the "active request" slot
        was_set = await redis.setnx(
            RedisKeys.user_active_request(user_id),
            request_id
        )
        
        if not was_set:
            # User already has an active request
            return False
        
        # Set TTL on the active request key
        await redis.expire(RedisKeys.user_active_request(user_id), self.ttl_seconds)
        
        # Store request details
        request_data = {
            "user_id": user_id,
            "pickup_lat": str(pickup_lat),
            "pickup_lng": str(pickup_lng),
            "drop_lat": str(drop_lat),
            "drop_lng": str(drop_lng),
            "time_start": time_start,
            "time_end": time_end,
            "female_only": "1" if female_only else "0",
            "allow_riders": "1" if allow_riders else "0",
            "created_at": utc_now().isoformat(),
            "date": date  # Store date for reference
        }
        
        pipe = redis.pipeline()
        
        # Store request details with TTL
        pipe.hset(RedisKeys.match_request(request_id), mapping=request_data)
        pipe.expire(RedisKeys.match_request(request_id), self.ttl_seconds)
        
        # Add to queue sorted set (score = timestamp for FIFO)
        score = utc_now().timestamp()
        pipe.zadd(RedisKeys.match_queue(date), {request_id: score})
        
        await pipe.execute()
        return True
    
    async def remove_from_queue(self, request_id: str, user_id: str, date: str) -> None:
        """Remove a request from the matchmaking queue."""
        redis = get_redis()
        
        pipe = redis.pipeline()
        pipe.delete(RedisKeys.match_request(request_id))
        pipe.zrem(RedisKeys.match_queue(date), request_id)
        pipe.delete(RedisKeys.user_active_request(user_id))
        pipe.delete(RedisKeys.confirm_pending(request_id))
        await pipe.execute()
    
    async def get_request_data(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get request data from Redis."""
        redis = get_redis()
        data = await redis.hgetall(RedisKeys.match_request(request_id))
        if not data:
            return None
        
        # Convert back to proper types
        return {
            "request_id": request_id,
            "user_id": data["user_id"],
            "pickup_lat": float(data["pickup_lat"]),
            "pickup_lng": float(data["pickup_lng"]),
            "drop_lat": float(data["drop_lat"]),
            "drop_lng": float(data["drop_lng"]),
            "time_start": data["time_start"],
            "time_end": data["time_end"],
            "female_only": data["female_only"] == "1",
            "allow_riders": data["allow_riders"] == "1",
            "created_at": data["created_at"]
        }
    
    async def get_pending_requests(self, date: str) -> List[str]:
        """Get all pending request IDs for a date, oldest first."""
        redis = get_redis()
        return await redis.zrange(RedisKeys.match_queue(date), 0, -1)
    
    async def get_user_active_request(self, user_id: str) -> Optional[str]:
        """Get user's active request ID if any."""
        redis = get_redis()
        return await redis.get(RedisKeys.user_active_request(user_id))
    
    async def create_tentative_group(
        self,
        group_id: str,
        request_ids: List[str]
    ) -> bool:
        """
        Create a tentative group awaiting confirmation.
        
        All members have READINESS_TIMEOUT_MINUTES to confirm.
        """
        redis = get_redis()
        
        deadline = utc_now() + timedelta(
            minutes=settings.readiness_timeout_minutes
        )
        
        group_data = {
            "member_request_ids": json.dumps(request_ids),
            "deadline": deadline.isoformat(),
            "created_at": utc_now().isoformat()
        }
        
        pipe = redis.pipeline()
        
        # Store group data
        pipe.hset(RedisKeys.tentative_group(group_id), mapping=group_data)
        pipe.expire(RedisKeys.tentative_group(group_id), self.confirm_ttl_seconds)
        
        # Mark each request as pending confirmation
        for req_id in request_ids:
            pipe.set(
                RedisKeys.confirm_pending(req_id),
                group_id,
                ex=self.confirm_ttl_seconds
            )
        
        await pipe.execute()
        return True
    
    async def get_tentative_group(self, group_id: str) -> Optional[Dict[str, Any]]:
        """Get tentative group data."""
        redis = get_redis()
        data = await redis.hgetall(RedisKeys.tentative_group(group_id))
        if not data:
            return None
        
        return {
            "group_id": group_id,
            "member_request_ids": json.loads(data["member_request_ids"]),
            "deadline": data["deadline"],
            "created_at": data["created_at"]
        }
    
    async def get_pending_confirmation(self, request_id: str) -> Optional[str]:
        """Get group_id if request is pending confirmation."""
        redis = get_redis()
        return await redis.get(RedisKeys.confirm_pending(request_id))
    
    async def remove_tentative_group(self, group_id: str) -> None:
        """Remove a tentative group and its confirmation markers."""
        redis = get_redis()
        
        # Get member request IDs first
        group_data = await self.get_tentative_group(group_id)
        if not group_data:
            return
        
        pipe = redis.pipeline()
        pipe.delete(RedisKeys.tentative_group(group_id))
        
        for req_id in group_data["member_request_ids"]:
            pipe.delete(RedisKeys.confirm_pending(req_id))
        
        await pipe.execute()
    
    async def set_maintenance_mode(self, enabled: bool) -> None:
        """Set or clear maintenance mode flag."""
        redis = get_redis()
        if enabled:
            await redis.set(RedisKeys.maintenance_mode(), "1")
        else:
            await redis.delete(RedisKeys.maintenance_mode())
    
    async def is_maintenance_mode(self) -> bool:
        """Check if maintenance mode is active."""
        redis = get_redis()
        return await redis.exists(RedisKeys.maintenance_mode()) > 0
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """Get matchmaking queue statistics.
        
        Uses SCAN instead of KEYS to avoid blocking Redis.
        """
        redis = get_redis()
        
        # SCALABILITY FIX: Use SCAN instead of KEYS
        # KEYS is O(n) and blocks Redis; SCAN is non-blocking
        stats = {}
        cursor = 0
        while True:
            cursor, keys = await redis.scan(cursor, match="orix:match:queue:*", count=100)
            for key in keys:
                date = key.split(":")[-1]
                count = await redis.zcard(key)
                stats[date] = count
            if cursor == 0:
                break
        
        return stats
