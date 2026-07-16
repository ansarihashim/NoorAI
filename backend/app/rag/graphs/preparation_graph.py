"""LangGraph state machine for Preparation Mode (Phase 7C).

Why a graph here and not for the simpler flows? Preparation Overview has a
real branching contract:

  ingest → analyze → validate ── ok ──► persist
                       │
                       └─ invalid ──► retry (once) ──► validate

The graph isolates the retry/branch logic so future additions (e.g. a
mermaid-only repair node, a "split-into-sub-overviews" node) can be added
as new nodes without touching the chain code.

Heavy work (LLM calls) is wrapped in :func:`asyncio.to_thread` by the
calling service so it doesn't block the event loop.
"""
from __future__ import annotations

import logging
import re
from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.rag.chains.overview_chain import build_overview_chain
from app.rag.retriever import multi_doc_chunk_counts
from app.rag.schemas.preparation import OverviewMap, validate_chunk_refs
from app.services.visual import _repair_collapsed, _validate_mermaid

logger = logging.getLogger(__name__)


class OverviewState(TypedDict, total=False):
    doc_ids: list[str]
    n_min: int
    n_max: int
    attempt: int

    # Filled by nodes
    chunk_counts: dict[str, int]
    overview: OverviewMap | None
    error: str | None


MAX_ATTEMPTS = 2


def _node_ingest(state: OverviewState) -> dict:
    counts = multi_doc_chunk_counts(state["doc_ids"])
    if not counts or all(v == 0 for v in counts.values()):
        return {"error": "no chunks available across the supplied documents"}
    return {"chunk_counts": counts, "attempt": 0}


def _node_analyze(state: OverviewState) -> dict:
    chain = build_overview_chain(state["doc_ids"])
    try:
        result: OverviewMap = chain.invoke({
            "n_min": state.get("n_min", 6),
            "n_max": state.get("n_max", 14),
        })
    except Exception as exc:
        logger.warning("preparation_graph: analyze chain failed: %s", exc)
        return {
            "overview": None,
            "error": f"chain error: {exc}",
            "attempt": state.get("attempt", 0) + 1,
        }
    return {"overview": result, "error": None, "attempt": state.get("attempt", 0) + 1}


def _node_validate(state: OverviewState) -> dict:
    overview = state.get("overview")
    if overview is None:
        # Pass-through error so the router can decide retry vs give-up.
        return {"error": state.get("error") or "no overview from analyze"}

    counts = state.get("chunk_counts", {})

    # 1. Validate ChunkRefs across all topics.
    for i, t in enumerate(overview.topics):
        if not t.chunks:
            return {"error": f"topic[{i}] '{t.title}' missing chunks", "overview": None}
        ok, reason = validate_chunk_refs(t.chunks, counts)
        if not ok:
            return {"error": f"topic[{i}] '{t.title}': {reason}", "overview": None}

    # 2. Validate / repair Mermaid.
    if overview.mermaid:
        ok, reason, repaired = _validate_mermaid(overview.mermaid)
        if ok:
            overview.mermaid = repaired
        else:
            # Mermaid is non-critical — drop it and continue with topics only.
            logger.info("preparation_graph: dropping invalid mermaid (%s)", reason)
            overview.mermaid = ""

    return {"error": None, "overview": overview}


def _route(state: OverviewState) -> str:
    """Router after validate: success → END; error + attempts left → analyze; otherwise END."""
    if state.get("error") is None and state.get("overview") is not None:
        return "ok"
    if state.get("attempt", 0) >= MAX_ATTEMPTS:
        return "give_up"
    return "retry"


def build_overview_graph():
    """Compile the Overview LangGraph.

    Returns the compiled graph; the caller invokes ``.invoke(state_dict)``.

    LangGraph is built on langchain-core Runnables, so once LangSmith tracing
    is enabled (LANGCHAIN_* env vars, wired in app/main.py) the whole graph run
    — each node plus the nested ``overview_generation`` chain call inside
    ``_node_analyze`` — is captured automatically; no LangGraph-specific config
    is required. ``with_config`` here only sets a readable root-span name.
    ``CompiledStateGraph.with_config`` returns a copy of the compiled graph, so
    ``.invoke`` and every other graph method still work on the result.
    """
    g: StateGraph = StateGraph(OverviewState)
    g.add_node("ingest", _node_ingest)
    g.add_node("analyze", _node_analyze)
    g.add_node("validate", _node_validate)

    g.set_entry_point("ingest")
    g.add_edge("ingest", "analyze")
    g.add_edge("analyze", "validate")
    g.add_conditional_edges(
        "validate",
        _route,
        {"ok": END, "retry": "analyze", "give_up": END},
    )
    return g.compile().with_config({"run_name": "overview_preparation_graph"})


# Module-level singleton — graph compilation is cheap but caching avoids the
# (small) overhead on hot paths.
_compiled = None


def get_overview_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_overview_graph()
    return _compiled


__all__ = ["build_overview_graph", "get_overview_graph", "OverviewState"]
