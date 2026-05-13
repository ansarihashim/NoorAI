"""Security headers + generic 500 handler.

Adds standards-track defensive headers to every HTTP response, and replaces
the default FastAPI 500 handler so unhandled exceptions never leak stack
traces, internal paths, or upstream API error JSON to clients.

Header policy (production):
  Strict-Transport-Security : max-age=31536000; includeSubDomains; preload
  Content-Security-Policy   : strict; allows only self for scripts/styles,
                              connects to self + configured WS origin
  X-Frame-Options           : DENY        (no clickjacking host)
  X-Content-Type-Options    : nosniff     (no MIME inference)
  Referrer-Policy           : strict-origin-when-cross-origin
  Permissions-Policy        : disables camera/geolocation/payment etc; mic
                              is allowed because the narration mode needs it
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-site
  X-Powered-By              : explicitly absent (we don't advertise the stack)

In dev, CSP is relaxed so Vite's HMR (eval-based, websocket on a different
port) keeps working. Switching modes is driven by ``settings.app_env``.
"""
from __future__ import annotations

import logging
import uuid
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


def _build_csp(*, dev: bool, frontend_origins: list[str]) -> str:
    """Compose the Content-Security-Policy string.

    `connect-src` must include every host the SPA talks to — the API itself
    (same-origin), Groq, and ElevenLabs. For dev we also allow
    ws://localhost:5173 so Vite HMR works.
    """
    self_ = "'self'"
    api_origins = " ".join(frontend_origins)
    extra_connect = " https://api.groq.com https://api.elevenlabs.io"
    if dev:
        # Vite HMR: wss + eval. We accept these only in dev mode.
        script_src  = f"{self_} 'unsafe-eval'"
        style_src   = f"{self_} 'unsafe-inline' https://fonts.googleapis.com"
        connect_src = f"{self_} {api_origins} ws: wss: http: https:{extra_connect}"
    else:
        script_src  = self_
        style_src   = f"{self_} 'unsafe-inline' https://fonts.googleapis.com"  # tailwind component classes
        connect_src = f"{self_} {api_origins} wss:{extra_connect}"
    return "; ".join([
        f"default-src {self_}",
        f"script-src {script_src}",
        f"style-src {style_src}",
        f"img-src {self_} data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        f"connect-src {connect_src}",
        "media-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ])


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach defensive headers to every HTTP response."""

    def __init__(self, app, *, dev: bool, frontend_origins: list[str]) -> None:
        super().__init__(app)
        self._dev = dev
        self._csp = _build_csp(dev=dev, frontend_origins=frontend_origins)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            response = await call_next(request)
        except Exception:
            # Outermost safety net — any uncaught exception in nested
            # middleware also gets the generic 500 treatment.
            ref = uuid.uuid4().hex[:10]
            logger.exception("unhandled exception in middleware ref=%s", ref)
            response = JSONResponse(
                status_code=500,
                content={"detail": "internal server error", "ref": ref},
            )

        # Don't second-guess CORS preflight — those have their own header set
        # contributed by CORSMiddleware. We still attach the security-only
        # headers so the policy applies uniformly.
        response.headers["Content-Security-Policy"] = self._csp
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            # mic on (narration), everything else off
            "microphone=(self), camera=(), geolocation=(), payment=(), "
            "usb=(), magnetometer=(), gyroscope=(), accelerometer=(), "
            "fullscreen=(self), autoplay=(self)"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        # ``cross-origin`` lets the frontend (Vercel) embed audio MP3s served
        # from this backend (Render) via <audio> tags. The endpoints
        # themselves are still gated by JWT auth — CORP only relaxes the
        # browser's same-site-by-default block on resource embedding.
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        if not self._dev:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        # Don't advertise the stack
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]
        return response


# ---- 500 handler ------------------------------------------------------------
#
# FastAPI/Starlette's default behaviour for an unhandled exception is to
# emit a 500 with the exception text. We DO NOT want upstream error JSON,
# database error messages, or filesystem paths leaking back to the client.
# Every unhandled exception instead returns a generic body + a short ref id
# that's also written to the log for correlation.


async def _generic_500_handler(request: Request, exc: Exception) -> Response:  # type: ignore[override]
    ref = uuid.uuid4().hex[:10]
    logger.exception(
        "unhandled %s on %s ref=%s", type(exc).__name__, request.url.path, ref
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "internal server error", "ref": ref},
    )


def install_security(app: FastAPI) -> None:
    """Wire :class:`SecurityHeadersMiddleware` and the generic 500 handler.

    Call this from ``create_app()`` right after the CORS middleware so the
    response chain is: CORS → SecurityHeaders → app routes.
    """
    s = get_settings()
    dev = s.app_env != "prod"
    app.add_middleware(
        SecurityHeadersMiddleware,
        dev=dev,
        frontend_origins=s.cors_origin_list,
    )
    app.add_exception_handler(Exception, _generic_500_handler)


__all__ = ["install_security", "SecurityHeadersMiddleware"]
