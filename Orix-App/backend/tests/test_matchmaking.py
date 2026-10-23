"""
Tests for Matchmaking Service

Unit tests for route overlap scoring, time compatibility, and match finding.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.matchmaking_service import MatchmakingService


class TestMatchmakingService:
    """Tests for MatchmakingService."""
    
    @pytest.fixture
    def service(self):
        return MatchmakingService()
    
    # =========================================================================
    # Route Overlap Tests
    # =========================================================================
    
    def test_route_overlap_identical_routes(self, service):
        """Identical routes should have score of 1.0."""
        pickup = (40.7128, -74.0060)  # NYC
        drop = (40.7580, -73.9855)    # Midtown
        
        score = service.calculate_route_overlap(
            pickup, drop, pickup, drop
        )
        
        assert score == 1.0
    
    def test_route_overlap_nearby_routes(self, service):
        """Nearby routes should have high overlap score."""
        pickup1 = (40.7128, -74.0060)
        drop1 = (40.7580, -73.9855)
        
        # Slightly offset
        pickup2 = (40.7130, -74.0058)
        drop2 = (40.7582, -73.9853)
        
        score = service.calculate_route_overlap(
            pickup1, drop1, pickup2, drop2
        )
        
        assert score > 0.9
    
    def test_route_overlap_distant_routes(self, service):
        """Distant routes should have low overlap score."""
        # NYC
        pickup1 = (40.7128, -74.0060)
        drop1 = (40.7580, -73.9855)
        
        # LA
        pickup2 = (34.0522, -118.2437)
        drop2 = (34.1478, -118.1445)
        
        score = service.calculate_route_overlap(
            pickup1, drop1, pickup2, drop2
        )
        
        assert score == 0.0
    
    def test_route_overlap_same_direction(self, service):
        """Routes in same direction should score higher than opposite."""
        start = (40.7128, -74.0060)
        end_same = (40.7580, -73.9855)  # North
        end_opposite = (40.6700, -74.0200)  # South
        
        # Second route going north
        score_same = service.calculate_route_overlap(
            start, end_same,
            (40.7150, -74.0040), (40.7600, -73.9835)
        )
        
        # Second route going south (opposite)
        score_opposite = service.calculate_route_overlap(
            start, end_same,
            (40.7150, -74.0040), (40.6720, -74.0180)
        )
        
        assert score_same > score_opposite
    
    # =========================================================================
    # Time Compatibility Tests
    # =========================================================================
    
    def test_time_compatibility_exact_match(self, service):
        """Exact start time match should score 1.0."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "08:00", "10:00"
        )
        
        assert score == 1.0
    
    def test_time_compatibility_different_start_strict(self, service):
        """Different start times should return 0.0 in strict mode (default)."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",  
            "09:00", "11:00"   # Different start time
        )
        
        # Strict mode requires exact start time match
        assert score == 0.0
    
    def test_time_compatibility_no_overlap(self, service):
        """Completely different times should return 0."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "14:00", "16:00"
        )
        
        assert score == 0.0
    
    def test_time_compatibility_flexible_within_1_hour(self, service):
        """Flexible mode with times within 1 hour should return reduced score."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "08:30", "10:30",  # 30 min difference
            flexible=True
        )
        
        # Within 1 hour in flexible mode returns 0.5-0.9
        assert 0.5 <= score <= 0.9
    
    def test_time_compatibility_flexible_over_1_hour(self, service):
        """Flexible mode with times over 1 hour apart should return 0."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "10:00", "12:00",  # 2 hour difference
            flexible=True
        )
        
        assert score == 0.0
    
    # =========================================================================
    # Match Score Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_match_score_female_only_mismatch(self, service):
        """Female-only mismatch should return 0 score."""
        with patch.object(service, 'redis_service'):
            request1 = {
                "user_id": "user1",
                "pickup_lat": 40.7128,
                "pickup_lng": -74.0060,
                "drop_lat": 40.7580,
                "drop_lng": -73.9855,
                "time_start": "08:00",
                "time_end": "10:00",
                "female_only": True
            }
            
            request2 = {
                "user_id": "user2",
                "pickup_lat": 40.7130,
                "pickup_lng": -74.0058,
                "drop_lat": 40.7582,
                "drop_lng": -73.9853,
                "time_start": "08:00",
                "time_end": "10:00",
                "female_only": False  # Mismatch!
            }
            
            # No longer need to mock trust_score - it's been removed from calculation
            score = await service.calculate_match_score(request1, request2)
            
            assert score == 0.0
    
    @pytest.mark.asyncio
    async def test_match_score_good_match(self, service):
        """Good matching requests should have high score (trust score removed)."""
        request1 = {
            "user_id": "user1",
            "pickup_lat": 40.7128,
            "pickup_lng": -74.0060,
            "drop_lat": 40.7580,
            "drop_lng": -73.9855,
            "time_start": "08:00",
            "time_end": "10:00",
            "female_only": False
        }
        
        request2 = {
            "user_id": "user2",
            "pickup_lat": 40.7130,
            "pickup_lng": -74.0058,
            "drop_lat": 40.7582,
            "drop_lng": -73.9853,
            "time_start": "08:00",
            "time_end": "10:00",
            "female_only": False
        }
        
        # No DB mock needed - trust score removed from calculation
        score = await service.calculate_match_score(request1, request2)
        
        # With 60% route (high - similar locations) + 40% time (1.0 - exact match)
        # Should score close to 1.0
        assert score > 0.8


