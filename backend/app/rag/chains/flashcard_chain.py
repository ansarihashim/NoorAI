"""Flashcard generation chain — proof-of-pattern for Phase 7A.

Takes a doc_id + n_cards. Returns a validated FlashcardSet, structured by
ChatGroq's ``with_structured_output`` against our Pydantic schema.

Pipeline::

    EchoVerseRetriever.fetch_all()  →  numbered NOTES context  ─┐
                                                                 ├→ FLASHCARD_PROMPT → ChatGroq → FlashcardSet
    {n, title}  ────────────────────────────────────────────────┘

The chain does not validate ``grounded_chunks`` indices — that's the
calling service's job (it knows the document's chunk count).
"""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import (
    EchoVerseRetriever,
    docs_to_numbered_context,
)
from app.core.settings import get_settings
from app.rag.prompts.flashcards import FLASHCARD_PROMPT
from app.rag.schemas.flashcards import FlashcardSet


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.4,
        max_tokens=2400,
    ).with_structured_output(FlashcardSet)


def build_flashcard_chain(doc_id: str) -> Runnable:
    """Return a ``Runnable`` that, when invoked with ``{"n_cards": int, "title": str}``,
    yields a validated :class:`FlashcardSet`.

    The retriever pulls ALL RAG chunks for the document so flashcards can
    cover the whole text (not just the chunks closest to a single query).
    """
    # k is irrelevant for flashcards — we call fetch_all() which loads every
    # chunk regardless of k. We still set k to a sane in-bounds value because
    # EchoVerseRetriever validates the field at construction.
    retriever = EchoVerseRetriever(doc_id=doc_id, k=8)

    def _build_context(_: dict[str, Any]) -> str:
        # ``fetch_all`` ignores the query string — flashcards span the doc.
        return docs_to_numbered_context(retriever.fetch_all())

    llm = _build_llm()

    return (
        RunnablePassthrough.assign(context=RunnableLambda(_build_context))
        | RunnableLambda(
            lambda x: {
                "context": x["context"],
                "n": x["n_cards"],
                "title": x["title"],
            }
        )
        | FLASHCARD_PROMPT
        | llm
    ).with_config({"run_name": "flashcard_generation"})


__all__ = ["build_flashcard_chain"]
