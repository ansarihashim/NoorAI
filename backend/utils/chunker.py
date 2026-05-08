"""Text → narration-sized chunks. Splits on sentence boundaries, packs to ~target length."""
from __future__ import annotations

import re
from io import BytesIO

from pypdf import PdfReader

# Roughly: 600 chars ≈ 100-130 words ≈ 40-50 sec at TTS speaking rate
NARRATION_TARGET_CHARS = 600
RAG_TARGET_CHARS = 800       # slightly larger so retrieved chunks carry more context
RAG_OVERLAP_CHARS = 120

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"\(])")


def _sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]


def _pack(sentences: list[str], target_chars: int) -> list[str]:
    out: list[str] = []
    cur = ""
    for s in sentences:
        if not cur:
            cur = s
        elif len(cur) + 1 + len(s) <= target_chars:
            cur = f"{cur} {s}"
        else:
            out.append(cur)
            cur = s
    if cur:
        out.append(cur)
    return out


def narration_chunks(text: str) -> list[str]:
    """Pack sentences into ~600-char chunks for TTS narration."""
    return _pack(_sentences(text), NARRATION_TARGET_CHARS)


def rag_chunks(text: str) -> list[str]:
    """Pack into larger overlapping chunks suitable for retrieval."""
    sents = _sentences(text)
    base = _pack(sents, RAG_TARGET_CHARS)
    if len(base) <= 1 or RAG_OVERLAP_CHARS <= 0:
        return base
    overlapped = [base[0]]
    for i in range(1, len(base)):
        prev_tail = base[i - 1][-RAG_OVERLAP_CHARS:]
        overlapped.append(f"{prev_tail} {base[i]}")
    return overlapped


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()
