from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.groq_service import get_groq
from backend.services.rag_service import get_rag

router = APIRouter()


class AnswerRequest(BaseModel):
    doc_id: str
    question: str
    k: int = 4


@router.post("/answer")
async def answer(req: AnswerRequest):
    rag = get_rag()
    if not rag.exists(req.doc_id):
        raise HTTPException(status_code=404, detail="doc not found")
    chunks = rag.retrieve(req.doc_id, req.question, k=req.k)
    groq = get_groq()

    async def gen():
        async for delta in groq.answer(req.question, chunks):
            yield delta

    return StreamingResponse(gen(), media_type="text/plain")
