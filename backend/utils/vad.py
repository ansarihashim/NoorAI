"""Voice-activity detection state machine on top of webrtcvad.

Usage:
    vad = UtteranceDetector()
    for frame in iter_frames(pcm_chunk):
        event = vad.feed(frame)
        if event == VadEvent.SPEECH_START:   # cancel narration
            ...
        elif event == VadEvent.UTTERANCE_END:  # run STT on vad.flush()
            audio = vad.flush()
            ...

Frame size MUST be 10/20/30ms of 16kHz int16 mono. We standardize on 30ms.
"""
from __future__ import annotations

from collections import deque
from enum import Enum, auto

import webrtcvad

from backend.utils.audio_utils import FRAME_BYTES, FRAME_MS, SAMPLE_RATE


class VadEvent(Enum):
    NONE = auto()
    SPEECH_START = auto()      # first time we see sustained speech
    UTTERANCE_END = auto()     # trailing silence reached the threshold


class UtteranceDetector:
    """Edge-trigger VAD: emits SPEECH_START on rising edge, UTTERANCE_END on
    sustained silence after speech.

    Parameters
    ----------
    aggressiveness : 0..3 (3 = most aggressive at filtering non-speech)
    speech_start_ms : how many ms of detected speech to confirm SPEECH_START
    silence_end_ms  : how many ms of trailing silence ends the utterance
    """

    def __init__(
        self,
        aggressiveness: int = 2,
        speech_start_ms: int = 150,
        silence_end_ms: int = 700,
    ) -> None:
        self._vad = webrtcvad.Vad(aggressiveness)
        self._speech_start_frames = max(1, speech_start_ms // FRAME_MS)
        self._silence_end_frames = max(1, silence_end_ms // FRAME_MS)

        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        self._buffer: deque[bytes] = deque()  # collected speech frames

    # ---- streaming ----
    def feed(self, frame: bytes) -> VadEvent:
        if len(frame) != FRAME_BYTES:
            raise ValueError(
                f"VAD expects {FRAME_BYTES}-byte 30ms frames, got {len(frame)}"
            )

        is_speech = self._vad.is_speech(frame, SAMPLE_RATE)

        if not self._in_speech:
            if is_speech:
                self._speech_run += 1
                self._buffer.append(frame)
                if self._speech_run >= self._speech_start_frames:
                    self._in_speech = True
                    self._silence_run = 0
                    return VadEvent.SPEECH_START
            else:
                # reset rising-edge counter on silence
                self._speech_run = 0
                self._buffer.clear()
            return VadEvent.NONE

        # ---- already in an utterance ----
        self._buffer.append(frame)
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
        audio = b"".join(self._buffer)
        self._buffer.clear()
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
        return audio

    def reset(self) -> None:
        self._buffer.clear()
        self._in_speech = False
        self._speech_run = 0
        self._silence_run = 0
