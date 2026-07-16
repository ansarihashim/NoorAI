"""Multi-doc Simplest-Explanation chain — Phase 7C.

Differs from overview/important_questions: takes a `topic` parameter and
narrows the retrieval to chunks closest to that topic. We still pass full
multi-doc context (capped) so the model has the surrounding material.
"""
from __future__ import annotations

import logging
from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from app.rag.retriever import EchoVerseRetriever, docs_to_numbered_context
from app.core.settings import get_settings
from app.rag.prompts.explanation import EXPLANATION_PROMPT, EXPLANATION_STREAM_PROMPT
from app.rag.schemas.preparation import SimpleExplanation

logger = logging.getLogger(__name__)


def _build_llm() -> Runnable:
    s = get_settings()
    return ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.5,
        max_tokens=2400,
    ).with_structured_output(SimpleExplanation, method="json_mode")


def build_explanation_chain(doc_ids: list[str]) -> Runnable:
    """Multi-doc retrieval per topic.

    For each doc_id, retrieve top-k chunks for the given `topic` query, then
    combine into a single numbered context with [<doc_id>#<chunk_idx>] tags.
    """
    def _ctx(x: dict[str, Any]) -> str:
        topic = x["topic"]
        all_docs = []
        for d_id in doc_ids:
            r = EchoVerseRetriever(doc_id=d_id, k=6)
            try:
                all_docs.extend(r.invoke(topic))
            except Exception:
                # Tolerate single-doc failures (missing FAISS, broken index)
                # but never silently — a missing-method bug here is exactly
                # what made Simplest-Explanation appear broken before.
                logger.exception(
                    "explanation: retrieval failed for doc=%s topic=%r", d_id, topic[:80]
                )
                continue
        # Reformat with [doc#idx] prefix and cap
        lines: list[str] = []
        total = 0
        cap = 12000
        for d in all_docs:
            doc_id = d.metadata.get("doc_id")
            chunk_idx = d.metadata.get("chunk_idx")
            text = " ".join(d.page_content.split())
            line = f"[{doc_id}#{chunk_idx}] {text}"
            if total + len(line) + 2 > cap:
                break
            lines.append(line)
            total += len(line) + 2
        if not lines:
            logger.warning(
                "explanation: empty context for docs=%s topic=%r — model will refuse",
                doc_ids, topic[:80],
            )
            return "(no notes available)"
        logger.info(
            "explanation: context built docs=%s chunks=%d chars=%d",
            doc_ids, len(lines), total,
        )
        return "\n\n".join(lines)

    llm = _build_llm()
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(lambda x: {"context": x["context"], "topic": x["topic"]})
        | EXPLANATION_PROMPT
        | llm
    ).with_config({"run_name": "explanation_generation"})


def build_explanation_stream_chain(doc_ids: list[str]) -> Runnable:
    """Streaming (prose) explanation chain — streams plain-text tokens for the
    live typing effect. Same per-topic multi-doc retrieval as
    :func:`build_explanation_chain`, but no structured output. Drive with
    ``astream_tokens(chain, {"topic": topic})``.
    """
    def _ctx(x: dict[str, Any]) -> str:
        topic = x["topic"]
        all_docs = []
        for d_id in doc_ids:
            r = EchoVerseRetriever(doc_id=d_id, k=6)
            try:
                all_docs.extend(r.invoke(topic))
            except Exception:
                logger.exception(
                    "explanation_stream: retrieval failed for doc=%s topic=%r", d_id, topic[:80]
                )
                continue
        lines: list[str] = []
        total = 0
        cap = 12000
        for d in all_docs:
            doc_id = d.metadata.get("doc_id")
            chunk_idx = d.metadata.get("chunk_idx")
            text = " ".join(d.page_content.split())
            line = f"[{doc_id}#{chunk_idx}] {text}"
            if total + len(line) + 2 > cap:
                break
            lines.append(line)
            total += len(line) + 2
        if not lines:
            return "(no notes available)"
        return "\n\n".join(lines)

    s = get_settings()
    llm = ChatGroq(
        model=s.groq_model,
        api_key=s.groq_api_key,
        temperature=0.5,
        max_tokens=2400,
        streaming=True,
    )
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(lambda x: {"context": x["context"], "topic": x["topic"]})
        | EXPLANATION_STREAM_PROMPT
        | llm
    ).with_config({"run_name": "explanation_stream"})


__all__ = ["build_explanation_chain", "build_explanation_stream_chain"]
