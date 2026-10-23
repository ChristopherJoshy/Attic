"""
Tests for Admin Endpoints

Unit tests for admin ban/suspend functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta

from app.services.user_service import UserService
from app.models.user import UserStatus


class TestUserServiceAdmin:
    """Tests for admin functionality in UserService."""
    
    @pytest.fixture
    def service(self):
        return UserService()
    
    # =========================================================================
    # Ban Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_ban_user(self, service):
        """User should be banned with reason."""
        with patch('app.services.user_service.get_db') as mock_db:
            mock_collection = AsyncMock()
            mock_db.return_value.users = mock_collection
            
            mock_collection.update_one = AsyncMock()
            mock_collection.find_one = AsyncMock(return_value={
                "user_id": "test_user",
                "email": "test@college.edu",
                "display_name": "Test User",
                "firebase_uid": "firebase_123",
                "status": "banned",
                "ban_reason": "Violation of terms"
            })
            
            result = await service.ban_user("test_user", "Violation of terms")
            
            mock_collection.update_one.assert_called_once()
            call_args = mock_collection.update_one.call_args
            
            # Verify update sets banned status
            assert call_args[0][1]["$set"]["status"] == UserStatus.BANNED
            assert call_args[0][1]["$set"]["ban_reason"] == "Violation of terms"
    
    # =========================================================================
    # Suspend Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_suspend_user(self, service):
        """User should be suspended with expiry."""
        with patch('app.services.user_service.get_db') as mock_db:
            mock_collection = AsyncMock()
            mock_db.return_value.users = mock_collection
            
            mock_collection.update_one = AsyncMock()
            mock_collection.find_one = AsyncMock(return_value={
                "user_id": "test_user",
                "email": "test@college.edu",
                "display_name": "Test User",
                "firebase_uid": "firebase_123",
                "status": "suspended",
                "suspension_expires_at": datetime.utcnow() + timedelta(hours=24)
            })
            
            result = await service.suspend_user("test_user", 24, "Minor violation")
            
            mock_collection.update_one.assert_called_once()
            call_args = mock_collection.update_one.call_args
            
            assert call_args[0][1]["$set"]["status"] == UserStatus.SUSPENDED
            assert "suspension_expires_at" in call_args[0][1]["$set"]
    
    # =========================================================================
    # Unban Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_unban_user(self, service):
        """User should be unbanned."""
        with patch('app.services.user_service.get_db') as mock_db:
            mock_collection = AsyncMock()
            mock_db.return_value.users = mock_collection
            
            mock_collection.update_one = AsyncMock()
            mock_collection.find_one = AsyncMock(return_value={
                "user_id": "test_user",
                "email": "test@college.edu",
                "display_name": "Test User",
                "firebase_uid": "firebase_123",
                "status": "active",
                "ban_reason": None
            })
            
            result = await service.unban_user("test_user")
            
            mock_collection.update_one.assert_called_once()
            call_args = mock_collection.update_one.call_args
            
            assert call_args[0][1]["$set"]["status"] == UserStatus.ACTIVE
            assert call_args[0][1]["$set"]["ban_reason"] is None
    
    # =========================================================================
    # Suspension Expiry Tests
    # =========================================================================
    
    @pytest.mark.asyncio
    async def test_check_suspension_expired(self, service):
        """Expired suspension should update status to active."""
        from app.models.user import User
        
        expired_user = User(
            user_id="test_user",
            firebase_uid="firebase_123",
            email="test@college.edu",
            display_name="Test User",
            status=UserStatus.SUSPENDED,
            suspension_expires_at=datetime.utcnow() - timedelta(hours=1)  # Expired
        )
        
        with patch('app.services.user_service.get_db') as mock_db:
            mock_collection = AsyncMock()
            mock_db.return_value.users = mock_collection
            mock_collection.update_one = AsyncMock()
            
            is_active = await service.check_suspension_expired(expired_user)
            
            assert is_active is True
            mock_collection.update_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_check_suspension_not_expired(self, service):
        """Active suspension should not update status."""
        from app.models.user import User
        
        suspended_user = User(
            user_id="test_user",
            firebase_uid="firebase_123",
            email="test@college.edu",
            display_name="Test User",
            status=UserStatus.SUSPENDED,
            suspension_expires_at=datetime.utcnow() + timedelta(hours=23)  # Not expired
        )
        
        with patch('app.services.user_service.get_db') as mock_db:
            mock_collection = AsyncMock()
            mock_db.return_value.users = mock_collection
            
            is_active = await service.check_suspension_expired(suspended_user)
            
            assert is_active is False
            mock_collection.update_one.assert_not_called()


class TestPhoneMasking:
    """Tests for phone number masking."""
    
    @pytest.fixture
    def service(self):
        return UserService()
    
    def test_mask_phone_standard(self, service):
        """Standard phone should be masked correctly."""
        masked = service.mask_phone("5551234567")
        
        assert masked == "***-***-4567"
    
    def test_mask_phone_short(self, service):
        """Short phone should return safe value."""
        masked = service.mask_phone("123")
        
        assert masked == "***"
    
    def test_mask_phone_empty(self, service):
        """Empty phone should return safe value."""
        masked = service.mask_phone("")
        
        assert masked == "***"
    
    def test_mask_phone_none(self, service):
        """None phone should return safe value."""
        masked = service.mask_phone(None)
        
        assert masked == "***"
