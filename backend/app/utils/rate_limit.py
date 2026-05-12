"""Simple in-process token-bucket rate limiter.

We don't need Redis for this. The product is single-process today and the
limits below are about defending against credential-stuffing and accidental
client loops — both of which are caught with even a coarse local counter.
If/when the deployment becomes multi-process, swap the dict for a Redis
app behind the same :class:`RateLimit` interface.

Buckets are keyed on (scope, ip_or_user). Each bucket has a max capacity
and a refill rate (tokens per second). One request consumes one token.

Usage in a route::

    from app.utils.rate_limit import limit_dep, RateLimit

    LOGIN_LIMIT = RateLimit(scope="auth.login", capacity=10, refill_per_sec=10/60)

    @router.post("/login", dependencies=[Depends(limit_dep(LOGIN_LIMIT))])
    async def login(...): ...
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Callable

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)


@dataclass
class _Bucket:
    tokens: float
    last_refill: float


@dataclass
class RateLimit:
    """A named rate limit. ``capacity`` is the burst, ``refill_per_sec`` is
    the steady-state rate (tokens / second).

    Examples:
        RateLimit("auth.login", 10, 10/60)   # 10/min, burst 10
        RateLimit("upload",      6, 6/60)    # 6/min,  burst 6
        RateLimit("ai.generate", 30, 30/60)  # 30/min, burst 30
    """

    scope: str
    capacity: int
    refill_per_sec: float
    _buckets: dict[str, _Bucket] = field(default_factory=dict, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def consume(self, key: str, *, cost: int = 1) -> bool:
        now = time.monotonic()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                # Cold bucket — start full so the *first* call is never blocked.
                b = _Bucket(tokens=float(self.capacity), last_refill=now)
                self._buckets[key] = b
            elapsed = max(0.0, now - b.last_refill)
            b.tokens = min(self.capacity, b.tokens + elapsed * self.refill_per_sec)
            b.last_refill = now
            if b.tokens < cost:
                return False
            b.tokens -= cost
            return True

    def retry_after_seconds(self, key: str, *, cost: int = 1) -> float:
        """Approximate wait until at least ``cost`` tokens are available."""
        with self._lock:
            b = self._buckets.get(key)
            tokens = float(self.capacity) if b is None else b.tokens
            need = cost - tokens
        if need <= 0:
            return 0.0
        return need / max(self.refill_per_sec, 1e-9)


def _client_key(request: Request, scope: str) -> str:
    """Best-effort caller key — use authenticated user-id if we have one,
    otherwise fall back to the client IP. We don't trust ``X-Forwarded-For``
    unless explicitly configured (avoid spoofing); deployments behind a
    reverse proxy should set ``proxy_headers`` on uvicorn instead.
    """
    user_id = getattr(getattr(request, "state", None), "user_id", None)
    if user_id:
        return f"{scope}:u:{user_id}"
    host = request.client.host if request.client else "unknown"
    return f"{scope}:ip:{host}"


def limit_dep(limit: RateLimit, *, cost: int = 1) -> Callable:
    """Build a FastAPI ``Depends(...)`` callable for a given limit."""

    async def _dep(request: Request) -> None:
        key = _client_key(request, limit.scope)
        if not limit.consume(key, cost=cost):
            wait = limit.retry_after_seconds(key, cost=cost)
            logger.warning("rate-limit hit scope=%s key=%s retry_after=%.1fs", limit.scope, key, wait)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests — slow down for a moment.",
                headers={"Retry-After": str(int(wait) + 1)},
            )

    return _dep


# ---- Predefined buckets -----------------------------------------------------
#
# Tuned for an interactive single-user study app. They're deliberately
# loose for normal use and tight for credential stuffing / runaway loops.

LIMIT_AUTH_LOGIN    = RateLimit("auth.login",    capacity=10, refill_per_sec=10 / 60)   # 10/min
LIMIT_AUTH_REGISTER = RateLimit("auth.register", capacity=5,  refill_per_sec=5 / 600)   # 5 per 10 min
LIMIT_UPLOAD        = RateLimit("upload",        capacity=8,  refill_per_sec=8 / 60)    # 8/min
LIMIT_AI_GENERATE   = RateLimit("ai.generate",   capacity=30, refill_per_sec=30 / 60)   # 30/min
LIMIT_AI_HEAVY      = RateLimit("ai.heavy",      capacity=10, refill_per_sec=10 / 300)  # 10 per 5 min — overview/podcast


__all__ = [
    "RateLimit",
    "limit_dep",
    "LIMIT_AUTH_LOGIN",
    "LIMIT_AUTH_REGISTER",
    "LIMIT_UPLOAD",
    "LIMIT_AI_GENERATE",
    "LIMIT_AI_HEAVY",
]
