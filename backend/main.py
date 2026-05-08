from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import get_settings
from backend.routes import audio, llm, tts, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.storage_path
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="EchoVerse",
        description="Real-time bidirectional AI voice agent",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(upload.router, prefix="/api", tags=["upload"])
    app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
    app.include_router(tts.router, prefix="/api/tts", tags=["tts"])
    app.include_router(audio.router, tags=["audio"])

    @app.get("/")
    async def root():
        return {"status": "ok", "service": "echoverse", "env": settings.app_env}

    @app.get("/healthz")
    async def healthz():
        return {"ok": True}

    return app


app = create_app()
