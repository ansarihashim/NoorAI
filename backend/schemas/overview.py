"""Overview-mode schemas — Phase 7C (stub for now)."""
from __future__ import annotations

from pydantic import BaseModel, Field

from backend.schemas.grounded import GroundedOutput


class OverviewTopic(GroundedOutput):
    title: str
    summary: str = Field(min_length=5, max_length=800)
    importance: int = Field(ge=1, le=5, default=3)
    depends_on: list[str] = Field(default_factory=list, description="Sibling topic titles")


class OverviewMap(BaseModel):
    title: str
    topics: list[OverviewTopic] = Field(min_length=1, max_length=40)
    mermaid: str = Field(default="", description="Optional Mermaid source for the topic dependency graph")
