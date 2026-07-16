"""Preparation Mode routes (Phase 7C).

Multi-doc — every endpoint accepts ``doc_ids: list[str]`` so the user can
prepare across an entire syllabus, not just a single document.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.rag.schemas.preparation import (
    ImportantQuestion,
    ImportantQuestionSet,
    OverviewMap,
    SimpleExplanation,
)
from app.rag.chains.important_questions_chain import build_important_questions_stream_chain
from app.rag.chains.overview_chain import build_overview_stream_chain
from app.rag.chains.explanation_chain import build_explanation_stream_chain
from app.rag.chains.streaming import astream_jsonl_items, astream_tokens
from app.services import preparation as preparation_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user, get_current_user_from_query_or_header
from app.utils.rate_limit import limit_dep, LIMIT_AI_GENERATE, LIMIT_AI_HEAVY

logger = logging.getLogger(__name__)
router = APIRouter()


async def _ensure_owns_all(db: AsyncSession, doc_ids: list[str], user: User) -> None:
    if not doc_ids:
        raise HTTPException(status_code=400, detail="doc_ids must not be empty")
    rag = get_rag()
    for d in doc_ids:
        if not rag.exists(d):
            raise HTTPException(status_code=404, detail=f"doc not found: {d}")
    # Ownership: each doc with a DB row must belong to the user.
    result = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    rows = result.scalars().all()
    for row in rows:
        if row.user_id and row.user_id != user.id:
            raise HTTPException(status_code=403, detail=f"not your document: {row.id}")


# ---------------------------------------------------------------------------
# Overview


class OverviewRequest(BaseModel):
    doc_ids: list[str] = Field(min_length=1, max_length=10)
    n_min: int = Field(default=6, ge=3, le=20)
    n_max: int = Field(default=14, ge=4, le=40)
    force: bool = False


@router.post("/overview/generate", response_model=OverviewMap)
async def generate_overview(
    req: OverviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> OverviewMap:
    await _ensure_owns_all(db, req.doc_ids, user)
    try:
        return await preparation_service.generate_overview(
            req.doc_ids,
            n_min=req.n_min,
            n_max=req.n_max,
            force=req.force,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        msg = str(exc)
        if "429" in msg or "rate limit" in msg.lower() or "tokens per day" in msg.lower():
            logger.warning("preparation: overview hit rate limit: %s", msg[:160])
            raise HTTPException(status_code=429, detail="LLM rate limit hit — try again in a few minutes.")
        logger.exception("preparation: overview failed for %s", req.doc_ids)
        raise HTTPException(status_code=502, detail=f"overview generation failed: {exc}")


class DocIdsBody(BaseModel):
    doc_ids: list[str] = Field(min_length=1, max_length=10)


@router.post("/overview", response_model=OverviewMap)
async def get_overview(
    req: DocIdsBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> OverviewMap:
    """Fetch cached overview by doc_ids set. POST (with body) so we don't have
    to encode arrays in the URL."""
    await _ensure_owns_all(db, req.doc_ids, user)
    o = preparation_service.load_overview(req.doc_ids)
    if o is None:
        raise HTTPException(status_code=404, detail="overview not generated yet")
    return o


@router.post("/overview/delete", status_code=204, response_class=Response)
async def delete_overview(
    req: DocIdsBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    await _ensure_owns_all(db, req.doc_ids, user)
    preparation_service.delete_overview(req.doc_ids)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Important questions


class QuestionsRequest(BaseModel):
    doc_ids: list[str] = Field(min_length=1, max_length=10)
    n: int = Field(default=10, ge=5, le=20)
    force: bool = False


@router.post("/questions/generate", response_model=ImportantQuestionSet)
async def generate_questions(
    req: QuestionsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ImportantQuestionSet:
    await _ensure_owns_all(db, req.doc_ids, user)
    try:
        return await preparation_service.generate_questions(
            req.doc_ids, n=req.n, force=req.force
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        msg = str(exc)
        # Surface upstream rate-limits as 429 so the UI can say "try again
        # later" instead of a wall of internal text.
        if "429" in msg or "rate limit" in msg.lower() or "tokens per day" in msg.lower():
            logger.warning("preparation: questions hit rate limit: %s", msg[:160])
            raise HTTPException(status_code=429, detail="LLM rate limit hit — try again in a few minutes.")
        logger.exception("preparation: questions failed for %s", req.doc_ids)
        raise HTTPException(status_code=502, detail=f"question generation failed: {exc}")


@router.post("/questions", response_model=ImportantQuestionSet)
async def get_questions(
    req: DocIdsBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ImportantQuestionSet:
    await _ensure_owns_all(db, req.doc_ids, user)
    qs = preparation_service.load_questions(req.doc_ids)
    if qs is None:
        raise HTTPException(status_code=404, detail="questions not generated yet")
    return qs


@router.post("/questions/delete", status_code=204, response_class=Response)
async def delete_questions(
    req: DocIdsBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    await _ensure_owns_all(db, req.doc_ids, user)
    preparation_service.delete_questions(req.doc_ids)
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Simplest explanation


class ExplanationRequest(BaseModel):
    doc_ids: list[str] = Field(min_length=1, max_length=10)
    topic: str = Field(min_length=2, max_length=200)
    force: bool = False


@router.post("/explanation/generate", response_model=SimpleExplanation)
async def generate_explanation(
    req: ExplanationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SimpleExplanation:
    await _ensure_owns_all(db, req.doc_ids, user)
    try:
        return await preparation_service.generate_explanation(
            req.doc_ids, req.topic, force=req.force
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        msg = str(exc)
        if "429" in msg or "rate limit" in msg.lower() or "tokens per day" in msg.lower():
            logger.warning("preparation: explanation hit rate limit: %s", msg[:160])
            raise HTTPException(status_code=429, detail="LLM rate limit hit — try again in a few minutes.")
        logger.exception("preparation: explanation failed")
        raise HTTPException(status_code=502, detail=f"explanation generation failed: {exc}")


class GetExplanationRequest(BaseModel):
    doc_ids: list[str] = Field(min_length=1, max_length=10)
    topic: str = Field(min_length=2, max_length=200)


@router.post("/explanation", response_model=SimpleExplanation)
async def get_explanation(
    req: GetExplanationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SimpleExplanation:
    await _ensure_owns_all(db, req.doc_ids, user)
    e = preparation_service.load_explanation(req.doc_ids, req.topic)
    if e is None:
        raise HTTPException(status_code=404, detail="explanation not generated yet")
    return e


# ---------------------------------------------------------------------------
# Streaming (SSE) endpoints
#
# doc_ids are passed as repeated query params (?doc_ids=a&doc_ids=b) since these
# are GET. JWT arrives via ?token= (SSE can't set the Authorization header),
# using the same dep as narration. CORS is inherited from the app-level
# middleware — no manual CORS headers here.
#
#   Important Questions → JSONL items:  data: {"type":"item","index":i,"data":{...}}
#   Overview / Explanation → tokens:    data: {"type":"token","token":"..."}
#   Completion:                         data: {"type":"done"[,"total":N]}
#   Error:                              data: {"type":"error","message":"..."}

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _chunk_text(text: str, size: int) -> list[str]:
    """Split cached text into small pieces so a cache replay still 'types'."""
    return [text[i:i + size] for i in range(0, len(text), size)]


def _first_title(doc_ids: list[str], default: str) -> str:
    try:
        return get_rag().get_meta(doc_ids[0]).get("title") or default
    except Exception:
        return default


async def _run_questions_stream(doc_ids: list[str], n: int, title: str):
    """JSONL stream: replay disk cache if present, else stream + persist."""
    try:
        cached = preparation_service.load_questions(doc_ids)
        if cached is not None:
            for i, q in enumerate(cached.questions):
                yield _sse({"type": "item", "index": i, "data": q.model_dump()})
                await asyncio.sleep(0.03)
            yield _sse({"type": "done", "total": len(cached.questions)})
            return

        items: list[dict] = []
        chain = build_important_questions_stream_chain(doc_ids)
        async for item in astream_jsonl_items(chain, {"n": n}, ImportantQuestion, label="questions_stream"):
            yield _sse({"type": "item", "index": len(items), "data": item})
            items.append(item)
        if items:
            try:
                preparation_service.save_questions(doc_ids, items, title=title)
            except Exception:
                logger.exception("preparation stream: questions cache write failed")
        yield _sse({"type": "done", "total": len(items)})
    except Exception as exc:
        logger.exception("preparation stream: questions failed")
        yield _sse({"type": "error", "message": str(exc)})


async def _run_overview_stream(doc_ids: list[str], n_min: int, n_max: int):
    """Token stream of the OverviewMap JSON (frontend parses on completion).
    Replays the cached overview JSON if the LangGraph endpoint already built it."""
    try:
        cached = preparation_service.load_overview(doc_ids)
        if cached is not None:
            for piece in _chunk_text(cached.model_dump_json(), 24):
                yield _sse({"type": "token", "token": piece})
                await asyncio.sleep(0.01)
            yield _sse({"type": "done"})
            return

        chain = build_overview_stream_chain(doc_ids)
        async for tok in astream_tokens(chain, {"n_min": n_min, "n_max": n_max}):
            yield _sse({"type": "token", "token": tok})
        yield _sse({"type": "done"})
    except Exception as exc:
        logger.exception("preparation stream: overview failed")
        yield _sse({"type": "error", "message": str(exc)})


async def _run_explanation_stream(doc_ids: list[str], topic: str):
    """Token stream of plain explanation prose. Replays cached explanation text
    if present (the existing endpoint remains the canonical generator)."""
    try:
        cached = preparation_service.load_explanation(doc_ids, topic)
        if cached is not None:
            for piece in _chunk_text(cached.explanation, 12):
                yield _sse({"type": "token", "token": piece})
                await asyncio.sleep(0.02)
            yield _sse({"type": "done"})
            return

        chain = build_explanation_stream_chain(doc_ids)
        async for tok in astream_tokens(chain, {"topic": topic}):
            yield _sse({"type": "token", "token": tok})
        yield _sse({"type": "done"})
    except Exception as exc:
        logger.exception("preparation stream: explanation failed")
        yield _sse({"type": "error", "message": str(exc)})


@router.get("/questions/stream", dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))])
async def stream_questions(
    doc_ids: list[str] = Query(..., min_length=1),
    n: int = 10,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    await _ensure_owns_all(db, doc_ids, user)
    title = _first_title(doc_ids, "Important Questions")
    return StreamingResponse(
        _run_questions_stream(doc_ids, max(5, min(20, n)), title),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.get("/overview/stream", dependencies=[Depends(limit_dep(LIMIT_AI_HEAVY))])
async def stream_overview(
    doc_ids: list[str] = Query(..., min_length=1),
    n_min: int = 6,
    n_max: int = 14,
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    await _ensure_owns_all(db, doc_ids, user)
    nmin = max(3, min(20, n_min))
    nmax = max(nmin, min(40, n_max))
    return StreamingResponse(
        _run_overview_stream(doc_ids, nmin, nmax),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.get("/explanation/stream", dependencies=[Depends(limit_dep(LIMIT_AI_GENERATE))])
async def stream_explanation(
    doc_ids: list[str] = Query(..., min_length=1),
    topic: str = Query(..., min_length=2, max_length=200),
    user: User = Depends(get_current_user_from_query_or_header),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    await _ensure_owns_all(db, doc_ids, user)
    return StreamingResponse(
        _run_explanation_stream(doc_ids, topic.strip()),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
