"""AI Visual Learning service.

Given a document and a free-text prompt ("show this as a mind map", "build a
revision roadmap"), call Groq to produce a Mermaid diagram, validate it, and
cache the result on disk so re-opens are instant.

  storage/visuals/{doc_id}/{visual_id}.json
       { visual_id, doc_id, prompt, style, diagram_type, title, mermaid, created_at }

The visual_id is a stable hash of (prompt, style) so the same prompt always
lands in the same cache slot — re-issuing the same request is a no-op fetch.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from backend.config.settings import get_settings
from backend.services.groq_service import get_groq
from backend.services.rag_service import get_rag

logger = logging.getLogger(__name__)


VALID_DIAGRAM_PREFIXES = (
    "flowchart ", "graph ", "mindmap", "sequenceDiagram",
    "classDiagram", "stateDiagram", "stateDiagram-v2", "erDiagram",
    "journey", "gantt", "timeline", "quadrantChart", "requirementDiagram",
)

MAX_VISUAL_CHARS = 6000
MIN_VISUAL_CHARS = 30


@dataclass
class Visual:
    visual_id: str
    doc_id: str
    prompt: str
    style: str | None
    diagram_type: str
    title: str
    mermaid: str
    created_at: float

    def to_dict(self) -> dict:
        return asdict(self)


# In-process locks so two concurrent requests for the same (doc, prompt, style)
# don't both call Groq.
_INFLIGHT: dict[tuple[str, str], asyncio.Future] = {}


def _root() -> Path:
    p = get_settings().storage_path / "visuals"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _doc_dir(doc_id: str) -> Path:
    p = _root() / doc_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def _visual_id(prompt: str, style: str | None) -> str:
    key = f"{(prompt or '').strip()}|{(style or '').strip()}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def _path(doc_id: str, visual_id: str) -> Path:
    return _doc_dir(doc_id) / f"{visual_id}.json"


# ---------------------------------------------------------------------------
# parsing + validation


def _strip_fences(s: str) -> str:
    s = s.strip()
    fence = re.match(r"^```(?:json|mermaid)?\s*(.*?)\s*```$", s, re.DOTALL)
    return fence.group(1).strip() if fence else s


def _parse_json_response(raw: str) -> dict:
    raw = _strip_fences(raw)
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    # Fall back: find a JSON object in the body
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        return json.loads(raw[start : end + 1])
    raise ValueError("model output was not JSON")


def _repair_collapsed(code: str) -> str:
    """If the model collapsed everything onto one line with `; ` separators,
    expand the separators back to newlines. Preserves correct multi-line input."""
    if "\n" in code:
        return code
    # The first whitespace gap separates the diagram-type keyword from the
    # body. Split the body on `; ` and rejoin with newlines.
    head, _, tail = code.partition(" ")
    if not tail or "; " not in tail:
        return code
    parts = [p.strip() for p in tail.split(";") if p.strip()]
    if not parts:
        return code
    indent = "  " if head.lower() == "mindmap" else "    "
    return head + "\n" + "\n".join(indent + p for p in parts)


def _validate_mermaid(mermaid: str) -> tuple[bool, str, str]:
    """Return (ok, reason, repaired). Cheap structural check — not a parser.

    Attempts an auto-repair if the model collapsed the diagram onto one line.
    """
    if not mermaid or not mermaid.strip():
        return False, "empty mermaid", mermaid
    code = _strip_fences(mermaid).strip()
    code = _repair_collapsed(code)
    if len(code) < MIN_VISUAL_CHARS:
        return False, f"too short ({len(code)} chars)", code
    if len(code) > MAX_VISUAL_CHARS:
        return False, f"too long ({len(code)} chars)", code
    first_line = code.lstrip().splitlines()[0].strip()
    if not any(first_line.startswith(p) for p in VALID_DIAGRAM_PREFIXES):
        return False, f"unknown diagram type: {first_line[:40]!r}", code
    # Mindmap / sequence / flowchart need multiple lines to be meaningful.
    if first_line.startswith(("mindmap", "sequenceDiagram", "flowchart ", "graph ")):
        if code.count("\n") < 2:
            return False, "diagram has no body lines", code
    return True, "", code


def _normalize_diagram_type(raw_type: str | None, mermaid: str) -> str:
    """Return a stable family label ('flowchart', 'mindmap', etc.)."""
    if raw_type:
        t = raw_type.strip().lower().split()[0]
        if t in ("flowchart", "graph"):
            return "flowchart"
        if t in ("mindmap", "concept-map", "concept_map"):
            return "mindmap"
        if t in ("sequencediagram", "sequence"):
            return "sequence"
        if t in ("classdiagram", "class"):
            return "class"
        if t in ("erdiagram", "er"):
            return "er"
        if t in ("statediagram", "statediagram-v2", "state"):
            return "state"
        if t in ("timeline",):
            return "timeline"
        if t in ("gantt",):
            return "gantt"
        if t:
            return t
    # Fall back to first token of the mermaid source
    head = mermaid.lstrip().splitlines()[0].split()[0].lower()
    if head.startswith("flowchart") or head == "graph":
        return "flowchart"
    if head == "mindmap":
        return "mindmap"
    if head.startswith("sequence"):
        return "sequence"
    return head or "diagram"


# ---------------------------------------------------------------------------
# public API


def list_visuals(doc_id: str) -> list[Visual]:
    folder = _doc_dir(doc_id)
    out: list[Visual] = []
    for p in sorted(folder.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append(Visual(**data))
        except Exception:
            logger.warning("visuals: skipping unreadable %s", p)
    out.sort(key=lambda v: v.created_at, reverse=True)
    return out


def load_visual(doc_id: str, visual_id: str) -> Visual | None:
    p = _path(doc_id, visual_id)
    if not p.exists():
        return None
    try:
        return Visual(**json.loads(p.read_text(encoding="utf-8")))
    except Exception:
        logger.exception("visuals: bad cache file %s", p)
        return None


def delete_visual(doc_id: str, visual_id: str) -> bool:
    p = _path(doc_id, visual_id)
    if p.exists():
        try:
            p.unlink()
            return True
        except Exception:
            logger.exception("visuals: failed to delete %s", p)
    return False


async def generate_visual(
    doc_id: str,
    prompt: str,
    style: str | None = None,
    *,
    force: bool = False,
) -> Visual:
    """Generate (or fetch cached) Mermaid visual for a document."""
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("prompt is required")

    visual_id = _visual_id(prompt, style)

    if not force:
        cached = load_visual(doc_id, visual_id)
        if cached is not None:
            return cached

    rag = get_rag()
    if not rag.exists(doc_id):
        raise FileNotFoundError(f"doc not found: {doc_id}")
    meta = rag.get_meta(doc_id)
    title = meta.get("title") or "Untitled"

    chunks_path = get_settings().storage_path / "rag" / doc_id / "chunks.json"
    if not chunks_path.exists():
        raise FileNotFoundError(f"chunks.json missing for {doc_id}")
    data = json.loads(chunks_path.read_text(encoding="utf-8"))
    notes = data.get("rag") or data.get("narration") or []

    # Cap context to ~10k chars
    capped: list[str] = []
    total = 0
    for n in notes:
        if total + len(n) > 10000:
            break
        capped.append(n)
        total += len(n)

    key = (doc_id, visual_id)
    inflight = _INFLIGHT.get(key)
    if inflight is not None:
        return await inflight

    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    _INFLIGHT[key] = fut
    try:
        # Try once; on validation failure, retry with a stricter nudge.
        groq = get_groq()
        attempts = 0
        last_reason = ""
        while attempts < 2:
            attempts += 1
            raw = await groq.generate_mermaid(
                title=title, notes=capped, prompt=prompt, style=style,
            )
            try:
                obj = _parse_json_response(raw)
            except Exception as exc:
                last_reason = f"JSON parse failed: {exc}"
                logger.warning("visuals: attempt %d parse fail (%s)", attempts, exc)
                continue
            mermaid_raw = _strip_fences(str(obj.get("mermaid", ""))).strip()
            ok, reason, mermaid = _validate_mermaid(mermaid_raw)
            if not ok:
                last_reason = reason
                logger.warning("visuals: attempt %d invalid (%s)", attempts, reason)
                continue
            diagram_type = _normalize_diagram_type(obj.get("diagram_type"), mermaid)
            visual = Visual(
                visual_id=visual_id,
                doc_id=doc_id,
                prompt=prompt,
                style=style,
                diagram_type=diagram_type,
                title=str(obj.get("title") or "Diagram"),
                mermaid=mermaid,
                created_at=time.time(),
            )
            try:
                _path(doc_id, visual_id).write_text(
                    json.dumps(visual.to_dict(), ensure_ascii=False), encoding="utf-8"
                )
            except Exception:
                logger.exception("visuals: failed to cache %s", visual_id)
            logger.info(
                "visuals: generated doc=%s id=%s type=%s len=%d",
                doc_id, visual_id, diagram_type, len(mermaid),
            )
            fut.set_result(visual)
            return visual

        msg = f"visual generation failed after {attempts} attempts: {last_reason}"
        exc = RuntimeError(msg)
        fut.set_exception(exc)
        raise exc
    except Exception as exc:
        if not fut.done():
            fut.set_exception(exc)
        raise
    finally:
        _INFLIGHT.pop(key, None)
