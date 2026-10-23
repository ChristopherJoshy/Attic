#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Configuration - Loads application settings from environment variables.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# Settings.cors_origins_list: Returns list of allowed CORS origins.
# Settings.firebase_credentials: Builds Firebase credentials dict.
# get_settings: Returns cached Settings instance.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# Settings: Configuration model matching environment variables.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# pydantic_settings: Settings management.
# functools.lru_cache: Caching.
# typing: Type hints.

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_secret_key: str = "dev-secret-key-change-in-production"
    
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "evotaion"
    
    # Redis Cloud
    redis_url: str = ""  # Full Redis URL (takes priority if set)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""
    redis_username: str = "default"
    
    # Firebase Admin SDK
    firebase_project_id: str = ""
    firebase_fcm_server_key: str = ""
    firebase_service_account_client_email: str = ""
    firebase_service_account_private_key: str = ""
    firebase_service_account_private_key_id: str = ""
    
    # Game Configuration
    match_duration_seconds: int = 30
    matchmaking_timeout_seconds: int = 30
    bot_min_wpm: int = 15  # Lowered from 40 to allow beginner-friendly bots
    bot_max_wpm: int = 180  # Allow higher WPM for grandmaster-level bots
    
    # Anti-Cheat
    min_keystroke_latency_ms: int = 20
    max_wpm_threshold: int = 250
    keystroke_variance_threshold: float = 0.1
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def firebase_credentials(self) -> dict:
        """Build Firebase credentials dict from env vars"""
        return {
            "type": "service_account",
            "project_id": self.firebase_project_id,
            "private_key_id": self.firebase_service_account_private_key_id,
            "private_key": self.firebase_service_account_private_key.replace("\\n", "\n"),
            "client_email": self.firebase_service_account_client_email,
            "client_id": "",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{self.firebase_service_account_client_email}"
        }
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
