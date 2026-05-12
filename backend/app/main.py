import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import get_settings
from app.api import (
    auth,
    documents,
    llm,
    narration,
    podcast,
    preparation,
    revision,
    tts,
    upload,
    visuals,
    voices,
)
from app.websocket import audio
from app.utils.security_middleware import install_security


def _configure_logging() -> None:
    """Idempotent logging setup. Avoid clobbering uvicorn's handlers."""
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        )
    else:
        root.setLevel(logging.INFO)
    # Make our app loggers chatty enough to see WS lifecycle.
    logging.getLogger("backend").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    settings = get_settings()
    settings.storage_path  # ensure dir exists
    logging.getLogger(__name__).info(
        "EchoVerse starting env=%s cors=%s storage=%s",
        settings.app_env, settings.cors_origin_list, settings.storage_path,
    )
    yield
    logging.getLogger(__name__).info("EchoVerse shutdown complete")


def create_app() -> FastAPI:
    _configure_logging()
    settings = get_settings()
    app = FastAPI(
        title="EchoVerse",
        description="Real-time bidirectional AI voice agent",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — strict allowlist. allow_origins is the configured list (no
    # wildcard). allow_credentials=True is paired with explicit origins, so
    # a browser will refuse the response anyway if the Origin header doesn't
    # match — but never relax both at once.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
        max_age=600,
    )

    # Security headers + generic 500 handler. Installed AFTER CORS so the
    # CORS middleware's preflight short-circuit still gets to attach its
    # response headers; ours are layered on top.
    install_security(app)

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(upload.router, prefix="/api", tags=["upload"])
    app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
    app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
    app.include_router(tts.router, prefix="/api/tts", tags=["tts"])
    app.include_router(narration.router, prefix="/api/narration", tags=["narration"])
    app.include_router(podcast.router, prefix="/api/podcast", tags=["podcast"])
    app.include_router(visuals.router, prefix="/api/visuals", tags=["visuals"])
    app.include_router(preparation.router, prefix="/api/preparation", tags=["preparation"])
    app.include_router(revision.router, prefix="/api/revision", tags=["revision"])
    app.include_router(voices.router, prefix="/api/voices", tags=["voices"])
    app.include_router(audio.router, tags=["audio"])

    @app.get("/")
    async def root():
        return {"status": "ok", "service": "echoverse", "env": settings.app_env}

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    return app


app = create_app()
