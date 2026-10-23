"""Validation and timeout helpers for SAHAYI backend."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, TypeVar

from fastapi import HTTPException, status

T = TypeVar("T")


async def with_timeout(awaitable: Awaitable[T], seconds: float, context: str) -> T:
    """Await a coroutine with a fixed timeout.

    Args:
        awaitable: Coroutine or awaitable object.
        seconds: Timeout window in seconds.
        context: Human-readable timeout context.
    Returns:
        Awaited result when completed in time.
    Agent:
        Platform
    """

    try:
        return await asyncio.wait_for(awaitable, timeout=seconds)
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"{context} timed out",
        ) from exc


def clamp_severity(value: int) -> int:
    """Clamp symptom severity into the required 1-5 range.

    Args:
        value: Candidate severity score.
    Returns:
        Clamped severity value.
    Agent:
        Platform
    """

    return max(1, min(5, value))


def normalize_phone(value: str) -> str:
    """Normalize phone numbers for lookup and storage.

    Args:
        value: Raw phone input.
    Returns:
        Normalized E.164-like phone string.
    Agent:
        Platform
    """

    raw = "".join(ch for ch in value if ch.isdigit() or ch == "+")
    if not raw:
        return ""
    if raw.startswith("+"):
        digits = "".join(ch for ch in raw if ch.isdigit())
        return f"+{digits}" if digits else ""

    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""
    if len(digits) == 10:
        # Default local mobile numbers to India E.164 because SAHAYI is India-first.
        return f"+91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if 11 <= len(digits) <= 15:
        return f"+{digits}"
    return digits


def phone_lookup_variants(value: str) -> tuple[str, ...]:
    """Generate lookup variants for phone numbers stored in older formats.

    Args:
        value: Raw or normalized phone number.
    Returns:
        Candidate phone strings for database lookup.
    Agent:
        Platform
    """

    normalized = normalize_phone(value)
    digits = "".join(ch for ch in normalized if ch.isdigit())
    variants = {candidate for candidate in (normalized, digits, f"+{digits}" if digits else "") if candidate}
    if len(digits) >= 10:
        local = digits[-10:]
        variants.update({local, f"+91{local}"})
    return tuple(variants)


def normalize_whatsapp(value: str) -> str:
    """Normalize WhatsApp addresses for Twilio sends.

    Args:
        value: Raw WhatsApp number or address.
    Returns:
        Twilio-ready WhatsApp address string.
    Agent:
        Platform
    """

    phone = normalize_phone(value.replace("whatsapp:", ""))
    return f"whatsapp:{phone}" if phone else ""
