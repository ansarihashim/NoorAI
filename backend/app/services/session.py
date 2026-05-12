"""Per-WebSocket session orchestrator.

Drives the two server-pushed audio modes that survive in the current
product: narration streaming and podcast playback.

States::

    IDLE
     │  start_narration(doc_id)
     ▼
    NARRATING ── stop() ──► IDLE

    IDLE
     │  start_podcast(doc_id)
     ▼
    PODCAST_GENERATING (or skipped if cached)
     │
     ▼
    PODCAST_PLAYING
     │
     ▼
    IDLE

Voice barge-in (Whisper + VAD + interruption FSM) was removed from the
product — narration is now a one-way listen experience and the frontend
no longer opens the mic. The ``feed_audio`` entry point and every
INTERRUPTED/THINKING/SPEAKING_ANSWER transition are gone.

Public surface (used by routes/audio.py):
    sess = Session(send_json, send_bytes)
    await sess.start_narration(doc_id)
    await sess.start_podcast(doc_id)
    await sess.stop()
"""
from __future__ import annotations

import asyncio
import logging
from enum import Enum
from typing import Awaitable, Callable

from app.services.podcast import (
    PodcastScript,
    generate_script as podcast_generate_script,
    synthesize_turn as podcast_synthesize_turn,
)
from app.rag.service import get_rag
from app.services.tts import get_tts

logger = logging.getLogger(__name__)


class State(str, Enum):
    IDLE = "idle"
    NARRATING = "narrating"            # server-driven narration playback
    PODCAST_GENERATING = "podcast_generating"
    PODCAST_PLAYING = "podcast_playing"


SendJson = Callable[[dict], Awaitable[None]]
SendBytes = Callable[[bytes], Awaitable[None]]


class Session:
    def __init__(self, send_json: SendJson, send_bytes: SendBytes) -> None:
        self._send_json = send_json
        self._send_bytes = send_bytes

        self._state: State = State.IDLE
        self._doc_id: str | None = None
        self._narration: list[str] = []
        self._cursor: int = 0

        self._playback_task: asyncio.Task | None = None

    # ---- public ----
    async def start_narration(self, doc_id: str) -> None:
        rag = get_rag()
        if not rag.exists(doc_id):
            await self._send_json({"type": "error", "message": f"doc not found: {doc_id}"})
            return
        self._doc_id = doc_id
        self._narration = rag.get_narration(doc_id)
        self._cursor = 0
        await self._enter(State.NARRATING)
        self._spawn_narration()

    async def start_podcast(self, doc_id: str) -> None:
        rag = get_rag()
        if not rag.exists(doc_id):
            await self._send_json({"type": "error", "message": f"doc not found: {doc_id}"})
            return
        self._doc_id = doc_id
        await self._cancel_playback()
        await self._enter(State.PODCAST_GENERATING)
        self._playback_task = asyncio.create_task(self._run_podcast(doc_id))

    async def stop(self) -> None:
        await self._cancel_playback()
        await self._enter(State.IDLE)

    async def resume(self) -> None:
        if self._state != State.IDLE or not self._narration or self._cursor >= len(self._narration):
            return
        await self._enter(State.NARRATING)
        self._spawn_narration()

    # ---- FSM transitions ----
    async def _enter(self, new: State) -> None:
        if new == self._state:
            return
        self._state = new
        await self._send_json({"type": "state", "value": new.value, "cursor": self._cursor})
        logger.info("session state -> %s (cursor=%s)", new.value, self._cursor)

    # ---- narration loop ----
    def _spawn_narration(self) -> None:
        self._playback_task = asyncio.create_task(self._narrate())

    async def _narrate(self) -> None:
        tts = get_tts()
        try:
            while self._cursor < len(self._narration) and self._state == State.NARRATING:
                chunk_idx = self._cursor
                text = self._narration[chunk_idx]
                await self._send_json(
                    {"type": "transcript", "role": "narrator", "text": text, "chunk_idx": chunk_idx}
                )
                async for audio in tts.synthesize_stream(text):
                    if self._state != State.NARRATING:
                        return
                    await self._send_bytes(audio)
                # advance only after the chunk fully streamed
                self._cursor += 1
                await self._send_json({"type": "narration_cursor", "chunk_idx": self._cursor})

            if self._cursor >= len(self._narration) and self._state == State.NARRATING:
                await self._send_json({"type": "narration_done"})
                await self._enter(State.IDLE)
        except asyncio.CancelledError:
            logger.info("narration cancelled at chunk=%s", self._cursor)
            raise
        except Exception as exc:
            logger.exception("narration failed")
            await self._send_json({"type": "error", "message": f"narration failed: {exc}"})

    # ---- podcast loop ----
    async def _run_podcast(self, doc_id: str) -> None:
        try:
            try:
                script: PodcastScript = await podcast_generate_script(doc_id)
            except Exception as exc:
                logger.exception("podcast generation failed")
                await self._send_json({"type": "error", "message": f"podcast generation failed: {exc}"})
                await self._enter(State.IDLE)
                return

            await self._send_json(
                {
                    "type": "podcast_ready",
                    "doc_id": doc_id,
                    "title": script.title,
                    "n_turns": len(script.turns),
                    "turns": [t.to_dict() for t in script.turns],
                }
            )
            await self._enter(State.PODCAST_PLAYING)

            for idx, turn in enumerate(script.turns):
                if self._state != State.PODCAST_PLAYING:
                    return
                await self._send_json(
                    {
                        "type": "podcast_turn",
                        "turn_idx": idx,
                        "speaker": turn.speaker,
                        "text": turn.text,
                    }
                )
                async for audio in podcast_synthesize_turn(doc_id, idx, turn):
                    if self._state != State.PODCAST_PLAYING:
                        return
                    await self._send_bytes(audio)

            if self._state == State.PODCAST_PLAYING:
                await self._send_json({"type": "podcast_done"})
                await self._enter(State.IDLE)
        except asyncio.CancelledError:
            logger.info("podcast cancelled")
            raise
        except Exception as exc:
            logger.exception("podcast playback failed")
            await self._send_json({"type": "error", "message": f"podcast failed: {exc}"})

    # ---- helpers ----
    async def _cancel_playback(self) -> None:
        if self._playback_task and not self._playback_task.done():
            self._playback_task.cancel()
            try:
                await self._playback_task
            except (asyncio.CancelledError, Exception):
                pass
        self._playback_task = None
