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


__all__ = ["build_overview_chain"]
