"""Quick-revision + Night-Before-Exam schemas — Phase 7B (stub for now)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.rag.schemas.grounded import GroundedOutput

NightCategory = Literal["definition", "formula", "derivation", "mistake", "high_yield"]


class QuickRevisionTopic(GroundedOutput):
    title: str
    summary: str = Field(min_length=10, max_length=1200)
    key_points: list[str] = Field(default_factory=list, max_length=8)


class QuickRevisionSet(BaseModel):
    title: str
    topics: list[QuickRevisionTopic] = Field(min_length=1, max_length=20)


class NightBeforeItem(GroundedOutput):
    category: NightCategory
    content: str = Field(min_length=2, max_length=600)
    importance: int = Field(ge=1, le=5, default=3)
    exam_probability: float = Field(ge=0.0, le=1.0, default=0.5)


class NightBeforeSet(BaseModel):
    title: str
    items: list[NightBeforeItem] = Field(min_length=1, max_length=60)
