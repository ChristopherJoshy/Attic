"""Centralized Timezone Utilities - All datetime operations should use these functions."""

from datetime import datetime, timedelta, timezone

UTC = timezone.utc
IST = timezone(timedelta(hours=5, minutes=30))


def utc_now() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(UTC)


def parse_local_to_utc(date_str: str, time_str: str, tz_offset_minutes: int) -> datetime:
    """Parse local date/time strings and convert to UTC datetime."""
    naive_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    local_tz = timezone(timedelta(minutes=tz_offset_minutes))
    local_dt = naive_dt.replace(tzinfo=local_tz)
    return local_dt.astimezone(UTC)


def format_ist(dt: datetime) -> str:
    """Format UTC datetime as IST time string for Telegram admin display."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST).strftime("%H:%M:%S")
