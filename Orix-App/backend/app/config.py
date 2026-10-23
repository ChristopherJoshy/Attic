import json
import os
import base64
from functools import lru_cache
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ==========================================================================
    # Firebase Configuration
    # ==========================================================================
    firebase_service_account_json: Optional[str] = None
    firebase_service_account_path: Optional[str] = None
    firebase_project_id: str

    # ==========================================================================
    # Allowed College Domains (REQUIRED - no development bypass)
    # ==========================================================================
    allowed_college_domains: str  # No default - must be configured

    @property
    def allowed_domains_list(self) -> List[str]:
        """Parse comma-separated domains into list."""
        domains = [
            d.strip().lower()
            for d in self.allowed_college_domains.split(",")
            if d.strip()
        ]
        if not domains:
            raise RuntimeError(
                "ALLOWED_COLLEGE_DOMAINS must be configured with at least one domain"
            )
        return domains

    # ==========================================================================
    # MongoDB Configuration
    # ==========================================================================
    mongodb_uri: str
    mongodb_database: str = "orix"

    # ==========================================================================
    # Redis Configuration
    # ==========================================================================
    redis_url: str

    # ==========================================================================
    # Telegram Bot Configuration
    # ==========================================================================
    telegram_bot_token: str
    telegram_webhook_url: Optional[str] = None
    telegram_admin_chat_ids: str = ""
    telegram_log_chat_id: str = ""
    telegram_allowed_group_id: str = ""
    telegram_secret_admin_passphrase: str  # No default - must be configured
    telegram_head_admin_id: str = ""  # Head admin with full privileges

    @property
    def admin_chat_ids_list(self) -> List[int]:
        """Parse comma-separated chat IDs into list."""
        if not self.telegram_admin_chat_ids:
            return []
        return [
            int(cid.strip())
            for cid in self.telegram_admin_chat_ids.split(",")
            if cid.strip()
        ]

    @property
    def head_admin_id(self) -> Optional[int]:
        """Get head admin user ID."""
        if self.telegram_head_admin_id:
            return int(self.telegram_head_admin_id.strip())
        return None

    # ==========================================================================
    # Admin API Configuration
    # ==========================================================================
    admin_api_secret: str

    # ==========================================================================
    # JWT Configuration (REQUIRED - no default)
    # ==========================================================================
    jwt_secret: str  # No default - must be configured

    # ==========================================================================
    # Rate Limiting
    # ==========================================================================
    rate_limit_per_minute: int = 60
    rate_limit_auth_per_minute: int = 300  # Increased for polling and normal usage

    # ==========================================================================
    # Application Settings
    # ==========================================================================
    api_base_url: str = "http://localhost:8000"
    api_v1_str: str = "/api/v1"
    debug: bool = True
    cors_origins: str  # No default - must be configured

    # ==========================================================================
    # AI Configuration (Groq) - Hardcoded for optimal performance
    # ==========================================================================
    groq_api_key: Optional[str] = None
    groq_model: str = (
        "openai/gpt-oss-120b"  # OpenAI's 120B MoE model - best for agentic tool use
    )
    ai_context_message_limit: int = 100  # More context = smarter responses
    ai_confirmation_timeout_minutes: int = 10  # Generous timeout for confirmations

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into list."""
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ==========================================================================
    # Matchmaking Configuration
    # ==========================================================================
    matchmaking_ttl_minutes: int = 60
    readiness_timeout_minutes: int = 60
    rider_availability_hours: int = 24
    # Distance and matching thresholds
    max_pickup_distance_km: float = 1.0  # Hard constraint for pickup proximity
    max_perpendicular_distance_km: float = 2.0  # Max deviation from route
    min_match_score: float = 0.5  # Minimum score to consider a match
    min_minutes_to_join_active_group: int = (
        0  # No time restriction for joining active groups
    )
    max_flexible_time_diff_minutes: int = (
        60  # Max time difference for flexible matching
    )

    # ==========================================================================
    # Computed Properties
    # ==========================================================================

    @property
    def firebase_credentials(self) -> Optional[dict]:
        """
        Get Firebase credentials as dict.

        Supports:
        1. File path (FIREBASE_SERVICE_ACCOUNT_PATH)
        2. JSON string (FIREBASE_SERVICE_ACCOUNT_JSON)
        3. Base64 encoded JSON string (FIREBASE_SERVICE_ACCOUNT_JSON)
        """
        # 1. Try File Path
        if self.firebase_service_account_path:
            if os.path.exists(self.firebase_service_account_path):
                try:
                    with open(self.firebase_service_account_path, "r") as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Error reading Firebase credentials file: {e}")
                    return None

        # 2. Try JSON String or Base64
        if self.firebase_service_account_json:
            content = self.firebase_service_account_json.strip()

            # Try raw JSON first
            if content.startswith("{"):
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    pass  # Move to Base64 attempt

            # Try Base64
            try:
                decoded = base64.b64decode(content).decode("utf-8")
                return json.loads(decoded)
            except Exception:
                print(
                    "Failed to decode FIREBASE_SERVICE_ACCOUNT_JSON (Invalid JSON or Base64)"
                )
                return None

        return None

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses LRU cache to avoid re-reading env vars on every request.
    """
    return Settings()


# Convenience export
settings = get_settings()
