"""Podcast routes — generation status + on-demand pre-generation.

The WebSocket /ws/audio handles streaming playback (start_podcast); this
REST surface is for the UI to show "Generate" progress and inspect the
cached script before pressing play.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services import podcast as podcast_service
from app.rag.service import get_rag
from app.services.tts import get_tts
from app.auth.deps import get_current_user, get_current_user_from_query_or_header

logger = logging.getLogger(__name__)
router = APIRouter()


class TurnOut(BaseModel):
    speaker: str
    text: str


class PodcastOut(BaseModel):
    doc_id: str
    title: str
    n_turns: int
    cached: bool
    char_count: int
    turns: list[TurnOut]


async def _ensure_doc_owner(db: AsyncSession, doc_id: str, user: User) -> None:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your document")


@router.get("/{doc_id}", response_model=PodcastOut)
async def get_podcast(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PodcastOut:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)

    script = podcast_service.load_script(doc_id)
    if script is None:
        raise HTTPException(status_code=404, detail="podcast not generated yet")
    return PodcastOut(
        doc_id=script.doc_id,
        title=script.title,
        n_turns=len(script.turns),
        cached=True,
        char_count=script.char_count,
        turns=[TurnOut(**t.to_dict()) for t in script.turns],
    )


@router.post("/{doc_id}/generate", response_model=PodcastOut)
async def generate_podcast(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PodcastOut:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)

    # cost guardrail — refuse if doing this would blow the daily ElevenLabs budget
    remaining = get_tts().chars_remaining_today()
    if remaining < 600:
        raise HTTPException(
            status_code=429,
            detail=f"Today's TTS budget is exhausted ({remaining} chars left). Try again tomorrow.",
        )

    cached_before = podcast_service.script_exists(doc_id)
    try:
        script = await podcast_service.generate_script(doc_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("podcast generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"podcast generation failed: {exc}")

    # Warm the audio cache for the first couple of turns so the user hits
    # play and gets sound back near-instantly.
    podcast_service.spawn_prefetch_turns(doc_id, [0, 1, 2])

    return PodcastOut(
        doc_id=script.doc_id,
        title=script.title,
        n_turns=len(script.turns),
        cached=cached_before,
        char_count=script.char_count,
        turns=[TurnOut(**t.to_dict()) for t in script.turns],
    )


@router.get("/{doc_id}/turn/{idx}.mp3")
async def turn_audio(
    doc_id: str,
    idx: int,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        audio = await podcast_service.ensure_turn_audio(doc_id, idx)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("podcast turn %d failed", idx)
        raise HTTPException(status_code=502, detail=f"tts failed: {exc}")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "private, max-age=86400",
            "Accept-Ranges": "bytes",
        },
    )
