"""Audio helpers: PCM ↔ wav, resampling, frame slicing.

Conventions used across EchoVerse:
  - Mic audio on the wire: signed int16 PCM, 16kHz, mono, little-endian.
  - VAD frames: 30ms = 480 samples = 960 bytes.
"""
from __future__ import annotations

import io
import wave

import numpy as np

SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2  # int16
CHANNELS = 1
FRAME_MS = 30
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000  # 480
FRAME_BYTES = FRAME_SAMPLES * SAMPLE_WIDTH       # 960


def pcm16_to_float32(pcm: bytes) -> np.ndarray:
    """int16 LE PCM bytes -> float32 in [-1, 1]."""
    arr = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    return arr / 32768.0


def float32_to_pcm16(arr: np.ndarray) -> bytes:
    """float32 in [-1, 1] -> int16 LE PCM bytes."""
    clipped = np.clip(arr, -1.0, 1.0)
    return (clipped * 32767.0).astype(np.int16).tobytes()


def pcm16_to_wav_bytes(pcm: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Wrap raw PCM in a WAV container so other tooling can decode it."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(CHANNELS)
        w.setsampwidth(SAMPLE_WIDTH)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()


def iter_frames(pcm: bytes, frame_bytes: int = FRAME_BYTES):
    """Yield non-overlapping frames of exactly `frame_bytes` (drops trailing partial)."""
    n = len(pcm) - (len(pcm) % frame_bytes)
    for i in range(0, n, frame_bytes):
        yield pcm[i : i + frame_bytes]
