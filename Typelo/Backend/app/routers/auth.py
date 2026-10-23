#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Authentication router - Firebase token verification and user management.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# verify_firebase_token: Verify a Firebase ID token using Firebase Admin SDK.
# get_or_create_user: Fetch existing user from MongoDB or create a new user document with default stats.
# get_current_user: Dependency that verifies the Authorization header and returns the current user Info.
# verify_token: Endpoint to manually verify a token and get user info.
# get_me: Endpoint to get current authenticated user's profile.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# router: FastAPI APIRouter instance.
# TokenVerifyRequest: Pydantic model for token verification request body.
# UserInfo: Pydantic model for verified user information response.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Framework components (APIRouter, HTTPException, Depends, Header).
# starlette.concurrency: concurrency utils.
# pydantic: Data validation.
# typing: Type hinting.
# datetime: Date and time utilities.
# firebase_admin: Firebase SDK.
# firebase_admin.auth: Firebase Auth module.
# logging: Logging module.
# app.database.Database: Database connection.
# app.models.user: User related models (Rank, get_rank_from_elo).

from fastapi import APIRouter, HTTPException, Depends, Header
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import firebase_admin
from firebase_admin import auth as firebase_auth
import logging
import uuid
import re
import bcrypt
from jose import jwt, JWTError

from app.database import Database
from app.models.user import Rank, get_rank_from_elo
from app.config import get_settings
import pymongo

logger = logging.getLogger(__name__)

router = APIRouter()


class TokenVerifyRequest(BaseModel):
    id_token: str
    referral_code: Optional[str] = None


class UserInfo(BaseModel):
    uid: str
    email: str
    display_name: str
    photo_url: Optional[str] = None
    elo_rating: int = 1000
    rank: Rank = Rank.UNRANKED
    referral_bonus_applied: bool = False
    is_new_user: bool = False
    is_guest: bool = False


# Guest Authentication Models
GUEST_JWT_ALGORITHM = "HS256"
GUEST_JWT_EXPIRY_DAYS = 30
GUEST_CONVERSION_BONUS = 500  # Coins awarded when converting to Google account


class GuestRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=6, max_length=50)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must contain only letters, numbers, and underscores')
        return v


class GuestLoginRequest(BaseModel):
    username: str
    password: str


class GuestUserInfo(BaseModel):
    uid: str
    display_name: str
    is_guest: bool = True
    elo_rating: int = 1000
    rank: Rank = Rank.UNRANKED
    token: str  # JWT token for guest session


class GuestConvertRequest(BaseModel):
    id_token: str  # Firebase token from Google login
    guest_token: str  # Current guest session token


async def verify_firebase_token(id_token: str) -> dict:
    try:
        decoded_token = await run_in_threadpool(firebase_auth.verify_id_token, id_token)
        
        return {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email", ""),
            "display_name": decoded_token.get("name", decoded_token.get("email", "").split("@")[0]),
            "photo_url": decoded_token.get("picture")
        }
    except firebase_admin.exceptions.FirebaseError as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")


