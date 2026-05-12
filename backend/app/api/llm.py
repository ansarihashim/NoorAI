from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.models.session import Document
from app.models.user import User
from app.services.groq import get_groq
from app.rag.service import get_rag
from app.auth.deps import get_current_user

router = APIRouter()


class AnswerRequest(BaseModel):
    doc_id: str = Field(..., min_length=12, max_length=32)
    question: str = Field(..., min_length=1, max_length=2000)
    k: int = Field(4, ge=1, le=12)


@router.post("/answer")
async def answer(
    req: AnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    rag = get_rag()
    if not rag.exists(req.doc_id):
        raise HTTPException(status_code=404, detail="doc not found")

    # Ownership check — match the pattern used by narration/podcast routes.
    result = await db.execute(select(Document).where(Document.id == req.doc_id))
    doc = result.scalar_one_or_none()
    if doc is not None and doc.user_id and doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="not your document")

    chunks = rag.retrieve(req.doc_id, req.question, k=req.k)
    groq = get_groq()

    async def gen():
        async for delta in groq.answer(req.question, chunks):
            yield delta

    return StreamingResponse(gen(), media_type="text/plain")
