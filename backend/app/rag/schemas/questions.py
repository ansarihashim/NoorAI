"""Important-question schemas — Phase 7D (stub for now)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.rag.schemas.grounded import GroundedOutput

QType = Literal["recall", "apply", "analyze", "evaluate"]


class ImportantQuestion(GroundedOutput):
    question: str = Field(min_length=3, max_length=600)
    answer: str = Field(min_length=2, max_length=1500)
    type: QType = "apply"
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class ImportantQuestionSet(BaseModel):
    title: str
    questions: list[ImportantQuestion] = Field(min_length=1, max_length=20)
