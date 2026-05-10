"""LangChain-compatible retriever wrapping the existing FAISS RAG service.

This is the **only** abstraction layer between LangChain and EchoVerse's
hand-rolled RAG. It does NOT replace :mod:`backend.services.rag_service` —
it delegates to it. The existing ``rag_service.retrieve()`` API is unchanged
and continues to power Q&A, podcast generation, and visual generation.

Why a thin wrapper instead of plugging in a LangChain native vectorstore:
  * Keeps the FAISS index format and chunk-storage layout owned by one
    service (rag_service), so any future change to embedding model or
    chunking strategy lives in a single file.
  * Lets every chain receive ``Document`` objects with a stable
    ``metadata.chunk_idx`` field — the load-bearing piece for the
    ``grounded_chunks`` contract that every AI output ships with.
"""
from __future__ import annotations

from typing import Any

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from pydantic import Field

from backend.services.rag_service import get_rag


class EchoVerseRetriever(BaseRetriever):
    """Retrieve top-k RAG chunks for a single document.

    Usage in a chain::

        retriever = EchoVerseRetriever(doc_id=doc_id, k=8)
        # In a Runnable pipeline, .invoke(query) returns list[Document];
        # each Document has page_content + metadata={"chunk_idx": int, "doc_id": str}.

    Notes
    -----
    * `doc_id` is required and bound at construction. One retriever per doc.
    * Synchronous by design — `rag_service` calls FAISS in-process and is
      microsecond-cheap once the index is loaded.
    """

    doc_id: str
    k: int = Field(default=4, ge=1, le=32)

    # BaseRetriever is a Pydantic model; allow subclass attrs.
    model_config = {"arbitrary_types_allowed": True}

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun,
    ) -> list[Document]:
        rag = get_rag()
        pairs = rag.retrieve_with_indices(self.doc_id, query, k=self.k)
        return [
            Document(
                page_content=text,
                metadata={"chunk_idx": idx, "doc_id": self.doc_id},
            )
            for idx, text in pairs
        ]

    def fetch_all(self) -> list[Document]:
        """Convenience for chains that need *every* RAG chunk (e.g. flashcard
        generation, where the model should cover the whole document, not just
        the chunks closest to a single query).

        Returns Documents in their original RAG-chunk order so chunk indices
        match positions.
        """
        rag = get_rag()
        # Reach into the loaded chunk list directly. This is a lightweight
        # private-ish call but kept here so chain code stays clean.
        _index, chunks = rag._load(self.doc_id)  # noqa: SLF001
        return [
            Document(
                page_content=text,
                metadata={"chunk_idx": i, "doc_id": self.doc_id},
            )
            for i, text in enumerate(chunks)
        ]


def docs_to_numbered_context(docs: list[Document], cap_chars: int = 12000) -> str:
    """Format a list of retrieved Documents as ``[#idx] text`` lines, capped
    at ``cap_chars`` total so we don't blow past the LLM context window.

    Whitespace is collapsed because RAG chunks frequently carry awkward
    line wrapping from PDF extraction.
    """
    out: list[str] = []
    total = 0
    for d in docs:
        idx = d.metadata.get("chunk_idx")
        clean = " ".join(d.page_content.split())
        line = f"[#{idx}] {clean}"
        if total + len(line) + 2 > cap_chars:
            break
        out.append(line)
        total += len(line) + 2
    return "\n\n".join(out) if out else "(no notes available)"


def collect_chunk_indices(docs: list[Document]) -> list[int]:
    """Pull the ordered chunk indices out of a list of Documents — useful when
    a chain wants to record what context was actually shown to the model.
    """
    out: list[int] = []
    for d in docs:
        idx = d.metadata.get("chunk_idx")
        if isinstance(idx, int):
            out.append(idx)
    return out


# ---------------------------------------------------------------------------
# Multi-document context (Preparation Mode)


def fetch_all_docs(doc_id: str) -> list[Document]:
    """Standalone helper — return every RAG chunk for one document."""
    return EchoVerseRetriever(doc_id=doc_id, k=8).fetch_all()


def multi_doc_numbered_context(
    doc_ids: list[str],
    cap_chars: int = 14000,
) -> str:
    """Build a single string of numbered NOTES drawing from multiple documents.

    Each chunk is prefixed with ``[<doc_id>#<chunk_idx>]`` so the LLM can
    cite chunks unambiguously across documents. Chunks are interleaved
    (round-robin across docs) so a budget cap doesn't starve later docs.
    """
    per_doc: list[list[Document]] = [fetch_all_docs(d) for d in doc_ids]
    lines: list[str] = []
    total = 0
    cursors = [0] * len(per_doc)
    while True:
        progressed = False
        for i, docs in enumerate(per_doc):
            if cursors[i] >= len(docs):
                continue
            d = docs[cursors[i]]
            cursors[i] += 1
            doc_id = d.metadata.get("doc_id") or doc_ids[i]
            chunk_idx = d.metadata.get("chunk_idx")
            text = " ".join(d.page_content.split())
            line = f"[{doc_id}#{chunk_idx}] {text}"
            if total + len(line) + 2 > cap_chars:
                progressed = False
                break
            lines.append(line)
            total += len(line) + 2
            progressed = True
        if not progressed:
            break
    return "\n\n".join(lines) if lines else "(no notes available)"


def multi_doc_chunk_counts(doc_ids: list[str]) -> dict[str, int]:
    """Map of doc_id → number of RAG chunks. Used by validators."""
    from backend.services.rag_service import get_rag
    rag = get_rag()
    return {d: rag.n_rag_chunks(d) for d in doc_ids}


__all__ = [
    "EchoVerseRetriever",
    "docs_to_numbered_context",
    "collect_chunk_indices",
    "fetch_all_docs",
    "multi_doc_numbered_context",
    "multi_doc_chunk_counts",
]
