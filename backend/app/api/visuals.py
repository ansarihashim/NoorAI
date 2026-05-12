"""AI Visual Learning routes — generate, list, fetch, delete Mermaid diagrams."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services import visual as visual_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=600)
    style: str | None = Field(default=None, max_length=40)
    force: bool = False


class VisualOut(BaseModel):
    visual_id: str
    doc_id: str
    prompt: str
    style: str | None = None
    diagram_type: str
    title: str
    mermaid: str
    created_at: float

    @classmethod
    def from_visual(cls, v: visual_service.Visual) -> "VisualOut":
        return cls(**v.to_dict())


async def _ensure_doc_owner(db: AsyncSession, doc_id: str, user: User) -> None:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not your document")


@router.post("/{doc_id}/generate", response_model=VisualOut)
async def generate(
    doc_id: str,
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> VisualOut:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)

    try:
        visual = await visual_service.generate_visual(
            doc_id=doc_id, prompt=req.prompt, style=req.style, force=req.force,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("visuals: generation failed for %s", doc_id)
        raise HTTPException(status_code=502, detail=f"visual generation failed: {exc}")
    return VisualOut.from_visual(visual)


@router.get("/{doc_id}", response_model=list[VisualOut])
async def list_for_doc(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[VisualOut]:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    return [VisualOut.from_visual(v) for v in visual_service.list_visuals(doc_id)]


@router.get("/{doc_id}/{visual_id}", response_model=VisualOut)
async def get_one(
    doc_id: str,
    visual_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> VisualOut:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    v = visual_service.load_visual(doc_id, visual_id)
    if v is None:
        raise HTTPException(status_code=404, detail="visual not found")
    return VisualOut.from_visual(v)


@router.delete("/{doc_id}/{visual_id}", status_code=204, response_class=Response)
async def delete_one(
    doc_id: str,
    visual_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    if not get_rag().exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    await _ensure_doc_owner(db, doc_id, user)
    if not visual_service.delete_visual(doc_id, visual_id):
        raise HTTPException(status_code=404, detail="visual not found")
    return Response(status_code=204)
