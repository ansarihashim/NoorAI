"""Voice picker API.

  GET  /api/voices              — list the curated catalog
  GET  /api/voices/{id}/preview — short cached MP3 sample so the user can
                                  hear a voice before applying it
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from backend.config.settings import get_settings
from backend.config.voices import (
    CATALOG,
    PREVIEW_TEXT,
    VoiceProfile,
    known_voice_ids,
)
from backend.models.user import User
from backend.services.tts_service import get_tts
from backend.utils.deps import get_current_user, get_current_user_from_query_or_header

logger = logging.getLogger(__name__)
router = APIRouter()


class VoiceOut(BaseModel):
    id: str
    name: str
    tone: str
    gender: str
    suggested_role: str

    @classmethod
    def from_profile(cls, p: VoiceProfile) -> "VoiceOut":
        return cls(**p.to_dict())


@router.get("", response_model=list[VoiceOut])
async def list_voices(_: User = Depends(get_current_user)) -> list[VoiceOut]:
    return [VoiceOut.from_profile(p) for p in CATALOG]


def _preview_path(voice_id: str):
    s = get_settings()
    p = s.storage_path / "voice_previews"
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{voice_id}.mp3"


@router.get("/{voice_id}/preview.mp3")
async def voice_preview(
    voice_id: str,
    _: User = Depends(get_current_user_from_query_or_header),
) -> Response:
    if voice_id not in known_voice_ids():
        raise HTTPException(status_code=404, detail="unknown voice")

    cache = _preview_path(voice_id)
    if cache.exists():
        return Response(
            content=cache.read_bytes(),
            media_type="audio/mpeg",
            headers={"Cache-Control": "private, max-age=86400"},
        )

    tts = get_tts()
    try:
        buf = bytearray()
        async for chunk in tts.synthesize_stream(PREVIEW_TEXT, voice_id=voice_id):
            buf.extend(chunk)
    except Exception as exc:
        logger.exception("voice preview failed for %s", voice_id)
        raise HTTPException(status_code=502, detail=f"preview synthesis failed: {exc}")

    if len(buf) <= 256:
        raise HTTPException(status_code=502, detail="preview synthesis returned no audio")

    audio = bytes(buf)
    try:
        cache.write_bytes(audio)
    except Exception:
        logger.exception("failed to cache voice preview %s", voice_id)
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=86400"},
    )
