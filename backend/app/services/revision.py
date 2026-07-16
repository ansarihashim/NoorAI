"""Revision-mode orchestration service.

Mirrors the shape of :mod:`app.services.podcast_service` and
:mod:`app.services.visual_service`:

    * Singleton-style module-level helpers
    * Disk caching under ``storage/revision/{doc_id}/<feature>.json``
    * In-process ``_INFLIGHT`` coalescing of concurrent generation calls
    * Post-hoc validation of ``grounded_chunks`` indices

In Phase 7A only flashcards are wired. Quiz / Recall / QuickRevision /
NightBefore / Viva / VisualRevision land in Phase 7B and follow the same
pattern (one ``async def generate_<feature>`` per sub-mode).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import TypeVar

from app.rag.chains.flashcard_chain import build_flashcard_chain
from app.rag.chains.night_before_chain import build_night_before_chain
from app.rag.chains.quick_revision_chain import build_quick_revision_chain
from app.rag.chains.quiz_chain import build_quiz_chain
from app.rag.chains.recall_chain import build_recall_chain
from app.rag.chains.viva_chain import build_viva_chain
from app.core.settings import get_settings
from app.core.redis import (
    is_redis_available,
    release_lock,
    try_acquire_lock,
    wait_for_lock_result,
)
from app.rag.schemas.flashcards import Flashcard, FlashcardSet
from app.rag.schemas.grounded import validate_grounded_indices
from app.rag.schemas.quiz import QuizQuestion, QuizSet
from app.rag.schemas.recall import RecallPrompt, RecallSet
from app.rag.schemas.revision import (
    NightBeforeItem,
    NightBeforeSet,
    QuickRevisionSet,
    QuickRevisionTopic,
)
from app.rag.schemas.viva import VivaQuestion, VivaSet
from app.rag.service import get_rag

logger = logging.getLogger(__name__)


T = TypeVar("T")

# Per-(doc_id, feature) inflight futures so two concurrent requests for the
# same generation don't both call Groq. Keys are ("flashcards", doc_id) etc.
_INFLIGHT: dict[tuple[str, str], asyncio.Future] = {}


# ---------------------------------------------------------------------------
# storage helpers


def _root() -> Path:
    p = get_settings().storage_path / "revision"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _doc_dir(doc_id: str) -> Path:
    p = _root() / doc_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def _path(doc_id: str, feature: str) -> Path:
    return _doc_dir(doc_id) / f"{feature}.json"


# ---------------------------------------------------------------------------
# flashcards


def load_flashcards(doc_id: str) -> FlashcardSet | None:
    p = _path(doc_id, "flashcards")
    if not p.exists():
        return None
    try:
        return FlashcardSet.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("revision: bad flashcard cache for %s", doc_id)
        return None


def delete_flashcards(doc_id: str) -> bool:
    p = _path(doc_id, "flashcards")
    if not p.exists():
        return False
    try:
        p.unlink()
        return True
    except Exception:
        logger.exception("revision: failed to delete flashcards for %s", doc_id)
        return False


# ---------------------------------------------------------------------------
# Streaming cache writers
#
# The GET /stream endpoints collect the full list of items they streamed and
# persist it to the SAME on-disk cache the generate/get endpoints use (identical
# _path(doc_id, feature) file), so a later visit — stream OR generate — is
# served from cache. Each writer coerces the streamed item dicts into the
# feature's Set schema (capped to the schema's max length) and writes it; on any
# validation/IO error it logs and no-ops, since the stream itself already
# succeeded and returned items to the client.


def _write_set(doc_id: str, feature: str, set_obj) -> None:
    try:
        _path(doc_id, feature).write_text(set_obj.model_dump_json(), encoding="utf-8")
    except Exception:
        logger.exception("revision: failed to write %s stream cache for %s", feature, doc_id)


def save_flashcards(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        deck = FlashcardSet(title=title, cards=items[:50])
    except Exception:
        logger.exception("revision: cannot cache streamed flashcards for %s", doc_id)
        return
    _write_set(doc_id, "flashcards", deck)


def save_quiz(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        qs = QuizSet(title=title, questions=items[:30])
    except Exception:
        logger.exception("revision: cannot cache streamed quiz for %s", doc_id)
        return
    _write_set(doc_id, "quiz", qs)


def save_recall(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        rs = RecallSet(title=title, prompts=items[:30])
    except Exception:
        logger.exception("revision: cannot cache streamed recall for %s", doc_id)
        return
    _write_set(doc_id, "recall", rs)


def save_viva(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        vs = VivaSet(title=title, questions=items[:30])
    except Exception:
        logger.exception("revision: cannot cache streamed viva for %s", doc_id)
        return
    _write_set(doc_id, "viva", vs)


def save_night_before(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        nb = NightBeforeSet(title=title, items=items[:60])
    except Exception:
        logger.exception("revision: cannot cache streamed night_before for %s", doc_id)
        return
    _write_set(doc_id, "night_before", nb)


def save_quick_revision(doc_id: str, items: list[dict], *, title: str) -> None:
    try:
        qr = QuickRevisionSet(title=title, topics=items[:20])
    except Exception:
        logger.exception("revision: cannot cache streamed quick_revision for %s", doc_id)
        return
    _write_set(doc_id, "quick_revision", qr)


async def generate_flashcards(
    doc_id: str,
    *,
    n: int = 20,
    force: bool = False,
) -> FlashcardSet:
    """Return a FlashcardSet for the document.

    On cache hit: read from disk. On miss (or force): build + run the chain,
    bounds-check every card's ``grounded_chunks``, retry once with a stricter
    nudge if validation fails, persist on success.

    Raises
    ------
    FileNotFoundError
        If the document doesn't exist.
    RuntimeError
        If the chain produced no usable output after retry.
    """
    if not force:
        cached = load_flashcards(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    n = max(5, min(40, int(n)))

    # Distributed coalescing (best-effort, Redis). When Redis is up, concurrent
    # generations for this doc are serialized across workers by a short-lived
    # lock: the winner generates, losers wait and return the disk cache the
    # winner writes. If Redis is unconfigured/down/errors — or on force — we
    # fall straight through to the original in-process coalescing in
    # _generate_flashcards_local (unchanged). Never raises from Redis.
    if not force and is_redis_available():
        lock_key = f"lock:flashcard:{doc_id}"
        if await try_acquire_lock(lock_key, ttl=120):
            try:
                return await _generate_flashcards_local(doc_id, n, rag)
            finally:
                await release_lock(lock_key)
        # Lock held by another worker (or a transient Redis error): wait for
        # the winner's cached result. On miss/timeout, generate it ourselves.
        cached = await wait_for_lock_result(lock_key, lambda: load_flashcards(doc_id))
        if cached is not None:
            return cached

    return await _generate_flashcards_local(doc_id, n, rag)


async def _generate_flashcards_local(doc_id: str, n: int, rag) -> FlashcardSet:
    """In-process (single-worker) flashcard generation + coalescing.

    This is the original implementation, preserved verbatim as the fallback:
    it runs whenever Redis is unavailable, and is also the body executed by the
    Redis lock holder. ``n`` is already clamped and ``rag`` already validated by
    the caller.
    """
    key = ("flashcards", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut

    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Flashcards"

        chain = build_flashcard_chain(doc_id)

        attempts = 0
        last_reason = ""
        while attempts < 2:
            attempts += 1
            try:
                # ChatGroq's structured-output runnable is sync internally; run it
                # off the event loop so we never block the audio path.
                deck: FlashcardSet = await asyncio.to_thread(
                    chain.invoke,
                    {"n_cards": n, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("flashcards: attempt %d chain error: %s", attempts, exc)
                continue

            invalid = _validate_cards(deck.cards, n_chunks)
            if invalid:
                last_reason = invalid
                logger.warning(
                    "flashcards: attempt %d invalid (%s) — retrying once",
                    attempts, invalid,
                )
                continue

            # Persist + return
            try:
                _path(doc_id, "flashcards").write_text(
                    deck.model_dump_json(), encoding="utf-8"
                )
            except Exception:
                logger.exception("flashcards: failed to write cache for %s", doc_id)

            logger.info(
                "flashcards: generated doc=%s n=%d (asked=%d) chunks_seen=%d",
                doc_id, len(deck.cards), n, n_chunks,
            )
            fut.set_result(deck)
            return deck

        msg = f"flashcard generation failed after {attempts} attempts: {last_reason}"
        exc = RuntimeError(msg)
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


def _validate_cards(cards: list[Flashcard], n_chunks: int) -> str:
    """Return empty string on success, otherwise a human-readable reason."""
    if not cards:
        return "no cards produced"
    if n_chunks <= 0:
        # Document has no RAG chunks — odd, but don't fail validation on chunk
        # bounds. The card text itself is still potentially useful.
        return ""
    for i, c in enumerate(cards):
        if not c.grounded_chunks:
            return f"card[{i}] missing grounded_chunks"
        ok, reason = validate_grounded_indices(c.grounded_chunks, n_chunks)
        if not ok:
            return f"card[{i}]: {reason}"
    return ""


# ---------------------------------------------------------------------------
# Generic load/delete helpers — same on-disk shape for every Phase 7B feature


def _load_json_as(model_cls, doc_id: str, feature: str):
    p = _path(doc_id, feature)
    if not p.exists():
        return None
    try:
        return model_cls.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("revision: bad %s cache for %s", feature, doc_id)
        return None


def _delete_json(doc_id: str, feature: str) -> bool:
    p = _path(doc_id, feature)
    if not p.exists():
        return False
    try:
        p.unlink()
        return True
    except Exception:
        logger.exception("revision: failed to delete %s for %s", feature, doc_id)
        return False


def _validate_grounded_collection(
    items: list,
    n_chunks: int,
    item_label: str,
) -> str:
    """Validate that every item in a collection has bounds-valid
    `grounded_chunks`. Mirrors `_validate_cards` but for any list of
    GroundedOutput-derived models."""
    if not items:
        return f"no {item_label}s produced"
    if n_chunks <= 0:
        return ""
    for i, item in enumerate(items):
        gc = getattr(item, "grounded_chunks", None) or []
        if not gc:
            return f"{item_label}[{i}] missing grounded_chunks"
        ok, reason = validate_grounded_indices(gc, n_chunks)
        if not ok:
            return f"{item_label}[{i}]: {reason}"
    return ""


# ---------------------------------------------------------------------------
# quiz


def load_quiz(doc_id: str) -> QuizSet | None:
    return _load_json_as(QuizSet, doc_id, "quiz")


def delete_quiz(doc_id: str) -> bool:
    return _delete_json(doc_id, "quiz")


async def generate_quiz(
    doc_id: str,
    *,
    n: int = 12,
    force: bool = False,
) -> QuizSet:
    """Generate (or fetch cached) Quiz for the document."""
    if not force:
        cached = load_quiz(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    n = max(5, min(30, int(n)))
    key = ("quiz", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Quiz"
        chain = build_quiz_chain(doc_id)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                quiz: QuizSet = await asyncio.to_thread(
                    chain.invoke,
                    {"n": n, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("quiz: attempt %d chain error: %s", attempt, exc)
                continue

            invalid = _validate_grounded_collection(quiz.questions, n_chunks, "question")
            if invalid:
                last_reason = invalid
                logger.warning("quiz: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(doc_id, "quiz").write_text(quiz.model_dump_json(), encoding="utf-8")
            except Exception:
                logger.exception("quiz: failed to write cache for %s", doc_id)

            logger.info("quiz: generated doc=%s n=%d", doc_id, len(quiz.questions))
            fut.set_result(quiz)
            return quiz

        exc = RuntimeError(f"quiz generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


# ---------------------------------------------------------------------------
# active recall


def load_recall(doc_id: str) -> RecallSet | None:
    return _load_json_as(RecallSet, doc_id, "recall")


def delete_recall(doc_id: str) -> bool:
    return _delete_json(doc_id, "recall")


async def generate_recall(
    doc_id: str,
    *,
    n: int = 12,
    force: bool = False,
) -> RecallSet:
    if not force:
        cached = load_recall(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    n = max(5, min(30, int(n)))
    key = ("recall", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Active Recall"
        chain = build_recall_chain(doc_id)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                recall: RecallSet = await asyncio.to_thread(
                    chain.invoke,
                    {"n": n, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("recall: attempt %d chain error: %s", attempt, exc)
                continue

            invalid = _validate_grounded_collection(recall.prompts, n_chunks, "prompt")
            if invalid:
                last_reason = invalid
                logger.warning("recall: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(doc_id, "recall").write_text(recall.model_dump_json(), encoding="utf-8")
            except Exception:
                logger.exception("recall: failed to write cache for %s", doc_id)

            logger.info("recall: generated doc=%s n=%d", doc_id, len(recall.prompts))
            fut.set_result(recall)
            return recall

        exc = RuntimeError(f"recall generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


# ---------------------------------------------------------------------------
# quick revision


def load_quick_revision(doc_id: str) -> QuickRevisionSet | None:
    return _load_json_as(QuickRevisionSet, doc_id, "quick_revision")


def delete_quick_revision(doc_id: str) -> bool:
    return _delete_json(doc_id, "quick_revision")


async def generate_quick_revision(
    doc_id: str,
    *,
    max_topics: int = 8,
    force: bool = False,
) -> QuickRevisionSet:
    if not force:
        cached = load_quick_revision(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    max_topics = max(3, min(15, int(max_topics)))
    key = ("quick_revision", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Quick Revision"
        chain = build_quick_revision_chain(doc_id)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                qr: QuickRevisionSet = await asyncio.to_thread(
                    chain.invoke,
                    {"max_topics": max_topics, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("quick_revision: attempt %d chain error: %s", attempt, exc)
                continue

            invalid = _validate_grounded_collection(qr.topics, n_chunks, "topic")
            if invalid:
                last_reason = invalid
                logger.warning("quick_revision: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(doc_id, "quick_revision").write_text(
                    qr.model_dump_json(), encoding="utf-8"
                )
            except Exception:
                logger.exception("quick_revision: failed to write cache for %s", doc_id)

            logger.info("quick_revision: generated doc=%s topics=%d", doc_id, len(qr.topics))
            fut.set_result(qr)
            return qr

        exc = RuntimeError(f"quick_revision generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


# ---------------------------------------------------------------------------
# night before exam


def load_night_before(doc_id: str) -> NightBeforeSet | None:
    return _load_json_as(NightBeforeSet, doc_id, "night_before")


def delete_night_before(doc_id: str) -> bool:
    return _delete_json(doc_id, "night_before")


async def generate_night_before(
    doc_id: str,
    *,
    n: int = 25,
    force: bool = False,
) -> NightBeforeSet:
    if not force:
        cached = load_night_before(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    n = max(10, min(50, int(n)))
    key = ("night_before", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Night Before"
        chain = build_night_before_chain(doc_id)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                nb: NightBeforeSet = await asyncio.to_thread(
                    chain.invoke,
                    {"n": n, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("night_before: attempt %d chain error: %s", attempt, exc)
                continue

            invalid = _validate_grounded_collection(nb.items, n_chunks, "item")
            if invalid:
                last_reason = invalid
                logger.warning("night_before: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(doc_id, "night_before").write_text(
                    nb.model_dump_json(), encoding="utf-8"
                )
            except Exception:
                logger.exception("night_before: failed to write cache for %s", doc_id)

            logger.info("night_before: generated doc=%s items=%d", doc_id, len(nb.items))
            fut.set_result(nb)
            return nb

        exc = RuntimeError(f"night_before generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


# ---------------------------------------------------------------------------
# viva


def load_viva(doc_id: str) -> VivaSet | None:
    return _load_json_as(VivaSet, doc_id, "viva")


def delete_viva(doc_id: str) -> bool:
    return _delete_json(doc_id, "viva")


async def generate_viva(
    doc_id: str,
    *,
    n: int = 12,
    force: bool = False,
) -> VivaSet:
    if not force:
        cached = load_viva(doc_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")

    n = max(5, min(30, int(n)))
    key = ("viva", doc_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        n_chunks = rag.n_rag_chunks(doc_id)
        title = rag.get_meta(doc_id).get("title") or "Viva"
        chain = build_viva_chain(doc_id)

        last_reason = ""
        for attempt in range(1, 3):
            try:
                viva: VivaSet = await asyncio.to_thread(
                    chain.invoke,
                    {"n": n, "title": title},
                )
            except Exception as exc:
                last_reason = f"chain error: {exc}"
                logger.warning("viva: attempt %d chain error: %s", attempt, exc)
                continue

            invalid = _validate_grounded_collection(viva.questions, n_chunks, "question")
            if invalid:
                last_reason = invalid
                logger.warning("viva: attempt %d invalid (%s)", attempt, invalid)
                continue

            try:
                _path(doc_id, "viva").write_text(viva.model_dump_json(), encoding="utf-8")
            except Exception:
                logger.exception("viva: failed to write cache for %s", doc_id)

            logger.info("viva: generated doc=%s questions=%d", doc_id, len(viva.questions))
            fut.set_result(viva)
            return viva

        exc = RuntimeError(f"viva generation failed: {last_reason}")
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


__all__ = [
    "generate_flashcards", "load_flashcards", "delete_flashcards",
    "generate_quiz", "load_quiz", "delete_quiz",
    "generate_recall", "load_recall", "delete_recall",
    "generate_quick_revision", "load_quick_revision", "delete_quick_revision",
    "generate_night_before", "load_night_before", "delete_night_before",
    "generate_viva", "load_viva", "delete_viva",
]
