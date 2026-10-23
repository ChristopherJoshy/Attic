"""Environment-backed configuration helpers for SAHAYI."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime settings loaded from environment variables.

    Args:
        None: Values come from environment variables.
    Returns:
        Immutable settings object.
    Agent:
        Platform
    """

    gemini_api_key: str
    google_cloud_project: str
    google_cloud_location: str
    gemini_model: str
    firebase_project_id: str
    service_account_file: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    twilio_whatsapp_number: str
    twilio_webhook_base: str
    sarvam_api_key: str
    sarvam_stt_model: str
    sarvam_tts_model: str
    sarvam_language: str
    sarvam_tts_speaker: str
    database_url: str
    chroma_persist_dir: str
    chroma_collection_name: str
    pubmed_email: str
    pubmed_max_results: int
    risk_yellow_threshold: float
    risk_red_threshold: float
    anomaly_z_score_threshold: float
    doctor_escalation_hours: int
    dashboard_auth_header: str
    dashboard_shared_token: str
    host: str
    port: int
    environment: str
    secret_key: str
    frontend_url: str

    @property
    def frontend_origins(self) -> tuple[str, ...]:
        """Return normalized CORS origins from the frontend URL setting.

        Args:
            None: Uses the configured frontend URL string.
        Returns:
            Tuple of normalized origin values.
        Agent:
            Platform
        """

        raw_values = [value.strip() for value in self.frontend_url.split(",")]
        return tuple(value for value in raw_values if value)

    @property
    def allow_all_frontend_origins(self) -> bool:
        """Return whether CORS should allow any origin.

        Args:
            None: Uses the configured frontend origin list.
        Returns:
            True when the wildcard origin is present.
        Agent:
            Platform
        """

        return "*" in self.frontend_origins


def _read(name: str, default: str = "") -> str:
    """Read one environment variable.

    Args:
        name: Environment variable name.
        default: Default value when unset.
    Returns:
        Environment variable value.
    Agent:
        Platform
    """

    return os.getenv(name, default).strip().rstrip(",")


def _resolve_backend_path(value: str) -> str:
    """Resolve a file path relative to the backend directory.

    Args:
        value: Candidate file path from environment.
    Returns:
        Absolute path string when the file exists, else the raw value.
    Agent:
        Platform
    """

    if not value:
        return ""
    path = Path(value)
    if not path.is_absolute():
        path = BACKEND_DIR / value
    return str(path.resolve())


def _discover_service_account_file() -> str:
    """Discover the Firebase service-account JSON file in the backend directory.

    Args:
        None: Uses environment overrides and backend-directory scanning.
    Returns:
        Absolute path string or an empty string.
    Agent:
        Platform
    """

    explicit = _resolve_backend_path(_read("SERVICE_ACCOUNT_FILE") or _read("GOOGLE_APPLICATION_CREDENTIALS"))
    if explicit and Path(explicit).exists():
        return explicit
    matches = sorted(BACKEND_DIR.glob("*-firebase-adminsdk-*.json"))
    return str(matches[0].resolve()) if matches else ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and cache application settings.

    Args:
        None: Values come from `.env` and process environment.
    Returns:
        Cached Settings object.
    Agent:
        Platform
    """

    load_dotenv()
    return Settings(
        gemini_api_key=_read("GOOGLE_GEMINI_API") or _read("GEMINI_API_KEY"),
        google_cloud_project=_read("GOOGLE_CLOUD_PROJECT"),
        google_cloud_location=_read("GOOGLE_CLOUD_LOCATION", "us-central1"),
        gemini_model=_read("GEMINI_MODEL", "gemini-3-flash-preview"),
        firebase_project_id=_read("FIREBASE_PROJECT_ID"),
        service_account_file=_discover_service_account_file(),
        twilio_account_sid=_read("TWILIO_ACCOUNT_SID"),
        twilio_auth_token=_read("TWILIO_AUTH_TOKEN"),
        twilio_phone_number=_read("TWILIO_PHONE_NUMBER"),
        twilio_whatsapp_number=_read("TWILIO_WHATSAPP_NUMBER"),
        twilio_webhook_base=_read("TWILIO_WEBHOOK_BASE"),
        sarvam_api_key=_read("SARVAM_API_KEY"),
        sarvam_stt_model=_read("SARVAM_STT_MODEL", "saaras:v3"),
        sarvam_tts_model=_read("SARVAM_TTS_MODEL", "bulbul:v3"),
        sarvam_language=_read("SARVAM_LANGUAGE", "ml-IN"),
        sarvam_tts_speaker=_read("SARVAM_TTS_SPEAKER", "ritu"),
        database_url=_read("DATABASE_URL", "sqlite+aiosqlite:///./sahayi.db"),
        chroma_persist_dir=_read("CHROMA_PERSIST_DIR", "./rag/chroma_store"),
        chroma_collection_name=_read("CHROMA_COLLECTION_NAME", "sahayi_medical_kb"),
        pubmed_email=_read("PUBMED_EMAIL"),
        pubmed_max_results=int(_read("PUBMED_MAX_RESULTS", "3")),
        risk_yellow_threshold=float(_read("RISK_YELLOW_THRESHOLD", "0.4")),
        risk_red_threshold=float(_read("RISK_RED_THRESHOLD", "0.7")),
        anomaly_z_score_threshold=float(_read("ANOMALY_Z_SCORE_THRESHOLD", "2.0")),
        doctor_escalation_hours=int(_read("DOCTOR_ESCALATION_HOURS", "3")),
        dashboard_auth_header=_read("DASHBOARD_AUTH_HEADER", "X-Sahayi-Doctor-Token"),
        dashboard_shared_token=_read("DASHBOARD_SHARED_TOKEN"),
        host=_read("HOST", "0.0.0.0"),
        port=int(_read("PORT", "8000")),
        environment=_read("ENVIRONMENT", "development"),
        secret_key=_read("SECRET_KEY"),
        frontend_url=_read("FRONTEND_URL", "http://localhost:5173"),
    )
