"""
ORIX Backend - FastAPI Application

Main application entry point with middleware, routers, and OpenAPI
documentation.
"""

from app.telegram_bot.bot import (
    create_bot,
    logger as bot_logger,
)
from telegram import (
    Update,
)
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db, close_db, get_db, get_redis
from app.routers import (
    auth,
    users,
    rides,
    groups,
    reports,
    notifications,
    admin,
    websocket,
    support,
    logs,
    ratings,
    version,
    scheduler,
)
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from apscheduler.schedulers.asyncio import AsyncIOScheduler


# Domain display name defaults (used for seeding)
DOMAIN_NAMES = {
    "sjcetpalai.ac.in": "SJCET Palai",
    "adishankara.ac.in": ("Adi Shankara Institute of Engineering and Technology"),
}


async def seed_domains_from_env():
    """Seed domains from .env to MongoDB on startup."""
    db = get_db()

    for domain in settings.allowed_domains_list:
        # Check if domain already exists
        existing = await db.domain_names.find_one({"domain": domain})
        if not existing:
            name = DOMAIN_NAMES.get(domain) or domain.split(".")[0].upper()
            await db.domain_names.insert_one({"domain": domain, "name": name})
            print(f"Seeded domain: {domain} -> {name}")
        else:
            print(f"Domain exists: {domain}")

    domains_count = len(settings.allowed_domains_list)
    print(f"Domain seeding complete - {domains_count} domains from .env")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.

    Handles startup and shutdown events:
    - Initialize database connections
    - Seed domains from .env to MongoDB
    - Start background workers
    - Initialize Telegram Bot
    - Cleanup on shutdown
    """
    # Startup
    await init_db()

    # Set up Telegram logging for console messages
    if settings.telegram_bot_token and settings.head_admin_id:
        try:
            from app.utils.telegram_log_handler import setup_telegram_logging

            setup_telegram_logging(
                settings.telegram_bot_token, str(settings.head_admin_id)
            )
        except Exception as e:
            print(f"Failed to setup Telegram logging: {e}")

    # Seed domains from .env to MongoDB
    await seed_domains_from_env()

    # Initialize Telegram Bot
    import asyncio as aio

    global bot_app
    telegram_active = False
    if settings.telegram_bot_token:
        try:

            async def init_telegram():
                global bot_app
                bot_app = create_bot()
                await bot_app.initialize()

                if settings.telegram_webhook_url:
                    # Webhook mode: set webhook and DON'T start polling
                    webhook_url = f"{settings.telegram_webhook_url}" f"/api/v1/webhook"
                    await bot_app.bot.set_webhook(webhook_url)
                    webhook_info = await bot_app.bot.get_webhook_info()
                    bot_logger.info(f"Webhook set to: {webhook_url}")
                    bot_logger.info(
                        f"Webhook info: url={webhook_info.url}, "
                        f"pending={webhook_info.pending_update_count}, "
                        f"last_error={webhook_info.last_error_message}"
                    )
                else:
                    # Polling mode: start the updater
                    await bot_app.start()
                    await bot_app.updater.start_polling()
                return True

            # 30 second timeout for bot initialization
            await aio.wait_for(init_telegram(), timeout=30.0)
            telegram_active = True
        except aio.TimeoutError:
            bot_logger.error("Telegram bot initialization timed out after 30s")
        except Exception as e:
            bot_logger.error(f"Failed to initialize Telegram bot: {e}")

    # Verify connections and print logs
    print("\n" + "=" * 50)
    print("ORIX BACKEND STARTUP")
    print("=" * 50)

    # Verify MongoDB
    try:
        await get_db().client.admin.command("ping")
        print("Connected to db")
    except Exception as e:
        print(f"FAILED to connect to db: {e}")

    # Verify Firebase (trigger init via AuthService)
    try:
        from app.services.auth_service import AuthService
        import firebase_admin

        AuthService()  # Triggers _init_firebase
        firebase_admin.get_app()  # Verifies it exists
        print("Firebase connected")
    except Exception as e:
        print(f"FAILED to connect to Firebase: {e}")

    # Verify Redis
    try:
        await get_redis().ping()
        print("Redis connected")
    except Exception as e:
        print(f"FAILED to connect to Redis: {e}")

    print(f"Telegram bot active: {telegram_active}")
    print("=" * 50 + "\n")

    # Scheduler with industry-standard job management
    scheduler = None
    try:
        from app.scheduler import (
            health_check_job,
            ride_reminder_job,
            ride_alarm_job,
            promotional_notification_job,
            data_cleanup_job,
        )

        scheduler = AsyncIOScheduler()

        # Register jobs with appropriate intervals
        scheduler.add_job(
            health_check_job.execute,
            "interval",
            minutes=10,
            id="health_check",
            name="Health Check Job",
            max_instances=1,
            coalesce=True,  # Skip if previous run is still executing
        )

        scheduler.add_job(
            promotional_notification_job.execute,
            "interval",
            minutes=30,
            id="promotional_notification",
            name="Promotional Notification Job",
            max_instances=1,
            coalesce=True,
        )

        scheduler.add_job(
            ride_reminder_job.execute,
            "interval",
            minutes=5,
            id="ride_reminder",
            name="Ride Reminder Job",
            max_instances=1,
            coalesce=True,
        )

        scheduler.add_job(
            ride_alarm_job.execute,
            "interval",
            minutes=1,
            id="ride_alarm",
            name="Ride Alarm Job",
            max_instances=1,
            coalesce=True,
        )

        scheduler.add_job(
            data_cleanup_job.execute,
            "interval",
            minutes=5,
            id="data_cleanup",
            name="Data Cleanup Job",
            max_instances=1,
            coalesce=True,
        )

        scheduler.start()
        print(
            "✓ Scheduler started with 5 jobs: "
            "Health Check (10m) | Promotions (30m) | "
            "Reminders (5m) | Alarm (1m) | Cleanup (5m)"
        )
    except Exception as e:
        print(f"✗ Failed to start scheduler: {e}")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown()
        print("Scheduler stopped")

    if bot_app:
        try:
            if settings.telegram_webhook_url:
                # In webhook mode: DON'T stop or shutdown the bot
                # The library's shutdown() deletes the webhook internally
                # Just let the process exit - webhook persists with Telegram
                # Stop putting  fucking comments in my fucking  code bitch
                bot_logger.info(
                    "Webhook mode: skipping bot shutdown to preserve webhook"
                )
            else:
                # Only stop updater in polling mode
                if bot_app.updater and bot_app.updater.running:
                    await bot_app.updater.stop()
                await bot_app.stop()
                await bot_app.shutdown()
        except Exception as e:
            bot_logger.error(f"Error shutting down bot: {e}")

    await close_db()


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="ORIX API",
    description="""
    ORIX - College Ride Coordination Platform API

    ## Features
    - Firebase Authentication with college email verification
    - Ride request creation and matchmaking
    - Real-time group coordination
    - Safety reporting and moderation

    ## Authentication
    All authenticated endpoints require a valid Firebase ID token in the
    Authorization header: `Authorization: Bearer <firebase_id_token>`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# =============================================================================