async def get_or_create_user(firebase_user: dict, referral_code: Optional[str] = None) -> dict:
    from pymongo.errors import DuplicateKeyError
    
    db = Database.get_db()
    
    # 1. Atomic Upsert: Create user if not exists, or update last_login if exists.
    # This prevents race conditions where multiple requests try to insert simultaneously.
    now = datetime.now(timezone.utc)
    
    try:
        user = await db.users.find_one_and_update(
            {"firebase_uid": firebase_user["uid"]},
            {
                "$setOnInsert": {
                    # Fields set only on creation
                    "firebase_uid": firebase_user["uid"],
                    "email": firebase_user["email"],
                    "elo_rating": 1000,
                    "elo_rd": 350.0,
                    "elo_volatility": 0.06,
                    "peak_elo": 1000,
                    "best_wpm": 0,
                    "total_matches": 0,
                    "wins": 0,
                    "losses": 0,
                    "coins": 100,  # Base 100 coins
                    "invited_count": 0,
                    "redeemed_codes": [],
                    "created_at": now,
                },
                "$set": {
                    # Fields updated on every login
                    "last_login": now,
                    "display_name": firebase_user["display_name"],
                    "photo_url": firebase_user["photo_url"]
                }
            },
            upsert=True,
            return_document=True
        )
    except DuplicateKeyError:
        # Email already exists with a different firebase_uid
        # This can happen if user linked a new auth provider, or database inconsistency
        # Try to find by email and update the firebase_uid to link accounts
        logger.warning(f"DuplicateKeyError for email {firebase_user['email']}, attempting to link accounts")
        user = await db.users.find_one_and_update(
            {"email": firebase_user["email"]},
            {
                "$set": {
                    "firebase_uid": firebase_user["uid"],  # Link to new firebase UID
                    "last_login": now,
                    "display_name": firebase_user["display_name"],
                    "photo_url": firebase_user["photo_url"]
                }
            },
            return_document=True
        )
        if not user:
            logger.error(f"Could not find or create user with email {firebase_user['email']}")
            raise HTTPException(status_code=500, detail="Failed to create or link user account")
    
    # Check if this was a new user (created_at is almost equal to now)
    # or rely on whether referral logic has run.
    # Ensure created_at is timezone-aware for comparison (MongoDB may return naive datetimes)
    created_at = user["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    is_new_user = (created_at == now) or (now - created_at).total_seconds() < 1
    
    # 2. Handle Referral (Idempotent)
    # Only apply referral if user is new AND hasn't been referred yet
    referral_bonus_applied = False
    
    if is_new_user and referral_code and referral_code != firebase_user["uid"]:
        # Check if already referred (double safety)
        if "referred_by" not in user:
            referrer = await db.users.find_one({"firebase_uid": referral_code})
            if referrer:
                # Atomic update to claim referral
                result = await db.users.update_one(
                    {
                        "firebase_uid": firebase_user["uid"],
                        "referred_by": {"$exists": False}  # Ensure not already referred
                    },
                    {
                        "$set": {"referred_by": referral_code},
                        "$inc": {"coins": 1500}  # Award bonus coins to new user
                    }
                )
                
                if result.modified_count > 0:
                    referral_bonus_applied = True
                    # Update local user object to reflect changes
                    user["coins"] += 1500
                    
                    # Award referrer (1000 coins + increment invite count)
                    await db.users.update_one(
                        {"firebase_uid": referral_code},
                        {"$inc": {"coins": 1000, "invited_count": 1}}
                    )
                    logger.info(f"Referral successful: {referral_code} referred {firebase_user['uid']}")
                    
                    # Update referrer's invite quest progress
                    try:
                        from app.routers.earn import update_invite_quest_progress
                        await update_invite_quest_progress(referral_code, 1)
                    except Exception as quest_error:
                        logger.warning(f"Failed to update invite quest progress: {quest_error}")

    return {
        **firebase_user,
        "elo_rating": user.get("elo_rating", 1000),
        "rank": get_rank_from_elo(user.get("elo_rating", 1000)),
        "referral_bonus_applied": referral_bonus_applied,
        "is_new_user": is_new_user
    }


async def get_current_user(authorization: str = Header(...)) -> UserInfo:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization[7:]
    
    # First try to verify as guest token
    guest_uid = verify_guest_token(token)
    if guest_uid:
        # It's a valid guest token
        db = Database.get_db()
        user = await db.users.find_one({"firebase_uid": guest_uid})
        if not user:
            raise HTTPException(status_code=401, detail="Guest user not found")
        
        elo = user.get("elo_rating", 1000)
        return UserInfo(
            uid=guest_uid,
            email="",
            display_name=user.get("display_name", "Guest"),
            photo_url=None,
            elo_rating=elo,
            rank=get_rank_from_elo(elo),
            is_guest=True
        )
    
    # If not a guest token, try Firebase token
    firebase_user = await verify_firebase_token(token)
    user_data = await get_or_create_user(firebase_user)
    
    return UserInfo(**user_data)


@router.post("/verify", response_model=UserInfo)
async def verify_token(request: TokenVerifyRequest):
    firebase_user = await verify_firebase_token(request.id_token)
    user_data = await get_or_create_user(firebase_user, request.referral_code)
    return UserInfo(**user_data)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: UserInfo = Depends(get_current_user)):
    return current_user


# =============================================================================
# GUEST AUTHENTICATION ENDPOINTS
# =============================================================================

def create_guest_token(guest_uid: str) -> str:
    """Create a JWT token for guest authentication"""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(days=GUEST_JWT_EXPIRY_DAYS)
    payload = {
        "sub": guest_uid,
        "exp": expire,
        "type": "guest"
    }
    return jwt.encode(payload, settings.backend_secret_key, algorithm=GUEST_JWT_ALGORITHM)


def verify_guest_token(token: str) -> Optional[str]:
    """Verify a guest JWT token and return the guest UID"""
    settings = get_settings()
    
    # Warn if using default secret key in production
    if settings.backend_secret_key == "dev-secret-key-change-in-production":
        logger.warning("SECURITY: Using default backend_secret_key! Set BACKEND_SECRET_KEY env var in production.")
    
    try:
        payload = jwt.decode(token, settings.backend_secret_key, algorithms=[GUEST_JWT_ALGORITHM])
        if payload.get("type") != "guest":
            logger.debug(f"Token verification failed: token type is '{payload.get('type')}', expected 'guest'")
            return None
        return payload.get("sub")
    except JWTError as e:
        # Log the specific error to help debug secret key mismatches
        logger.debug(f"Guest token verification failed: {type(e).__name__}: {e}")
        return None


