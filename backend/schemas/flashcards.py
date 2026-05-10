"""Flashcard schemas — the proof-of-pattern AI output for Phase 7A."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.schemas.grounded import GroundedOutput

Difficulty = Literal["easy", "medium", "hard"]


class Flashcard(GroundedOutput):
    question: str = Field(min_length=3, max_length=400)
    answer: str = Field(min_length=2, max_length=800)
    difficulty: Difficulty = "medium"
    tags: list[str] = Field(default_factory=list, max_length=6)


class FlashcardSet(BaseModel):
    """Top-level result returned by the flashcard chain."""

    title: str = Field(min_length=1, max_length=120)
    cards: list[Flashcard] = Field(min_length=1, max_length=50)
