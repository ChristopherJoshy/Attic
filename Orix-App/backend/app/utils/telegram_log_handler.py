"""
Telegram Log Handler

Custom logging handler that forwards console logs to Telegram head admin.
"""

import logging
import asyncio
from typing import Optional
import httpx


class TelegramLogHandler(logging.Handler):
    """
    Logging handler that sends logs to Telegram head admin.
    Only sends WARNING level and above to avoid spam.
    """
    
    def __init__(
        self,
        bot_token: str,
        chat_id: str,
        level: int = logging.WARNING
    ):
        super().__init__(level=level)
        self.bot_token = bot_token
        self.chat_id = chat_id
        self._queue: list[str] = []
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
    
    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            level_emoji = {
                'DEBUG': '🔍',
                'INFO': 'ℹ️',
                'WARNING': '⚠️',
                'ERROR': '❌',
                'CRITICAL': '🚨'
            }.get(record.levelname, '📝')
            
            formatted = (
                f"{level_emoji} *{record.levelname}*\n"
                f"`{record.name}`\n"
                f"```\n{msg[:1000]}```"
            )
            
            # Queue the message for async sending
            self._queue.append(formatted)
            
            # Start sender task if not running
            try:
                loop = asyncio.get_running_loop()
                if self._task is None or self._task.done():
                    self._task = loop.create_task(self._send_batch())
            except RuntimeError:
                # No event loop running, skip
                pass
                
        except Exception:
            self.handleError(record)
    
    async def _send_batch(self):
        """Send queued messages in batch."""
        await asyncio.sleep(2)  # Batch messages for 2 seconds
        
        async with self._lock:
            if not self._queue:
                return
            
            messages = self._queue[:10]  # Max 10 messages per batch
            self._queue = self._queue[10:]
            
            combined = "\n\n".join(messages)
            if len(combined) > 4000:
                combined = combined[:4000] + "...[truncated]"
            
            try:
                url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(url, json={
                        "chat_id": self.chat_id,
                        "text": combined,
                        "parse_mode": "Markdown"
                    })
            except Exception:
                pass  # Silent failure to avoid recursion


def setup_telegram_logging(bot_token: str, chat_id: str):
    """
    Set up Telegram logging for the application.
    Attaches handler to root logger.
    """
    if not bot_token or not chat_id:
        return
    
    handler = TelegramLogHandler(bot_token, chat_id, level=logging.WARNING)
    handler.setFormatter(logging.Formatter('%(message)s'))
    
    # Add to root logger
    logging.getLogger().addHandler(handler)
    
    # Also add to uvicorn loggers
    for logger_name in ['uvicorn', 'uvicorn.error', 'uvicorn.access']:
        logging.getLogger(logger_name).addHandler(handler)
