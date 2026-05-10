"""Quiz schemas — Phase 7B (stub for now)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.schemas.grounded import GroundedOutput

QuestionType = Literal["mcq", "conceptual", "assertion_reason"]


class QuizQuestion(GroundedOutput):
    question: str = Field(min_length=3, max_length=600)
    type: QuestionType = "mcq"
    options: list[str] = Field(default_factory=list, max_length=6)
    correct_index: int = Field(ge=0, default=0, description="Index into options[] for MCQ")
    explanation: str = Field(min_length=2, max_length=800)


class QuizSet(BaseModel):
    title: str
    questions: list[QuizQuestion] = Field(min_length=1, max_length=30)
