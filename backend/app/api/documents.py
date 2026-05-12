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

from app.core.settings import get_settings
from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services import podcast as podcast_service
from app.rag.service import get_rag
from app.auth.deps import get_current_user
from app.utils.security_input import safe_join, validate_doc_id

logger = logging.getLogger(__name__)
router = APIRouter()


class DocumentOut(BaseModel):
    id: str
    title: str
    n_chunks: int
    created_at: float | None = None
    has_podcast: bool = False


class CitationsOut(BaseModel):
    """Per-chunk page-number array.

    ``pages[i]`` is the page number for RAG chunk index ``i`` (1-based, the
    way humans cite). A value of ``None`` means the chunk's page is unknown
    — typically a non-PDF source (text upload) or a legacy document that was
    ingested before page-aware chunking landed.
    """
    pages: list[int | None]
    total_pages: int | None = None
    is_paged: bool = False


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


@router.get("/{doc_id}/citations", response_model=CitationsOut)
async def get_citations(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> CitationsOut:
    """Return the per-chunk page-number array for a document.

    The frontend calls this once when a session opens and uses the result to
    render "Page 12" wherever it would otherwise show ``chunk #N``. Matches
    the ownership-tolerance used by the upload + narration routes: legacy
    orphan documents (no user_id) are readable by any authenticated user.
    """
    doc_id = validate_doc_id(doc_id)
    rag = get_rag()
    if not rag.exists(doc_id):
        raise HTTPException(status_code=404, detail="document not found")

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    pages = rag.get_rag_pages(doc_id)
    meta = rag.get_meta(doc_id)
    total = meta.get("total_pages") if isinstance(meta, dict) else None
    is_paged = any(p is not None for p in pages)
    return CitationsOut(pages=pages, total_pages=total, is_paged=is_paged)


@router.delete("/{doc_id}", status_code=204, response_class=Response)
async def delete_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Response:
    # validate_doc_id rejects anything outside [a-f0-9]{12,32} BEFORE the
    # filesystem ops below — even a single ../ would be filtered here.
    doc_id = validate_doc_id(doc_id)

    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    if doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    # delete row
    await db.execute(delete(Document).where(Document.id == doc_id))
    await db.commit()

    # Drop the document's Pinecone namespace + Postgres mirror row. Best-
    # effort: a failure here is logged but does not abort on-disk cleanup
    # or the user's request.
    try:
        get_rag().delete(doc_id)
    except Exception:
        logger.exception("documents: rag.delete failed for %s", doc_id)

    # Best-effort cleanup of on-disk artifacts. safe_join belt-and-braces:
    # if the regex check above ever regresses, safe_join still refuses paths
    # that don't resolve under storage_path.
    storage = get_settings().storage_path
    for sub in ("rag", "podcast"):
        try:
            p: Path = safe_join(storage, sub, doc_id)
        except Exception:
            continue
        if p.exists() and p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
    try:
        podcast_json = safe_join(storage, "podcast", f"{doc_id}.json")
    except Exception:
        podcast_json = None
    if podcast_json is not None and podcast_json.exists() and podcast_json.is_file():
        try:
            podcast_json.unlink()
        except Exception:
            logger.exception("documents: failed to remove podcast json for %s", doc_id)

    logger.info("documents: user=%s deleted doc=%s", user.id, doc_id)
    return Response(status_code=204)
