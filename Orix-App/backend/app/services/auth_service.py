"""
Authentication Service

Firebase Admin SDK integration for token verification.
"""

import uuid
from typing import Optional, Tuple

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from app.config import settings
from app.database import get_db
from app.models.user import User, UserCreate, UserStatus


# =============================================================================
# Firebase Initialization
# =============================================================================

_firebase_app = None


def _init_firebase():
    """
    Initialize Firebase Admin SDK.
    
    SECURITY: The service account credentials must be kept secure.
    Never log or expose the credentials.
    
    TODO: Set up Firebase service account JSON in .env
    """
    global _firebase_app
    
    if _firebase_app is not None:
        return _firebase_app
    
    creds = settings.firebase_credentials
    if creds is None:
        raise RuntimeError(
            "Firebase credentials not configured. "
            "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in .env"
        )
    
    cred = credentials.Certificate(creds)
    _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app


class AuthService:
    """
    Authentication service for Firebase token verification.
    
    SECURITY: All authentication flows go through this service.
    The service verifies Firebase ID tokens and enforces domain restrictions.
    """
    
    def __init__(self):
        """Initialize Firebase on first use."""
        import logging
        try:
            _init_firebase()
        except Exception as e:
            # Log warning but allow startup (Firebase may not be needed for all tests)
            logging.warning(f"Firebase initialization failed: {e}")
    
    def verify_firebase_token(self, id_token: str) -> Optional[dict]:
        """
        Verify a Firebase ID token and return the decoded claims.
        
        SECURITY: This is the authoritative verification of user identity.
        The token is verified against Firebase's public keys.
        
        Args:
            id_token: Firebase ID token from client
            
        Returns:
            Decoded token claims if valid, None otherwise
            
        Token claims include:
        - uid: Firebase UID
        - email: User's email
        - email_verified: Whether email is verified
        - name: Display name
        - picture: Profile picture URL
        """
        try:
            decoded = firebase_auth.verify_id_token(id_token)
            return decoded
        except firebase_auth.InvalidIdTokenError:
            return None
        except firebase_auth.ExpiredIdTokenError:
            return None
        except Exception:
            return None
    
    async def validate_college_domain(self, email: str) -> Tuple[bool, str]:
        """
        Validate that email is from an allowed college domain.
        
        SECURITY: This is the authoritative domain check.
        Client-side validation is for UX only.
        
        Domain source priority:
        1. MongoDB domain_names collection (primary)
        2. Fallback to .env ALLOWED_COLLEGE_DOMAINS
        
        Args:
            email: User's email address
            
        Returns:
            (is_valid, message) tuple
        """
        if not email:
            return False, "Email is required"
        
        email_lower = email.lower()
        domain = email_lower.split("@")[-1] if "@" in email_lower else ""
        
        # Get allowed domains from MongoDB first
        allowed_domains = []
        try:
            db = get_db()
            cursor = db.domain_names.find({})
            async for doc in cursor:
                if doc.get("domain"):
                    allowed_domains.append(doc["domain"].lower())
        except Exception:
            pass
        
        # Fallback to .env if MongoDB is empty
        if not allowed_domains:
            allowed_domains = settings.allowed_domains_list
        
        # Check for exact match or subdomain
        for allowed in allowed_domains:
            if domain == allowed or domain.endswith("." + allowed):
                return True, "OK"
        
        return False, f"Email domain '{domain}' is not allowed. Use your college email."
    
    async def get_or_create_user(self, token_claims: dict) -> Tuple[User, bool]:
        """
        Get existing user or create new one from Firebase claims.
        
        SECURITY: User records are created/retrieved based on verified
        Firebase tokens only.
        
        Uses atomic upsert to prevent race conditions when multiple concurrent
        requests try to create the same user (E11000 duplicate key error).
        
        Args:
            token_claims: Decoded Firebase token claims
            
        Returns:
            (user, is_new) tuple
        """
        from pymongo.errors import DuplicateKeyError
        
        db = get_db()
        firebase_uid = token_claims["uid"]
        email = token_claims.get("email", "")
        
        # Try to find existing user first
        existing = await db.users.find_one({"firebase_uid": firebase_uid})
        
        if existing:
            user = User(**existing)
            
            # Sync profile photo from Google if not using a custom uploaded photo
            # Custom photos are stored as relative paths (starting with /)
            token_photo = token_claims.get("picture")
            current_photo = user.photo_url
            
            should_update = False
            updates = {}
            
            if token_photo and (not current_photo or not current_photo.startswith("/")):
                if current_photo != token_photo:
                    updates["photo_url"] = token_photo
                    should_update = True
            
            if should_update:
                await db.users.update_one(
                    {"firebase_uid": firebase_uid},
                    {"$set": updates}
                )
                user = user.copy(update=updates)
                
            return user, False
        
        # Prepare new user data
        user_id = str(uuid.uuid4())
        
        new_user_data = {
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "email": email,
            "display_name": token_claims.get("name", email.split("@")[0]),
            "photo_url": token_claims.get("picture"),
            "onboarding_completed": False,
            "safety_consent": False,
            "status": UserStatus.ACTIVE.value,
            "trust_score": 0.5,
        }
        
        try:
            # Try to insert the new user
            await db.users.insert_one(new_user_data)
            user = User(**new_user_data)
            return user, True
            
        except DuplicateKeyError:
            # Race condition: another request created the user simultaneously
            # Fetch the existing user that was just created
            existing = await db.users.find_one({"firebase_uid": firebase_uid})
            if existing:
                user = User(**existing)
                return user, False
            
            # Extremely unlikely: user was created and deleted between operations
            raise RuntimeError(f"Failed to get or create user for firebase_uid: {firebase_uid}")
    
    async def get_user_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        """Get user by Firebase UID."""
        db = get_db()
        doc = await db.users.find_one({"firebase_uid": firebase_uid})
        if doc:
            return User(**doc)
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        db = get_db()
        doc = await db.users.find_one({"email": email.lower()})
        if doc:
            return User(**doc)
        return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by internal user_id."""
        db = get_db()
        doc = await db.users.find_one({"user_id": user_id})
        if doc:
            return User(**doc)
        return None
