"""Preparation Mode orchestration service (Phase 7C+).

Multi-doc generation surface for:
  - Overview        (LangGraph: ingest → analyze → validate, with retry)
  - Important Qs    (chain-only)
  - Simplest Explain (chain-only, per-topic)

Caching key for multi-doc operations is ``sha1(sorted(doc_ids))[:12]`` so
the same selection always lands in the same cache slot, irrespective of
input order.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from pathlib import Path

from app.rag.chains.explanation_chain import build_explanation_chain
from app.rag.chains.important_questions_chain import build_important_questions_chain
from app.rag.retriever import multi_doc_chunk_counts
from app.core.settings import get_settings
from app.rag.graphs.preparation_graph import get_overview_graph
from app.rag.schemas.preparation import (
    ImportantQuestionSet,
    OverviewMap,
    SimpleExplanation,
    validate_chunk_refs,
)
from app.rag.service import get_rag

logger = logging.getLogger(__name__)


_INFLIGHT: dict[tuple[str, str], asyncio.Future] = {}


def _root() -> Path:
    p = get_settings().storage_path / "preparation"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _set_key(doc_ids: list[str]) -> str:
    """Stable cache key for an ordered set of doc_ids."""
    canon = "|".join(sorted(doc_ids))
    return hashlib.sha1(canon.encode("utf-8")).hexdigest()[:12]


def _path(set_key: str, feature: str, suffix: str = "") -> Path:
    folder = _root() / set_key
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{feature}{('_' + suffix) if suffix else ''}.json"
    return folder / name


def _validate_doc_ids(doc_ids: list[str]) -> None:
    if not doc_ids:
        raise ValueError("at least one doc_id is required")
    rag = get_rag()
    for d in doc_ids:
        if not rag.exists(d):
            raise FileNotFoundError(f"doc not found: {d}")


# ---------------------------------------------------------------------------
# Overview (LangGraph)


def load_overview(doc_ids: list[str]) -> OverviewMap | None:
    p = _path(_set_key(doc_ids), "overview")
    if not p.exists():
        return None
    try:
        return OverviewMap.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("preparation: bad overview cache")
        return None


def delete_overview(doc_ids: list[str]) -> bool:
    p = _path(_set_key(doc_ids), "overview")
    if not p.exists():
        return False
    try:
        p.unlink()
        return True
    except Exception:
        return False


async def generate_overview(
    doc_ids: list[str],
    *,
    n_min: int = 6,
    n_max: int = 14,
    force: bool = False,
) -> OverviewMap:
    _validate_doc_ids(doc_ids)
    if not force:
        cached = load_overview(doc_ids)
        if cached is not None:
            return cached

    set_key = _set_key(doc_ids)
    inflight_key = ("overview", set_key)
    inflight = _INFLIGHT.get(inflight_key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[inflight_key] = fut
    try:
        graph = get_overview_graph()

        def _run() -> dict:
            return graph.invoke({
                "doc_ids": doc_ids,
                "n_min": max(3, min(20, int(n_min))),
                "n_max": max(int(n_min), min(40, int(n_max))),
            })

        result_state = await asyncio.to_thread(_run)
        overview: OverviewMap | None = result_state.get("overview")
        err = result_state.get("error")
        if overview is None or err:
            raise RuntimeError(f"overview generation failed: {err or 'unknown'}")

        try:
            _path(set_key, "overview").write_text(
                overview.model_dump_json(), encoding="utf-8"
            )
        except Exception:
            logger.exception("preparation: failed to write overview cache")

        logger.info(
            "preparation: overview docs=%s topics=%d",
            doc_ids, len(overview.topics),
        )
        fut.set_result(overview)
        return overview
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(inflight_key, None)


# ---------------------------------------------------------------------------
# Important questions (multi-doc chain)


def load_questions(doc_ids: list[str]) -> ImportantQuestionSet | None:
    p = _path(_set_key(doc_ids), "questions")
    if not p.exists():
        return None
    try:
        return ImportantQuestionSet.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("preparation: bad questions cache")
        return None


def delete_questions(doc_ids: list[str]) -> bool:
    p = _path(_set_key(doc_ids), "questions")
    if not p.exists():
        return False
    try:
        p.unlink()
        return True
    except Exception:
        return False


def save_questions(doc_ids: list[str], items: list[dict], *, title: str) -> None:
    """Persist a streamed important-questions set to the SAME on-disk cache the
    generate/get endpoints use, so a later visit is served from cache. Coerces
    the streamed item dicts into ImportantQuestionSet (capped to the schema max);
    logs and no-ops on any validation/IO error since the stream already
    succeeded."""
    try:
        qs = ImportantQuestionSet(title=title, questions=items[:20])
    except Exception:
        logger.exception("preparation: cannot cache streamed questions for %s", doc_ids)
        return
    try:
        _path(_set_key(doc_ids), "questions").write_text(
            qs.model_dump_json(), encoding="utf-8"
        )
    except Exception:
        logger.exception("preparation: failed to write questions stream cache")


async def generate_questions(
    doc_ids: list[str],
    *,
    n: int = 10,
    force: bool = False,
) -> ImportantQuestionSet:
    _validate_doc_ids(doc_ids)
    if not force:
        cached = load_questions(doc_ids)
        if cached is not None:
            return cached

    set_key = _set_key(doc_ids)
    inflight_key = ("questions", set_key)
    inflight = _INFLIGHT.get(inflight_key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[inflight_key] = fut
    try:
        n = max(5, min(20, int(n)))
        chain = build_important_questions_chain(doc_ids)
        counts = multi_doc_chunk_counts(doc_ids)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                qs: ImportantQuestionSet = await asyncio.to_thread(
                    chain.invoke, {"n": n}
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("questions: attempt %d failed: %s", attempt, exc)
                continue

            invalid = ""
            for i, q in enumerate(qs.questions):
                if not q.chunks:
                    invalid = f"q[{i}] missing chunks"
                    break
                ok, reason = validate_chunk_refs(q.chunks, counts)
                if not ok:
                    invalid = f"q[{i}]: {reason}"
                    break
            if invalid:
                last_reason = invalid
                logger.warning("questions: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(set_key, "questions").write_text(
                    qs.model_dump_json(), encoding="utf-8"
                )
            except Exception:
                logger.exception("preparation: failed to write questions cache")

            logger.info(
                "preparation: questions docs=%s n=%d", doc_ids, len(qs.questions)
            )
            fut.set_result(qs)
            return qs

        exc = RuntimeError(f"questions generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(inflight_key, None)


# ---------------------------------------------------------------------------
# Simplest explanation (per-topic chain, cached per-topic)


def _topic_slug(topic: str) -> str:
    """Stable cache slug for a topic string (case-insensitive, trimmed)."""
    h = hashlib.sha1(topic.strip().lower().encode("utf-8")).hexdigest()[:10]
    return f"explanation_{h}"


def load_explanation(doc_ids: list[str], topic: str) -> SimpleExplanation | None:
    p = _path(_set_key(doc_ids), "explanation", _topic_slug(topic))
    if not p.exists():
        return None
    try:
        return SimpleExplanation.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("preparation: bad explanation cache")
        return None


async def generate_explanation(
    doc_ids: list[str],
    topic: str,
    *,
    force: bool = False,
) -> SimpleExplanation:
    _validate_doc_ids(doc_ids)
    if not topic.strip():
        raise ValueError("topic is required")
    if not force:
        cached = load_explanation(doc_ids, topic)
        if cached is not None:
            return cached

    set_key = _set_key(doc_ids)
    inflight_key = (f"explanation_{_topic_slug(topic)}", set_key)
    inflight = _INFLIGHT.get(inflight_key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[inflight_key] = fut
    try:
        chain = build_explanation_chain(doc_ids)
        counts = multi_doc_chunk_counts(doc_ids)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                expl: SimpleExplanation = await asyncio.to_thread(
                    chain.invoke, {"topic": topic.strip()}
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("explanation: attempt %d failed: %s", attempt, exc)
                continue

            # The schema permits empty `chunks` (model can decline if topic
            # not covered), but if any chunks are present they must be valid.
            ok, reason = validate_chunk_refs(expl.chunks, counts)
            if not ok:
                last_reason = reason
                logger.warning("explanation: attempt %d invalid (%s)", attempt, reason)
                continue

            try:
                _path(set_key, "explanation", _topic_slug(topic)).write_text(
                    expl.model_dump_json(), encoding="utf-8"
                )
            except Exception:
                logger.exception("preparation: failed to write explanation cache")

            logger.info(
                "preparation: explanation docs=%s topic=%r chars=%d",
                doc_ids, topic[:60], len(expl.explanation),
            )
            fut.set_result(expl)
            return expl

        exc = RuntimeError(f"explanation generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(inflight_key, None)


__all__ = [
    "generate_overview", "load_overview", "delete_overview",
    "generate_questions", "load_questions", "delete_questions", "save_questions",
    "generate_explanation", "load_explanation",
]
