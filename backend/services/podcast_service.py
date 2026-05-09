"""Podcast generation: takes a doc, asks Groq for a host/guest dialogue,
caches both the script and the per-turn synthesized audio so re-listens are
cheap and instant.

Storage:
  storage/podcast/{doc_id}.json                 — the script (list of turns)
  storage/podcast/{doc_id}/turn_NNN.mp3         — TTS audio for turn N
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import AsyncIterator, Iterable

from backend.config.settings import get_settings
from backend.config.voices import voice_for
from backend.services.groq_service import get_groq
from backend.services.rag_service import get_rag
from backend.services.tts_service import TtsError, get_tts

logger = logging.getLogger(__name__)

VALID_SPEAKERS = ("host", "guest")
MAX_TURNS = 32


@dataclass
class PodcastTurn:
    speaker: str
    text: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PodcastScript:
    doc_id: str
    title: str
    turns: list[PodcastTurn]

    def to_dict(self) -> dict:
        return {"doc_id": self.doc_id, "title": self.title, "turns": [t.to_dict() for t in self.turns]}

    @property
    def char_count(self) -> int:
        return sum(len(t.text) for t in self.turns)


def _root() -> Path:
    p = get_settings().storage_path / "podcast"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _script_path(doc_id: str) -> Path:
    return _root() / f"{doc_id}.json"


def _voice_fingerprint() -> str:
    """A short stable hash of the (host, guest) voice pair. Cache paths embed
    this so a voice change naturally invalidates old per-turn audio files."""
    import hashlib
    s = get_settings()
    pair = f"{s.elevenlabs_voice_id}|{s.elevenlabs_guest_voice_id or s.elevenlabs_voice_id}"
    return hashlib.sha1(pair.encode("utf-8")).hexdigest()[:10]


def _turn_dir(doc_id: str) -> Path:
    p = _root() / doc_id / _voice_fingerprint()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _turn_path(doc_id: str, idx: int) -> Path:
    return _turn_dir(doc_id) / f"turn_{idx:03d}.mp3"


def all_turn_paths(doc_id: str, n_turns: int) -> list[Path]:
    """Convenience for prefetch + manifest endpoints."""
    return [_turn_path(doc_id, i) for i in range(n_turns)]


def _extract_turns(raw: str) -> list[dict]:
    """Tolerate either ``{"turns": [...]}`` (response_format=json_object) or a
    bare ``[...]`` array, with or without ```json fences."""
    raw = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", raw, re.DOTALL)
    if fence:
        raw = fence.group(1).strip()

    # Try strict JSON first.
    parsed = None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fall through to bracket-extraction.
        pass

    if parsed is None:
        # Look for a top-level array.
        start = raw.find("[")
        end = raw.rfind("]")
        if start != -1 and end > start:
            try:
                parsed = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                # Last resort: a top-level object that *contains* an array.
                obj_start = raw.find("{")
                obj_end = raw.rfind("}")
                if obj_start != -1 and obj_end > obj_start:
                    parsed = json.loads(raw[obj_start : obj_end + 1])

    if parsed is None:
        raise ValueError("no JSON found in model output")

    if isinstance(parsed, dict):
        # Common keys: turns, dialogue, script, episode
        for key in ("turns", "dialogue", "script", "episode", "podcast"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        # Some models nest one extra level.
        for v in parsed.values():
            if isinstance(v, list):
                return v
        raise ValueError("JSON object did not contain a list of turns")

    if isinstance(parsed, list):
        return parsed

    raise ValueError(f"unexpected JSON shape: {type(parsed).__name__}")


def _parse_script(doc_id: str, title: str, raw: str) -> PodcastScript:
    arr = _extract_turns(raw)
    turns: list[PodcastTurn] = []
    for entry in arr[:MAX_TURNS]:
        if not isinstance(entry, dict):
            continue
        speaker = str(entry.get("speaker", "")).strip().lower()
        text = str(entry.get("text", "")).strip()
        if not text:
            continue
        if speaker not in VALID_SPEAKERS:
            # tolerate "co-host" or "expert" etc by mapping unknown → guest
            speaker = "host" if speaker.startswith("h") else "guest"
        turns.append(PodcastTurn(speaker=speaker, text=text))
    if not turns:
        raise ValueError("podcast script had no usable turns")
    return PodcastScript(doc_id=doc_id, title=title, turns=turns)


# ---------------------------------------------------------------------------
# public API


def script_exists(doc_id: str) -> bool:
    return _script_path(doc_id).exists()


def load_script(doc_id: str) -> PodcastScript | None:
    p = _script_path(doc_id)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        turns = [PodcastTurn(speaker=t["speaker"], text=t["text"]) for t in data.get("turns", [])]
        return PodcastScript(doc_id=data["doc_id"], title=data.get("title", ""), turns=turns)
    except Exception:
        logger.exception("failed to load cached podcast script %s", doc_id)
        return None


async def generate_script(doc_id: str, *, force: bool = False) -> PodcastScript:
    """Generate (or load) the podcast script for a document.

    Caches to disk; subsequent calls return the cached script unless force=True.
    """
    if not force:
        existing = load_script(doc_id)
        if existing is not None:
            return existing

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")
    meta = rag.get_meta(doc_id)
    title = meta.get("title") or "Untitled"

    # Use the RAG chunks (they're slightly larger and more contextual than
    # narration chunks). Cap total context to keep the LLM call fast.
    notes_path = get_settings().storage_path / "rag" / doc_id / "chunks.json"
    if not notes_path.exists():
        raise FileNotFoundError(f"chunks.json missing for {doc_id}")
    chunks_obj = json.loads(notes_path.read_text(encoding="utf-8"))
    notes = chunks_obj.get("rag") or chunks_obj.get("narration") or []
    # cap to ~12k chars of context — plenty for short docs, truncated for long ones
    capped: list[str] = []
    total = 0
    for n in notes:
        if total + len(n) > 12000:
            break
        capped.append(n)
        total += len(n)

    raw = await get_groq().generate_podcast(title=title, notes=capped)
    try:
        script = _parse_script(doc_id, title, raw)
    except Exception as exc:
        logger.exception("failed to parse podcast script for %s: %s", doc_id, exc)
        raise

    _script_path(doc_id).write_text(json.dumps(script.to_dict(), ensure_ascii=False), encoding="utf-8")
    logger.info("podcast: generated %d turns for doc=%s (%d chars total)", len(script.turns), doc_id, script.char_count)
    return script


async def synthesize_turn(doc_id: str, idx: int, turn: PodcastTurn) -> AsyncIterator[bytes]:
    """Yield MP3 chunks for a turn. Caches the assembled audio on first run."""
    cache_path = _turn_path(doc_id, idx)
    if cache_path.exists():
        # serve cached file in 16KB chunks
        data = cache_path.read_bytes()
        for i in range(0, len(data), 16 * 1024):
            yield data[i : i + 16 * 1024]
        return

    voice = voice_for(turn.speaker)
    buffer = bytearray()
    tts = get_tts()
    try:
        async for chunk in tts.synthesize_stream(turn.text, voice_id=voice):
            buffer.extend(chunk)
            yield bytes(chunk)
    except TtsError as exc:
        logger.warning("podcast turn %d failed: %s", idx, exc)
        raise

    # write cache only if we got something coherent
    if len(buffer) > 256:
        try:
            cache_path.write_bytes(bytes(buffer))
        except Exception:
            logger.exception("failed to cache podcast turn %d", idx)


# In-process per-(doc, idx, voice_fp) locks so two concurrent prefetches don't
# both hit ElevenLabs.
_INFLIGHT_TURNS: dict[tuple[str, int, str], asyncio.Future] = {}


async def ensure_turn_audio(doc_id: str, idx: int) -> bytes:
    """Return the MP3 bytes for a turn, synthesizing + caching if missing.

    Used by the HTTP audio route so the browser <audio> element can fetch the
    full file. Coalesces concurrent requests for the same turn.
    """
    cache_path = _turn_path(doc_id, idx)
    if cache_path.exists():
        return cache_path.read_bytes()

    script = load_script(doc_id)
    if script is None or idx < 0 or idx >= len(script.turns):
        raise FileNotFoundError(f"podcast turn {idx} not found for doc {doc_id}")

    key = (doc_id, idx, _voice_fingerprint())
    inflight = _INFLIGHT_TURNS.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT_TURNS[key] = fut
    try:
        turn = script.turns[idx]
        voice = voice_for(turn.speaker)
        tts = get_tts()
        buffer = bytearray()
        async for chunk in tts.synthesize_stream(turn.text, voice_id=voice):
            buffer.extend(chunk)
        if len(buffer) <= 256:
            raise RuntimeError(f"TTS produced no audio for turn {idx}")
        audio = bytes(buffer)
        try:
            cache_path.write_bytes(audio)
        except Exception:
            logger.exception("failed to cache podcast turn %d", idx)
        fut.set_result(audio)
        return audio
    except Exception as exc:
        fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT_TURNS.pop(key, None)


def spawn_prefetch_turns(doc_id: str, indices: Iterable[int]) -> asyncio.Task:
    """Background prefetch of multiple podcast turns."""
    indices = list(indices)
    sem = asyncio.Semaphore(2)

    async def _one(i: int) -> None:
        async with sem:
            try:
                await ensure_turn_audio(doc_id, i)
                logger.info("podcast: prefetched turn %d for doc %s", i, doc_id)
            except Exception as exc:
                logger.warning("podcast: prefetch turn %d failed: %s", i, exc)

    async def _run() -> None:
        await asyncio.gather(*(_one(i) for i in indices), return_exceptions=True)

    return asyncio.create_task(_run())


def estimated_chars(script: PodcastScript) -> int:
    return script.char_count
