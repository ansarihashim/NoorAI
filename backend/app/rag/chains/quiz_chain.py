"""Quiz generation chain — Phase 7B.

Same shape as flashcard_chain: fetch all RAG chunks → numbered context →
ChatGroq with structured output → validated QuizSet.
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
from app.rag.prompts.quiz import QUIZ_PROMPT
from app.rag.schemas.quiz import QuizSet


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.4,
        max_tokens=3000,
    ).with_structured_output(QuizSet)


def build_quiz_chain(doc_id: str) -> Runnable:
    retriever = EchoVerseRetriever(doc_id=doc_id, k=8)

    def _build_context(_: dict[str, Any]) -> str:
        return docs_to_numbered_context(retriever.fetch_all())

    llm = _build_llm()

    return (
        RunnablePassthrough.assign(context=RunnableLambda(_build_context))
        | RunnableLambda(
            lambda x: {"context": x["context"], "n": x["n"], "title": x["title"]}
        )
        | QUIZ_PROMPT
        | llm
    ).with_config({"run_name": "quiz_generation"})


__all__ = ["build_quiz_chain"]
