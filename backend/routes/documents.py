"""Document library: list and delete the current user's uploads."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.settings import get_settings
from backend.db.base import get_session
from backend.models.session import Document
from backend.models.user import User
from backend.services import podcast_service
from backend.utils.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


class DocumentOut(BaseModel):
    id: str
    title: str
    n_chunks: int
    created_at: float | None = None
    has_podcast: bool = False


@router.get("", response_model=List[DocumentOut])
async def list_documents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> List[DocumentOut]:
    result = await db.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        DocumentOut(
            id=d.id,
            title=d.title or "Untitled",
            n_chunks=d.n_chunks or 0,
            created_at=d.created_at.timestamp() if d.created_at else None,
            has_podcast=podcast_service.script_exists(d.id),
        )
        for d in docs
    ]


@router.delete("/{doc_id}", status_code=204, response_class=Response)
async def delete_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    if doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    # delete row
    await db.execute(delete(Document).where(Document.id == doc_id))
    await db.commit()

    # best-effort cleanup of on-disk artifacts
    storage = get_settings().storage_path
    for sub in ("rag", "podcast"):
        p: Path = storage / sub / doc_id
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)
    podcast_json = storage / "podcast" / f"{doc_id}.json"
    if podcast_json.exists():
        try:
            podcast_json.unlink()
        except Exception:
            pass

    logger.info("documents: user=%s deleted doc=%s", user.id, doc_id)
    return Response(status_code=204)
