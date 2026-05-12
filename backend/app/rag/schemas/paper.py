"""Predicted-paper schemas — Phase 7E (stub for now)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.rag.schemas.grounded import GroundedOutput


class PredictedQuestion(GroundedOutput):
    question: str = Field(min_length=3, max_length=600)
    marks: int = Field(ge=1, default=6)
    topic: str
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class PaperSection(BaseModel):
    section_label: str = Field(description="e.g. 'Section A'")
    instructions: str = Field(default="Attempt any one of the following")
    questions: list[PredictedQuestion] = Field(min_length=1, max_length=4)


class PredictedPaper(BaseModel):
    title: str
    total_marks: int = 60
    sections: list[PaperSection] = Field(min_length=1, max_length=10)
    confidence_metadata: dict = Field(
        default_factory=dict,
        description="Top-level signals e.g. {n_pyq_papers: int, top_topics: [...]}",
    )
