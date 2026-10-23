"""
Rate Limit Middleware

Simple in-memory rate limiting using sliding window.
"""

import time
from collections import defaultdict
from typing import Callable, Dict, Tuple

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware using sliding window algorithm.
    
    SECURITY: Protects against brute force and DoS attacks.
    Uses IP-based limiting for unauthenticated requests and
    user-based limiting for authenticated requests.
    
    In production, consider using Redis for distributed rate limiting.
    """
    
    def __init__(self, app):
        super().__init__(app)
        # Store: {key: [(timestamp, count), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        self.window_size = 60  # 1 minute window
    
    def _get_key(self, request: Request) -> Tuple[str, int]:
        """
        Get rate limit key and limit based on request.
        
        Returns (key, limit) tuple.
        """
        # Check for authenticated user (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        
        if user_id:
            return f"user:{user_id}", settings.rate_limit_auth_per_minute
        
        # Fall back to IP-based limiting
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        return f"ip:{client_ip}", settings.rate_limit_per_minute
    
    def _is_rate_limited(self, key: str, limit: int) -> bool:
        """
        Check if the key is rate limited.
        
        Uses sliding window algorithm.
        """
        now = time.time()
        window_start = now - self.window_size
        
        # Remove old entries
        self.requests[key] = [
            ts for ts in self.requests[key]
            if ts > window_start
        ]
        
        # Check limit
        if len(self.requests[key]) >= limit:
            return True
        
        # Add new request
        self.requests[key].append(now)
        return False
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        key, limit = self._get_key(request)
        
        if self._is_rate_limited(key, limit):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after_seconds": self.window_size
                },
                headers={"Retry-After": str(self.window_size)}
            )
        
        return await call_next(request)