class TestRouteOverlapEdgeCases:
    """Edge case tests for route overlap."""
    
    @pytest.fixture
    def service(self):
        return MatchmakingService()
    
    def test_zero_length_route(self, service):
        """Zero-length route should not cause errors."""
        point = (40.7128, -74.0060)
        
        score = service.calculate_route_overlap(
            point, point,
            point, point
        )
        
        # Should handle gracefully
        assert 0 <= score <= 1
    
    def test_very_short_route(self, service):
        """Very short routes should still be scored."""
        start = (40.7128, -74.0060)
        end = (40.7129, -74.0059)  # ~10 meters
        
        score = service.calculate_route_overlap(
            start, end, start, end
        )
        
        assert score == 1.0


class TestRiderMatching:
    """Tests for rider matching with passengers."""
    
    @pytest.fixture
    def service(self):
        return MatchmakingService()
    
    @pytest.mark.asyncio
    async def test_check_riders_respects_allow_riders_flag(self, service):
        """Rider matching should be skipped if any passenger opts out."""
        with patch.object(service, 'redis_service') as mock_redis:
            # Mock a request with allow_riders=False
            mock_redis.get_request_data = AsyncMock(return_value={
                "pickup_lat": 40.7128,
                "pickup_lng": -74.0060,
                "drop_lat": 40.7580,
                "drop_lng": -73.9855,
                "time_start": "08:00",
                "female_only": False,
                "allow_riders": False  # Opted out
            })
            
            with patch('app.services.matchmaking_service.get_db'):
                result = await service.check_riders_for_group(
                    request_ids=["req1"],
                    date="2025-12-25"
                )
                
                # Should return None because passenger opted out
                assert result is None
    
    @pytest.mark.asyncio
    async def test_check_riders_all_allow_returns_rider(self, service):
        """When all passengers allow riders, a matching rider should be returned."""
        with patch.object(service, 'redis_service') as mock_redis:
            # Mock a request with allow_riders=True
            mock_redis.get_request_data = AsyncMock(return_value={
                "pickup_lat": 40.7128,
                "pickup_lng": -74.0060,
                "drop_lat": 40.7580,
                "drop_lng": -73.9855,
                "time_start": "08:00",
                "female_only": False,
                "allow_riders": True
            })
            
            with patch('app.services.matchmaking_service.get_db') as mock_db:
                # Mock a matching rider
                mock_rider = {
                    "user_id": "rider123",
                    "gender": "M",
                    "rider_info": {
                        "from_location": {"lat": 40.7130, "lng": -74.0058},
                        "to_location": {"lat": 40.7582, "lng": -73.9853},
                        "time_window_start": "07:00",
                        "time_window_end": "09:00",
                        "seats": 3
                    }
                }
                
                # Create async iterator for cursor
                async def mock_cursor():
                    yield mock_rider
                
                mock_db.return_value.users.find = MagicMock(return_value=mock_cursor())
                
                result = await service.check_riders_for_group(
                    request_ids=["req1"],
                    date="2025-12-25"
                )
                
                # Should return rider_id and seat capacity
                assert result is not None
                assert result[0] == "rider123"
                assert result[1] == 3


class TestTimeCompatibility:
    """Additional time compatibility tests."""
    
    @pytest.fixture
    def service(self):
        return MatchmakingService()
    
    def test_time_compatibility_flexible_30_minutes(self, service):
        """30 minute difference with flexible mode should have high score."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "08:30", "10:30",
            flexible=True
        )
        
        # 30 min difference should give ~0.7 score
        assert 0.6 <= score <= 0.85
    
    def test_time_compatibility_flexible_55_minutes(self, service):
        """55 minute difference with flexible mode should have lower but valid score."""
        score = service.calculate_time_compatibility(
            "08:00", "10:00",
            "08:55", "10:55",
            flexible=True
        )
        
        # Near the 60 min limit, should be around 0.5
        assert 0.5 <= score <= 0.6


class TestGroupJoiningConstraints:
    """Tests for joining active/confirming groups."""
    
    @pytest.fixture
    def service(self):
        return MatchmakingService()
    
    def test_min_group_size_allows_single(self, service):
        """Verify MIN_GROUP_SIZE is 1 to allow solo passengers with riders."""
        assert service.MIN_GROUP_SIZE == 1
    
    def test_max_group_size(self, service):
        """Verify MAX_GROUP_SIZE is 4."""
        assert service.MAX_GROUP_SIZE == 4
    
    def test_min_match_score_threshold(self, service):
        """Verify MIN_MATCH_SCORE is 0.5."""
        assert service.MIN_MATCH_SCORE == 0.5
