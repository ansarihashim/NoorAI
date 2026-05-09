"""Narration audio service — per-chunk MP3 cache + rolling prefetch.

Mirrors the layout of `podcast_service` so the two surfaces look the same to
the HTTP layer:

  storage/narration/{doc_id}/{voice_fingerprint}/chunk_NNN.mp3

The voice fingerprint is the SHA-1 prefix of the active narrator voice ID, so
swapping voices automatically uses a fresh cache rather than serving stale
audio. Old fingerprint directories remain on disk (cheap, can be GC'd later).

Public API:

    chunk_audio_path(doc_id, idx, voice_id=None) -> Path
        Path the chunk's MP3 *would* live at — caller checks .exists() / reads.

    async ensure_chunk_audio(doc_id, idx, voice_id=None) -> bytes
        Return the chunk's MP3 bytes, synthesizing + caching if missing.
        If a render is already in flight, await that one instead of starting
        a duplicate.

    spawn_prefetch(doc_id, indices, voice_id=None) -> asyncio.Task
        Fire-and-forget prefetch of multiple chunks in parallel (capped).

    chunk_text(doc_id, idx) -> str | None
        Look up a chunk's text from the RAG store (no audio side effects).

The audio is generated lazily — first hit synthesizes via the existing
TTS service. Subsequent hits read from disk. A small in-process lock dict
prevents duplicate parallel synthesis of the same chunk.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from pathlib import Path
from typing import Iterable

from backend.config.settings import get_settings
from backend.services.tts_service import get_tts

logger = logging.getLogger(__name__)


# At most this many chunks may render in parallel for a single document.
# Higher values eat ElevenLabs concurrency budget and rarely help perceived UX.
_PREFETCH_CONCURRENCY = 2

# In-process per-(doc, voice, idx) locks so two concurrent requests for the
# same un-rendered chunk don't both hit the TTS provider.
_INFLIGHT: dict[tuple[str, str, int], asyncio.Future] = {}


def _voice_fingerprint(voice_id: str | None = None) -> str:
    s = get_settings()
    vid = voice_id or s.elevenlabs_voice_id or "default"
    return hashlib.sha1(vid.encode("utf-8")).hexdigest()[:10]


def _root() -> Path:
    p = get_settings().storage_path / "narration"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _chunk_dir(doc_id: str, voice_id: str | None = None) -> Path:
    p = _root() / doc_id / _voice_fingerprint(voice_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


def chunk_audio_path(doc_id: str, idx: int, voice_id: str | None = None) -> Path:
    return _chunk_dir(doc_id, voice_id) / f"chunk_{idx:04d}.mp3"


def chunk_text(doc_id: str, idx: int) -> str | None:
    """Read narration chunk text from the RAG store. Cheap (one JSON read).

    Returns None if the doc or chunk doesn't exist.
    """
    chunks_path = get_settings().storage_path / "rag" / doc_id / "chunks.json"
    if not chunks_path.exists():
        return None
    try:
        data = json.loads(chunks_path.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("narration: bad chunks.json for %s", doc_id)
        return None
    narration = data.get("narration") or []
    if 0 <= idx < len(narration):
        return narration[idx]
    return None


def chunk_count(doc_id: str) -> int:
    chunks_path = get_settings().storage_path / "rag" / doc_id / "chunks.json"
    if not chunks_path.exists():
        return 0
    try:
        data = json.loads(chunks_path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    return len(data.get("narration") or [])


async def ensure_chunk_audio(
    doc_id: str, idx: int, voice_id: str | None = None
) -> bytes:
    """Return the MP3 bytes for a chunk, synthesizing if not yet cached."""
    path = chunk_audio_path(doc_id, idx, voice_id)
    if path.exists():
        return path.read_bytes()

    fingerprint = _voice_fingerprint(voice_id)
    key = (doc_id, fingerprint, idx)

    # Coalesce concurrent requests for the same chunk.
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        audio = await _synthesize_and_cache(doc_id, idx, voice_id, path)
        fut.set_result(audio)
        return audio
    except Exception as exc:
        fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)


async def _synthesize_and_cache(
    doc_id: str,
    idx: int,
    voice_id: str | None,
    path: Path,
) -> bytes:
    text = chunk_text(doc_id, idx)
    if text is None:
        raise FileNotFoundError(f"narration chunk {idx} not found for doc {doc_id}")

    tts = get_tts()
    buffer = bytearray()
    async for chunk in tts.synthesize_stream(text, voice_id=voice_id):
        buffer.extend(chunk)

    if len(buffer) <= 256:
        # something went wrong; raise so caller can retry / show error.
        raise RuntimeError(f"TTS produced no audio for chunk {idx}")

    audio = bytes(buffer)
    try:
        path.write_bytes(audio)
    except Exception:
        # cache write failure is non-fatal — we still have the bytes in memory.
        logger.exception("narration: failed to cache chunk %d for doc %s", idx, doc_id)
    return audio


async def _prefetch_one(doc_id: str, idx: int, voice_id: str | None, sem: asyncio.Semaphore) -> None:
    async with sem:
        try:
            await ensure_chunk_audio(doc_id, idx, voice_id)
            logger.info("narration: prefetched chunk %d for doc %s", idx, doc_id)
        except Exception as exc:
            logger.warning("narration: prefetch failed for chunk %d: %s", idx, exc)


def spawn_prefetch(
    doc_id: str,
    indices: Iterable[int],
    voice_id: str | None = None,
) -> asyncio.Task:
    """Fire-and-forget background prefetch of N narration chunks."""
    indices = list(indices)
    sem = asyncio.Semaphore(_PREFETCH_CONCURRENCY)

    async def _run() -> None:
        await asyncio.gather(
            *(_prefetch_one(doc_id, i, voice_id, sem) for i in indices),
            return_exceptions=True,
        )

    return asyncio.create_task(_run())