@router.post("/guest/register", response_model=GuestUserInfo)
async def register_guest(request: GuestRegisterRequest):
    """Register a new guest account with username and password"""
    db = Database.get_db()
    
    # Check if username already exists
    existing = await db.users.find_one({"guest_username": request.username.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Generate unique guest UID
    guest_uid = f"guest_{uuid.uuid4().hex[:16]}"
    
    # Hash password
    password_hash = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create guest user document
    new_user = {
        "firebase_uid": guest_uid,
        "guest_username": request.username.lower(),
        "password_hash": password_hash.decode('utf-8'),
        "display_name": request.username,
        "is_guest": True,
        "email": f"{guest_uid}@guest.typelo.tech",
        "photo_url": None,
        "elo_rating": 1000,
        "elo_rd": 350.0,
        "elo_volatility": 0.06,
        "peak_elo": 1000,
        "best_wpm": 0,
        "total_matches": 0,
        "wins": 0,
        "losses": 0,
        "coins": 100,
        "invited_count": 0,
        "redeemed_codes": [],
        "created_at": datetime.now(timezone.utc),
        "last_login": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(new_user)
    logger.info(f"Created new guest user: {guest_uid} ({request.username})")
    
    # Generate JWT token
    token = create_guest_token(guest_uid)
    
    return GuestUserInfo(
        uid=guest_uid,
        display_name=request.username,
        is_guest=True,
        elo_rating=1000,
        rank=Rank.UNRANKED,
        token=token
    )


@router.post("/guest/login", response_model=GuestUserInfo)
async def login_guest(request: GuestLoginRequest):
    """Login to an existing guest account"""
    db = Database.get_db()
    
    # Find user by username
    user = await db.users.find_one({"guest_username": request.username.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    if not bcrypt.checkpw(request.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Update last login
    await db.users.update_one(
        {"firebase_uid": user["firebase_uid"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Generate new JWT token
    token = create_guest_token(user["firebase_uid"])
    
    logger.info(f"Guest login successful: {user['firebase_uid']} ({request.username})")
    
    return GuestUserInfo(
        uid=user["firebase_uid"],
        display_name=user["display_name"],
        is_guest=True,
        elo_rating=user.get("elo_rating", 1000),
        rank=get_rank_from_elo(user.get("elo_rating", 1000)),
        token=token
    )


@router.post("/guest/verify", response_model=GuestUserInfo)
async def verify_guest(authorization: str = Header(...)):
    """Verify a guest token and return user info"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization[7:]
    guest_uid = verify_guest_token(token)
    
    if not guest_uid:
        raise HTTPException(status_code=401, detail="Invalid or expired guest token")
    
    db = Database.get_db()
    user = await db.users.find_one({"firebase_uid": guest_uid})
    
    if not user:
        raise HTTPException(status_code=404, detail="Guest user not found")
    
    # Generate fresh token
    new_token = create_guest_token(guest_uid)
    
    return GuestUserInfo(
        uid=user["firebase_uid"],
        display_name=user["display_name"],
        is_guest=True,
        elo_rating=user.get("elo_rating", 1000),
        rank=get_rank_from_elo(user.get("elo_rating", 1000)),
        token=new_token
    )


@router.post("/guest/convert", response_model=UserInfo)
async def convert_guest_to_google(request: GuestConvertRequest):
    """Convert a guest account to a full Google account, transferring all data"""
    db = Database.get_db()
    
    # Verify guest token
    guest_uid = verify_guest_token(request.guest_token)
    if not guest_uid:
        raise HTTPException(status_code=401, detail="Invalid or expired guest token")
    
    # Get guest user data
    guest_user = await db.users.find_one({"firebase_uid": guest_uid})
    if not guest_user:
        raise HTTPException(status_code=404, detail="Guest user not found")
    
    # Verify Firebase token
    firebase_user = await verify_firebase_token(request.id_token)
    
    # Check if Google account already exists
    existing_google = await db.users.find_one({"firebase_uid": firebase_user["uid"]})
    if existing_google:
        raise HTTPException(
            status_code=400, 
            detail="This Google account is already registered. Please use a different account."
        )
    
    # Transfer guest data to new Google account
    # Keep all stats, coins, inventory, etc. but update identity fields
    update_data = {
        "firebase_uid": firebase_user["uid"],
        "email": firebase_user["email"],
        "display_name": firebase_user["display_name"],
        "photo_url": firebase_user["photo_url"],
        "is_guest": False,
        "converted_from_guest": guest_uid,
        "converted_at": datetime.now(timezone.utc),
        # Award conversion bonus
        "coins": guest_user.get("coins", 0) + GUEST_CONVERSION_BONUS
    }
    
    # Remove guest-specific fields
    await db.users.update_one(
        {"firebase_uid": guest_uid},
        {
            "$set": update_data,
            "$unset": {"guest_username": "", "password_hash": ""}
        }
    )
    
    logger.info(f"Guest {guest_uid} converted to Google account {firebase_user['uid']} (+{GUEST_CONVERSION_BONUS} bonus coins)")
    
    return UserInfo(
        uid=firebase_user["uid"],
        email=firebase_user["email"],
        display_name=firebase_user["display_name"],
        photo_url=firebase_user["photo_url"],
        elo_rating=guest_user.get("elo_rating", 1000),
        rank=get_rank_from_elo(guest_user.get("elo_rating", 1000)),
        referral_bonus_applied=False,
        is_new_user=False,
        is_guest=False
    )
