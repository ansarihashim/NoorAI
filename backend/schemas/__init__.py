"""Pydantic schemas for AI-generated outputs.

All grounded outputs inherit from :class:`backend.schemas.grounded.GroundedOutput`
which mandates a ``grounded_chunks: list[int]`` field referencing RAG-chunk
indices. This is the platform's hallucination-reduction contract.
"""
