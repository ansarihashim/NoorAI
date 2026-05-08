from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.tts_service import get_tts

router = APIRouter()


class SynthesizeRequest(BaseModel):
    text: str


@router.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    tts = get_tts()

    async def gen():
        async for chunk in tts.synthesize_stream(req.text):
            yield chunk

    return StreamingResponse(gen(), media_type="audio/mpeg")
