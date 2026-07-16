"""Shared JSONL streaming driver for the ``*_stream`` chains.

The streaming chains use ``ChatGroq(streaming=True)`` with NO
``with_structured_output`` — the model is prompted to emit one JSON object per
line (JSON Lines). This module turns that raw token stream into a stream of
validated item dicts:

  * accumulate tokens into a buffer,
  * split on newlines as complete lines arrive,
  * parse each line as JSON and validate it against the *item-level* Pydantic
    schema (e.g. ``Flashcard``, not ``FlashcardSet``),
  * skip + log any malformed/invalid line — a single bad line never crashes
    the stream,
  * yield each valid item as a plain ``dict`` immediately.
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator, Type

from langchain_core.runnables import Runnable
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _parse_line(line: str, item_model: Type[BaseModel], label: str) -> dict | None:
    """Parse + validate one JSONL line. Returns a dict, or None to skip it."""
    s = line.strip()
    if not s:
        return None
    # Tolerate stray array/fence punctuation the model might emit despite the
    # JSONL instruction (``[``, ``]``, ```` ```json ````), and trailing commas.
    if s.startswith("```") or s in ("[", "]"):
        return None
    s = s.rstrip(",").strip()
    if not s.startswith("{"):
        # Not a JSON object line (e.g. a stray word) — skip quietly-ish.
        logger.warning("%s: skipping non-object line: %.120s", label, s)
        return None
    try:
        raw = json.loads(s)
    except json.JSONDecodeError:
        # Usually a partial line that slipped through; log and move on.
        logger.warning("%s: skipping unparseable JSON line: %.120s", label, s)
        return None
    if not isinstance(raw, dict):
        logger.warning("%s: skipping non-dict JSON line: %.120s", label, s)
        return None
    try:
        item = item_model.model_validate(raw)
    except Exception as exc:  # pydantic ValidationError and anything else
        logger.warning("%s: skipping schema-invalid line (%s): %.120s", label, exc, s)
        return None
    return item.model_dump()


async def astream_jsonl_items(
    chain: Runnable,
    inputs: dict[str, Any],
    item_model: Type[BaseModel],
    *,
    label: str = "stream",
) -> AsyncIterator[dict]:
    """Drive ``chain.astream(inputs)`` and yield validated item dicts as they
    complete. Never raises for a bad line — only for a genuine stream/transport
    failure, which the caller wraps into an SSE ``error`` event.
    """
    buffer = ""
    async for chunk in chain.astream(inputs):
        # ChatGroq(streaming=True) yields AIMessageChunk; other runnables may
        # yield str. Be liberal about extracting the token text.
        text = getattr(chunk, "content", chunk)
        if not isinstance(text, str):
            text = str(text)
        if not text:
            continue
        buffer += text
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            item = _parse_line(line, item_model, label)
            if item is not None:
                yield item

    # Flush a trailing final line that had no closing newline.
    if buffer.strip():
        item = _parse_line(buffer, item_model, label)
        if item is not None:
            yield item


__all__ = ["astream_jsonl_items"]
