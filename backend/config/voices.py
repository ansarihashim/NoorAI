"""Speaker → ElevenLabs voice ID registry + curated catalog for the picker UI.

The narration mode uses a single voice (`narrator`/`host`). The podcast mode
uses two contrasting voices for the host / guest dynamic so the dialogue is
easy to follow by ear.

The CATALOG below is the public list shown in Settings. We deliberately keep
it short (6 entries) — choice paralysis is a worse UX than a polished default.
All IDs are part of the standard ElevenLabs library and should work on free
and paid plans alike.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from backend.config.settings import get_settings


@dataclass
class VoiceProfile:
    id: str
    name: str
    tone: str
    gender: str           # 'F' | 'M' | 'X'
    suggested_role: str   # 'host' | 'guest'

    def to_dict(self) -> dict:
        return asdict(self)


# Curated voice catalog. The first entry per role is the recommended default.
CATALOG: list[VoiceProfile] = [
    VoiceProfile(
        id="21m00Tcm4TlvDq8ikWAM",
        name="Rachel",
        tone="calm, structured, guiding",
        gender="F",
        suggested_role="host",
    ),
    VoiceProfile(
        id="MF3mGyEYCl7XYWbV9V6O",
        name="Elli",
        tone="soft, friendly, attentive",
        gender="F",
        suggested_role="host",
    ),
    VoiceProfile(
        id="TxGEqnHWrfWFTfGW9XjX",
        name="Josh",
        tone="neutral, articulate, easy to follow",
        gender="M",
        suggested_role="host",
    ),
    VoiceProfile(
        id="pNInz6obpgDQGcFmaJgB",
        name="Adam",
        tone="warm, conversational, energetic",
        gender="M",
        suggested_role="guest",
    ),
    VoiceProfile(
        id="EXAVITQu4vr4xnSDxMaL",
        name="Bella",
        tone="bright, expressive, curious",
        gender="F",
        suggested_role="guest",
    ),
    VoiceProfile(
        id="ErXwobaYiN019PkySvjV",
        name="Antoni",
        tone="grounded, story-teller",
        gender="M",
        suggested_role="guest",
    ),
]


def known_voice_ids() -> set[str]:
    return {v.id for v in CATALOG}


def voice_for(role: str) -> str:
    """Return an ElevenLabs voice ID for the given speaker role.

    Roles:
      "narrator", "host"   → narrator/host (settings.elevenlabs_voice_id)
      "guest", "co-host"    → guest         (settings.elevenlabs_guest_voice_id)
      anything else         → narrator default
    """
    s = get_settings()
    role = (role or "").strip().lower()
    if role in ("guest", "co-host", "cohost", "expert"):
        return s.elevenlabs_guest_voice_id or s.elevenlabs_voice_id
    return s.elevenlabs_voice_id


def host_guest_pair() -> tuple[str, str]:
    s = get_settings()
    return (s.elevenlabs_voice_id, s.elevenlabs_guest_voice_id or s.elevenlabs_voice_id)


# Display names — surfaced in the API/UI.
ROLE_LABELS = {
    "host": "Host",
    "guest": "Guest",
}


# Short, neutral preview text used by the /api/voices/{id}/preview endpoint.
PREVIEW_TEXT = (
    "Hello — I'm one of the voices you can pick for EchoVerse. "
    "I'll narrate your notes and walk you through them."
)
