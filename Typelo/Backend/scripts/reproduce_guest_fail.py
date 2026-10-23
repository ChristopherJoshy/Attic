import sys
import os
import asyncio
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Add Backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Mock dependencies before importing app modules that might use them
sys.modules["app.database"] = MagicMock()
sys.modules["app.database"].Database = MagicMock()
sys.modules["app.database"].Database.get_db = MagicMock(return_value=AsyncMock())
sys.modules["firebase_admin"] = MagicMock()
sys.modules["firebase_admin"].auth = MagicMock()
sys.modules["app.config"] = MagicMock()
sys.modules["app.config"].get_settings = MagicMock()

# Setup Mock Settings
mock_settings = MagicMock()
mock_settings.backend_secret_key = "test_secret_key"
mock_settings.mongodb_uri = "mongodb://localhost:27017"
mock_settings.mongodb_database = "test_db"
sys.modules["app.config"].get_settings.return_value = mock_settings

# Now import the router
from app.routers.auth import router, GuestRegisterRequest

# Create a minimal app for testing
app = FastAPI()
app.include_router(router, prefix="/api/auth")

client = TestClient(app)

def test_guest_register():
    print("Attempting to register guest user...")
    try:
        # Mock database behavior
        mock_db = sys.modules["app.database"].Database.get_db.return_value
        
        # user find_one returns None (username not taken)
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        # user insert_one returns success
        mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="test_id"))
        
        response = client.post(
            "/api/auth/guest/register",
            json={
                "username": "test_guest_user",
                "password": "secure_password_123"
            }
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 500:
            print("Successfully reproduced 500 Internal Server Error!")
        else:
            print("Did not reproduce 500 error. Check if the environment differs.")
            
    except Exception as e:
        print(f"Caught exception during test execution: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_guest_register()
