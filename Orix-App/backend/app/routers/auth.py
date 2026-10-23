"""
Authentication Router

Handles Firebase token verification and user onboarding.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.services.auth_service import AuthService
from app.services.user_service import UserService
from app.services.audit_service import AuditService
from app.models.user import User
from app.dependencies import get_current_user
from app.database import get_redis


router = APIRouter()
auth_service = AuthService()
user_service = UserService()
audit_service = AuditService()


class DomainInfo(BaseModel):
    """Information about a supported college domain."""
    domain: str
    name: str


class AuthConfigResponse(BaseModel):
    """Public auth configuration response."""
    allowed_domains: list[DomainInfo]
    version: str = "1.0.0"


# Domain name mapping (can be extended to database later)
DOMAIN_NAMES = {
    "sjcetpalai.ac.in": "SJCET Palai",
    "adishankara.ac.in": "Adi Shankara Institute of Engineering and Technology",
}


@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config():
    """
    Get public authentication configuration.
    
    Returns allowed domains and app version. This is a public endpoint
    used by the frontend to dynamically validate email domains.
    
    Domain source priority:
    1. MongoDB domain_names collection (primary - editable via Telegram bot)
    2. Fallback to .env ALLOWED_COLLEGE_DOMAINS for initial setup
    """
    from app.config import settings
    from app.database import get_db
    
    db = get_db()
    
    # Get domains from MongoDB (primary source)
    domains = []
    try:
        cursor = db.domain_names.find({})
        async for doc in cursor:
            domain = doc.get("domain", "")
            name = doc.get("name", domain.split(".")[0].upper())
            if domain:
                domains.append(DomainInfo(domain=domain, name=name))
    except Exception:
        pass
    
    # Fallback: if MongoDB has no domains, seed from .env
    if not domains:
        for domain in settings.allowed_domains_list:
            name = DOMAIN_NAMES.get(domain) or domain.split(".")[0].upper()
            domains.append(DomainInfo(domain=domain, name=name))
            # Seed MongoDB for future use
            try:
                await db.domain_names.update_one(
                    {"domain": domain},
                    {"$setOnInsert": {"domain": domain, "name": name}},
                    upsert=True
                )
            except Exception:
                pass
    
    return AuthConfigResponse(allowed_domains=domains)


class TokenVerifyRequest(BaseModel):
    """Request to verify Firebase token."""
    id_token: str = Field(..., description="Firebase ID token")


class TokenVerifyResponse(BaseModel):
    """Response after token verification."""
    user_id: str
    email: str
    display_name: str
    photo_url: Optional[str]
    onboarding_completed: bool
    is_new_user: bool


class OnboardingRequest(BaseModel):
    """Request to complete onboarding."""
    phone: str = Field(..., min_length=10, max_length=20)
    gender: Optional[str] = Field(None, pattern="^[MFO]$")
    safety_consent: bool = Field(...)


class OnboardingResponse(BaseModel):
    """Response after completing onboarding."""
    success: bool
    message: str


@router.post("/verify", response_model=TokenVerifyResponse)
async def verify_token(request: TokenVerifyRequest):
    """
    Verify Firebase ID token and get/create user.
    
    This is the main authentication endpoint. The client obtains a
    Firebase ID token after Google Sign-In and sends it here.
    
    SECURITY: Server-side validation of college email domain.
    """
    # Verify the token
    claims = auth_service.verify_firebase_token(request.id_token)
    
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    email = claims.get("email", "")
    
    # Validate college domain (authoritative check)
    is_valid, message = await auth_service.validate_college_domain(email)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "invalid_domain",
                "message": message
            }
        )
    
    # Get or create user
    user, is_new = await auth_service.get_or_create_user(claims)
    
    # Log new user registration only (prevent spamming on every app open)
    # The 'verify' endpoint is hit frequently for profile fetching
    if is_new:
        await audit_service.log_login_event(
            user_id=user.user_id,
            email=email,
            method="New Registration"
        )

    
    return TokenVerifyResponse(
        user_id=user.user_id,
        email=user.email,
        display_name=user.display_name,
        photo_url=user.photo_url,
        onboarding_completed=user.onboarding_completed,
        is_new_user=is_new
    )


@router.post("/onboard", response_model=OnboardingResponse)
async def complete_onboarding(
    request: OnboardingRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Complete user onboarding with phone and consent.
    
    Required for all new users before they can use the app.
    """
    if current_user.onboarding_completed:
        return OnboardingResponse(
            success=True,
            message="Onboarding already completed"
        )
    
    if not request.safety_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must agree to the safety terms to continue"
        )
    
    try:
        await user_service.complete_onboarding(
            user_id=current_user.user_id,
            phone=request.phone,
            gender=request.gender,
            safety_consent=True
        )
        
        await audit_service.log_user_action(
            user_id=current_user.user_id,
            action="completed_onboarding",
            metadata={"gender_provided": request.gender is not None}
        )
        
        return OnboardingResponse(
            success=True,
            message="Onboarding completed successfully"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


class CollegeRequestInput(BaseModel):
    """Request to add a new college to ORIX."""
    email: str = Field(..., min_length=5, max_length=100, description="College email address")
    college_name: str = Field(..., min_length=2, max_length=200, description="Name of the college")
    city: str = Field(..., min_length=2, max_length=100, description="City/Location of the college")
    message: Optional[str] = Field(None, max_length=500, description="Additional message or details")


class CollegeRequestResponse(BaseModel):
    """Response after submitting college request."""
    success: bool
    message: str


@router.post("/request-college", response_model=CollegeRequestResponse)
async def request_college(request: CollegeRequestInput):
    """
    Submit a request to add a new college to ORIX.
    
    This is a public endpoint (no auth required) since the user
    signed in with an unsupported domain.
    
    The request is stored in MongoDB and sent to the admin Telegram channel.
    """
    from datetime import datetime, timezone, timedelta
    import httpx
    import logging
    from app.config import settings
    from app.database import get_db
    
    # Basic validation
    if "@" not in request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address"
        )
    
    # Extract domain from email
    domain = request.email.split("@")[-1].lower()
    
    # Check if already supported
    db = get_db()
    existing_domain = await db.domain_names.find_one({"domain": domain})
    if existing_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The domain '{domain}' is already supported! Please try signing in again."
        )
    
    # Also check .env fallback
    for allowed in settings.allowed_domains_list:
        if domain == allowed or domain.endswith("." + allowed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The domain '{domain}' is already supported! Please try signing in again."
            )
    
    # Check for duplicate pending request (same domain in last 24h)
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    existing_request = await db.domain_requests.find_one({
        "domain": domain,
        "status": "pending",
        "created_at": {"$gte": yesterday}
    })
    
    if existing_request:
        return CollegeRequestResponse(
            success=True,
            message="A request for this college is already pending review. We'll process it soon!"
        )
    
    # Store in MongoDB
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(timezone.utc)
    request_doc = {
        "email": request.email,
        "domain": domain,
        "college_name": request.college_name,
        "city": request.city,
        "message": request.message,
        "status": "pending",
        "created_at": now,
        "created_at_ist": now.astimezone(ist).strftime("%Y-%m-%d %H:%M:%S IST")
    }
    
    result = await db.domain_requests.insert_one(request_doc)
    request_id = str(result.inserted_id)
    
    # Format timestamp in IST
    timestamp = now.astimezone(ist).strftime("%Y-%m-%d %H:%M:%S IST")
    
    # Build Telegram message
    msg = (
        f"COLLEGE REQUEST\n"
        f"{timestamp}\n"
        f"---\n"
        f"ID: {request_id[:8]}\n"
        f"Email: {request.email}\n"
        f"Domain: {domain}\n"
        f"College: {request.college_name}\n"
        f"City: {request.city}"
    )
    
    if request.message:
        msg += f"\nMessage: {request.message}"
    
    msg += f"\n---\nUse /domain_requests to manage"
    
    # Send to Telegram
    telegram_sent = False
    try:
        bot_token = settings.telegram_bot_token
        log_chat = settings.telegram_log_chat_id
        
        if bot_token and log_chat:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={
                    "chat_id": log_chat,
                    "text": msg,
                    "parse_mode": None
                })
                if response.status_code == 200:
                    telegram_sent = True
                else:
                    logging.warning(f"Telegram API returned {response.status_code}: {response.text}")
        else:
            logging.warning("Telegram bot token or log chat ID not configured")
    except Exception as e:
        logging.error(f"Failed to send college request to Telegram: {e}")
    
    # Update record with telegram status
    await db.domain_requests.update_one(
        {"_id": result.inserted_id},
        {"$set": {"telegram_notified": telegram_sent}}
    )
    
    return CollegeRequestResponse(
        success=True,
        message="Your request has been submitted successfully! We'll review it and add your college soon."
    )

