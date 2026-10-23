"""
Scheduler Monitoring Router

Provides endpoints to monitor scheduled job health and status.
"""

from fastapi import APIRouter, Depends
from typing import Dict, List
from app.dependencies import get_current_admin_user
from app.models.user import User

router = APIRouter()


@router.get("/scheduler/status", dependencies=[Depends(get_current_admin_user)])
async def get_scheduler_status() -> Dict:
    """
    Get the status of all scheduled jobs.

    Returns job execution metrics including:
    - Execution count
    - Failure count
    - Last execution time
    - Last error (if any)

    **Admin only**
    """
    from app.scheduler import (
        health_check_job,
        ride_reminder_job,
        promotional_notification_job,
        data_cleanup_job,
    )

    jobs = [
        health_check_job,
        ride_reminder_job,
        promotional_notification_job,
        data_cleanup_job,
    ]

    job_statuses = []
    for job in jobs:
        status = {
            "name": job.name,
            "execution_count": job.execution_count,
            "failure_count": job.failure_count,
            "last_execution": (
                job.last_execution.isoformat() if job.last_execution else None
            ),
            "last_error": job.last_error,
            "health": "healthy" if job.failure_count < 3 else "unhealthy",
        }
        job_statuses.append(status)

    # Calculate overall health
    unhealthy_jobs = [j for j in job_statuses if j["health"] == "unhealthy"]
    overall_health = "unhealthy" if unhealthy_jobs else "healthy"

    return {
        "overall_health": overall_health,
        "jobs": job_statuses,
        "unhealthy_jobs": len(unhealthy_jobs),
        "total_jobs": len(job_statuses),
    }


@router.post("/scheduler/reset-metrics", dependencies=[Depends(get_current_admin_user)])
async def reset_scheduler_metrics() -> Dict:
    """
    Reset scheduler metrics (execution counts, failure counts).

    **Admin only**
    """
    from app.scheduler import (
        health_check_job,
        ride_reminder_job,
        promotional_notification_job,
        data_cleanup_job,
    )

    jobs = [
        health_check_job,
        ride_reminder_job,
        promotional_notification_job,
        data_cleanup_job,
    ]

    for job in jobs:
        job.execution_count = 0
        job.failure_count = 0
        job.last_error = None

    return {
        "status": "success",
        "message": "Scheduler metrics reset successfully",
    }
