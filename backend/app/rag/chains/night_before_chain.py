"""Night-before-exam chain — Phase 7B."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import (
    EchoVerseRetriever,
    docs_to_numbered_context,
)
from app.core.settings import get_settings
from app.rag.prompts.night_before import NIGHT_BEFORE_PROMPT
from app.rag.schemas.revision import NightBeforeSet


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.3,
        max_tokens=2400,
    ).with_structured_output(NightBeforeSet)


def build_night_before_chain(doc_id: str) -> Runnable:
    retriever = EchoVerseRetriever(doc_id=doc_id, k=8)

    def _build_context(_: dict[str, Any]) -> str:
        return docs_to_numbered_context(retriever.fetch_all())

    llm = _build_llm()

    return (
        RunnablePassthrough.assign(context=RunnableLambda(_build_context))
        | RunnableLambda(
            lambda x: {"context": x["context"], "n": x["n"], "title": x["title"]}
        )
        | NIGHT_BEFORE_PROMPT
        | llm
    )


__all__ = ["build_night_before_chain"]
