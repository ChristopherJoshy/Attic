"""FastAPI entrypoint for the SAHAYI backend."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.routes_dashboard import router as dashboard_router
from api.routes_patients import router as patient_router
from api.routes_voice import router as voice_router
from contracts.system import HealthResponse
from core.bootstrap import bootstrap_app, health_snapshot, run_overdue_summary_job, run_population_job
from core.config import get_settings
from utils.logger import get_logger

settings = get_settings()
scheduler = AsyncIOScheduler()
logger = get_logger("sahayi.api.access")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise and tear down SAHAYI application services.

    Args:
        app: FastAPI application instance.
    Returns:
        Async lifespan context.
    Agent:
        Platform
    """

    app.state.settings = settings
    app.state.websocket_base = settings.twilio_webhook_base.replace("https://", "wss://").replace("http://", "ws://")
    await bootstrap_app(app)
    scheduler.add_job(run_population_job, "interval", hours=6, args=[app], id="population-job", replace_existing=True)
    scheduler.add_job(run_overdue_summary_job, "interval", minutes=10, args=[app], id="overdue-summary-job", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="SAHAYI", version="1.0.0", lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log incoming HTTP requests and their processing time.

    Args:
        request: FastAPI request object.
        call_next: The next middleware or route handler.
    Returns:
        The response from the route handler.
    Agent:
        API
    """

    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    
    # Avoid logging frequent health checks to keep logs clean
    if request.url.path != "/health":
        logger.info(
            "API | %s %s | %d | %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            process_time,
        )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if settings.allow_all_frontend_origins else list(settings.frontend_origins),
    allow_origin_regex=".*" if settings.allow_all_frontend_origins else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(voice_router)
app.include_router(dashboard_router)
app.include_router(patient_router)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return system health for SAHAYI services.

    Args:
        None: Uses application state and configured services.
    Returns:
        Health response payload.
    Agent:
        API
    """

    snapshot = await health_snapshot(app)
    return HealthResponse(status=snapshot["status"], services=snapshot["services"], checked_at=datetime.utcnow())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
