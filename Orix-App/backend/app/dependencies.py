"""
Authentication Dependencies

FastAPI dependencies for authentication and authorization.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status, Header

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.models.user import User, UserStatus, UserRole


auth_service = AuthService()
user_service = UserService()


async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> User:
    """
    Get current authenticated user from Firebase token.
    
    SECURITY: This is the primary authentication gate.
    All protected endpoints should depend on this.
    
    Expects Authorization header: Bearer <firebase_id_token>
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Use: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = authorization[7:]  # Remove "Bearer " prefix
    
    # Verify Firebase token
    claims = auth_service.verify_firebase_token(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Get or create user
    user, _ = await auth_service.get_or_create_user(claims)
    
    # Check maintenance mode (admins bypass)
    from app.services.redis_service import RedisService
    redis_service = RedisService()
    if await redis_service.is_maintenance_mode():
        if user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "maintenance_mode",
                    "message": "ORIX is currently under maintenance. Please try again later."
                }
            )
    
    # Check user status
    if user.status == UserStatus.BANNED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "account_banned",
                "message": "Your account has been banned.",
                "reason": user.ban_reason
            }
        )
    
    if user.status == UserStatus.SUSPENDED:
        # Check if suspension expired
        is_active = await user_service.check_suspension_expired(user)
        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "account_suspended",
                    "message": "Your account is suspended.",
                    "expires_at": user.suspension_expires_at.isoformat() if user.suspension_expires_at else None,
                    "reason": user.ban_reason
                }
            )
        # Refresh user after status update
        user = await user_service.get_user(user.user_id)
    
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user)
) -> User:
    """
    Get current user who has completed onboarding.
    
    Use this for endpoints that require a fully set up user.
    """
    if not user.onboarding_completed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "onboarding_required",
                "message": "Please complete onboarding first."
            }
        )
    
    return user


async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    
    Use for endpoints that work with or without authentication.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


async def get_admin_user(
    user: User = Depends(get_current_user),
    x_admin_secret: Optional[str] = Header(None)
) -> User:
    """
    Get current user with admin privileges.
    
    SECURITY: Admin access requires both:
    1. Valid Firebase token
    2. Admin API secret in X-Admin-Secret header
    
    TODO: Implement proper admin role management in database.
    For now, uses the ADMIN_API_SECRET from config.
    """
    from app.config import settings
    
    # Check 1: Legacy/Service Key Access
    if x_admin_secret and x_admin_secret == settings.admin_api_secret:
        return user

    # Check 2: RBAC (Role-Based Access Control)
    if user.role == UserRole.ADMIN:
        return user

    # Deny Access
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required"
    )
    
    return user


get_current_admin_user = get_admin_user
get_current_user_optional = get_optional_user
