"""Shared Upstash Redis client with graceful degradation.

Design contract
---------------
Redis here is a *best-effort accelerator*, never a hard dependency:

  * If ``UPSTASH_REDIS_URL`` is empty/missing, :func:`get_redis` returns
    ``None`` and every helper below no-ops (returning ``None``/``False``) so
    callers fall back to their existing in-process behaviour.
  * Every single Redis call is wrapped in ``try/except``. A network blip,
    timeout, or Upstash hiccup is logged and swallowed — it can never turn
    into a 500 on a request path.

So callers follow one rule: "use the Redis result if it's truthy/not-None,
otherwise do exactly what you did before Redis existed."
"""
from __future__ import annotations

import asyncio
import inspect
import logging
from typing import Awaitable, Callable, Optional, Union

import redis.asyncio as aioredis

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


# Module-level singleton. ``_initialized`` guards against re-running the
# (cheap) setup + repeated warning logs on every get_redis() call.
_client: Optional[aioredis.Redis] = None
_initialized = False


def get_redis() -> Optional[aioredis.Redis]:
    """Return the shared async Redis client, or ``None`` if unconfigured.

    Lazily constructs the client on first call. Never raises: a bad URL or
    client-construction error is logged and downgraded to ``None`` so the app
    keeps running without Redis.
    """
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True

    url = (get_settings().upstash_redis_url or "").strip()
    if not url:
        logger.warning(
            "UPSTASH_REDIS_URL not set — running without Redis "
            "(in-process caches/locks active)"
        )
        _client = None
        return None

    try:
        # decode_responses=True → helpers deal in str, not bytes.
        # Short timeouts so a slow/unreachable Redis fails fast into fallback
        # rather than stalling a request.
        _client = aioredis.from_url(
            url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
    except Exception:
        logger.exception("failed to initialise Redis client — continuing without Redis")
        _client = None
    return _client


def is_redis_available() -> bool:
    """True if a Redis client is configured/constructed.

    Note: this reflects configuration, not live reachability — the client
    connects lazily. Startup uses :func:`ping` for an actual round-trip check;
    per-op failures are handled by each helper's try/except.
    """
    return get_redis() is not None


async def ping() -> bool:
    """Round-trip health check. Returns False on any error (never raises)."""
    r = get_redis()
    if r is None:
        return False
    try:
        return bool(await r.ping())
    except Exception as exc:
        logger.warning("Redis ping failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Distributed locks (used by the generation-coalescing services)


async def try_acquire_lock(key: str, ttl: int = 120) -> bool:
    """Best-effort ``SET key 1 NX EX ttl``. True if this caller won the lock.

    Returns False if the lock is already held OR if Redis is unavailable/errors
    — in both cases the caller should proceed with its in-process fallback.
    """
    r = get_redis()
    if r is None:
        return False
    try:
        return bool(await r.set(key, "1", nx=True, ex=ttl))
    except Exception as exc:
        logger.warning("Redis lock acquire failed (%s): %s", key, exc)
        return False


async def release_lock(key: str) -> None:
    """Best-effort lock release. Swallows all errors."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception as exc:
        logger.warning("Redis lock release failed (%s): %s", key, exc)


async def lock_held(key: str) -> bool:
    """True if the lock key currently exists. False on any error."""
    r = get_redis()
    if r is None:
        return False
    try:
        return bool(await r.exists(key))
    except Exception:
        return False


async def wait_for_lock_result(
    lock_key: str,
    load_cached: Callable[[], Union[object, Awaitable[object]]],
    *,
    timeout: float = 120.0,
    interval: float = 0.5,
) -> Optional[object]:
    """Wait for the current holder of ``lock_key`` to finish, then return the
    result it cached.

    Used by a caller that lost the lock race: it polls ``load_cached`` (the
    service's own cache reader — may be sync or async) until a value appears,
    the lock is released, or ``timeout`` elapses. Returns the cached value, or
    ``None`` if nothing was cached (caller then falls through to generate it
    itself). Never raises.

    ``None`` is also returned immediately when Redis is unavailable, so the
    caller degrades to its in-process path.
    """
    r = get_redis()
    if r is None:
        return None

    async def _load() -> Optional[object]:
        try:
            res = load_cached()
            if inspect.isawaitable(res):
                res = await res
            return res
        except Exception:
            return None

    waited = 0.0
    while waited < timeout:
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
        waited += interval
        val = await _load()
        if val is not None:
            return val
        # Holder released (or the lock expired) — one last read, then give up
        # so the caller can generate it itself.
        if not await lock_held(lock_key):
            return await _load()
    return await _load()


# ---------------------------------------------------------------------------
# Counters (used by the ElevenLabs daily-char budget)


async def incr_counter(key: str, amount: int, ttl: int) -> Optional[int]:
    """Atomically add ``amount`` to ``key``, setting ``ttl`` on first creation.

    Returns the new total, or ``None`` if Redis is unavailable/errors so the
    caller falls back to its in-process counter.
    """
    r = get_redis()
    if r is None:
        return None
    try:
        total = await r.incrby(key, amount)
        # Only stamp the TTL when we just created the key (total == amount),
        # so we don't keep pushing expiry forward on every increment.
        if total == amount:
            await r.expire(key, ttl)
        return int(total)
    except Exception as exc:
        logger.warning("Redis incr failed (%s): %s", key, exc)
        return None


async def get_counter(key: str) -> Optional[int]:
    """Return the current integer value of ``key`` (0 if unset).

    Returns ``None`` only when Redis is unavailable/errors.
    """
    r = get_redis()
    if r is None:
        return None
    try:
        val = await r.get(key)
        return int(val) if val is not None else 0
    except Exception as exc:
        logger.warning("Redis get_counter failed (%s): %s", key, exc)
        return None


# ---------------------------------------------------------------------------
# Generic string cache (used by the assembled-context cache)


async def cache_get(key: str) -> Optional[str]:
    """Return the cached string for ``key``, or ``None`` if missing/unavailable."""
    r = get_redis()
    if r is None:
        return None
    try:
        return await r.get(key)
    except Exception as exc:
        logger.warning("Redis cache_get failed (%s): %s", key, exc)
        return None


async def cache_set(key: str, value: str, ttl: int) -> None:
    """Best-effort ``SET key value EX ttl``. Swallows all errors."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.set(key, value, ex=ttl)
    except Exception as exc:
        logger.warning("Redis cache_set failed (%s): %s", key, exc)


async def close() -> None:
    """Close the client (used on shutdown). Best-effort."""
    global _client
    if _client is None:
        return
    try:
        await _client.aclose()
    except Exception as exc:
        logger.warning("Redis close failed: %s", exc)
