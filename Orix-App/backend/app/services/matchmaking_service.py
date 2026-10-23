"""
Matchmaking Service

Route overlap scoring and match finding algorithm.
"""

import math
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from geopy.distance import geodesic

from app.database import get_db
from app.services.redis_service import RedisService
from app.models.user import UserStatus
from app.utils.timezone_utils import utc_now


class MatchmakingService:
    """
    Matchmaking engine for finding compatible ride requests.
    
    Scoring algorithm:
    1. Route overlap (primary) - geodesic distance comparison
    2. Time window compatibility
    3. Gender constraints (hard)
    4. Rider preference
    5. Trust score (hidden, server-side only)
    
    Prioritization order:
    1. Student-only passenger groups (best route overlap & time)
    2. Student riders (if passenger allows)
    3. Female-only constraint is HARD (never violated)
    4. Prefer groups of 2-4
    """
    
    def __init__(self):
        self.redis_service = RedisService()
        
        # Scoring weights (trust score removed - 60% route, 40% time)
        self.WEIGHT_ROUTE_OVERLAP = 0.6
        self.WEIGHT_TIME_COMPATIBILITY = 0.4
        
        # Thresholds
        self.MIN_MATCH_SCORE = 0.5
        self.MAX_PICKUP_DISTANCE_KM = 1.0  # Starting location must be within 1km (HARD)
        self.MAX_BEARING_DIFF_DEGREES = 45  # Route direction threshold for path overlap
        self.MAX_GROUP_SIZE = 4
        self.MIN_GROUP_SIZE = 1  # Groups can start with 1 member
    
    def calculate_route_overlap(
        self,
        pickup1: Tuple[float, float],
        drop1: Tuple[float, float],
        pickup2: Tuple[float, float],
        drop2: Tuple[float, float]
    ) -> float:
        """
        Calculate route overlap score between two requests.
        
        Scoring approach:
        1. Pickup proximity (HARD CONSTRAINT: within 1km)
        2. Route direction similarity (destinations on same path)
        3. Path convergence check (drops are along similar trajectory)
        
        Returns score between 0.0 (no overlap) and 1.0 (perfect match).
        Returns 0.0 if pickup distance > 1km (hard constraint).
        """
        # Calculate pickup distance - HARD CONSTRAINT
        pickup_distance = geodesic(pickup1, pickup2).kilometers
        
        # Pickup must be within 1km - this is a hard constraint
        if pickup_distance > self.MAX_PICKUP_DISTANCE_KM:
            return 0.0
        
        # Normalize pickup distance (closer = better)
        pickup_score = max(0, 1 - (pickup_distance / self.MAX_PICKUP_DISTANCE_KM))
        
        # Calculate route direction similarity using bearing angle
        # Vector from pickup to drop for each route
        v1 = (drop1[0] - pickup1[0], drop1[1] - pickup1[1])
        v2 = (drop2[0] - pickup2[0], drop2[1] - pickup2[1])
        
        # Cosine similarity of direction vectors
        dot_product = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
        mag2 = math.sqrt(v2[0]**2 + v2[1]**2)
        
        if mag1 == 0 or mag2 == 0:
            direction_score = 0
        else:
            cos_sim = dot_product / (mag1 * mag2)
            # Convert from [-1, 1] to [0, 1]
            direction_score = (cos_sim + 1) / 2
            
            # Check bearing angle difference (45 degree threshold)
            bearing_angle = math.degrees(math.acos(max(-1, min(1, cos_sim))))
            if bearing_angle > self.MAX_BEARING_DIFF_DEGREES:
                # Opposite or perpendicular directions - low score
                direction_score *= 0.3
        
        # Check if destinations are on the same path
        # This checks if drop2 lies roughly on the line from pickup1 to drop1 (or beyond)
        path_overlap_score = self._calculate_path_overlap(pickup1, drop1, drop2)
        
        # Combined route overlap score
        # 30% pickup proximity + 40% direction similarity + 30% path overlap
        route_score = (
            pickup_score * 0.3 +
            direction_score * 0.4 +
            path_overlap_score * 0.3
        )
        
        return route_score
    
    def _calculate_path_overlap(
        self,
        pickup: Tuple[float, float],
        drop1: Tuple[float, float],
        drop2: Tuple[float, float]
    ) -> float:
        """
        Check if drop2 is on the same path as pickup->drop1.
        
        Uses projection to determine if drop2 lies along or near the route.
        Returns 1.0 if drop2 is on the same path, decreasing as it deviates.
        """
        # Vector from pickup to drop1 (the reference route)
        route_vec = (drop1[0] - pickup[0], drop1[1] - pickup[1])
        route_length_sq = route_vec[0]**2 + route_vec[1]**2
        
        if route_length_sq == 0:
            # Zero-length route - check if drop2 is at same point
            dist = geodesic(drop1, drop2).kilometers
            return 1.0 if dist < 0.5 else 0.0
        
        # Vector from pickup to drop2
        drop2_vec = (drop2[0] - pickup[0], drop2[1] - pickup[1])
        
        # Project drop2 onto the route line
        t = (route_vec[0] * drop2_vec[0] + route_vec[1] * drop2_vec[1]) / route_length_sq
        
        # t < 0 means drop2 is behind pickup (wrong direction)
        # t = 0 means drop2 is at pickup
        # 0 < t < 1 means drop2 is between pickup and drop1
        # t = 1 means drop2 is at drop1
        # t > 1 means drop2 is beyond drop1 (same direction, further)
        
        if t < 0:
            # Drop2 is in opposite direction - no path overlap
            return 0.0
        
        # Calculate perpendicular distance from drop2 to the route line
        proj_point = (
            pickup[0] + t * route_vec[0],
            pickup[1] + t * route_vec[1]
        )
        perpendicular_dist = geodesic(drop2, proj_point).kilometers
        
        # If perpendicular distance is small (< 2km), destinations are on same path
        # Score decreases as perpendicular distance increases
        max_perpendicular_km = 2.0
        if perpendicular_dist > max_perpendicular_km:
            return 0.0
        
        path_score = 1.0 - (perpendicular_dist / max_perpendicular_km)
        
        # Bonus if drop2 is between pickup and drop1 (shared route segment)
        if 0 <= t <= 1:
            # drop2 is on the exact route segment - perfect overlap
            path_score = min(1.0, path_score * 1.2)
        elif t > 1 and t <= 2:
            # drop2 is a bit further but same direction - still good
            path_score *= 0.9
        elif t > 2:
            # drop2 is much further - reduce score
            path_score *= max(0.3, 1.0 - (t - 2) * 0.2)
        
        return max(0.0, min(1.0, path_score))
    
    def calculate_time_compatibility(
        self,
        start1: str,
        end1: str,
        start2: str,
        end2: str,
        flexible: bool = False
    ) -> float:
        """
        Calculate time compatibility score.
        
        If flexible=False (default): EXACT TIME MATCH REQUIRED.
        If flexible=True: Allow up to 1 hour difference with reduced score.
        
        Returns 1.0 for exact match, 0.5-0.9 for within 1 hour (if flexible), 0.0 otherwise.
        """
        # Require exact time match for full score
        if start1 == start2:
            return 1.0
        
        if not flexible:
            return 0.0
        
        # Flexible matching: calculate time difference
        def time_to_min(t: str) -> int:
            parts = t.split(":")
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            return h * 60 + m
        
        min1 = time_to_min(start1)
        min2 = time_to_min(start2)
        diff = abs(min1 - min2)
        
        # Max 1 hour (60 min) difference for flexible match
        if diff <= 60:
            # Score decreases linearly from 0.9 (close) to 0.5 (1 hour away)
            return 0.9 - (diff / 60) * 0.4
        
        return 0.0
    
    async def calculate_match_score(
        self,
        request1: Dict[str, Any],
        request2: Dict[str, Any],
        return_details: bool = False
    ) -> float:
        """
        Calculate overall match score between two requests.
        
        SECURITY: Gender constraints are enforced as hard constraints.
        Trust score has been removed - matching is based purely on route and time.
        
        Args:
            request1: First ride request data
            request2: Second ride request data
            return_details: If True, returns dict with score breakdown
        
        Returns:
            Score between 0.0 and 1.0, or dict with breakdown if return_details=True
        """
        # Hard constraint: female_only must match
        if request1["female_only"] or request2["female_only"]:
            # Both must be female_only if either is
            if request1["female_only"] != request2["female_only"]:
                if return_details:
                    return {"score": 0.0, "reason": "female_only_mismatch"}
                return 0.0
        
        # Route overlap score
        pickup1 = (request1["pickup_lat"], request1["pickup_lng"])
        drop1 = (request1["drop_lat"], request1["drop_lng"])
        pickup2 = (request2["pickup_lat"], request2["pickup_lng"])
        drop2 = (request2["drop_lat"], request2["drop_lng"])
        
        route_score = self.calculate_route_overlap(pickup1, drop1, pickup2, drop2)
        
        # Time compatibility score
        time_score = self.calculate_time_compatibility(
            request1["time_start"], request1["time_end"],
            request2["time_start"], request2["time_end"]
        )
        
        # Combined score (60% route, 40% time - trust score removed)
        score = (
            route_score * self.WEIGHT_ROUTE_OVERLAP +
            time_score * self.WEIGHT_TIME_COMPATIBILITY
        )
        
        if return_details:
            return {
                "score": score,
                "route_overlap": route_score,
                "time_compatibility": time_score,
                "weights": {
                    "route": self.WEIGHT_ROUTE_OVERLAP,
                    "time": self.WEIGHT_TIME_COMPATIBILITY
                }
            }
        
        return score
    
    async def get_nearby_request_ids(
        self,
        pickup_lat: float,
        pickup_lng: float,
        date: str,
        max_distance_meters: float = 1000
    ) -> List[str]:
        """
        Get request IDs within max_distance_meters of the given pickup location.
        
        Uses MongoDB $nearSphere geospatial query for efficient filtering.
        This pre-filters candidates before detailed scoring, reducing O(n²) to O(n).
        
        Args:
            pickup_lat: Latitude of pickup point
            pickup_lng: Longitude of pickup point  
            date: Date to filter requests
            max_distance_meters: Maximum distance in meters (default 1km)
            
        Returns:
            List of request_ids within the specified distance
        """
        db = get_db()
        
        # Use $nearSphere for geospatial filtering
        # Requires 2dsphere index on pickup.coordinates
        cursor = db.ride_requests.find({
            "status": "pending",
            "date": date,
            "pickup": {
                "$nearSphere": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [pickup_lng, pickup_lat]  # GeoJSON: [lng, lat]
                    },
                    "$maxDistance": max_distance_meters
                }
            }
        }, {"request_id": 1})
        
        request_ids = []
        async for doc in cursor:
            request_ids.append(doc["request_id"])
        
        return request_ids
    
    async def find_matches_for_request(
        self,
        request_id: str,
        date: str
    ) -> List[Tuple[str, float]]:
        """
        Find compatible matches for a given request.
        
        Uses geospatial pre-filtering for efficiency when possible.
        Uses Redis pipelining to batch fetch candidate data for scalability.
        
        Returns list of (request_id, score) tuples, sorted by score descending.
        """
        from app.database import get_redis
        from app.services.redis_service import RedisKeys
        
        # Get the source request
        source = await self.redis_service.get_request_data(request_id)
        if not source:
            return []
        
        # Try geospatial pre-filtering first for better performance
        pickup_lat = source.get("pickup_lat")
        pickup_lng = source.get("pickup_lng")
        
        nearby_ids = []
        if pickup_lat and pickup_lng:
            nearby_ids = await self.get_nearby_request_ids(
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                date=date,
                max_distance_meters=self.MAX_PICKUP_DISTANCE_KM * 1000
            )
        
        # Fall back to Redis queue if geospatial query returns nothing
        if not nearby_ids:
            nearby_ids = await self.redis_service.get_pending_requests(date)
        
        # Filter out self and get candidate IDs
        candidate_ids = [pid for pid in nearby_ids if pid != request_id]
        
        if not candidate_ids:
            return []
        
        # SCALABILITY FIX: Batch fetch all candidate data using Redis pipeline
        redis = get_redis()
        
        # First, batch check which are pending confirmation
        pipe = redis.pipeline()
        for pid in candidate_ids:
            pipe.get(RedisKeys.confirm_pending(pid))
        confirm_results = await pipe.execute()
        
        # Filter out candidates in confirmation
        filtered_ids = [
            pid for pid, is_pending in zip(candidate_ids, confirm_results)
            if not is_pending
        ]
        
        if not filtered_ids:
            return []
        
        # Batch fetch request data for all filtered candidates
        pipe = redis.pipeline()
        for pid in filtered_ids:
            pipe.hgetall(RedisKeys.match_request(pid))
        data_results = await pipe.execute()
        
        # Parse and score candidates
        matches = []
        for pid, data in zip(filtered_ids, data_results):
            if not data:
                continue
            
            # Parse request data (same format as redis_service.get_request_data)
            candidate = {
                "request_id": pid,
                "user_id": data.get("user_id", ""),
                "pickup_lat": float(data.get("pickup_lat", 0)),
                "pickup_lng": float(data.get("pickup_lng", 0)),
                "drop_lat": float(data.get("drop_lat", 0)),
                "drop_lng": float(data.get("drop_lng", 0)),
                "time_start": data.get("time_start", "00:00"),
                "time_end": data.get("time_end", "23:59"),
                "female_only": data.get("female_only") == "1",
                "allow_riders": data.get("allow_riders") == "1",
            }
            
            score = await self.calculate_match_score(source, candidate)
            
            if score >= self.MIN_MATCH_SCORE:
                matches.append((pid, score))
        
        # Sort by score descending
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches
    
    async def find_best_group(
        self,
        request_id: str,
        date: str
    ) -> Optional[List[str]]:
        """
        Find the best group of compatible requests.
        
        Prioritizes:
        1. Groups of 2-4 passengers
        2. Highest combined compatibility score
        
        Returns [request_id] for single passengers if no matches found,
        allowing them to be matched with riders.
        """
        matches = await self.find_matches_for_request(request_id, date)
        
        # Simple greedy grouping: take top matches up to max size
        group = [request_id]
        
        if matches:
            for match_id, score in matches:
                if len(group) >= self.MAX_GROUP_SIZE:
                    break
                
                # Verify compatibility with all existing group members
                compatible = True
                source = await self.redis_service.get_request_data(match_id)
                
                for existing_id in group:
                    if existing_id == match_id:
                        continue
                    existing = await self.redis_service.get_request_data(existing_id)
                    if existing:
                        pair_score = await self.calculate_match_score(source, existing)
                        if pair_score < self.MIN_MATCH_SCORE:
                            compatible = False
                            break
                
                if compatible:
                    group.append(match_id)
        
        # Always return at least the single request (MIN_GROUP_SIZE=1)
        # This allows solo passengers to be matched with riders
        if len(group) >= self.MIN_GROUP_SIZE:
            return group
        
        return None
    
    def calculate_rider_overlap(
        self,
        rider_pickup: Tuple[float, float],
        rider_drop: Tuple[float, float],
        passenger_pickup: Tuple[float, float],
        passenger_drop: Tuple[float, float]
    ) -> float:
        """
        Calculate if a passenger's trip is a subset of the rider's trip.
        
        Unlike calculate_route_overlap (which expects similar start/end points),
        this checks if the passenger is "on the way" for the rider.
        
        Algorithm:
        1. Project Passenger Pickup onto Rider Path.
        2. Project Passenger Drop onto Rider Path.
        3. Valid if both are on the path, and Drop is after Pickup.
        """
        # Vector from Rider Pickup to Rider Drop
        route_vec = (rider_drop[0] - rider_pickup[0], rider_drop[1] - rider_pickup[1])
        route_length_sq = route_vec[0]**2 + route_vec[1]**2
        
        if route_length_sq == 0:
            return 0.0

        # Helper to project point onto line (returns t, dist)
        def project_point(p, start, vec, len_sq):
            p_vec = (p[0] - start[0], p[1] - start[1])
            t = (vec[0] * p_vec[0] + vec[1] * p_vec[1]) / len_sq
            
            proj = (start[0] + t * vec[0], start[1] + t * vec[1])
            dist = geodesic(p, proj).kilometers
            return t, dist

        # Project Passenger Pickup
        t_pickup, dist_pickup = project_point(passenger_pickup, rider_pickup, route_vec, route_length_sq)
        
        # Project Passenger Drop
        t_drop, dist_drop = project_point(passenger_drop, rider_pickup, route_vec, route_length_sq)
        
        # Constraints
        # 1. Passenger must be close to the route (< 2km deviation)
        MAX_DEVIATION_KM = 3.0 # Increased to 3km to be more generous
        if dist_pickup > MAX_DEVIATION_KM or dist_drop > MAX_DEVIATION_KM:
            return 0.0
            
        # 2. Passenger pickup must be "along" the rider's path (0 <= t <= 1)
        # We allow a small buffer (t > -0.1) in case they start slightly behind
        if t_pickup < -0.1 or t_pickup > 1.1:
            return 0.0
            
        # 3. Passenger drop must be "along" the rider's path
        if t_drop < -0.1 or t_drop > 1.1:
            return 0.0
            
        # 4. Drop must be AFTER pickup (t_drop > t_pickup)
        if t_drop <= t_pickup:
            return 0.0
            
        # Calculate scores
        # Proximity score (closer to line is better)
        deviation_score = 1.0 - (max(dist_pickup, dist_drop) / MAX_DEVIATION_KM)
        
        # Percentage of rider's route utilized by passenger
        utilization = t_drop - t_pickup
        
        # Final score is mostly about creating a valid match, deviation matters
        return max(0.0, deviation_score)

    async def check_riders_for_group(
        self,
        request_ids: List[str],
        date: str
    ) -> Optional[Tuple[str, int]]:
        """
        Check if any available rider matches the group route.
        
        Returns (rider_user_id, seat_capacity) if found, None otherwise.
        Respects allow_riders flag - if any passenger opts out, no rider matching.
        """
        db = get_db()
        
        # Get average pickup/drop for the group
        pickups_lat = []
        pickups_lng = []
        drops_lat = []
        drops_lng = []
        
        any_female_only = False
        all_allow_riders = True
        group_time_start = "00:00"
        
        for rid in request_ids:
            data = await self.redis_service.get_request_data(rid)
            if data:
                if not data.get("allow_riders", True):
                    all_allow_riders = False
                
                if len(pickups_lat) == 0:
                    group_time_start = data.get("time_start", "00:00")
                
                pickups_lat.append(data["pickup_lat"])
                pickups_lng.append(data["pickup_lng"])
                drops_lat.append(data["drop_lat"])
                drops_lng.append(data["drop_lng"])
                if data["female_only"]:
                    any_female_only = True
        
        if not all_allow_riders:
            return None
        
        if not pickups_lat:
            return None
        
        avg_pickup = (sum(pickups_lat) / len(pickups_lat), sum(pickups_lng) / len(pickups_lng))
        avg_drop = (sum(drops_lat) / len(drops_lat), sum(drops_lng) / len(drops_lng))
        
        # Find riders matching criteria
        query = {
            "is_rider": True,
            "status": UserStatus.ACTIVE,  # Fixed: use enum instead of string
            "rider_info.date": date,
            "rider_info.expires_at": {"$gt": utc_now()}
        }
        
        if any_female_only:
            query["gender"] = "F"
        
        cursor = db.users.find(query)
        
        best_rider = None
        best_score = 0
        best_rider_seats = 0
        
        async for rider in cursor:
            rider_info = rider.get("rider_info", {})
            rider_from = rider_info.get("from_location", {})
            rider_to = rider_info.get("to_location", {})
            
            rider_pickup = (rider_from.get("lat", 0), rider_from.get("lng", 0))
            rider_drop = (rider_to.get("lat", 0), rider_to.get("lng", 0))
            
            # USE NEW RIDER OVERLAP LOGIC
            score = self.calculate_rider_overlap(
                rider_pickup, rider_drop,
                avg_pickup, avg_drop
            )
            
            if score < self.MIN_MATCH_SCORE:
                continue
            
            # Check time compatibility with rider's time window
            rider_time_start = rider_info.get("time_window_start", "00:00")
            rider_time_end = rider_info.get("time_window_end", "23:59")
            
            def time_to_min(t):
                h, m = map(int, t.split(":"))
                return h * 60 + m
            
            group_min = time_to_min(group_time_start)
            rider_start_min = time_to_min(rider_time_start)
            rider_end_min = time_to_min(rider_time_end)
            
            # Check if group wants to leave within Rider's availability window
            if not (rider_start_min <= group_min <= rider_end_min):
                continue
            
            if score > best_score:
                seats = rider_info.get("seats", 1)
                if seats >= 1:
                    best_score = score
                    best_rider = rider["user_id"]
                    best_rider_seats = seats
        
        if best_rider:
            return (best_rider, best_rider_seats)
        return None
    
    async def find_matching_group(
        self,
        request_id: str,
        date: str,
        pickup_lat: float,
        pickup_lng: float,
        drop_lat: float,
        drop_lng: float,
        time_start: str,
        time_end: str,
        female_only: bool
    ) -> Optional[str]:
        """
        Find an existing group that matches the ride request criteria.
        
        Matching strategy:
        1. First, try to find groups with EXACT time match
        2. If no exact match, try flexible matching (up to 1 hour difference)
        
        Returns group_id if a matching group is found, None otherwise.
        """
        # First pass: exact time match
        result = await self._find_matching_group_with_flexibility(
            date=date,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            drop_lat=drop_lat,
            drop_lng=drop_lng,
            time_start=time_start,
            time_end=time_end,
            female_only=female_only,
            flexible_time=False
        )
        
        if result:
            return result
        
        # Second pass: flexible time match (up to 1 hour difference)
        return await self._find_matching_group_with_flexibility(
            date=date,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            drop_lat=drop_lat,
            drop_lng=drop_lng,
            time_start=time_start,
            time_end=time_end,
            female_only=female_only,
            flexible_time=True
        )
    
    async def _find_matching_group_with_flexibility(
        self,
        date: str,
        pickup_lat: float,
        pickup_lng: float,
        drop_lat: float,
        drop_lng: float,
        time_start: str,
        time_end: str,
        female_only: bool,
        flexible_time: bool = False
    ) -> Optional[str]:
        """
        Internal method to find matching groups with optional time flexibility.
        """
        db = get_db()
        from app.models.ride_group import GroupStatus
        
        # Find pending/confirming/active groups for the same date with room
        cursor = db.ride_groups.find({
            "status": {"$in": [GroupStatus.PENDING, GroupStatus.CONFIRMING, GroupStatus.ACTIVE]},
            "date": date,
            "$expr": {"$lt": [{"$size": "$members"}, self.MAX_GROUP_SIZE]}
        })
        
        user_pickup = (pickup_lat, pickup_lng)
        user_drop = (drop_lat, drop_lng)
        
        best_group = None
        best_score = 0
        
        async for group in cursor:
            # Check if group has members
            members = group.get("members", [])
            if not members:
                continue

            # Get the first member's request to compare routes
            first_member = members[0]
            first_user_id = first_member.get("user_id")
            
            if not first_user_id:
                continue
            
            # Get the first member's ride request
            first_request = await db.ride_requests.find_one({
                "user_id": first_user_id,
                "group_id": group["group_id"]
            })
            
            if not first_request:
                continue
            
            # Check if female_only constraint is compatible
            # Check if female_only constraint is compatible
            # TRY REDIS FIRST
            first_req_data = await self.redis_service.get_request_data(first_request.get("request_id", ""))
            
            # FALLBACK TO MONGODB IF REDIS DATA IS MISSING 
            if not first_req_data:
                first_req_data = first_request  # Already fetched from DB above
                # Normalize keys to match Redis dict structure if needed, or access directly
                # MongoDB fields: female_only (bool)
                is_group_female_only = first_req_data.get("female_only", False)
            else:
                is_group_female_only = first_req_data.get("female_only")

            if is_group_female_only != female_only:
                continue
            
            # Get group's pickup/drop coordinates
            group_pickup = first_request.get("pickup", {})
            group_drop = first_request.get("drop", {})
            
            group_pickup_coords = (
                group_pickup.get("coordinates", [0, 0])[1],  # lat
                group_pickup.get("coordinates", [0, 0])[0]   # lng
            )
            group_drop_coords = (
                group_drop.get("coordinates", [0, 0])[1],
                group_drop.get("coordinates", [0, 0])[0]
            )
            
            # Calculate route compatibility
            score = self.calculate_route_overlap(
                user_pickup, user_drop,
                group_pickup_coords, group_drop_coords
            )
            
            if score < self.MIN_MATCH_SCORE:
                continue
            
            # Check time window compatibility (with optional flexibility)
            group_time = first_request.get("time_window", {})
            start_time_str = group_time.get("start", "00:00")
            
            # Note: Time-based restriction for joining active groups removed
            # Users can join any active/confirming group regardless of time remaining
            
            time_compat = self.calculate_time_compatibility(
                time_start, time_end,
                start_time_str,
                group_time.get("end", "23:59"),
                flexible=flexible_time
            )
            
            if time_compat == 0:
                continue
            
            combined_score = score * 0.7 + time_compat * 0.3
            
            if combined_score > best_score:
                best_score = combined_score
                best_group = group["group_id"]
        
        return best_group
    
    async def add_user_to_group(
        self,
        group_id: str,
        user_id: str,
        request_id: str
    ) -> bool:
        """
        Add a user to an existing group.
        
        Returns True if successful, False otherwise.
        """
        db = get_db()
        from app.models.ride_request import RideRequestStatus
        
        # Add member to group AND ensure status is back to CONFIRMING
        # This handles the case where a group was already ACTIVE but we added a new member
        result = await db.ride_groups.update_one(
            {
                "group_id": group_id,
                "$expr": {"$lt": [{"$size": "$members"}, self.MAX_GROUP_SIZE]}
            },
            {
                "$push": {
                    "members": {
                        "user_id": user_id,
                        "role": "passenger",
                        "readiness_confirmed": False,
                        "joined_at": utc_now()
                    }
                },
                "$set": {
                    "status": "confirming", # Reset to confirming so everyone (including new member) has to confirm
                    "finalized_at": None,   # Clear finalization
                    "updated_at": utc_now()
                }
            }
        )
        
        if result.modified_count == 0:
            return False
        
        # Update ride request with group assignment for the new user
        
        # Safer: Just update the new user first
        await db.ride_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": RideRequestStatus.MATCHED,
                    "group_id": group_id,
                    "matched_at": utc_now()
                }
            }
        )
        
        # Now update ALL members of the group to MATCHED status
        # This handles the case where a user was "EXPIRED" (passive) but now got a match
        updated_group = await db.ride_groups.find_one({"group_id": group_id})
        if updated_group:
            member_user_ids = [m["user_id"] for m in updated_group.get("members", [])]
            if member_user_ids:
                await db.ride_requests.update_many(
                    {"user_id": {"$in": member_user_ids}, "group_id": group_id},
                    {"$set": {"status": RideRequestStatus.MATCHED}}
                )

        # Remove from Redis matchmaking queue
        request_data = await self.redis_service.get_request_data(request_id)
        if request_data:
            await self.redis_service.remove_from_queue(
                request_id=request_id,
                user_id=user_id,
                date=request_data.get("date", "")
            )
        
        return True
    
    async def create_group_for_user(
        self,
        user_id: str,
        request_id: str,
        date: str,
        pickup_label: str,
        drop_label: str,
        time_window: Dict[str, str],
        expires_at: datetime,
        timezone_offset_minutes: int,
        female_only: bool = False
    ) -> str:
        """
        Create a new group with the user as the first (and potentially only) member.
        
        Returns the new group_id.
        """
        import uuid
        from app.models.ride_group import GroupStatus
        from app.models.ride_request import RideRequestStatus
        from app.config import settings
        from datetime import timedelta
        
        db = get_db()
        
        group_id = str(uuid.uuid4())
        
        # Determine route summary
        route_summary = f"{pickup_label} → {drop_label}"
        confirmation_deadline = utc_now() + timedelta(minutes=settings.readiness_timeout_minutes)
        
        group_data = {
            "group_id": group_id,
            "status": GroupStatus.PENDING,
            "date": date,  # CRITICAL: Required for matchmaking query
            "time_window": time_window,  # CRITICAL: Required for time matching
            "timezone_offset_minutes": timezone_offset_minutes,  # For correct time calculation
            "members": [{
                "user_id": user_id,
                "role": "passenger",
                "readiness_confirmed": False,
                "joined_at": utc_now()
            }],
            "route_summary": route_summary,
            "pickup_summary": pickup_label,
            "drop_summary": drop_label,
            "female_only": female_only,  # Use passed val
            "confirmation_deadline": confirmation_deadline,
            "created_at": utc_now(),
            "finalized_at": None,
            "expires_at": expires_at
        }
        
        await db.ride_groups.insert_one(group_data)
        
        # Update ride request with group assignment and MATCHED status
        await db.ride_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": RideRequestStatus.MATCHED,
                    "group_id": group_id,
                    "matched_at": utc_now()
                }
            }
        )
        
        return group_id

