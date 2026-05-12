from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # backend/app/core/settings.py → parent.parent.parent == backend/
    # (one more `.parent` than before the restructure, since this file
    # moved into `app/core/` from `config/`).
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # TTS — primary
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # narrator / host (Rachel)
    elevenlabs_guest_voice_id: str = "pNInz6obpgDQGcFmaJgB"  # podcast co-host (Adam)
    elevenlabs_model: str = "eleven_turbo_v2_5"

    # TTS — fallback
    # DB
    database_url: str = "postgresql+asyncpg://user:pass@localhost/echoverse"

    # Embeddings — HuggingFace Inference API (replaces local sentence-transformers).
    # Free token: https://huggingface.co/settings/tokens
    huggingface_api_token: str = ""
    huggingface_embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Vector store — Pinecone serverless (replaces local FAISS).
    # Free key: https://app.pinecone.io
    # One index, namespaced per doc_id. Index is auto-created on first use
    # with dimension=384 (matching the default embedding model) and cosine
    # metric. If you change the embedding model's dimension, delete the
    # Pinecone index from the dashboard so it gets recreated correctly.
    pinecone_api_key: str = ""
    pinecone_index_name: str = "noorai-rag"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    # App
    app_env: str = "dev"
    cors_origins: str = "http://localhost:5173"
    session_max_minutes: int = 30
    elevenlabs_chars_per_day: int = 50000
    storage_dir: str = "./storage"

    # Auth
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    # 60 minutes by default. Short enough that an idle laptop won't stay
    # logged in across an evening, long enough for a typical study session
    # without re-auth friction. Override via ACCESS_TOKEN_TTL_MINUTES in
    # .env if a deployment needs a different policy — but never make it
    # "forever". Tokens carry an `exp` claim and PyJWT enforces it at
    # decode-time, so this number is the real ceiling.
    access_token_ttl_minutes: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        p = Path(self.storage_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
