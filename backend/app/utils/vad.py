"""Voice-activity detection state machine on top of webrtcvad.

Usage:
    vad = UtteranceDetector()
    for frame in iter_frames(pcm_chunk):
        event = vad.feed(frame)
        if event == VadEvent.SPEECH_START:   # cancel narration
            ...
        elif event == VadEvent.UTTERANCE_END:  # run STT on vad.flush()
            audio, stats = vad.flush_with_stats()
            if stats.likely_noise:
                # auto-resume narration silently — don't bother Whisper
                ...

Frame size MUST be 10/20/30ms of 16kHz int16 mono. We standardize on 30ms.

Tuning notes (vs. the original):
  - `speech_start_ms` raised 150 → 250 (more confidence before stopping narration)
  - Each frame must clear an energy floor *and* webrtcvad must label it speech;
    this keeps fan noise / keyboard clacks / background music from triggering
    SPEECH_START.
  - `flush_with_stats()` returns aggregate signal so the caller can decide
    whether to even bother with Whisper.
"""
from __future__ import annotations

import math
import struct
from collections import deque
from dataclasses import dataclass
from enum import Enum, auto

import webrtcvad

from app.utils.audio_utils import FRAME_BYTES, FRAME_MS, SAMPLE_RATE


class VadEvent(Enum):
    NONE = auto()
    SPEECH_START = auto()      # first time we see sustained speech
    UTTERANCE_END = auto()     # trailing silence reached the threshold


@dataclass
class UtteranceStats:
    duration_ms: int          # how long the captured audio is
    speech_frames: int        # frames flagged as speech (after energy gate)
    peak_rms: float           # loudest frame, normalized 0..1
    mean_rms: float           # average across all collected frames
    likely_noise: bool        # heuristic — caller may auto-resume on this


def _frame_rms(frame: bytes) -> float:
    """Normalized RMS [0..1] of a 16-bit mono PCM frame.

    Computed without numpy to keep this module hot-path-light. ~0.05ms per
    480-sample frame on a slow laptop.
    """
    n = len(frame) // 2
    if n == 0:
        return 0.0
    samples = struct.unpack_from(f"<{n}h", frame)
    s = 0
    for x in samples:
        s += x * x
    return math.sqrt(s / n) / 32768.0


class UtteranceDetector:
    """Edge-trigger VAD: emits SPEECH_START on rising edge, UTTERANCE_END on
    sustained silence after speech.

    Parameters
    ----------
    aggressiveness : 0..3 (3 = most aggressive at filtering non-speech)
    speech_start_ms : how many ms of *qualified* speech to confirm SPEECH_START
    silence_end_ms  : how many ms of trailing silence ends the utterance
    energy_floor    : minimum normalized RMS for a frame to count as speech
                      (0.012 ≈ very quiet whisper; tuned for laptop mics with
                      moderate background hum). Set to 0.0 to disable.
    """

    def __init__(
        self,
        aggressiveness: int = 2,
        speech_start_ms: int = 250,
        silence_end_ms: int = 700,
        energy_floor: float = 0.012,
    ) -> None:
        self._vad = webrtcvad.Vad(aggressiveness)
        self._speech_start_frames = max(1, speech_start_ms // FRAME_MS)
        self._silence_end_frames = max(1, silence_end_ms // FRAME_MS)
        self._energy_floor = energy_floor

        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        self._buffer: deque[bytes] = deque()  # collected speech frames

        # stats tracking for the current utterance (reset on flush/reset)
        self._speech_frames = 0
        self._sum_rms = 0.0
        self._peak_rms = 0.0
        self._frames_total = 0

    # ---- streaming ----
    def feed(self, frame: bytes) -> VadEvent:
        if len(frame) != FRAME_BYTES:
            raise ValueError(
                f"VAD expects {FRAME_BYTES}-byte 30ms frames, got {len(frame)}"
            )

        # Compute energy gate first — webrtcvad alone is too eager on
        # background hiss + room tone.
        rms = _frame_rms(frame)
        webrtc_says_speech = self._vad.is_speech(frame, SAMPLE_RATE)
        is_speech = webrtc_says_speech and rms >= self._energy_floor

        if not self._in_speech:
            if is_speech:
                self._speech_run += 1
                self._buffer.append(frame)
                self._track(frame, rms, counted_as_speech=True)
                if self._speech_run >= self._speech_start_frames:
                    self._in_speech = True
                    self._silence_run = 0
                    return VadEvent.SPEECH_START
            else:
                # reset rising-edge counter on silence
                self._speech_run = 0
                self._buffer.clear()
                self._reset_stats()
            return VadEvent.NONE

        # ---- already in an utterance ----
        self._buffer.append(frame)
        self._track(frame, rms, counted_as_speech=is_speech)
        if is_speech:
            self._silence_run = 0
        else:
            self._silence_run += 1
            if self._silence_run >= self._silence_end_frames:
                return VadEvent.UTTERANCE_END
        return VadEvent.NONE

    # ---- output ----
    def flush(self) -> bytes:
        """Drain the collected speech frames and reset state for the next utterance."""
        audio, _ = self.flush_with_stats()
        return audio

    def flush_with_stats(self) -> tuple[bytes, UtteranceStats]:
        audio = b"".join(self._buffer)
        n = self._frames_total
        mean = (self._sum_rms / n) if n else 0.0
        duration_ms = n * FRAME_MS
        # Heuristic for "this was probably noise, not the user":
        #   too short (< 240ms of captured audio), OR
        #   too few speech-qualified frames (< 6, i.e. < 180ms of actual voice), OR
        #   peak RMS very low (< ~0.04 — a clear voice usually peaks above this)
        likely_noise = (
            duration_ms < 240
            or self._speech_frames < 6
            or self._peak_rms < 0.04
        )
        stats = UtteranceStats(
            duration_ms=duration_ms,
            speech_frames=self._speech_frames,
            peak_rms=self._peak_rms,
            mean_rms=mean,
            likely_noise=likely_noise,
        )
        self._buffer.clear()
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        self._reset_stats()
        return audio, stats

    def reset(self) -> None:
        self._buffer.clear()
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        self._reset_stats()

    # ---- internal stat helpers ----
    def _track(self, frame: bytes, rms: float, *, counted_as_speech: bool) -> None:
        self._frames_total += 1
        self._sum_rms += rms
        if rms > self._peak_rms:
            self._peak_rms = rms
        if counted_as_speech:
            self._speech_frames += 1

    def _reset_stats(self) -> None:
        self._speech_frames = 0
        self._sum_rms = 0.0
        self._peak_rms = 0.0
        self._frames_total = 0
