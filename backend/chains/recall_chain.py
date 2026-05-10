"""Active-recall generation chain — Phase 7B."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from backend.chains.retriever import (
    EchoVerseRetriever,
    docs_to_numbered_context,
)
from backend.config.settings import get_settings
from backend.prompts.recall import RECALL_PROMPT
from backend.schemas.recall import RecallSet


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
    )


__all__ = ["build_recall_chain"]
