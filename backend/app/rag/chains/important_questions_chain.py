"""Multi-doc Important-Questions chain — Phase 7C."""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import multi_doc_numbered_context
from app.core.settings import get_settings
from app.rag.prompts.important_questions import IMPORTANT_QUESTIONS_PROMPT
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


__all__ = ["build_important_questions_chain"]
