"""Lazy-loaded singleton wrapper around faster-whisper.

The model loads on first call (~1-2s) and stays in memory afterwards.
"""
from __future__ import annotations

import asyncio
import logging
from threading import Lock

from faster_whisper import WhisperModel

from app.core.settings import get_settings
from app.utils.audio_utils import SAMPLE_RATE, pcm16_to_float32

logger = logging.getLogger(__name__)


class WhisperService:
    _instance: "WhisperService | None" = None
    _lock = Lock()

    def __init__(self) -> None:
        s = get_settings()
        logger.info(
            "Loading Whisper model=%s device=%s compute=%s",
            s.whisper_model, s.whisper_device, s.whisper_compute_type,
        )
        self._model = WhisperModel(
            s.whisper_model,
            device=s.whisper_device,
            compute_type=s.whisper_compute_type,
        )
        self._sem = asyncio.Semaphore(1)  # whisper isn't thread-safe across calls

    @classmethod
    def instance(cls) -> "WhisperService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    async def transcribe(self, pcm16_mono: bytes, language: str = "en") -> str:
        """Transcribe a single utterance. Input: int16 LE PCM, 16kHz mono."""
        if not pcm16_mono:
            return ""

        async with self._sem:
            audio = pcm16_to_float32(pcm16_mono)
            return await asyncio.to_thread(self._sync_transcribe, audio, language)

    def _sync_transcribe(self, audio_f32, language: str) -> str:
        segments, _info = self._model.transcribe(
            audio_f32,
            language=language,
            vad_filter=False,                    # we already did VAD
            beam_size=1,                         # latency over accuracy
            condition_on_previous_text=False,
            no_speech_threshold=0.5,
        )
        return " ".join(seg.text.strip() for seg in segments).strip()


def get_whisper() -> WhisperService:
    return WhisperService.instance()
