"""Viva-prep schemas — Phase 7B (stub for now)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.rag.schemas.grounded import GroundedOutput

VivaDifficulty = Literal["easy", "medium", "hard"]


class VivaQuestion(GroundedOutput):
    question: str = Field(min_length=3, max_length=400)
    expected_answer: str = Field(min_length=2, max_length=800)
    follow_ups: list[str] = Field(default_factory=list, max_length=4)
    difficulty: VivaDifficulty = "medium"


class VivaSet(BaseModel):
    title: str
    questions: list[VivaQuestion] = Field(min_length=1, max_length=30)
