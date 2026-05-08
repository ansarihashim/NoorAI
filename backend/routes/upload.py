from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.services.rag_service import get_rag
from backend.utils.chunker import extract_text_from_pdf

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


@router.post("/upload/text", response_model=UploadResponse)
async def upload_text(req: TextUploadRequest) -> UploadResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    doc_id = uuid.uuid4().hex[:16]
    bundle = get_rag().ingest(doc_id=doc_id, title=req.title, text=text)
    return UploadResponse(
        doc_id=bundle.doc_id,
        title=bundle.title,
        n_narration_chunks=len(bundle.narration),
        n_rag_chunks=len(bundle.rag),
    )


@router.post("/upload/file", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), title: str = Form("Untitled")) -> UploadResponse:
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
    return UploadResponse(
        doc_id=bundle.doc_id,
        title=bundle.title,
        n_narration_chunks=len(bundle.narration),
        n_rag_chunks=len(bundle.rag),
    )


@router.get("/upload/{doc_id}")
async def get_doc(doc_id: str):
    rag = get_rag()
    if not rag.exists(doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    return rag.get_meta(doc_id)
