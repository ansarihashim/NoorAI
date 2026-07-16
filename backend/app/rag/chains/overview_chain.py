"""Multi-doc Overview chain — Phase 7C."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import multi_doc_numbered_context
from app.core.settings import get_settings
from app.rag.prompts.overview import OVERVIEW_PROMPT
from app.rag.schemas.preparation import OverviewMap


def _build_llm() -> Runnable:
    s = get_settings()
    # json_mode is more resilient than the default function-calling path on
    # Groq for nested schemas (ChunkRef list etc.). The model returns plain
    # JSON which langchain validates against the Pydantic class.
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.3,
        max_tokens=3500,
    ).with_structured_output(OverviewMap, method="json_mode")


def build_overview_chain(doc_ids: list[str]) -> Runnable:
    """Returns a Runnable taking ``{n_min: int, n_max: int}`` → OverviewMap."""
    def _ctx(_: dict[str, Any]) -> str:
        return multi_doc_numbered_context(doc_ids, cap_chars=14000)

    llm = _build_llm()
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(
            lambda x: {
                "context": x["context"],
                "n_min": x.get("n_min", 6),
                "n_max": x.get("n_max", 14),
            }
        )
        | OVERVIEW_PROMPT
        | llm
    ).with_config({"run_name": "overview_generation"})


def build_overview_stream_chain(doc_ids: list[str]) -> Runnable:
    """Streaming Overview chain — same context + prompt as
    :func:`build_overview_chain`, but streams the raw JSON tokens of the
    OverviewMap instead of returning a parsed object (bypasses LangGraph).

    Drive with ``astream_tokens(chain, {"n_min", "n_max"})``; the caller
    accumulates the token text and parses it once the stream completes.
    """
    def _ctx(_: dict[str, Any]) -> str:
        return multi_doc_numbered_context(doc_ids, cap_chars=14000)

    s = get_settings()
    # response_format=json_object mirrors the non-streaming chain's json_mode so
    # the streamed text is valid JSON the frontend can parse on completion.
    llm = ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.3,
        max_tokens=3500,
        streaming=True,
        model_kwargs={"response_format": {"type": "json_object"}},
    )
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(
            lambda x: {
                "context": x["context"],
                "n_min": x.get("n_min", 6),
                "n_max": x.get("n_max", 14),
            }
        )
        | OVERVIEW_PROMPT
        | llm
    ).with_config({"run_name": "overview_stream"})


__all__ = ["build_overview_chain", "build_overview_stream_chain"]
