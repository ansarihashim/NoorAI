"""Multi-doc-aware schemas for Preparation Mode (Phase 7C+).

Where Phase 7B revision schemas use ``grounded_chunks: list[int]`` (single-doc),
Preparation outputs may span multiple documents — so they cite chunks via
:class:`ChunkRef` which carries both ``doc_id`` and ``chunk_idx``.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChunkRef(BaseModel):
    """A reference to a single RAG chunk in a specific document."""
    doc_id: str
    chunk_idx: int = Field(ge=0)


# ---------------------------------------------------------------------------
# Overview Mode


class OverviewTopic(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=10, max_length=800)
    importance: int = Field(ge=1, le=5, default=3)
    depends_on: list[str] = Field(
        default_factory=list,
        description="Sibling topic titles this topic builds on",
        max_length=8,
    )
    chunks: list[ChunkRef] = Field(
        default_factory=list,
        description="Chunks that ground this topic",
    )


class OverviewMap(BaseModel):
    title: str
    topics: list[OverviewTopic] = Field(min_length=1, max_length=40)
    mermaid: str = Field(default="", description="Mermaid source for the topic dependency graph")


# ---------------------------------------------------------------------------
# Important Questions Mode

QType = Literal["recall", "apply", "analyze", "evaluate"]


class ImportantQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=600)
    answer: str = Field(min_length=2, max_length=2000)
    type: QType = "apply"
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    chunks: list[ChunkRef] = Field(default_factory=list)


class ImportantQuestionSet(BaseModel):
    title: str
    questions: list[ImportantQuestion] = Field(min_length=1, max_length=20)


# ---------------------------------------------------------------------------
# Simplest Explanation Mode


class SimpleExplanation(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    explanation: str = Field(
        min_length=10,
        max_length=3000,
        description="Beginner-friendly explanation grounded in the notes",
    )
    analogies: list[str] = Field(default_factory=list, max_length=4)
    examples: list[str] = Field(default_factory=list, max_length=4)
    chunks: list[ChunkRef] = Field(default_factory=list)


def validate_chunk_refs(
    refs: list[ChunkRef],
    chunk_counts: dict[str, int],
) -> tuple[bool, str]:
    """Validate that every ChunkRef points to an in-bounds chunk.

    ``chunk_counts`` maps doc_id → number of RAG chunks in that doc.
    """
    bad = []
    for r in refs:
        n = chunk_counts.get(r.doc_id, -1)
        if n < 0:
            bad.append(f"unknown doc_id={r.doc_id}")
        elif r.chunk_idx >= n or r.chunk_idx < 0:
            bad.append(f"out-of-range {r.doc_id}#{r.chunk_idx} (n={n})")
    if bad:
        return False, "; ".join(bad[:5])
    return True, ""


__all__ = [
    "ChunkRef",
    "OverviewTopic",
    "OverviewMap",
    "ImportantQuestion",
    "ImportantQuestionSet",
    "SimpleExplanation",
    "validate_chunk_refs",
]
