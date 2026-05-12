"""Active recall schemas — Phase 7B (stub for now)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.rag.schemas.grounded import GroundedOutput

RecallKind = Literal["concept", "fill_in_blank", "explain_in_own_words", "short"]


class RecallPrompt(GroundedOutput):
    prompt: str = Field(min_length=3, max_length=400)
    kind: RecallKind = "concept"
    expected: str = Field(min_length=2, max_length=600)


class RecallSet(BaseModel):
    title: str
    prompts: list[RecallPrompt] = Field(min_length=1, max_length=30)
