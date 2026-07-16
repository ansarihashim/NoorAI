"""Revision-mode routes (Phase 7+).

Phase 7A wires only Flashcards. Other sub-modes (quick_revision,
night_before, active_recall, quiz, viva, visual_revision) are stubbed below
with `# TODO: Phase 7B` markers — keeps the module navigable for the
picking-up agent without 404s on unimplemented endpoints.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.rag.schemas.flashcards import Flashcard, FlashcardSet
from app.rag.schemas.quiz import QuizQuestion, QuizSet
from app.rag.schemas.recall import RecallPrompt, RecallSet
from app.rag.schemas.revision import (
    NightBeforeItem,
    NightBeforeSet,
    QuickRevisionSet,
    QuickRevisionTopic,
)
from app.rag.schemas.viva import VivaQuestion, VivaSet
from app.rag.chains.flashcard_chain import build_flashcard_stream_chain
from app.rag.chains.quiz_chain import build_quiz_stream_chain
from app.rag.chains.recall_chain import build_recall_stream_chain
from app.rag.chains.viva_chain import build_viva_stream_chain
from app.rag.chains.night_before_chain import build_night_before_stream_chain
from app.rag.chains.quick_revision_chain import build_quick_revision_stream_chain
from app.rag.chains.streaming import astream_jsonl_items
from app.services import revision as revision_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user, get_current_user_from_query_or_header
from app.utils.rate_limit import limit_dep, LIMIT_AI_GENERATE

logger = logging.getLogger(__name__)
router = APIRouter()


async def _ensure_doc_owner(db: AsyncSession, doc_id: str, user: User) -> None:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your document")


# ---------------------------------------------------------------------------
# Flashcards


class FlashcardsGenerateRequest(BaseModel):
    n: int = Field(default=20, ge=5, le=40)
    force: bool = False


@router.post("/{doc_id}/flashcards/generate", response_model=FlashcardSet)
async def generate_flashcards(
    doc_id: str,
    req: FlashcardsGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> FlashcardSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_flashcards(
            doc_id, n=req.n, force=req.force
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: flashcard generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"flashcard generation failed: {exc}")


@router.get("/{doc_id}/flashcards", response_model=FlashcardSet)
async def get_flashcards(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> FlashcardSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    deck = revision_service.load_flashcards(doc_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="flashcards not generated yet")
    return deck


@router.delete("/{doc_id}/flashcards", status_code=204, response_class=Response)
async def delete_flashcards(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_flashcards(doc_id):
        raise HTTPException(status_code=404, detail="flashcards not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Quiz


class QuizGenerateRequest(BaseModel):
    n: int = Field(default=12, ge=5, le=30)
    force: bool = False


@router.post("/{doc_id}/quiz/generate", response_model=QuizSet)
async def generate_quiz(
    doc_id: str,
    req: QuizGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> QuizSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_quiz(doc_id, n=req.n, force=req.force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: quiz generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"quiz generation failed: {exc}")


@router.get("/{doc_id}/quiz", response_model=QuizSet)
async def get_quiz(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> QuizSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    quiz = revision_service.load_quiz(doc_id)
    if quiz is None:
        raise HTTPException(status_code=404, detail="quiz not generated yet")
    return quiz


@router.delete("/{doc_id}/quiz", status_code=204, response_class=Response)
async def delete_quiz(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_quiz(doc_id):
        raise HTTPException(status_code=404, detail="quiz not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Active recall


class RecallGenerateRequest(BaseModel):
    n: int = Field(default=12, ge=5, le=30)
    force: bool = False


@router.post("/{doc_id}/recall/generate", response_model=RecallSet)
async def generate_recall(
    doc_id: str,
    req: RecallGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> RecallSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_recall(doc_id, n=req.n, force=req.force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: recall generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"recall generation failed: {exc}")


@router.get("/{doc_id}/recall", response_model=RecallSet)
async def get_recall(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> RecallSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    rs = revision_service.load_recall(doc_id)
    if rs is None:
        raise HTTPException(status_code=404, detail="recall not generated yet")
    return rs


@router.delete("/{doc_id}/recall", status_code=204, response_class=Response)
async def delete_recall(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_recall(doc_id):
        raise HTTPException(status_code=404, detail="recall not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Quick revision


class QuickRevisionRequest(BaseModel):
    max_topics: int = Field(default=8, ge=3, le=15)
    force: bool = False


@router.post("/{doc_id}/quick-revision/generate", response_model=QuickRevisionSet)
async def generate_quick_revision(
    doc_id: str,
    req: QuickRevisionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> QuickRevisionSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_quick_revision(
            doc_id, max_topics=req.max_topics, force=req.force
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: quick_revision generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"quick revision generation failed: {exc}")


@router.get("/{doc_id}/quick-revision", response_model=QuickRevisionSet)
async def get_quick_revision(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> QuickRevisionSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    qr = revision_service.load_quick_revision(doc_id)
    if qr is None:
        raise HTTPException(status_code=404, detail="quick revision not generated yet")
    return qr


@router.delete("/{doc_id}/quick-revision", status_code=204, response_class=Response)
async def delete_quick_revision(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_quick_revision(doc_id):
        raise HTTPException(status_code=404, detail="quick revision not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Night before exam


class NightBeforeRequest(BaseModel):
    n: int = Field(default=25, ge=10, le=50)
    force: bool = False


@router.post("/{doc_id}/night-before/generate", response_model=NightBeforeSet)
async def generate_night_before(
    doc_id: str,
    req: NightBeforeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> NightBeforeSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_night_before(
            doc_id, n=req.n, force=req.force
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: night_before generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"night before generation failed: {exc}")


@router.get("/{doc_id}/night-before", response_model=NightBeforeSet)
async def get_night_before(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> NightBeforeSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    nb = revision_service.load_night_before(doc_id)
    if nb is None:
        raise HTTPException(status_code=404, detail="night before not generated yet")
    return nb


@router.delete("/{doc_id}/night-before", status_code=204, response_class=Response)
async def delete_night_before(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_night_before(doc_id):
        raise HTTPException(status_code=404, detail="night before not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Viva


class VivaRequest(BaseModel):
    n: int = Field(default=12, ge=5, le=30)
    force: bool = False


@router.post("/{doc_id}/viva/generate", response_model=VivaSet)
async def generate_viva(
    doc_id: str,
    req: VivaRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> VivaSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    try:
        return await revision_service.generate_viva(doc_id, n=req.n, force=req.force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("revision: viva generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"viva generation failed: {exc}")


@router.get("/{doc_id}/viva", response_model=VivaSet)
async def get_viva(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> VivaSet:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    viva = revision_service.load_viva(doc_id)
    if viva is None:
        raise HTTPException(status_code=404, detail="viva not generated yet")
    return viva


@router.delete("/{doc_id}/viva", status_code=204, response_class=Response)
async def delete_viva(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not revision_service.delete_viva(doc_id):
        raise HTTPException(status_code=404, detail="viva not found")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Streaming (SSE) endpoints
#
# These mirror the POST /generate endpoints but stream items as they are
# produced (Server-Sent Events). They:
#   - authenticate via ?token= (the browser EventSource/fetch can't send the
#     Authorization header on the SSE request) using the same dep as narration;
#   - check the SAME on-disk cache the generate/get endpoints use, and on a hit
#     replay it item-by-item with a small delay so it still animates in;
#   - otherwise run the streaming JSONL chain, forwarding each validated item,
#     then persist the full set to that same shared cache;
#   - carry the ai.generate rate limit;
#   - inherit CORS from the app-level CORSMiddleware — no manual CORS headers.
#
# SSE contract per item:   data: {"type":"item","index":i,"data":{...}}\n\n
# On completion:           data: {"type":"done","total":N}\n\n
# On error:                data: {"type":"error","message":"..."}\n\n

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _run_stream(*, load_items, build_chain, inputs, item_model, save_items, label):
    """Shared SSE body: cache-replay if cached, else stream the chain + persist."""
    try:
        cached = load_items()
        if cached is not None:
            for i, item in enumerate(cached):
                yield _sse({"type": "item", "index": i, "data": item})
                await asyncio.sleep(0.03)  # keep the "streaming" feel from cache
            yield _sse({"type": "done", "total": len(cached)})
            return

        items: list[dict] = []
        async for item in astream_jsonl_items(build_chain(), inputs, item_model, label=label):
            yield _sse({"type": "item", "index": len(items), "data": item})
            items.append(item)

        if items:
            try:
                save_items(items)
            except Exception:
                logger.exception("revision stream: cache write failed (%s)", label)
        yield _sse({"type": "done", "total": len(items)})
    except Exception as exc:
        logger.exception("revision stream: %s failed", label)
        yield _sse({"type": "error", "message": str(exc)})


def _doc_title(doc_id: str, default: str) -> str:
    try:
        return get_rag().get_meta(doc_id).get("title") or default
    except Exception:
        return default


@router.get(
    "/{doc_id}/flashcards/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_flashcards(
    doc_id: str,
    n: int = 20,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Flashcards")

    def load_items():
        deck = revision_service.load_flashcards(doc_id)
        return [c.model_dump() for c in deck.cards] if deck is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_flashcard_stream_chain(doc_id),
        inputs={"n_cards": max(5, min(40, n)), "title": title},
        item_model=Flashcard,
        save_items=lambda items: revision_service.save_flashcards(doc_id, items, title=title),
        label="flashcard_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get(
    "/{doc_id}/quiz/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_quiz(
    doc_id: str,
    n: int = 12,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Quiz")

    def load_items():
        qs = revision_service.load_quiz(doc_id)
        return [q.model_dump() for q in qs.questions] if qs is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_quiz_stream_chain(doc_id),
        inputs={"n": max(5, min(30, n)), "title": title},
        item_model=QuizQuestion,
        save_items=lambda items: revision_service.save_quiz(doc_id, items, title=title),
        label="quiz_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get(
    "/{doc_id}/recall/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_recall(
    doc_id: str,
    n: int = 12,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Active Recall")

    def load_items():
        rs = revision_service.load_recall(doc_id)
        return [p.model_dump() for p in rs.prompts] if rs is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_recall_stream_chain(doc_id),
        inputs={"n": max(5, min(30, n)), "title": title},
        item_model=RecallPrompt,
        save_items=lambda items: revision_service.save_recall(doc_id, items, title=title),
        label="recall_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get(
    "/{doc_id}/viva/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_viva(
    doc_id: str,
    n: int = 12,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Viva")

    def load_items():
        vs = revision_service.load_viva(doc_id)
        return [q.model_dump() for q in vs.questions] if vs is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_viva_stream_chain(doc_id),
        inputs={"n": max(5, min(30, n)), "title": title},
        item_model=VivaQuestion,
        save_items=lambda items: revision_service.save_viva(doc_id, items, title=title),
        label="viva_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get(
    "/{doc_id}/night_before/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_night_before(
    doc_id: str,
    n: int = 25,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Night Before")

    def load_items():
        nb = revision_service.load_night_before(doc_id)
        return [i.model_dump() for i in nb.items] if nb is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_night_before_stream_chain(doc_id),
        inputs={"n": max(10, min(50, n)), "title": title},
        item_model=NightBeforeItem,
        save_items=lambda items: revision_service.save_night_before(doc_id, items, title=title),
        label="night_before_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get(
    "/{doc_id}/quick_revision/stream",
    dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))],
)
async def stream_quick_revision(
    doc_id: str,
    max_topics: int = 8,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    title = _doc_title(doc_id, "Quick Revision")

    def load_items():
        qr = revision_service.load_quick_revision(doc_id)
        return [t.model_dump() for t in qr.topics] if qr is not None else None

    gen = _run_stream(
        load_items=load_items,
        build_chain=lambda: build_quick_revision_stream_chain(doc_id),
        inputs={"max_topics": max(3, min(15, max_topics)), "title": title},
        item_model=QuickRevisionTopic,
        save_items=lambda items: revision_service.save_quick_revision(doc_id, items, title=title),
        label="quick_revision_stream",
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


# ---------------------------------------------------------------------------
# Visual revision is purely a frontend feature: a curated list of revision-
# style prompts that funnel into the existing /api/visuals route. No
# duplication of the Mermaid pipeline.
