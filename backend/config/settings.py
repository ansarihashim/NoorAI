from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
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
    google_application_credentials: str = ""
    google_tts_api_key: str = ""

    # DB
    database_url: str = "postgresql+asyncpg://user:pass@localhost/echoverse"

    # Whisper
    whisper_model: str = "base.en"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # App
    app_env: str = "dev"
    cors_origins: str = "http://localhost:5173"
    session_max_minutes: int = 30
    elevenlabs_chars_per_day: int = 50000
    storage_dir: str = "./storage"

    # Auth
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    # 4 hours by default — short enough that an idle laptop won't stay logged in
    # forever, long enough that a real study session isn't interrupted.
    access_token_ttl_minutes: int = 60 * 4

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
