from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.base import get_session
from backend.models.session import Document
from backend.models.user import User
from backend.services import narration_service
from backend.services.rag_service import get_rag
from backend.utils.chunker import extract_text_from_pdf
from backend.utils.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


class TextUploadRequest(BaseModel):
    title: str = "Untitled"
    text: str


class UploadResponse(BaseModel):
    doc_id: str
    title: str
    n_narration_chunks: int
    n_rag_chunks: int


async def _persist_document(db: AsyncSession, doc_id: str, title: str, n_chunks: int, user_id: str) -> None:
    db.add(Document(id=doc_id, user_id=user_id, title=title, n_chunks=n_chunks))
    await db.commit()


@router.post("/upload/text", response_model=UploadResponse)
async def upload_text(
    req: TextUploadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UploadResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    doc_id = uuid.uuid4().hex[:16]
    bundle = get_rag().ingest(doc_id=doc_id, title=req.title, text=text)
    await _persist_document(db, doc_id, bundle.title, len(bundle.narration), user.id)
    # Warm the first chunk's audio in the background so first-play feels instant.
    if bundle.narration:
        narration_service.spawn_prefetch(doc_id, [0])
    logger.info("upload: user=%s doc=%s n_narration=%d", user.id, doc_id, len(bundle.narration))
    return UploadResponse(
        doc_id=bundle.doc_id,
        title=bundle.title,
        n_narration_chunks=len(bundle.narration),
        n_rag_chunks=len(bundle.rag),
    )


@router.post("/upload/file", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form("Untitled"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UploadResponse:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        text = extract_text_from_pdf(raw)
    else:
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="replace")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No extractable text in file")

    doc_id = uuid.uuid4().hex[:16]
    bundle = get_rag().ingest(doc_id=doc_id, title=title or file.filename or "Untitled", text=text)
    await _persist_document(db, doc_id, bundle.title, len(bundle.narration), user.id)
    if bundle.narration:
        narration_service.spawn_prefetch(doc_id, [0])
    logger.info("upload: user=%s doc=%s file=%s", user.id, doc_id, file.filename)
    return UploadResponse(
        doc_id=bundle.doc_id,
        title=bundle.title,
        n_narration_chunks=len(bundle.narration),
        n_rag_chunks=len(bundle.rag),
    )


@router.get("/upload/{doc_id}")
async def get_doc(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    rag = get_rag()
    if not rag.exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")

    # Enforce ownership for documents that have a DB row.
    # Documents created before auth was added (no DB row) remain accessible
    # to any authenticated user — this is a one-time migration concession.
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    return rag.get_meta(doc_id)
