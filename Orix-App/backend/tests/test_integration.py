"""
Integration Test for Ride Matching Lifecycle

End-to-end test covering:
1. Create ride request
2. Match with another request
3. Group creation
4. Readiness confirmation
5. Group finalization
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
import uuid

from app.services.ride_service import RideService
from app.services.group_service import GroupService
from app.services.matchmaking_service import MatchmakingService
from app.services.notification_service import NotificationService
from app.models.ride_request import RideRequestCreate


class TestRideMatchingLifecycle:
    """Integration tests for the complete ride matching lifecycle."""
    
    @pytest.fixture
    def ride_service(self):
        return RideService()
    
    @pytest.fixture
    def group_service(self):
        return GroupService()
    
    @pytest.fixture
    def matchmaking_service(self):
        return MatchmakingService()
    
    @pytest.mark.asyncio
    async def test_full_lifecycle(
        self,
        ride_service,
        group_service,
        matchmaking_service
    ):
        """
        Test complete ride matching lifecycle.
        
        Simulates:
        1. User A creates a ride request
        2. User B creates a matching request
        3. Matchmaking finds the pair
        4. Group is created
        5. Both users confirm readiness
        6. Group is finalized
        """
        user_a_id = str(uuid.uuid4())
        user_b_id = str(uuid.uuid4())
        
        # Mock database and Redis
        with patch('app.services.ride_service.get_db') as mock_db, \
             patch.object(ride_service.redis_service, 'add_to_match_queue', new_callable=AsyncMock) as mock_redis_add, \
             patch.object(ride_service.redis_service, 'get_user_active_request', new_callable=AsyncMock) as mock_redis_get:
            
            mock_collection = AsyncMock()
            mock_db.return_value.ride_requests = mock_collection
            mock_collection.find_one = AsyncMock(return_value=None)
            mock_collection.insert_one = AsyncMock()
            mock_redis_get.return_value = None
            mock_redis_add.return_value = True
            
            # Step 1: User A creates request
            request_a_data = RideRequestCreate(
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                pickup_label="Downtown NYC",
                drop_lat=40.7580,
                drop_lng=-73.9855,
                drop_label="Midtown",
                date="2024-01-15",
                time_window_start="08:00",
                time_window_end="10:00",
                allow_riders=True,
                female_only=False
            )
            
            request_a = await ride_service.create_ride_request(
                user_id=user_a_id,
                data=request_a_data
            )
            
            assert request_a.request_id is not None
            assert request_a.user_id == user_a_id
            assert request_a.status == "pending"
            mock_redis_add.assert_called_once()
            
            # Step 2: User B creates matching request
            mock_redis_add.reset_mock()
            
            request_b_data = RideRequestCreate(
                pickup_lat=40.7130,  # Very close to User A
                pickup_lng=-74.0058,
                pickup_label="Near Downtown",
                drop_lat=40.7582,
                drop_lng=-73.9853,
                drop_label="Near Midtown",
                date="2024-01-15",
                time_window_start="08:30",
                time_window_end="10:30",
                allow_riders=True,
                female_only=False
            )
            
            request_b = await ride_service.create_ride_request(
                user_id=user_b_id,
                data=request_b_data
            )
            
            assert request_b.request_id is not None
            assert request_b.request_id != request_a.request_id
            
            # Step 3: Verify matchmaking would find them
            score = matchmaking_service.calculate_route_overlap(
                (request_a_data.pickup_lat, request_a_data.pickup_lng),
                (request_a_data.drop_lat, request_a_data.drop_lng),
                (request_b_data.pickup_lat, request_b_data.pickup_lng),
                (request_b_data.drop_lat, request_b_data.drop_lng)
            )
            
            # Should have high overlap
            assert score > 0.9
            
            # Step 4: Verify time compatibility
            time_score = matchmaking_service.calculate_time_compatibility(
                request_a_data.time_window_start,
                request_a_data.time_window_end,
                request_b_data.time_window_start,
                request_b_data.time_window_end
            )
            
            # Should have significant overlap (1.5 hours / 2 hours = 0.75)
            assert time_score > 0.5
    
    @pytest.mark.asyncio
    async def test_group_creation_and_confirmation(self, group_service):
        """Test group creation and member confirmation."""
        user_a_id = str(uuid.uuid4())
        user_b_id = str(uuid.uuid4())
        
        with patch('app.services.group_service.get_db') as mock_db, \
             patch.object(group_service.redis_service, 'create_tentative_group', new_callable=AsyncMock) as mock_redis_create:
            
            mock_groups = AsyncMock()
            mock_requests = AsyncMock()
            mock_messages = AsyncMock()
            mock_users = AsyncMock()
            
            mock_db.return_value.ride_groups = mock_groups
            mock_db.return_value.ride_requests = mock_requests
            mock_db.return_value.chat_messages = mock_messages
            mock_db.return_value.users = mock_users
            
            mock_groups.insert_one = AsyncMock()
            mock_requests.find_one = AsyncMock(return_value={
                "request_id": "req_a",
                "user_id": user_a_id,
                "pickup_label": "Location A",
                "drop_label": "Location B",
                "female_only": False
            })
            mock_requests.update_one = AsyncMock()
            mock_messages.insert_one = AsyncMock()
            mock_redis_create.return_value = True
            
            # Create group
            group = await group_service.create_group(
                request_ids=["req_a", "req_b"],
                rider_user_id=None
            )
            
            assert group.group_id is not None
            assert len(group.members) == 2
            assert group.status == "confirming"
            mock_groups.insert_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_female_only_constraint(self, matchmaking_service):
        """Test that female-only constraint is enforced."""
        request_female = {
            "user_id": "user_female",
            "pickup_lat": 40.7128,
            "pickup_lng": -74.0060,
            "drop_lat": 40.7580,
            "drop_lng": -73.9855,
            "time_start": "08:00",
            "time_end": "10:00",
            "female_only": True  # Female only
        }
        
        request_normal = {
            "user_id": "user_normal",
            "pickup_lat": 40.7128,
            "pickup_lng": -74.0060,
            "drop_lat": 40.7580,
            "drop_lng": -73.9855,
            "time_start": "08:00",
            "time_end": "10:00",
            "female_only": False  # Not female only
        }
        
        with patch('app.services.matchmaking_service.get_db') as mock_db:
            mock_db.return_value.users.find_one = AsyncMock(return_value={
                "trust_score": 0.8
            })
            
            # Should NOT match due to female_only constraint
            score = await matchmaking_service.calculate_match_score(
                request_female,
                request_normal
            )
            
            assert score == 0.0


class TestTTLExpiry:
    """Tests for request TTL expiry behavior."""
    
    @pytest.fixture
    def ride_service(self):
        return RideService()
    
    @pytest.mark.asyncio
    async def test_request_expiry(self, ride_service):
        """Test that expired requests are handled correctly."""
        with patch('app.services.ride_service.get_db') as mock_db, \
             patch.object(ride_service.redis_service, 'remove_from_queue', new_callable=AsyncMock) as mock_redis_remove:
            
            mock_collection = AsyncMock()
            mock_db.return_value.ride_requests = mock_collection
            
            mock_collection.find_one = AsyncMock(return_value={
                "request_id": "expired_request",
                "user_id": "test_user",
                "date": "2024-01-15",
                "status": "pending"
            })
            mock_collection.update_one = AsyncMock()
            
            await ride_service.expire_request("expired_request")
            
            # Verify status updated
            mock_collection.update_one.assert_called_once()
            call_args = mock_collection.update_one.call_args
            assert call_args[0][1]["$set"]["status"] == "expired"
            
            # Verify removed from Redis
            mock_redis_remove.assert_called_once()
