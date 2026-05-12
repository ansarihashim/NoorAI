from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services import narration as narration_service
from app.rag.service import get_rag
from app.rag.chunker import extract_pages_from_pdf
from app.auth.deps import get_current_user
from app.utils.rate_limit import LIMIT_UPLOAD, limit_dep
from app.utils.security_input import (
    MAX_TEXT_BYTES,
    MAX_UPLOAD_BYTES,
    enforce_max_bytes,
    sanitize_filename,
    validate_doc_id,
    validate_pdf_magic,
    validate_upload_extension,
    validate_upload_mime,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class TextUploadRequest(BaseModel):
    # Title is bounded so it can't be used as a denial-of-service vector
    # (huge title persisted in DB and shipped in every documents list).
    title: str = Field(default="Untitled", max_length=200)
    # The text is bounded by Pydantic and additionally enforced in the route
    # against MAX_TEXT_BYTES — the byte-level cap accounts for multibyte chars.
    text: str = Field(max_length=MAX_TEXT_BYTES)


class UploadResponse(BaseModel):
    doc_id: str
    title: str
    n_narration_chunks: int
    n_rag_chunks: int


async def _persist_document(db: AsyncSession, doc_id: str, title: str, n_chunks: int, user_id: str) -> None:
    db.add(Document(id=doc_id, user_id=user_id, title=title, n_chunks=n_chunks))
    await db.commit()


@router.post(
    "/upload/text",
    response_model=UploadResponse,
    dependencies=[Depends(limit_dep(LIMIT_UPLOAD))],
)
async def upload_text(
    req: TextUploadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UploadResponse:
    enforce_max_bytes(len(req.text.encode("utf-8")), limit=MAX_TEXT_BYTES)
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    title = sanitize_filename(req.title, fallback="Untitled")
    doc_id = uuid.uuid4().hex[:16]
    bundle = get_rag().ingest(doc_id=doc_id, title=title, text=text)
    await _persist_document(db, doc_id, bundle.title, len(bundle.narration), user.id)
    if bundle.narration:
        narration_service.spawn_prefetch(doc_id, [0])
    logger.info("upload: user=%s doc=%s n_narration=%d", user.id, doc_id, len(bundle.narration))
    return UploadResponse(
        doc_id=bundle.doc_id,
        title=bundle.title,
        n_narration_chunks=len(bundle.narration),
        n_rag_chunks=len(bundle.rag),
    )


@router.post(
    "/upload/file",
    response_model=UploadResponse,
    dependencies=[Depends(limit_dep(LIMIT_UPLOAD))],
)
async def upload_file(
    file: UploadFile = File(...),
    title: str = Form("Untitled", max_length=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UploadResponse:
    # Extension allowlist — checked from the user-supplied filename. If the
    # extension matches but the bytes don't, the magic-byte check below still
    # rejects PDFs that aren't really PDFs.
    ext = validate_upload_extension(file.filename)
    validate_upload_mime(file.content_type, ext)

    raw = await file.read()
    enforce_max_bytes(len(raw), limit=MAX_UPLOAD_BYTES)
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    pages: list[tuple[int, str]] | None = None
    if ext == ".pdf":
        validate_pdf_magic(raw)
        pages = extract_pages_from_pdf(raw)
        text = "\n\n".join(t for _, t in pages).strip()
    else:
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="replace")

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No extractable text in file")

    doc_id = uuid.uuid4().hex[:16]
    safe_title = sanitize_filename(title or file.filename, fallback="Untitled")
    safe_log_name = sanitize_filename(file.filename, fallback="<unnamed>")
    bundle = get_rag().ingest(doc_id=doc_id, title=safe_title, text=text, pages=pages)
    await _persist_document(db, doc_id, bundle.title, len(bundle.narration), user.id)
    if bundle.narration:
        narration_service.spawn_prefetch(doc_id, [0])
    logger.info(
        "upload: user=%s doc=%s ext=%s name=%s bytes=%d",
        user.id, doc_id, ext, safe_log_name, len(raw),
    )
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
    doc_id = validate_doc_id(doc_id)
    rag = get_rag()
    if not rag.exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")

    # Enforce ownership for documents that have a DB row. Documents created
    # before auth was added (NULL user_id) are migration debt — but we now
    # bind them to the first authenticated reader so future reads are gated.
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    return rag.get_meta(doc_id)
