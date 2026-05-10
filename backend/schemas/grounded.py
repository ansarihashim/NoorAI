"""Base schema for grounded AI outputs.

Every model produced by a chain in :mod:`backend.chains` extends
:class:`GroundedOutput`. The ``grounded_chunks`` field references RAG-chunk
indices used to support the answer; the platform validates these post-hoc
against the document's actual chunk count and rejects hallucinated indices.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class GroundedOutput(BaseModel):
    """Mixin/base for any AI output that cites source chunks.

    Subclasses MUST surface ``grounded_chunks`` whether nested (per-card,
    per-question, per-turn) or top-level. The validator that ensures every
    index falls inside ``[0, n_rag)`` runs in the calling service, not here,
    because we need the document's chunk count for the bounds check.
    """

    grounded_chunks: list[int] = Field(
        default_factory=list,
        description=(
            "Indices into the document's RAG chunk list (0-based). Every "
            "index MUST exist in the document's chunks.json `rag` array."
        ),
    )


def validate_grounded_indices(indices: list[int], n_chunks: int) -> tuple[bool, str]:
    """Bounds check — used by services after the chain returns.

    Returns ``(ok, reason)``. Empty index lists are considered valid only if
    the caller has already decided that's acceptable for the schema; this
    function only checks bounds when there *are* indices.
    """
    bad = [i for i in indices if not (0 <= i < n_chunks)]
    if bad:
        return False, f"out-of-range chunk indices {bad[:5]} (n_chunks={n_chunks})"
    return True, ""
