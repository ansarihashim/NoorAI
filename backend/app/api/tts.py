from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.models.user import User
from app.services.tts import get_tts
from app.auth.deps import get_current_user

router = APIRouter()


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


@router.post("/synthesize")
async def synthesize(
    req: SynthesizeRequest,
    user: User = Depends(get_current_user),
):
    tts = get_tts()

    async def gen():
        async for chunk in tts.synthesize_stream(req.text):
            yield chunk

    return StreamingResponse(gen(), media_type="audio/mpeg")
