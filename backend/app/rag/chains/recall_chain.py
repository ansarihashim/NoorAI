"""Active-recall generation chain — Phase 7B."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import (
    EchoVerseRetriever,
    docs_to_numbered_context,
)
from app.core.settings import get_settings
from app.rag.prompts.recall import RECALL_PROMPT, RECALL_STREAM_PROMPT
from app.rag.schemas.recall import RecallSet


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.5,
        max_tokens=2400,
    ).with_structured_output(RecallSet)


def build_recall_chain(doc_id: str) -> Runnable:
    retriever = EchoVerseRetriever(doc_id=doc_id, k=8)

    def _build_context(_: dict[str, Any]) -> str:
        return docs_to_numbered_context(retriever.fetch_all())

    llm = _build_llm()

    return (
        RunnablePassthrough.assign(context=RunnableLambda(_build_context))
        | RunnableLambda(
            lambda x: {"context": x["context"], "n": x["n"], "title": x["title"]}
        )
        | RECALL_PROMPT
        | llm
    ).with_config({"run_name": "recall_generation"})


def build_recall_stream_chain(doc_id: str) -> Runnable:
    """Streaming (JSONL) recall chain — one JSON prompt per line, no structured
    output. Drive with ``astream_jsonl_items(chain, {"n", "title"}, RecallPrompt)``."""
    retriever = EchoVerseRetriever(doc_id=doc_id, k=8)

    def _build_context(_: dict[str, Any]) -> str:
        return docs_to_numbered_context(retriever.fetch_all())

    s = get_settings()
    llm = ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.5,
        max_tokens=2400,
        streaming=True,
    )
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_build_context))
        | RunnableLambda(
            lambda x: {"context": x["context"], "n": x["n"], "title": x["title"]}
        )
        | RECALL_STREAM_PROMPT
        | llm
    ).with_config({"run_name": "recall_stream"})


__all__ = ["build_recall_chain", "build_recall_stream_chain"]
