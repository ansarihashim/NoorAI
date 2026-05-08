"""Text-to-speech with ElevenLabs primary + Google TTS fallback.

Both paths emit MP3-encoded audio chunks via an async iterator. ElevenLabs
streams natively; Google returns a single clip which we yield once.
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)


class TtsError(Exception):
    pass


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

    # ---- public ----
    async def synthesize_stream(self, text: str) -> AsyncIterator[bytes]:
        """Yield MP3 byte chunks for the given text."""
        if not text.strip():
            return

        used_eleven = False
        if self._eleven_api_key and self._chars_today + len(text) <= self._daily_cap:
            try:
                async for chunk in self._eleven_stream(text):
                    yield chunk
                self._chars_today += len(text)
                used_eleven = True
            except Exception as exc:
                logger.warning("ElevenLabs failed (%s), falling back to Google TTS", exc)

        if not used_eleven:
            audio = await self._google_synthesize(text)
            if audio:
                yield audio

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
        # `gen` is a sync iterator of bytes — pump it on a worker thread
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=32)

        def _producer():
            try:
                for chunk in gen:
                    if chunk:
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        producer = asyncio.create_task(asyncio.to_thread(_producer))
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            producer.cancel()

    # ---- Google TTS fallback ----
    async def _google_synthesize(self, text: str) -> bytes:
        try:
            from google.cloud import texttospeech
        except ImportError as exc:
            raise TtsError("google-cloud-texttospeech not installed") from exc

        if self._google_client is None:
            if self._google_api_key:
                from google.api_core.client_options import ClientOptions
                self._google_client = texttospeech.TextToSpeechAsyncClient(
                    client_options=ClientOptions(api_key=self._google_api_key)
                )
            else:
                # Uses GOOGLE_APPLICATION_CREDENTIALS env var
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


_singleton: TtsService | None = None


def get_tts() -> TtsService:
    global _singleton
    if _singleton is None:
        _singleton = TtsService()
    return _singleton
