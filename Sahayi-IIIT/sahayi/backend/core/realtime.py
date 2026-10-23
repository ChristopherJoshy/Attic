"""Realtime dashboard connection manager for SAHAYI."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import WebSocket

from contracts.system import DashboardEvent


class DashboardSocketManager:
    """Manage doctor-scoped dashboard WebSocket connections.

    Args:
        None: Uses in-memory connection registries.
    Returns:
        DashboardSocketManager instance.
    Agent:
        Platform
    """

    def __init__(self) -> None:
        """Initialise empty socket registries.

        Args:
            None: Uses in-memory dictionaries.
        Returns:
            None.
        Agent:
            Platform
        """

        self.connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, doctor_uid: str, websocket: WebSocket) -> None:
        """Accept and store a new doctor WebSocket.

        Args:
            doctor_uid: Authenticated doctor UID.
            websocket: Incoming WebSocket connection.
        Returns:
            None.
        Agent:
            Platform
        """

        await websocket.accept()
        self.connections[doctor_uid].append(websocket)

    def disconnect(self, doctor_uid: str, websocket: WebSocket) -> None:
        """Remove a closed doctor WebSocket.

        Args:
            doctor_uid: Authenticated doctor UID.
            websocket: Closing WebSocket connection.
        Returns:
            None.
        Agent:
            Platform
        """

        self.connections[doctor_uid] = [item for item in self.connections.get(doctor_uid, []) if item is not websocket]

    async def broadcast(self, doctor_uid: str, event: str, payload: dict) -> None:
        """Broadcast one event to all sockets for a doctor.

        Args:
            doctor_uid: Authenticated doctor UID.
            event: Event type name.
            payload: Event payload object.
        Returns:
            None.
        Agent:
            Platform
        """

        message = DashboardEvent(event=event, payload=payload, occurred_at=datetime.utcnow()).model_dump(mode="json")
        stale: list[WebSocket] = []
        for websocket in self.connections.get(doctor_uid, []):
            try:
                await websocket.send_json(message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(doctor_uid, websocket)

    async def broadcast_all(self, event: str, payload: dict) -> None:
        """Broadcast one event to every connected dashboard socket.

        Args:
            event: Event type name.
            payload: Event payload object.
        Returns:
            None.
        Agent:
            Platform
        """

        for doctor_uid in list(self.connections):
            await self.broadcast(doctor_uid, event, payload)
