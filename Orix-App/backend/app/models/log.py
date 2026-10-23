from typing import Optional, Dict, Any
from pydantic import BaseModel


class ClientLogRequest(BaseModel):
    level: str = "error"
    message: str
    context: str
    stack_trace: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ActivityLogRequest(BaseModel):
    action_type: str
    screen: str
    target: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationReceivedRequest(BaseModel):
    notification_id: str
    action: str = "received"
