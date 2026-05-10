"""Multi-doc Simplest-Explanation chain — Phase 7C.

Differs from overview/important_questions: takes a `topic` parameter and
narrows the retrieval to chunks closest to that topic. We still pass full
multi-doc context (capped) so the model has the surrounding material.
"""
from __future__ import annotations

from typing import Any

from langchain_core.runnables import Runnable, RunnableLambda, RunnablePassthrough
from langchain_groq import ChatGroq

from backend.chains.retriever import EchoVerseRetriever, docs_to_numbered_context
from backend.config.settings import get_settings
from backend.prompts.explanation import EXPLANATION_PROMPT
from backend.schemas.preparation import SimpleExplanation


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
                # tolerate single-doc failures (missing FAISS etc.)
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
        return "\n\n".join(lines) if lines else "(no notes available)"

    llm = _build_llm()
    return (
        RunnablePassthrough.assign(context=RunnableLambda(_ctx))
        | RunnableLambda(lambda x: {"context": x["context"], "topic": x["topic"]})
        | EXPLANATION_PROMPT
        | llm
    )


__all__ = ["build_explanation_chain"]
