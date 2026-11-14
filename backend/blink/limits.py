"""Server-side limits for the public endpoints. No secret is involved: the public frontend has none to give.

    per-client rate limit      RATE_LIMIT_PER_MINUTE requests per minute and client address        -> 429
    concurrency cap            MAX_CONCURRENT_REQUESTS in flight at once, the rest are turned away  -> 503
    time cap                   REQUEST_TIMEOUT_SECONDS per request                                   -> 504
    request size cap           URL at most 2048 characters, body at most 1024 bytes (the API is GET) -> 414 / 413
    pagination limit           MAX_PAGE_SIZE (applied in app.py)

Expensive operations (archive retrieval, processing) are not endpoints at all.
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAX_URL_CHARS = 2048
MAX_BODY_BYTES = 1024


class RateLimiter:
    """A fixed window of 60 s per client. Memory is bounded: the table is cleared of stale clients when it grows."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic, max_clients: int = 20_000):
        self.per_minute, self.clock, self.max_clients = per_minute, clock, max_clients
        self._hits: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def allow(self, client: str) -> bool:
        now = self.clock()
        with self._lock:
            start, count = self._hits.get(client, (now, 0))
            if now - start >= 60:
                start, count = now, 0
            if count >= self.per_minute:
                self._hits[client] = (start, count)
                return False
            self._hits[client] = (start, count + 1)
            if len(self._hits) > self.max_clients:
                self._hits = {c: v for c, v in self._hits.items() if now - v[0] < 60}
            return True


def client_of(request: Request, trust_forwarded_for: bool) -> str:
    """The client's address. Behind a trusted proxy it is the last hop the proxy added to X-Forwarded-For; otherwise the socket's peer."""
    if trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[-1].strip()[:64] or "unknown"
    return request.client.host if request.client else "unknown"


def _refuse(status: int, detail: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail}, headers=headers)


class Guard(BaseHTTPMiddleware):
    def __init__(self, app, *, limiter: RateLimiter, max_concurrent: int, timeout_s: float, trust_forwarded_for: bool = False):
        super().__init__(app)
        self.limiter, self.max_concurrent, self.timeout_s, self.trust = limiter, max_concurrent, timeout_s, trust_forwarded_for
        self.in_flight = 0

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        if len(str(request.url)) > MAX_URL_CHARS:
            return _refuse(414, "The request address is too long.")
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            return _refuse(413, "The request body is too large.")
        if not self.limiter.allow(client_of(request, self.trust)):
            return _refuse(429, "Too many requests from this address. Wait a minute and try again.", {"Retry-After": "60"})
        if self.in_flight >= self.max_concurrent:
            return _refuse(503, "The server is busy. Try again in a moment.", {"Retry-After": "2"})
        self.in_flight += 1
        try:
            return await asyncio.wait_for(call_next(request), timeout=self.timeout_s)
        except asyncio.TimeoutError:
            return _refuse(504, "The request took too long and was stopped.")
        finally:
            self.in_flight -= 1
