"""Text-to-speech with a two-tier fallback.

  1. ElevenLabs streaming (paid plan or free-tier-allowed voice)
  2. Microsoft Edge TTS (free, no auth, high-quality neural voices)

Both paths emit MP3 byte chunks via an async iterator so the calling code
stays uniform. Tier 2 guarantees audio output even when ElevenLabs is
misconfigured or out of budget, so narration always plays.

If ElevenLabs hits a permanent auth/billing error (401/402/403) it is
"sticky-disabled" for the remainder of the process — we don't keep
re-trying a provider that just told us "no" for every single chunk.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class TtsError(Exception):
    pass


def _is_permanent_auth_error(exc: Exception) -> bool:
    """Heuristic: detect 401/402/403/payment_required from any provider."""
    text = f"{type(exc).__name__}: {exc}"
    needles = (
        "401", "402", "403",
        "Unauthorized", "Unauthenticated",
        "payment_required", "paid_plan_required",
        "Forbidden",
    )
    return any(n in text for n in needles)


class TtsService:
    def __init__(self) -> None:
        s = get_settings()
        self._eleven_api_key = s.elevenlabs_api_key
        self._eleven_voice_id = s.elevenlabs_voice_id
        self._eleven_model = s.elevenlabs_model

        self._eleven_client = None

        self._chars_today = 0
        self._daily_cap = s.elevenlabs_chars_per_day

        # sticky-disable flag so we don't hammer a dead provider
        self._eleven_disabled = not bool(self._eleven_api_key)

        logger.info(
            "TTS init: eleven=%s edge=enabled",
            "enabled" if not self._eleven_disabled else "disabled (no key)",
        )

    # ---- public ----
    async def synthesize_stream(self, text: str, voice_id: str | None = None) -> AsyncIterator[bytes]:
        """Yield MP3 byte chunks for the given text, falling through providers.

        If ``voice_id`` is provided, ElevenLabs uses it instead of the default.
        The Edge fallback ignores voice_id (it doesn't share IDs with ElevenLabs).
        """
        text = text.strip()
        if not text:
            return

        # Tier 1: ElevenLabs
        if not self._eleven_disabled and self._chars_today + len(text) <= self._daily_cap:
            tier_yielded_any = False
            try:
                async for chunk in self._eleven_stream(text, voice_id=voice_id):
                    tier_yielded_any = True
                    yield chunk
                if tier_yielded_any:
                    self._chars_today += len(text)
                    return
            except Exception as exc:
                if _is_permanent_auth_error(exc):
                    logger.error("ElevenLabs permanently disabled this session: %s", exc)
                    self._eleven_disabled = True
                else:
                    logger.warning("ElevenLabs transient error: %s — falling back", exc)
                # If tier 1 emitted partial bytes, returning here would leave a
                # broken MP3 on the client. Don't fall through to tier 2 in that
                # case — re-raise as a hard error instead.
                if tier_yielded_any:
                    raise TtsError(f"elevenlabs failed mid-stream: {exc}") from exc

        # Tier 2: Edge TTS (always available, no auth)
        try:
            async for chunk in self._edge_stream(text):
                yield chunk
        except Exception:
            logger.exception("Edge TTS failed")
            raise TtsError("all TTS providers failed")

    def chars_remaining_today(self) -> int:
        return max(0, self._daily_cap - self._chars_today)

    # ---- ElevenLabs ----
    async def _eleven_stream(self, text: str, voice_id: str | None = None) -> AsyncIterator[bytes]:
        if self._eleven_client is None:
            from elevenlabs.client import ElevenLabs
            self._eleven_client = ElevenLabs(api_key=self._eleven_api_key)

        chosen_voice = voice_id or self._eleven_voice_id

        def _generate():
            return self._eleven_client.text_to_speech.convert(
                voice_id=chosen_voice,
                model_id=self._eleven_model,
                text=text,
                output_format="mp3_44100_128",
            )

        gen = await asyncio.to_thread(_generate)
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[bytes | None | Exception] = asyncio.Queue(maxsize=32)

        def _producer():
            try:
                for chunk in gen:
                    if chunk:
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
                return
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        producer = asyncio.create_task(asyncio.to_thread(_producer))
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    raise item
                yield item
        finally:
            producer.cancel()

    # ---- Edge TTS (free, no auth) ----
    async def _edge_stream(self, text: str) -> AsyncIterator[bytes]:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice="en-US-AriaNeural")
        async for event in communicate.stream():
            if event.get("type") == "audio":
                data = event.get("data")
                if data:
                    yield data


_singleton: TtsService | None = None


def get_tts() -> TtsService:
    global _singleton
    if _singleton is None:
        _singleton = TtsService()
    return _singleton
