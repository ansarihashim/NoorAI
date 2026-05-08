"""Per-WebSocket session orchestrator.

Owns the finite state machine that drives EchoVerse:

    IDLE
     │  start_narration(doc_id)
     ▼
    NARRATING ── VAD speech_start ──► INTERRUPTED
     ▲                                   │  utterance_end
     │                                   ▼
     │                                THINKING (Whisper → RAG → Groq)
     │                                   │
     │                                   ▼
     │                                SPEAKING_ANSWER (TTS stream)
     └─────────── resume from cursor ────┘

Public surface (used by routes/audio.py):
    sess = Session(send_json, send_bytes)
    await sess.start_narration(doc_id)
    sess.feed_audio(pcm_bytes)            # 30ms VAD frames inside
    await sess.stop()
"""
from __future__ import annotations

import asyncio
import logging
from enum import Enum
from typing import Awaitable, Callable

from backend.services.groq_service import get_groq
from backend.services.rag_service import get_rag
from backend.services.tts_service import get_tts
from backend.services.whisper_service import get_whisper
from backend.utils.audio_utils import FRAME_BYTES
from backend.utils.vad import UtteranceDetector, VadEvent

logger = logging.getLogger(__name__)


class State(str, Enum):
    IDLE = "idle"
    NARRATING = "narrating"
    INTERRUPTED = "interrupted"
    THINKING = "thinking"
    SPEAKING_ANSWER = "speaking"


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
        self._history: list[dict] = []

        self._playback_task: asyncio.Task | None = None
        self._vad = UtteranceDetector(aggressiveness=2, speech_start_ms=150, silence_end_ms=700)
        self._mic_buf = bytearray()
        self._mic_lock = asyncio.Lock()

    # ---- public ----
    async def start_narration(self, doc_id: str) -> None:
        rag = get_rag()
        if not rag.exists(doc_id):
            await self._send_json({"type": "error", "message": f"doc not found: {doc_id}"})
            return
        self._doc_id = doc_id
        self._narration = rag.get_narration(doc_id)
        self._cursor = 0
        self._history.clear()
        self._vad.reset()
        await self._enter(State.NARRATING)
        self._spawn_narration()

    async def stop(self) -> None:
        await self._cancel_playback()
        await self._enter(State.IDLE)

    async def resume(self) -> None:
        if self._state != State.IDLE or not self._narration or self._cursor >= len(self._narration):
            return
        await self._enter(State.NARRATING)
        self._spawn_narration()

    def feed_audio(self, pcm: bytes) -> None:
        """Append mic audio. VAD runs synchronously; STT runs in background."""
        self._mic_buf.extend(pcm)
        # Drain whole 30ms frames
        while len(self._mic_buf) >= FRAME_BYTES:
            frame = bytes(self._mic_buf[:FRAME_BYTES])
            del self._mic_buf[:FRAME_BYTES]
            event = self._vad.feed(frame)
            if event == VadEvent.SPEECH_START:
                asyncio.create_task(self._on_speech_start())
            elif event == VadEvent.UTTERANCE_END:
                audio = self._vad.flush()
                asyncio.create_task(self._on_utterance(audio))

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

    # ---- interruption ----
    async def _on_speech_start(self) -> None:
        if self._state != State.NARRATING:
            return
        await self._cancel_playback()
        await self._send_json({"type": "flush_audio"})
        await self._enter(State.INTERRUPTED)

    async def _on_utterance(self, audio: bytes) -> None:
        # Allow interruption during NARRATING (transitioning) or INTERRUPTED
        if self._state not in (State.INTERRUPTED, State.NARRATING):
            return
        await self._enter(State.THINKING)
        try:
            text = await get_whisper().transcribe(audio)
            text = text.strip()
            if not text:
                # noise — return to narration
                await self._enter(State.IDLE)
                await self.resume()
                return
            await self._send_json({"type": "transcript", "role": "user", "text": text})
            await self._answer_and_speak(text)
        finally:
            # always try to resume narration after a Q&A turn
            if self._state != State.NARRATING:
                await self.resume()

    async def _answer_and_speak(self, question: str) -> None:
        rag = get_rag()
        chunks = rag.retrieve(self._doc_id, question, k=4) if self._doc_id else []
        groq = get_groq()
        tts = get_tts()

        # Stream tokens, accumulate, but synthesize the full answer once
        # (ElevenLabs streams within the synth call itself).
        deltas: list[str] = []
        async for d in groq.answer(question, chunks, history=self._history):
            deltas.append(d)
        answer_text = "".join(deltas).strip()
        if not answer_text:
            answer_text = "I couldn't find that in your notes."

        self._history.append({"role": "user", "content": question})
        self._history.append({"role": "assistant", "content": answer_text})
        await self._send_json({"type": "transcript", "role": "assistant", "text": answer_text})

        await self._enter(State.SPEAKING_ANSWER)
        try:
            async for audio in tts.synthesize_stream(answer_text):
                await self._send_bytes(audio)
        except Exception as exc:
            logger.exception("answer TTS failed")
            await self._send_json({"type": "error", "message": f"tts failed: {exc}"})

    # ---- helpers ----
    async def _cancel_playback(self) -> None:
        if self._playback_task and not self._playback_task.done():
            self._playback_task.cancel()
            try:
                await self._playback_task
            except (asyncio.CancelledError, Exception):
                pass
        self._playback_task = None
