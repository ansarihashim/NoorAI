"""Text → narration-sized chunks. Splits on sentence boundaries, packs to ~target length.

Two ingest modes are supported:
  * legacy plain-text mode — single stream, no page boundaries known
    (used by /api/upload/text and any non-PDF file);
  * page-aware mode — caller provides ``list[tuple[page_num, text]]`` so we
    can chunk per-page and tag every chunk with its source page number.
    This is what powers human-readable "Page N" citations in the UI.
"""
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


# --- legacy single-stream API (text uploads, non-PDF files) ----------------


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


# --- page-aware API (PDF uploads) ------------------------------------------


def narration_chunks_with_pages(
    pages: list[tuple[int, str]],
) -> list[tuple[str, int]]:
    """Pack narration chunks WITHIN each page so every chunk carries its page.

    Chunks never span a page break — this is a tiny recall trade-off in
    exchange for clean per-chunk citations.
    """
    out: list[tuple[str, int]] = []
    for page_num, text in pages:
        for c in _pack(_sentences(text), NARRATION_TARGET_CHARS):
            out.append((c, page_num))
    return out


def rag_chunks_with_pages(
    pages: list[tuple[int, str]],
) -> list[tuple[str, int]]:
    """Pack RAG chunks per page, with overlap WITHIN a page only."""
    out: list[tuple[str, int]] = []
    for page_num, text in pages:
        base = _pack(_sentences(text), RAG_TARGET_CHARS)
        if not base:
            continue
        if len(base) > 1 and RAG_OVERLAP_CHARS > 0:
            overlapped = [base[0]]
            for i in range(1, len(base)):
                prev_tail = base[i - 1][-RAG_OVERLAP_CHARS:]
                overlapped.append(f"{prev_tail} {base[i]}")
            base = overlapped
        for c in base:
            out.append((c, page_num))
    return out


def extract_text_from_pdf(data: bytes) -> str:
    """Legacy: concatenate every page into one stream. Loses page boundaries."""
    reader = PdfReader(BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()


def extract_pages_from_pdf(data: bytes) -> list[tuple[int, str]]:
    """Return [(page_number, page_text), …] for every non-empty page.

    Page numbers are 1-based (the way humans cite). Empty pages are dropped.
    """
    reader = PdfReader(BytesIO(data))
    out: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        t = (page.extract_text() or "").strip()
        if t:
            out.append((i, t))
    return out
