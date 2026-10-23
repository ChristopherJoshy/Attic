"""
App Version Router

Provides version checking endpoint for app updates.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.utils.timezone_utils import utc_now

from app.database import get_db


router = APIRouter()


class AppVersionResponse(BaseModel):
    """App version information response."""
    current_version: str
    min_version: str
    update_required: bool
    update_title: Optional[str] = None
    update_notes: Optional[str] = None
    play_store_url: Optional[str] = None
    app_store_url: Optional[str] = None


# Default version config (fallback if not in DB)
DEFAULT_VERSION_CONFIG = {
    "current_version": "2.0.0",
    "min_version": "2.0.0",
    "update_title": "ORIX 2.0 is Here! 🎉",
    "update_notes": "Major update: Multi-timezone support, post-ride ratings, improved rider matching, and more!",
    "play_store_url": "https://play.google.com/store/apps/details?id=com.orix.app",
    "app_store_url": "https://apps.apple.com/app/orix/id000000000"
}


@router.get("/version", response_model=AppVersionResponse)
async def get_app_version(client_version: Optional[str] = None):
    """
    Get current app version information.
    
    Query params:
        client_version: The version the client is currently running
        
    Returns:
        Version info including whether update is required
    """
    db = get_db()
    
    config = await db.app_config.find_one({"_id": "version"})
    
    if not config:
        config = DEFAULT_VERSION_CONFIG
        await db.app_config.insert_one({
            "_id": "version",
            **DEFAULT_VERSION_CONFIG,
            "updated_at": utc_now()
        })
    
    current = config.get("current_version", "1.0.0")
    min_ver = config.get("min_version", "1.0.0")
    
    update_required = False
    if client_version:
        update_required = _compare_versions(client_version, min_ver) < 0
    
    return AppVersionResponse(
        current_version=current,
        min_version=min_ver,
        update_required=update_required,
        update_title=config.get("update_title"),
        update_notes=config.get("update_notes"),
        play_store_url=config.get("play_store_url"),
        app_store_url=config.get("app_store_url")
    )


def _compare_versions(v1: str, v2: str) -> int:
    """
    Compare two version strings.
    
    Returns:
        -1 if v1 < v2
         0 if v1 == v2
         1 if v1 > v2
    """
    def parse_version(v: str) -> list:
        parts = v.replace("+", ".").split(".")
        return [int(p) if p.isdigit() else 0 for p in parts[:3]]
    
    p1, p2 = parse_version(v1), parse_version(v2)
    
    for a, b in zip(p1, p2):
        if a < b:
            return -1
        if a > b:
            return 1
    
    return 0
