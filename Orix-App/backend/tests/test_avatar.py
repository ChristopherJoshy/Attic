
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.user_service import UserService
from datetime import datetime

class TestAvatarStorage:
    """Tests for UserService avatar storage."""
    
    @pytest.fixture
    def service(self):
        return UserService()
        
    @pytest.mark.asyncio
    async def test_update_profile_image(self, service):
        """Should upsert avatar binary and update user photo_url."""
        user_id = "test_user_123"
        image_data = b"fake_image_bytes"
        content_type = "image/jpeg"
        
        # Patch get_db AND settings
        with patch('app.services.user_service.get_db') as mock_get_db, \
             patch('app.config.settings', magic=True) as mock_settings:
            
            db = AsyncMock()
            mock_get_db.return_value = db
            
            # Setup mock settings
            mock_settings.api_v1_str = "/api/v1"
            
            # Mock update_one for user_avatars
            db.user_avatars.update_one.return_value = AsyncMock()
            
            # Mock update_one for users
            db.users.update_one.return_value = AsyncMock(modified_count=1)
            
            # Mock get_user to return a user object
            db.users.find_one.return_value = {
                "user_id": user_id,
                "email": "test@test.com",
                "display_name": "Test",
                "firebase_uid": "uid",
                "photo_url": "/api/v1/users/test_user_123/avatar"
            }

            # Call method
            user = await service.update_profile_image(user_id, image_data, content_type)
            
            # Verify upsert to user_avatars
            db.user_avatars.update_one.assert_called_once()
            call_args = db.user_avatars.update_one.call_args
            assert call_args[0][0] == {"user_id": user_id}
            assert call_args[0][1]["$set"]["image_data"] == image_data
            assert call_args[0][1]["$set"]["content_type"] == content_type
            assert call_args[1]["upsert"] is True
            
            # Verify update to users
            db.users.update_one.assert_called_once()
            assert "photo_url" in db.users.update_one.call_args[0][1]["$set"]
            
            assert user is not None
            assert "avatar" in user.photo_url

    @pytest.mark.asyncio
    async def test_get_profile_image(self, service):
        """Should retrieve avatar binary."""
        user_id = "test_user_123"
        expected_data = {
            "user_id": user_id,
            "image_data": b"stored_bytes",
            "content_type": "image/png"
        }
        
        with patch('app.services.user_service.get_db') as mock_get_db:
            db = AsyncMock()
            mock_get_db.return_value = db
            
            # Mock find_one
            db.user_avatars.find_one.return_value = expected_data
            
            result = await service.get_profile_image(user_id)
            
            assert result == expected_data
            assert result["image_data"] == b"stored_bytes"
