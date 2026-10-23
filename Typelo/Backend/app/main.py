#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Main FastAPI application entry point. Configures the app, middleware, database connections, and routes.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# init_firebase: Initialize Firebase Admin SDK using credentials from settings.
# check_firebase_health: Returns True if Firebase app is initialized.
# lifespan: Async context manager for application startup (db connection) and shutdown (cleanup) events.
# SecurityHeadersMiddleware.dispatch: Middleware to add security headers (X-Content-Type-Options, etc.) to responses.
# RequestIDMiddleware.dispatch: Middleware to generate and attach a unique X-Request-ID to every request.
# root: Simple health check endpoint returning status ok.
# health: Comprehensive health check for DB, Redis, and Firebase.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# app: The main FastAPI application instance.
# logger: Logger instance for this module.
# settings: Application settings loaded from config.
# SecurityHeadersMiddleware: Custom middleware class for security headers.
# RequestIDMiddleware: Custom middleware class for request tracing.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: Web framework.
# fastapi.middleware.cors: Middleware for handling CORS.
# contextlib.asynccontextmanager: Decorator for lifespan.
# firebase_admin: Firebase SDK for authentication.
# logging: standard logging library.
# uuid: For generating unique request IDs.
# app.config.get_settings: Helper to load settings.
# app.database.Database: Database connection manager.
# app.services.matchmaking.matchmaking_service: Service for handling matchmaking.
# app.services.game.game_service: Service for managing game sessions.
# app.routers: Module containing API route definitions.
# starlette.middleware.base.BaseHTTPMiddleware: Base class for custom middleware.
# starlette.requests.Request: Type hinting for requests.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import firebase_admin
from firebase_admin import credentials
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request 

from app.config import get_settings
from app.database import Database
from app.services.matchmaking import matchmaking_service
from app.services.game import game_service
from app.routers import auth, match, leaderboard, user, friends, shop, earn, daily

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_firebase():
    settings = get_settings()
    
    if firebase_admin._apps:
        return True
    
    try:
        cred = credentials.Certificate(settings.firebase_credentials)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized")
        return True
    except Exception as e:
        logger.warning(f"Firebase Admin SDK initialization failed: {e}")
        logger.warning("Token verification will use fallback method")
        return False

def check_firebase_health() -> bool:
    return bool(firebase_admin._apps)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Evotaion Backend starting...")
    
    init_firebase()
    
    await Database.connect()
    
    await matchmaking_service.init_redis()
    
    yield
    
    logger.info("Graceful shutdown: ending active games...")
    active_matches = list(game_service._sessions.keys())
    for match_id in active_matches:
        try:
            await game_service.end_game(match_id)
            logger.info(f"Ended active game: {match_id}")
        except Exception as e:
            logger.warning(f"Failed to end game {match_id}: {e}")
    
    logger.info(f"Ended {len(active_matches)} active games during shutdown")
    
    await Database.disconnect()
    logger.info("Evotaion Backend shutting down...")

app = FastAPI(
    title="typelo",
    description="Hyper-minimal competitive typing game API",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
logger.info(f"Configuring CORS for origins: {settings.cors_origins_list}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(match.router, prefix="/api/match", tags=["Match"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(friends.router, prefix="/api/friends", tags=["Friends"])
app.include_router(shop.router, prefix="/api/shop", tags=["Shop"])
app.include_router(earn.router, prefix="/api/earn", tags=["Earn"])
app.include_router(daily.router, prefix="/api/daily", tags=["Daily"])
# Force reload for new router registration

@app.get("/")
async def root():
    return {"status": "ok", "service": "evotaion"}

@app.get("/health")
async def health():
    db_healthy = await Database.check_health()
    
    redis_healthy = False
    try:
        if matchmaking_service._redis:
            await matchmaking_service._redis.ping()
            redis_healthy = True
    except Exception:
        pass
    
    firebase_healthy = check_firebase_health()
    
    all_healthy = db_healthy and redis_healthy
    status = "healthy" if all_healthy else "degraded"
    
    return {
        "status": status,
        "version": "1.0.0",
        "services": {
            "database": "connected" if db_healthy else "disconnected",
            "redis": "connected" if redis_healthy else "disconnected",
            "firebase": "initialized" if firebase_healthy else "not_initialized",
        },
        "active_games": len(game_service._sessions),
        "players_in_queue": len(matchmaking_service._match_callbacks),
    }
