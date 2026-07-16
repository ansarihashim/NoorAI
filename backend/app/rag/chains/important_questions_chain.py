"""Multi-doc Important-Questions chain — Phase 7C."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import multi_doc_numbered_context
from app.core.settings import get_settings
from app.rag.prompts.important_questions import (
    IMPORTANT_QUESTIONS_PROMPT,
    IMPORTANT_QUESTIONS_STREAM_PROMPT,
)
from app.rag.schemas.preparation import ImportantQuestionSet


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.4,
        max_tokens=3500,
    ).with_structured_output(ImportantQuestionSet, method="json_mode")


def build_important_questions_chain(doc_ids: list[str]) -> Runnable:
    def _ctx(_: dict[str, Any]) -> str:
        return multi_doc_numbered_context(doc_ids, cap_chars=14000)

    llm = _build_llm()
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(lambda x: {"context": x["context"], "n": x["n"]})
        | IMPORTANT_QUESTIONS_PROMPT
        | llm
    ).with_config({"run_name": "important_questions_generation"})


def build_important_questions_stream_chain(doc_ids: list[str]) -> Runnable:
    """Streaming (JSONL) important-questions chain — one JSON question per line,
    no structured output. Drive with
    ``astream_jsonl_items(chain, {"n": n}, ImportantQuestion)``."""
    def _ctx(_: dict[str, Any]) -> str:
        return multi_doc_numbered_context(doc_ids, cap_chars=14000)

    s = get_settings()
    llm = ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.4,
        max_tokens=3500,
        streaming=True,
    )
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(lambda x: {"context": x["context"], "n": x["n"]})
        | IMPORTANT_QUESTIONS_STREAM_PROMPT
        | llm
    ).with_config({"run_name": "important_questions_stream"})


__all__ = ["build_important_questions_chain", "build_important_questions_stream_chain"]
