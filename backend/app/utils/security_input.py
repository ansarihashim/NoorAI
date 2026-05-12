"""Input-validation helpers used across HTTP / WebSocket routes.

The single biggest class of bugs we've seen is **doc_id from URL → Path**.
``rag_service``, ``narration_service``, ``podcast_service``, and the
``documents`` route all do ``storage / doc_id / …`` — a doc_id of
``../../etc`` would resolve outside the storage tree and, in the case of
``shutil.rmtree``, could delete arbitrary directories.

These helpers normalize that risk in one place. Every route that accepts a
doc_id from the wire MUST call :func:`validate_doc_id` first.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from pathlib import Path

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


# We mint doc_ids as ``uuid.uuid4().hex[:16]``, so they are pure lowercase
# hex. We also accept up to 32 chars to cover the (rare) case of a longer
# legacy ID — but never anything outside [a-f0-9].
_DOC_ID_RE = re.compile(r"^[a-f0-9]{12,32}$")

# Voice IDs come from ElevenLabs (alnum) or Google TTS (alnum + dashes).
_VOICE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")

# Filenames the upload route is willing to display in logs / responses.
_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9 .,_\-()\[\]]+")

# Hard upper bound on uploaded file payload size.
MAX_UPLOAD_BYTES = 30 * 1024 * 1024  # 30 MB

# Hard upper bound on inline pasted text (the /upload/text body).
MAX_TEXT_BYTES = 2 * 1024 * 1024  # 2 MB

# Hard upper bound on the JSON body of any AI/preparation/revision route.
# Keeps the request-validation surface predictable and stops "JSON bombs".
MAX_JSON_BODY_BYTES = 256 * 1024  # 256 KB

ALLOWED_UPLOAD_EXTS = {".pdf", ".txt", ".md"}
ALLOWED_UPLOAD_MIMES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    # Some browsers send empty or generic types for .md / .txt — accept those
    # only when the extension matches.
    "",
    "application/octet-stream",
}


def validate_doc_id(doc_id: str) -> str:
    """Reject any doc_id that isn't lowercase hex of length 12-32.

    Returns the (unchanged) string on success; raises 400 otherwise. Logging
    is deliberately terse — we don't want to mirror back hostile input.
    """
    if not isinstance(doc_id, str) or not _DOC_ID_RE.match(doc_id):
        logger.warning("rejecting bad doc_id: len=%d", len(doc_id) if isinstance(doc_id, str) else -1)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid doc_id")
    return doc_id


def validate_voice_id(voice_id: str | None) -> str | None:
    """Reject voice IDs that aren't a tame [A-Za-z0-9_-]{1,64} string."""
    if voice_id is None:
        return None
    if not isinstance(voice_id, str) or not _VOICE_ID_RE.match(voice_id):
        logger.warning("rejecting bad voice_id")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid voice_id")
    return voice_id


def safe_join(root: Path, *parts: str) -> Path:
    """Join ``root`` with one or more user-supplied parts and verify the
    resolved path is a descendant of ``root``. Defends against ``..`` /
    absolute-path tricks even when an ID slips past the regex (defence in
    depth — a single missed call site shouldn't be game-over).
    """
    candidate = Path(root, *parts).resolve()
    root_resolved = Path(root).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError:
        logger.warning("safe_join: path escape attempt blocked")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid path")
    return candidate


def sanitize_filename(name: str | None, *, fallback: str = "upload") -> str:
    """Strip control chars, NFC-normalize, and collapse anything outside an
    explicit safe set into ``_``. Used for logging + response display only —
    the actual on-disk path is always derived from the server-minted doc_id.
    """
    if not isinstance(name, str) or not name.strip():
        return fallback
    n = unicodedata.normalize("NFC", name).strip()
    # Drop newlines / tabs first so log lines can never be split.
    n = re.sub(r"[\r\n\t\x00-\x1f]+", "", n)
    n = _FILENAME_SAFE_RE.sub("_", n)
    n = n.strip(" .")  # disallow trailing dots — Windows landmine
    if not n:
        return fallback
    return n[:128]  # hard cap so logs stay readable


def validate_upload_extension(filename: str | None) -> str:
    """Return the lowercased extension if it's on the allowlist, else 400."""
    name = (filename or "").lower()
    for ext in ALLOWED_UPLOAD_EXTS:
        if name.endswith(ext):
            return ext
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"unsupported file type — allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTS))}",
    )


def validate_upload_mime(content_type: str | None, ext: str) -> None:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if ct in ALLOWED_UPLOAD_MIMES:
        return
    # Common browser variants for plain-text-ish files
    if ext in {".txt", ".md"} and ct.startswith("text/"):
        return
    if ext == ".pdf" and ct in {"application/x-pdf", "application/acrobat"}:
        return
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="unsupported MIME type",
    )


def validate_pdf_magic(blob: bytes) -> None:
    """The first four bytes of a PDF MUST be ``%PDF``. Anything else is a
    file pretending to be a PDF (or a blob the user uploaded by accident).
    """
    if not blob.startswith(b"%PDF"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file does not look like a PDF")


def enforce_max_bytes(blob_len: int, *, limit: int = MAX_UPLOAD_BYTES) -> None:
    if blob_len > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"payload too large (limit {limit // (1024 * 1024)} MB)",
        )


__all__ = [
    "MAX_JSON_BODY_BYTES",
    "MAX_TEXT_BYTES",
    "MAX_UPLOAD_BYTES",
    "ALLOWED_UPLOAD_EXTS",
    "validate_doc_id",
    "validate_voice_id",
    "safe_join",
    "sanitize_filename",
    "validate_upload_extension",
    "validate_upload_mime",
    "validate_pdf_magic",
    "enforce_max_bytes",
]
