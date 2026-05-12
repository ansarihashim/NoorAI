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

  Or, separately:
    IDLE
     │  start_podcast(doc_id)
     ▼
    PODCAST_GENERATING (or skipped if cached)
     │
     ▼
    PODCAST_PLAYING (multi-voice TTS, non-interruptible)
     │
     ▼
    IDLE

Public surface (used by routes/audio.py):
    sess = Session(send_json, send_bytes)
    await sess.start_narration(doc_id)
    await sess.start_podcast(doc_id)
    sess.feed_audio(pcm_bytes)            # 30ms VAD frames inside
    await sess.stop()
"""
from __future__ import annotations

import asyncio
import logging
from enum import Enum
from typing import Awaitable, Callable

from app.services.groq import get_groq
from app.services.podcast import (
    PodcastScript,
    generate_script as podcast_generate_script,
    synthesize_turn as podcast_synthesize_turn,
)
from app.rag.service import get_rag
from app.services.tts import get_tts
from app.services.whisper import get_whisper
from app.utils.audio_utils import FRAME_BYTES
from app.utils.vad import UtteranceDetector, UtteranceStats, VadEvent

# Words below this count → treat as noise/false-trigger and auto-resume silently.
MIN_USEFUL_WORDS = 2

# Hard ceilings so a stalled Whisper/Groq/TTS call can never leave the session
# wedged in THINKING/SPEAKING forever. If any stage exceeds its budget we
# raise → the outer try/finally returns the session to ATTENDING and tells
# the client what happened.
_WHISPER_TIMEOUT_S = 45.0
_ANSWER_TIMEOUT_S = 60.0

logger = logging.getLogger(__name__)


class State(str, Enum):
    IDLE = "idle"
    NARRATING = "narrating"            # legacy: server-driven narration playback
    ATTENDING = "attending"            # new: client drives HTTP audio, server only listens for interruptions
    INTERRUPTED = "interrupted"
    THINKING = "thinking"
    SPEAKING_ANSWER = "speaking"
    PODCAST_GENERATING = "podcast_generating"
    PODCAST_PLAYING = "podcast_playing"


SendJson = Callable[[dict], Awaitable[None]]
SendBytes = Callable[[bytes], Awaitable[None]]


# Minimum length of a "sentence" we'll send to TTS. Below this, we keep
# buffering — protects against abbreviations like "U.S." or "i.e." being
# spoken as standalone sentences.
_MIN_SENTENCE_CHARS = 18
# For the very FIRST chunk of audio in a reply we lower the bar to a clause
# break (comma / em-dash / colon) so the user hears something within ~600-
# 900 ms of asking instead of waiting for a full sentence boundary.
_FIRST_CHUNK_MIN_CHARS = 12
_CLAUSE_BREAKS = set(".!?,;:—–")


def _split_first_sentence(
    buf: str,
    force: bool = False,
    *,
    allow_clause: bool = False,
) -> tuple[str, str]:
    """Return (sentence, remainder) if buf has a complete sentence, else ('', buf).

    A complete sentence is text ending in `.`, `!`, or `?` followed by
    whitespace (or, when ``force`` is True, the entire remaining buffer).
    Boundaries with fewer than ``_MIN_SENTENCE_CHARS`` of leading text are
    skipped so common abbreviations don't get spoken in pieces.

    When ``allow_clause`` is True (used for the FIRST audio chunk only), any
    of ``.!?,;:—–`` followed by whitespace counts and the minimum length
    drops to ``_FIRST_CHUNK_MIN_CHARS`` — this is what lets the answer start
    speaking before the model has finished its first full sentence.
    """
    if not buf:
        return ("", buf)
    boundary_chars = _CLAUSE_BREAKS if allow_clause else {".", "!", "?"}
    min_chars = _FIRST_CHUNK_MIN_CHARS if allow_clause else _MIN_SENTENCE_CHARS
    for i, ch in enumerate(buf):
        if ch in boundary_chars:
            after = i + 1
            if after < len(buf) and buf[after].isspace():
                candidate = buf[: after].strip()
                if len(candidate) >= min_chars:
                    return (candidate, buf[after:].lstrip())
    if force:
        stripped = buf.strip()
        return (stripped, "") if stripped else ("", "")
    return ("", buf)


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
        # Tuned for fewer false positives — see backend/utils/vad.py for rationale.
        self._vad = UtteranceDetector(
            aggressiveness=2,
            speech_start_ms=250,
            silence_end_ms=700,
            energy_floor=0.012,
        )
        self._mic_buf = bytearray()
        self._mic_lock = asyncio.Lock()
        # Most recent interruption stats — surfaced to the client on auto-resume.
        self._last_interrupt_reason: str | None = None

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

    async def start_podcast(self, doc_id: str) -> None:
        rag = get_rag()
        if not rag.exists(doc_id):
            await self._send_json({"type": "error", "message": f"doc not found: {doc_id}"})
            return
        self._doc_id = doc_id
        # Cancel any current playback first.
        await self._cancel_playback()
        await self._enter(State.PODCAST_GENERATING)
        self._playback_task = asyncio.create_task(self._run_podcast(doc_id))

    async def start_attend(self, doc_id: str) -> None:
        """Enter listen-only mode: client controls HTTP audio playback;
        server runs VAD + Q&A only. No narration loop is spawned."""
        rag = get_rag()
        if not rag.exists(doc_id):
            await self._send_json({"type": "error", "message": f"doc not found: {doc_id}"})
            return
        await self._cancel_playback()
        self._doc_id = doc_id
        # Don't load narration list — the client owns position now.
        self._history.clear()
        self._vad.reset()
        await self._enter(State.ATTENDING)

    async def stop(self) -> None:
        await self._cancel_playback()
        await self._enter(State.IDLE)

    async def resume(self) -> None:
        if self._state != State.IDLE or not self._narration or self._cursor >= len(self._narration):
            return
        await self._enter(State.NARRATING)
        self._spawn_narration()

    def feed_audio(self, pcm: bytes) -> None:
        """Append mic audio. VAD runs synchronously; STT runs in background.
        Ignored during podcast playback (podcast is not interruptible by design)
        and when truly idle."""
        if self._state in (State.IDLE, State.PODCAST_GENERATING, State.PODCAST_PLAYING):
            return
        self._mic_buf.extend(pcm)
        # Drain whole 30ms frames
        while len(self._mic_buf) >= FRAME_BYTES:
            frame = bytes(self._mic_buf[:FRAME_BYTES])
            del self._mic_buf[:FRAME_BYTES]
            event = self._vad.feed(frame)
            if event == VadEvent.SPEECH_START:
                asyncio.create_task(self._on_speech_start())
            elif event == VadEvent.UTTERANCE_END:
                audio, stats = self._vad.flush_with_stats()
                asyncio.create_task(self._on_utterance(audio, stats))

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

    # ---- interruption ----
    async def _on_speech_start(self) -> None:
        if self._state not in (State.NARRATING, State.ATTENDING):
            return
        await self._cancel_playback()
        await self._send_json({"type": "flush_audio"})
        await self._enter(State.INTERRUPTED)

    async def _on_utterance(self, audio: bytes, stats: UtteranceStats) -> None:
        # Allow interruption during NARRATING / ATTENDING (transitioning) or INTERRUPTED
        if self._state not in (State.INTERRUPTED, State.NARRATING, State.ATTENDING):
            return

        # Energy/duration heuristic — if the captured audio looks like noise,
        # don't even bother Whisper; auto-resume narration silently with a
        # clear UI reason so the user understands what just happened.
        if stats.likely_noise:
            self._last_interrupt_reason = (
                f"That sounded like background noise (peak={stats.peak_rms:.2f}, "
                f"{stats.duration_ms} ms) — resuming narration."
            )
            logger.info(
                "interruption auto-resumed: noise (peak=%.3f, dur=%dms, frames=%d)",
                stats.peak_rms, stats.duration_ms, stats.speech_frames,
            )
            await self._send_json({
                "type": "interruption_dismissed",
                "reason": "noise",
                "message": self._last_interrupt_reason,
                "peak_rms": round(stats.peak_rms, 4),
                "duration_ms": stats.duration_ms,
            })
            await self._return_to_listening()
            return

        await self._enter(State.THINKING)
        try:
            try:
                text = await asyncio.wait_for(
                    get_whisper().transcribe(audio),
                    timeout=_WHISPER_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                logger.warning("whisper transcription timed out after %.1fs", _WHISPER_TIMEOUT_S)
                await self._send_json({
                    "type": "interruption_dismissed",
                    "reason": "timeout",
                    "message": "Transcription took too long — resuming. Please try again.",
                })
                return
            text = (text or "").strip()
            words = [w for w in text.split() if w]

            # Whisper produced too little — same auto-resume policy.
            if not text or len(words) < MIN_USEFUL_WORDS:
                self._last_interrupt_reason = (
                    "Couldn't make out a clear question — resuming narration."
                    if not text
                    else f"Only heard \"{text}\" — too short to act on. Resuming."
                )
                logger.info(
                    "interruption auto-resumed: low_speech text=%r words=%d",
                    text, len(words),
                )
                await self._send_json({
                    "type": "interruption_dismissed",
                    "reason": "low_speech",
                    "message": self._last_interrupt_reason,
                    "transcript": text,
                })
                return

            await self._send_json({"type": "transcript", "role": "user", "text": text})
            try:
                await asyncio.wait_for(
                    self._answer_and_speak(text),
                    timeout=_ANSWER_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                logger.warning("answer pipeline timed out after %.1fs", _ANSWER_TIMEOUT_S)
                await self._send_json({
                    "type": "interruption_dismissed",
                    "reason": "timeout",
                    "message": "Generating a reply took too long — resuming. Please try again.",
                })
        except Exception as exc:
            logger.exception("ask-doubt pipeline failed")
            # Don't swallow silently — surface so the client can recover.
            try:
                await self._send_json({
                    "type": "interruption_dismissed",
                    "reason": "error",
                    "message": f"Couldn't process that — resuming. ({type(exc).__name__})",
                })
            except Exception:
                pass
        finally:
            # ALWAYS get back to a listening state — even if everything above
            # raised. This is the load-bearing guarantee that prevents a stuck
            # "Thinking…" on the client.
            try:
                await self._return_to_listening()
            except Exception:
                logger.exception("_return_to_listening also failed")

    async def _return_to_listening(self) -> None:
        """After an interruption is handled (or dismissed), get back to a
        listening posture: ATTENDING when the client owns playback, NARRATING
        when the server is mid-narration loop, IDLE otherwise."""
        if self._state in (State.NARRATING, State.ATTENDING):
            return  # someone already moved us there
        # If we previously were in ATTENDING (client mode), go back there.
        # The client will resume its own audio.
        if self._doc_id and self._narration == [] and self._cursor == 0:
            await self._enter(State.ATTENDING)
            return
        # Otherwise this is the legacy server-narration flow; re-spawn the loop.
        await self._enter(State.IDLE)
        await self.resume()

    async def _answer_and_speak(self, question: str) -> None:
        """Streaming Q&A pipeline.

        Used to drain the entire Groq stream before calling TTS — that put the
        user-perceived first-audio latency at ~3-5s. Now we sentence-buffer:
        each completed sentence (≥18 chars + boundary) is sent to TTS as soon
        as Groq produces it. First audio typically arrives ~700-1200ms after
        Groq starts streaming.
        """
        rag = get_rag()
        chunks = rag.retrieve(self._doc_id, question, k=4) if self._doc_id else []
        groq = get_groq()
        tts = get_tts()

        await self._enter(State.SPEAKING_ANSWER)

        full_parts: list[str] = []
        pending = ""
        first_chunk_sent = False

        async def flush_sentences(force: bool = False) -> None:
            nonlocal pending, first_chunk_sent
            while True:
                # First audio chunk uses the lower clause threshold so the
                # listener hears the reply within ~700 ms.
                sentence, remainder = _split_first_sentence(
                    pending,
                    force=force,
                    allow_clause=not first_chunk_sent,
                )
                if not sentence:
                    return
                pending = remainder
                first_chunk_sent = True
                try:
                    async for audio in tts.synthesize_stream(sentence):
                        if self._state != State.SPEAKING_ANSWER:
                            return
                        await self._send_bytes(audio)
                except Exception:
                    logger.exception("TTS failed mid-sentence; continuing with next sentence")

        try:
            async for d in groq.answer(question, chunks, history=self._history):
                if self._state != State.SPEAKING_ANSWER:
                    return
                full_parts.append(d)
                pending += d
                await flush_sentences()
            # End of stream — flush any trailing fragment.
            await flush_sentences(force=True)
        except Exception as exc:
            logger.exception("answer pipeline failed")
            await self._send_json({"type": "error", "message": f"answer failed: {exc}"})

        answer_text = "".join(full_parts).strip()
        if not answer_text:
            answer_text = "I couldn't find that in your notes."

        self._history.append({"role": "user", "content": question})
        self._history.append({"role": "assistant", "content": answer_text})
        await self._send_json({"type": "transcript", "role": "assistant", "text": answer_text})

    # ---- helpers ----
    async def _cancel_playback(self) -> None:
        if self._playback_task and not self._playback_task.done():
            self._playback_task.cancel()
            try:
                await self._playback_task
            except (asyncio.CancelledError, Exception):
                pass
        self._playback_task = None