# Middleware
# =============================================================================

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)


# =============================================================================
# Exception Handlers
# =============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors.

    SECURITY: In production, do not leak internal error details.
    """
    # Log to Telegram
    try:
        audit = AuditService()
        context = f"{request.method} {request.url.path}"
        await audit.log_exception(context, exc)
    except BaseException:
        pass

    # Always return simplified message to user, even in debug mode
    # if requested. But usually developers want debug info.
    # User requested: "fix showing such detailed errors... show a
    # simple plain english error message"
    # Sticking to the simplified message.

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": (
                "Something went wrong. Our team has been notified "
                "and will fix it shortly."
            )
        },
    )


# =============================================================================
# Routers
# =============================================================================

# Routers imported at top of file

# Authentication routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# User routes
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])

# Ride routes
app.include_router(rides.router, prefix="/api/v1/rides", tags=["Rides"])

# Group routes
app.include_router(groups.router, prefix="/api/v1/groups", tags=["Groups"])

# Report routes
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])

# Notification routes
app.include_router(
    notifications.router,
    prefix="/api/v1/notifications",
    tags=["Notifications"],
)

# Admin routes
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# Support routes
app.include_router(support.router, prefix="/api/v1/support", tags=["Support"])

# WebSocket routes
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])

# Logging routes
app.include_router(logs.router, prefix="/api/v1/logs", tags=["Logs"])

# App version routes
app.include_router(version.router, prefix="/api/v1/app", tags=["App"])

# Ratings routes
app.include_router(ratings.router, prefix="/api/v1/ratings", tags=["Ratings"])

# Scheduler monitoring routes
app.include_router(scheduler.router, prefix="/api/v1", tags=["Scheduler"])


# =============================================================================
# Telegram Bot Webhook
# =============================================================================

bot_app = None


@app.post("/api/v1/webhook")
async def telegram_webhook(request: Request):
    """Handle Telegram Webhook updates."""
    if not bot_app:
        bot_logger.warning("Webhook called but bot_app is None")
        return {"status": "bot_not_initialized"}

    try:
        data = await request.json()
        update_id = data.get("update_id", "unknown")
        bot_logger.info(f"Webhook received update: {update_id}")
        update = Update.de_json(data, bot_app.bot)
        await bot_app.process_update(update)
        return {"status": "ok"}
    except Exception as e:
        bot_logger.error(f"Webhook error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


# =============================================================================
# Health Check
# =============================================================================


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "ORIX API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
