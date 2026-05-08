"""Text-to-speech with a three-tier fallback.

  1. ElevenLabs streaming (paid plan or free-tier-allowed voice)
  2. Google Cloud TTS  (only if a real service account is configured —
                       Cloud TTS does NOT accept API keys)
  3. Microsoft Edge TTS (free, no auth, high-quality neural voices)

All three paths emit MP3 byte chunks via an async iterator so the calling
code stays uniform. Tier 3 guarantees audio output even when the cloud
providers are misconfigured, so narration always plays in development.

If a tier hits a permanent auth/billing error (401/402/403) it is
"sticky-disabled" for the remainder of the process — we don't keep
re-trying a provider that just told us "no" for every single chunk.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from backend.config.settings import get_settings

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
        "API keys are not supported",
        "Forbidden",
    )
    return any(n in text for n in needles)


class TtsService:
    def __init__(self) -> None:
        s = get_settings()
        self._eleven_api_key = s.elevenlabs_api_key
        self._eleven_voice_id = s.elevenlabs_voice_id
        self._eleven_model = s.elevenlabs_model
        self._google_api_key = s.google_tts_api_key
        self._google_creds_path = s.google_application_credentials

        self._eleven_client = None
        self._google_client = None

        self._chars_today = 0
        self._daily_cap = s.elevenlabs_chars_per_day

        # sticky-disable flags so we don't hammer dead providers
        self._eleven_disabled = not bool(self._eleven_api_key)
        # API keys are NOT supported by Cloud TTS - require a real service account
        self._google_disabled = not bool(self._google_creds_path)

        logger.info(
            "TTS init: eleven=%s google=%s edge=enabled",
            "enabled" if not self._eleven_disabled else "disabled (no key)",
            "enabled" if not self._google_disabled else "disabled (need GOOGLE_APPLICATION_CREDENTIALS, API key alone is not accepted by Cloud TTS)",
        )

    # ---- public ----
    async def synthesize_stream(self, text: str) -> AsyncIterator[bytes]:
        """Yield MP3 byte chunks for the given text, falling through providers."""
        text = text.strip()
        if not text:
            return

        # Tier 1: ElevenLabs
        if not self._eleven_disabled and self._chars_today + len(text) <= self._daily_cap:
            tier_yielded_any = False
            try:
                async for chunk in self._eleven_stream(text):
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

        # Tier 2: Google Cloud TTS
        if not self._google_disabled:
            try:
                audio = await self._google_synthesize(text)
                if audio:
                    yield audio
                    return
            except Exception as exc:
                if _is_permanent_auth_error(exc):
                    logger.error("Google TTS permanently disabled this session: %s", exc)
                    self._google_disabled = True
                else:
                    logger.warning("Google TTS transient error: %s — falling back", exc)

        # Tier 3: Edge TTS (always available, no auth)
        try:
            async for chunk in self._edge_stream(text):
                yield chunk
        except Exception:
            logger.exception("Edge TTS failed")
            raise TtsError("all TTS providers failed")

    # ---- ElevenLabs ----
    async def _eleven_stream(self, text: str) -> AsyncIterator[bytes]:
        if self._eleven_client is None:
            from elevenlabs.client import ElevenLabs
            self._eleven_client = ElevenLabs(api_key=self._eleven_api_key)

        def _generate():
            return self._eleven_client.text_to_speech.convert(
                voice_id=self._eleven_voice_id,
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

    # ---- Google TTS ----
    async def _google_synthesize(self, text: str) -> bytes:
        try:
            from google.cloud import texttospeech
        except ImportError as exc:
            raise TtsError("google-cloud-texttospeech not installed") from exc

        if self._google_client is None:
            # Cloud TTS requires service-account credentials. Plain API keys
            # do not work for this API and produce a 401.
            self._google_client = texttospeech.TextToSpeechAsyncClient()

        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Neural2-C",
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
        )
        response = await self._google_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        return response.audio_content

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
