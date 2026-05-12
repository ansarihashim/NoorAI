"""Narration HTTP routes: manifest + per-chunk audio + prefetch trigger.

These power the new client-side <audio> element. The frontend fetches the
manifest (chunk text + audio_ready flags), then plays each chunk by URL.

Audio URLs accept the JWT via ``?token=…`` because the browser <audio> element
cannot send custom headers — same convention used by /ws/audio.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services import narration as narration_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user, get_current_user_from_query_or_header

logger = logging.getLogger(__name__)
router = APIRouter()


class ChunkOut(BaseModel):
    idx: int
    text: str
    audio_ready: bool


class ManifestOut(BaseModel):
    doc_id: str
    title: str
    n_chunks: int
    voice_id: str | None = None
    chunks: list[ChunkOut]


async def _check_owner(db: AsyncSession, doc_id: str, user: User) -> Document | None:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")
    return doc


@router.get("/{doc_id}/manifest", response_model=ManifestOut)
async def manifest(
    doc_id: str,
    voice_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ManifestOut:
    rag = get_rag()
    if not rag.exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    db_doc = await _check_owner(db, doc_id, user)

    meta = rag.get_meta(doc_id)
    narration = rag.get_narration(doc_id)
    chunks = []
    for i, text in enumerate(narration):
        path = narration_service.chunk_audio_path(doc_id, i, voice_id)
        chunks.append(ChunkOut(idx=i, text=text, audio_ready=path.exists()))

    # Kick off rolling prefetch for the first few un-rendered chunks. Cheap
    # if they exist; warms the cache while the user is still reading.
    pending = [c.idx for c in chunks[:3] if not c.audio_ready]
    if pending:
        narration_service.spawn_prefetch(doc_id, pending, voice_id=voice_id)

    return ManifestOut(
        doc_id=doc_id,
        title=(db_doc.title if db_doc else meta.get("title", "Untitled")),
        n_chunks=len(narration),
        voice_id=voice_id,
        chunks=chunks,
    )


@router.get("/{doc_id}/chunk/{idx}.mp3")
async def chunk_audio(
    doc_id: str,
    idx: int,
    voice_id: str | None = None,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _check_owner(db, doc_id, user)

    try:
        audio = await narration_service.ensure_chunk_audio(doc_id, idx, voice_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("narration: chunk %d failed", idx)
        raise HTTPException(status_code=502, detail=f"tts failed: {exc}")

    headers = {
        "Cache-Control": "private, max-age=86400",
        "Accept-Ranges": "bytes",
    }
    return Response(content=audio, media_type="audio/mpeg", headers=headers)


class PrefetchRequest(BaseModel):
    indices: list[int]
    voice_id: str | None = None


@router.post("/{doc_id}/prefetch")
async def prefetch(
    doc_id: str,
    req: PrefetchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Client-driven rolling prefetch — frontend asks the app to warm the
    cache for the chunks it expects to need next."""
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _check_owner(db, doc_id, user)

    n = narration_service.chunk_count(doc_id)
    indices = sorted({i for i in req.indices if 0 <= i < n})
    if not indices:
        return {"requested": 0, "skipped_already_cached": 0, "started": 0}

    skipped = sum(
        1 for i in indices if narration_service.chunk_audio_path(doc_id, i, req.voice_id).exists()
    )
    pending = [
        i for i in indices if not narration_service.chunk_audio_path(doc_id, i, req.voice_id).exists()
    ]
    if pending:
        narration_service.spawn_prefetch(doc_id, pending, voice_id=req.voice_id)
    return {
        "requested": len(indices),
        "skipped_already_cached": skipped,
        "started": len(pending),
    }
