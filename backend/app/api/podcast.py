"""Podcast routes — generation status + on-demand pre-generation.

The WebSocket /ws/audio handles streaming playback (start_podcast); this
REST surface is for the UI to show "Generate" progress and inspect the
cached script before pressing play.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
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
from app.utils.rate_limit import limit_dep, LIMIT_AI_HEAVY

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


# ---------------------------------------------------------------------------
# Progress stream (SSE)
#
# Drives the "generate podcast" UX: the transcript builds line by line as each
# turn's audio becomes available. JWT via ?token= (SSE can't set headers).
# CORS is inherited from the app-level middleware — no manual CORS headers.
#
#   data: {"type":"script_ready","total_turns":N}\n\n
#   data: {"type":"turn_ready","turn_index":0,"speaker":"host","text":"..."}\n\n
#   data: {"type":"done"}\n\n
#   data: {"type":"error","message":"..."}\n\n

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _run_podcast_progress(doc_id: str):
    try:
        # Ensure the script exists (cached after first run). generate_script is
        # a no-op read when already present.
        try:
            script = await podcast_service.generate_script(doc_id)
        except FileNotFoundError as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return

        yield _sse({"type": "script_ready", "total_turns": len(script.turns)})

        for idx, turn in enumerate(script.turns):
            # Cached turn → announce immediately; uncached → synthesize first so
            # the audio is ready by the time the client plays it.
            if not podcast_service.turn_cached(doc_id, idx):
                try:
                    await podcast_service.ensure_turn_audio(doc_id, idx)
                except Exception as exc:
                    # Audio failed (rare — TTS falls back to free Edge). Still
                    # surface the turn so the transcript keeps building; the
                    # audio route will retry/handle on play.
                    logger.warning("podcast progress: turn %d synth failed: %s", idx, exc)
            yield _sse({
                "type": "turn_ready",
                "turn_index": idx,
                "speaker": turn.speaker,
                "text": turn.text,
            })

        yield _sse({"type": "done"})
    except Exception as exc:
        logger.exception("podcast progress failed for %s", doc_id)
        yield _sse({"type": "error", "message": str(exc)})


@router.get("/{doc_id}/progress", dependencies=[Depends(limit_dep(LIMIT_AI_HEAVY))])
async def podcast_progress(
    doc_id: str,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    return StreamingResponse(
        _run_podcast_progress(doc_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
