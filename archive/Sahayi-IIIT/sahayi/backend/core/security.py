"""Authentication and authorization helpers for SAHAYI."""

from __future__ import annotations

import asyncio
from typing import Any

import firebase_admin
from fastapi import Header, HTTPException, WebSocket, status
from firebase_admin import auth, credentials

from core.config import get_settings


def init_firebase() -> None:
    """Initialise Firebase Admin once per process.

    Args:
        None: Uses environment-backed settings.
    Returns:
        None.
    Agent:
        Platform
    """

    settings = get_settings()
    if firebase_admin._apps:
        return
    if not settings.service_account_file:
        raise RuntimeError("Firebase service-account JSON file is not configured.")
    cred = credentials.Certificate(settings.service_account_file)
    firebase_admin.initialize_app(cred)


async def verify_token(token: str) -> dict[str, Any]:
    """Verify a Firebase ID token asynchronously.

    Args:
        token: Firebase ID token from the client.
    Returns:
        Decoded token payload.
    Agent:
        Platform
    """

    try:
        init_firebase()
        return await asyncio.to_thread(auth.verify_id_token, token, check_revoked=False)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_doctor(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Authorize a doctor request from the Bearer header.

    Args:
        authorization: Incoming Authorization header.
    Returns:
        Decoded Firebase token payload.
    Agent:
        Platform
    """

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    return await verify_token(authorization.split(" ", 1)[1])


async def require_doctor_socket(websocket: WebSocket) -> dict[str, Any]:
    """Authorize a doctor WebSocket connection.

    Args:
        websocket: Incoming FastAPI WebSocket instance.
    Returns:
        Decoded Firebase token payload.
    Agent:
        Platform
    """

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    return await verify_token(token)
