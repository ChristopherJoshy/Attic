
"""Report Service - Manages user safety reports and moderation."""
from typing import List, Optional, Dict, Any
from app.database import get_db
from app.models.report import ReportStatus
from app.utils.timezone_utils import utc_now

class ReportService:
    async def get_pending_reports(self) -> List[Any]:
        """Get all pending reports."""
        db = get_db()
        cursor = db.reports.find({"status": "pending"}).sort("created_at", 1)
        reports = await cursor.to_list(length=100)
        
        # Convert to objects if your ORM requires it, but for now
        # simple dicts or simple objects wrapper is fine for the bot handler
        # The handler accesses .report_id so we might need SimpleNamespace or just dict access
        # but the handler uses dot notation: r.report_id
        # So let's wrap them in a simple class or use dict dot access if available.
        # For safety, let's return objects.
        
        return [SimpleReport(r) for r in reports]

    async def resolve_report(
        self, 
        report_id: str, 
        action: str, 
        resolution_notes: str, 
        resolved_by: str
    ):
        """Resolve a report with an action."""
        db = get_db()
        
        update_data = {
            "status": ReportStatus.RESOLVED.value,  # Use .value to store as string
            "resolution": action,
            "resolution_note": resolution_notes,
            "resolved_by": resolved_by,
            "resolved_at": utc_now()
        }
        
        result = await db.reports.update_one(
            {"report_id": report_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise ValueError(f"Report {report_id} not found")
            
        return True

class SimpleReport:
    """Helper to allow dot notation access for reports."""
    def __init__(self, data: Dict[str, Any]):
        self.report_id = data.get("report_id")
        self.reason = data.get("note", "No reason provided")
        self.reporter_id = data.get("reporter_user_id")
        self.reported_user_id = data.get("accused_user_id")
