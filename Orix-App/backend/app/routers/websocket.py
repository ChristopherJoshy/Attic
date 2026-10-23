"""
WebSocket Router

Real-time updates for ride matching and group chat.
"""

import json
from typing import Dict, Set
from app.utils.timezone_utils import utc_now

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.auth_service import AuthService
from app.services.audit_service import AuditService


router = APIRouter()
auth_service = AuthService()
audit_service = AuditService()


# =============================================================================
# Connection Manager
# =============================================================================


class ConnectionManager:
    """
    Manages WebSocket connections.

    Connections are grouped by user_id for targeted notifications.
    """

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and track a new connection."""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal(self, user_id: str, message: dict):
        """Send message to all connections of a user."""
        if user_id in self.active_connections:
            disconnected = set()

            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    disconnected.add(websocket)

            # Clean up disconnected sockets
            for ws in disconnected:
                self.active_connections[user_id].discard(ws)

    async def broadcast_to_group(self, user_ids: list, message: dict):
        """Broadcast message to multiple users."""
        for user_id in user_ids:
            await self.send_personal(user_id, message)

    async def broadcast_all(self, message: dict):
        """Broadcast message to ALL connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal(user_id, message)

    def get_online_users(self) -> list:
        """Get list of online user IDs."""
        return list(self.active_connections.keys())


manager = ConnectionManager()


# =============================================================================
# WebSocket Endpoint
# =============================================================================


@router.websocket("")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time updates.

    Connect with: ws://host/ws?token=<firebase_id_token>

    Messages sent to client:
    - match_found: New match available
    - match_expired: Match request expired
    - readiness_update: Group member confirmed/dropped
    - group_finalized: All members confirmed
    - group_cancelled: Group was cancelled
    - new_chat_message: New message in group chat
    - notification: General notification
    """
    # Verify token
    claims = auth_service.verify_firebase_token(token)

    if not claims:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Get user
    user, _ = await auth_service.get_or_create_user(claims)
    user_id = user.user_id

    await manager.connect(websocket, user_id)

    try:
        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connected",
                "user_id": user_id,
                "timestamp": utc_now().isoformat(),
            }
        )

        # Log User Online (Exact time)
        await audit_service.log_connection_event(user_id, "online")

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                message_type = message.get("type")

                if message_type == "ping":
                    await websocket.send_json(
                        {"type": "pong", "timestamp": utc_now().isoformat()}
                    )

                elif message_type == "chat_message":
                    # Handle chat messages via WebSocket for instant delivery
                    group_id = message.get("group_id")
                    content = message.get("content", "").strip()

                    if group_id and content:
                        # Import group service here to avoid circular dependency
                        from app.services.group_service import GroupService

                        group_service = GroupService()

                        # Send the message (persists to DB)
                        chat_msg = await group_service.send_chat_message(
                            group_id=group_id, user_id=user_id, content=content
                        )

                        if chat_msg:
                            # Get group members to broadcast
                            group = await group_service.get_group(group_id)
                            if group:
                                member_ids = [m.user_id for m in group.members]

                                # Broadcast to all group members
                                await notify_new_chat_message(
                                    user_ids=member_ids,
                                    group_id=group_id,
                                    message_id=chat_msg.message_id,
                                    sender_name=chat_msg.user_display_name,
                                    content=chat_msg.content,
                                )

                                # Send confirmation to sender
                                await websocket.send_json(
                                    {
                                        "type": "chat_sent",
                                        "message_id": chat_msg.message_id,
                                        "timestamp": chat_msg.created_at.isoformat(),
                                    }
                                )

                # Other message types can be added here

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        # Log User Offline (Exact time)
        await audit_service.log_connection_event(user_id, "offline")


# =============================================================================
# Helper Functions for Other Services
# =============================================================================


async def notify_match_found(user_id: str, group_id: str, route_summary: str):
    """Notify user via WebSocket about a match."""
    await manager.send_personal(
        user_id,
        {
            "type": "match_found",
            "group_id": group_id,
            "route_summary": route_summary,
            "timestamp": utc_now().isoformat(),
        },
    )


async def notify_group_update(
    user_ids: list, group_id: str, update_type: str, data: dict = None
):
    """Notify group members about an update."""
    message = {
        "type": update_type,
        "group_id": group_id,
        "timestamp": utc_now().isoformat(),
        **(data or {}),
    }

    await manager.broadcast_to_group(user_ids, message)


async def notify_new_chat_message(
    user_ids: list, group_id: str, message_id: str, sender_name: str, content: str
):
    """Notify group members about new chat message."""
    await manager.broadcast_to_group(
        user_ids,
        {
            "type": "new_chat_message",
            "group_id": group_id,
            "message_id": message_id,
            "sender_name": sender_name,
            "content": content[:100],  # Preview only
        },
    )

    # Log to Telegram
    from app.services.audit_service import AuditService

    audit = AuditService()
    await audit.log_chat_message(
        group_id=group_id,
        sender_id="unknown",  # We don't have sender ID here, just name
        sender_name=sender_name,
        message=content,
    )


async def notify_account_status(user_id: str, status: str, reason: str = None):
    """
    Notify user of account status change via WebSocket.

    Triggers immediate frontend refresh to show ban/suspension screen.
    """
    await manager.send_personal(
        user_id,
        {
            "type": f"user_{status}",  # user_banned or user_suspended
            "status": status,
            "reason": reason,
            "timestamp": utc_now().isoformat(),
        },
    )


async def notify_maintenance_mode(enabled: bool):
    """
    Broadcast maintenance mode status to ALL connected users.

    Triggers immediate frontend redirect to maintenance screen.
    """
    await manager.broadcast_all(
        {
            "type": "maintenance_mode",
            "enabled": enabled,
            "timestamp": utc_now().isoformat(),
        }
    )
