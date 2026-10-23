#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Retry utilities - Helpers for reliable async operations with retry logic.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# notify_with_retry: Executes a callback with retries on failure (e.g. timeout).
# notify_players_parallel: Executes multiple callbacks in parallel with individual retry logic.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# asyncio: Async I/O.
# logging: Logging.
# typing: Type hints.
# app.constants: Configuration constants for retries.

import asyncio
import logging
from typing import Callable, Awaitable, Any, Optional

from app.constants import (
    NOTIFY_MAX_RETRIES,
    NOTIFY_RETRY_DELAY_SECONDS,
    NOTIFY_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


async def notify_with_retry(
    callback: Callable[..., Awaitable[Any]],
    *args,
    timeout: float = NOTIFY_TIMEOUT_SECONDS,
    max_retries: int = NOTIFY_MAX_RETRIES,
    retry_delay: float = NOTIFY_RETRY_DELAY_SECONDS,
    label: str = "notification",
    **kwargs
) -> bool:
    """
    Execute an async callback with retry logic for reliability.
    
    Args:
        callback: Async function to call
        *args: Positional arguments for callback
        timeout: Timeout per attempt in seconds
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
        label: Description for logging
        **kwargs: Keyword arguments for callback
    
    Returns:
        True if callback succeeded, False if all retries failed
    """
    for attempt in range(max_retries):
        try:
            await asyncio.wait_for(
                callback(*args, **kwargs),
                timeout=timeout
            )
            if attempt > 0:
                logger.info(f"{label} succeeded on attempt {attempt + 1}")
            return True
        except asyncio.TimeoutError:
            logger.warning(
                f"{label} timeout, attempt {attempt + 1}/{max_retries}"
            )
        except Exception as e:
            logger.warning(
                f"{label} failed: {e}, attempt {attempt + 1}/{max_retries}"
            )
        
        if attempt < max_retries - 1:
            await asyncio.sleep(retry_delay)
    
    logger.error(f"{label} failed after {max_retries} attempts")
    return False


async def notify_players_parallel(
    player_callbacks: dict,
    message_builder: Callable[[str], tuple],
    timeout: float = NOTIFY_TIMEOUT_SECONDS,
    max_retries: int = NOTIFY_MAX_RETRIES,
    label_prefix: str = "Player notification"
) -> int:
    """
    Notify multiple players in parallel with retry logic.
    
    Args:
        player_callbacks: Dict of {player_uid: callback_function}
        message_builder: Function that takes player_uid and returns (args, kwargs) for callback
        timeout: Timeout per attempt
        max_retries: Maximum retries per player
        label_prefix: Prefix for log messages
    
    Returns:
        Number of successful notifications
    """
    async def notify_single(uid: str, callback: Callable) -> bool:
        if uid == "BOT":
            return True
        args, kwargs = message_builder(uid)
        return await notify_with_retry(
            callback,
            *args,
            timeout=timeout,
            max_retries=max_retries,
            label=f"{label_prefix} for {uid}",
            **kwargs
        )
    
    results = await asyncio.gather(
        *[notify_single(uid, cb) for uid, cb in player_callbacks.items()],
        return_exceptions=True
    )
    
    return sum(1 for r in results if r is True)
