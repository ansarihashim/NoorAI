"""Preparation Mode routes (Phase 7C).

Multi-doc — every endpoint accepts ``doc_ids: list[str]`` so the user can
prepare across an entire syllabus, not just a single document.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.rag.schemas.preparation import (
    ImportantQuestionSet,
    OverviewMap,
    SimpleExplanation,
)
from app.services import preparation as preparation_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user

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
