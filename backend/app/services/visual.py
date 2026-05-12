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

from app.core.settings import get_settings
from app.services.groq import get_groq
from app.rag.service import get_rag

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


# --- node-id sanitisation (flowchart / graph) ------------------------------
#
# Mermaid's flowchart parser requires node IDs to be a single alphanumeric
# token — `Ensemble Learning[label]` is a syntax error, the parser reads
# `Ensemble` as the id, then expects an edge or EOL and sees `Learning`.
# LLMs reliably get this wrong. We rewrite multi-word IDs in declarations
# to CamelCase, build a rename map, and apply it to all later references.
# Labels inside `[...]` are also force-quoted when they contain anything
# beyond bare alnum so spaces / punctuation can never re-trigger the issue.

_DECL_RE = re.compile(
    r"(?P<lead>^|[\s,;|&])"                                  # boundary
    r"(?P<id>[A-Za-z][A-Za-z0-9_]*(?:\s+[A-Za-z][A-Za-z0-9_]*)+)"  # multi-word id
    r"(?P<bracket>\s*[\[\(\{])"                              # opening of label
)


def _camel(name: str) -> str:
    parts = [p for p in re.split(r"\s+", name.strip()) if p]
    return "".join(parts) or name.replace(" ", "")


_LABEL_DANGEROUS = re.compile(r"[|#&<>`*_]")

# Unicode arrow variants LLMs reach for instead of Mermaid's `-->`. Anything
# we don't normalize here turns into a parse error like:
#   Parse error on line 3: ...oduction → Bagging  ^ Expecting 'SEMI', …
_ARROW_VARIANTS = {
    "→": "-->", "⟶": "-->", "⇒": "-->", "⇨": "-->", "➜": "-->",
    "➡": "-->", "↦": "-->", "⟹": "-->", "⟾": "-->", "↣": "-->",
    "←": "<--", "⟵": "<--", "⇐": "<--", "↤": "<--",
    "↔": "<-->", "⟷": "<-->", "⇔": "<-->",
    "—": "--", "–": "--",  # em- and en-dashes used as edge sugar
}


def _normalize_arrows(code: str) -> str:
    """Replace Unicode arrows / em-dash edges with proper Mermaid syntax.

    Also catches the common `A - B` form (single dash with spaces) that LLMs
    sometimes use in flowcharts — converts it to `A --> B` so the parser
    doesn't choke. The rewrite only fires INSIDE the diagram body, never on
    a hyphen that's part of a label inside brackets.
    """
    for src, dst in _ARROW_VARIANTS.items():
        code = code.replace(src, dst)
    # ` - ` → ` --> ` only when neither neighbour is itself a dash (so we don't
    # corrupt `-->` / `---`). Applied line-by-line on lines OUTSIDE brackets.
    out_lines: list[str] = []
    for ln in code.splitlines():
        # If the line has `[`, `(`, `{` we have to be more careful. Tokenise
        # on bracket spans so the inside of a label keeps its hyphens intact.
        if re.search(r"[\[\(\{]", ln):
            tokens = re.split(r"(\[[^\[\]\n]*\]|\([^()\n]*\)|\{[^{}\n]*\})", ln)
            for i in range(0, len(tokens), 2):
                tokens[i] = re.sub(r"(?<![-])\s-\s(?![-])", " --> ", tokens[i])
            ln = "".join(tokens)
        else:
            ln = re.sub(r"(?<![-])\s-\s(?![-])", " --> ", ln)
        out_lines.append(ln)
    return "\n".join(out_lines)


def _scrub_label_chars(s: str) -> str:
    """Make a label safe to live inside a Mermaid `[...]`/`(...)`/`{...}` block.

    Strips markdown emphasis and replaces characters that Mermaid's parser
    treats as syntax (``|`` for edge labels, ``#`` for comments, ``&`` for
    chained edges, angle brackets, backticks) with a benign Unicode variant
    or whitespace. Keeps the label human-readable.
    """
    # Strip leading/trailing markdown emphasis markers and inline code ticks.
    s = re.sub(r"(\*\*|__)(.+?)\1", r"\2", s)        # **bold** / __bold__
    s = re.sub(r"(?<!\\)\*(.+?)(?<!\\)\*", r"\1", s) # *italic*
    s = re.sub(r"`+", "", s)                          # backticks
    # Replace Mermaid-fragile chars.
    s = s.replace("|", "/").replace("#", "№")
    s = s.replace("&", "and").replace("<", "‹").replace(">", "›")
    # Collapse internal newlines + runs of spaces.
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _quote_bracket_labels(line: str) -> str:
    """For every bracket block on the line — `[label]`, `(label)`,
    `{label}`, `{{label}}` — scrub dangerous characters and force-quote
    the label when it contains anything beyond bare alphanumerics."""
    def _repl_factory(open_ch: str, close_ch: str):
        def _repl(m: re.Match[str]) -> str:
            inner = m.group(1)
            stripped = inner.strip()
            if not stripped:
                return m.group(0)
            # Already quoted? Still scrub the inside.
            if stripped.startswith('"') and stripped.endswith('"'):
                core = stripped[1:-1]
                core = _scrub_label_chars(core)
                core = core.replace("\\", "\\\\").replace('"', '\\"')
                return f'{open_ch}"{core}"{close_ch}'
            scrubbed = _scrub_label_chars(stripped)
            if scrubbed == "":
                return f'{open_ch}"·"{close_ch}'
            if re.search(r"[^A-Za-z0-9_]", scrubbed):
                safe = scrubbed.replace("\\", "\\\\").replace('"', '\\"')
                return f'{open_ch}"{safe}"{close_ch}'
            return f'{open_ch}{scrubbed}{close_ch}'
        return _repl

    # Order matters: handle `{{...}}` (rhombus) BEFORE `{...}` so the inner
    # braces aren't matched twice.
    line = re.sub(r"\{\{([^{}\n]*)\}\}", _repl_factory("{{", "}}"), line)
    line = re.sub(r"\{([^{}\n]*)\}", _repl_factory("{", "}"), line)
    line = re.sub(r"\(\(([^()\n]*)\)\)", _repl_factory("((", "))"), line)
    line = re.sub(r"\(([^()\n]*)\)", _repl_factory("(", ")"), line)
    line = re.sub(r"\[([^\[\]\n]*)\]", _repl_factory("[", "]"), line)
    return line


_EDGE_RE = re.compile(r"(<-->|<--|-->|--|<-\.->|<-\.-)")


def _camelcase_bare_refs(line: str) -> str:
    """In a flowchart body line, CamelCase any multi-word run that appears
    OUTSIDE bracketed labels — these are usually undeclared node refs like
    ``Random Forest`` on the right side of ``A --> Random Forest``.

    Skips bracket contents and the diagram-type header.
    """
    # Tokenise around bracket spans so labels stay intact.
    tokens = re.split(r"(\[[^\[\]\n]*\]|\([^()\n]*\)|\{[^{}\n]*\})", line)
    for i in range(0, len(tokens), 2):
        chunk = tokens[i]
        # Split on edge syntax so each chunk between edges is one node ref.
        parts = _EDGE_RE.split(chunk)
        for j, p in enumerate(parts):
            if _EDGE_RE.fullmatch(p or ""):
                continue
            stripped = p.strip()
            if not stripped:
                continue
            # Pipe-delimited edge label: `|"text"|` — leave it alone.
            if stripped.startswith("|"):
                continue
            words = stripped.split()
            if len(words) <= 1:
                continue
            # Already looks like CamelCase + something? Only collapse the
            # contiguous run of word-tokens at the start, leave any trailing
            # quoted label / shape in place.
            head_words: list[str] = []
            for w in words:
                if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", w):
                    head_words.append(w)
                else:
                    break
            if len(head_words) <= 1:
                continue
            camel = "".join(head_words)
            rest = stripped[len(" ".join(head_words)):]
            # Preserve leading / trailing whitespace from the original chunk.
            lead = p[: len(p) - len(p.lstrip())]
            trail = p[len(p.rstrip()):]
            parts[j] = f"{lead}{camel}{rest}{trail}"
        tokens[i] = "".join(parts)
    return "".join(tokens)


def _sanitize_flowchart(code: str) -> str:
    """Repair the most common LLM mistakes in a flowchart/graph block:
       1. Multi-word node IDs in declarations → CamelCase id.
       2. Same multi-word names appearing as plain references later → renamed.
       3. Bare multi-word references on either side of an edge (the model
          forgot to declare the node at all) → CamelCase'd.
       4. Bracket labels containing spaces/punctuation → force-quoted.

    The first line (the diagram-type header, e.g. ``flowchart LR``) is
    NEVER touched — otherwise our multi-word-id regex would happily eat
    ``flowchart LR Ensemble Learning`` as one giant id.
    """
    if not re.match(r"\s*(flowchart|graph)\b", code, re.IGNORECASE):
        return code

    # Split off the header so the body can be transformed in isolation.
    lines = code.splitlines()
    if not lines:
        return code
    # Find the first non-blank line — that's the header.
    header_idx = next((i for i, ln in enumerate(lines) if ln.strip()), 0)
    header = lines[header_idx]
    body = "\n".join(lines[header_idx + 1 :])

    rename: dict[str, str] = {}

    # 1. Find every declaration in the BODY and rewrite the id portion.
    cursor = 0
    parts: list[str] = []
    for m in _DECL_RE.finditer(body):
        raw_id = m.group("id")
        if " " not in raw_id:
            continue
        new_id = _camel(raw_id)
        if new_id == raw_id:
            continue
        rename[raw_id] = new_id
        parts.append(body[cursor : m.start("id")])
        parts.append(new_id)
        cursor = m.end("id")
    parts.append(body[cursor:])
    body = "".join(parts)

    # 2. Rewrite later standalone references to the declared old names —
    #    but only OUTSIDE bracketed label regions, so the human-readable
    #    "Ensemble Learning" inside `[Ensemble Learning]` survives intact.
    if rename:
        # Tokenise on `[...]` / `(...)` / `{...}` blocks. Even segments are
        # "outside" brackets and get the rename applied; odd segments are
        # the bracket contents and stay untouched.
        tokens = re.split(r"(\[[^\[\]\n]*\]|\([^()\n]*\)|\{[^{}\n]*\})", body)
        for i in range(0, len(tokens), 2):
            chunk = tokens[i]
            for old in sorted(rename.keys(), key=len, reverse=True):
                new = rename[old]
                chunk = re.sub(
                    rf"(?<![A-Za-z0-9_])({re.escape(old)})(?![A-Za-z0-9_])",
                    new, chunk,
                )
            tokens[i] = chunk
        body = "".join(tokens)

    # 3. Catch undeclared multi-word refs that sit on either side of an edge
    #    — e.g. `Introduction --> Random Forest`. CamelCase them so the parser
    #    sees a single id token instead of choking on the space.
    body = "\n".join(_camelcase_bare_refs(ln) for ln in body.splitlines())

    # 4. Quote bracketed labels that have spaces/punctuation.
    body_lines = [_quote_bracket_labels(ln) for ln in body.splitlines()]

    rebuilt = lines[: header_idx + 1] + body_lines
    return "\n".join(rebuilt)


def _sanitize_mindmap(code: str) -> str:
    """Strip markdown emphasis from mindmap bare-text nodes + pass any
    bracketed children through the same label scrubber the flowchart uses.

    Mindmap nodes can be:
        root((Text))   ← double-paren root
        ((Text))       ← circle
        [Text]         ← box
        (Text)         ← rounded
        Just text      ← bare-text leaf
    """
    if not re.match(r"\s*mindmap\b", code, re.IGNORECASE):
        return code
    out_lines: list[str] = []
    for ln in code.splitlines():
        # First normalise any bracket-style nodes on this line.
        ln = _quote_bracket_labels(ln)
        # Then strip markdown emphasis from bare text portions (anything
        # outside `(`, `[`, `{` brackets).
        if not re.search(r"[(\[{]", ln):
            # The whole non-blank content is bare text — scrub it.
            stripped = ln.lstrip()
            if stripped:
                indent = ln[: len(ln) - len(stripped)]
                ln = indent + _scrub_label_chars(stripped)
        out_lines.append(ln)
    return "\n".join(out_lines)


def _validate_mermaid(mermaid: str) -> tuple[bool, str, str]:
    """Return (ok, reason, repaired). Cheap structural check — not a parser.

    Repair pipeline:
      1. Strip ``` fences.
      2. Expand a single-line `head; body; body` into proper newlines.
      3. For flowchart/graph blocks, sanitise multi-word node IDs +
         force-quote bracket labels (the LLM's most common mistake).
      4. For mindmaps, scrub markdown emphasis in bare-text nodes and
         force-quote any bracketed labels.
    """
    if not mermaid or not mermaid.strip():
        return False, "empty mermaid", mermaid
    code = _strip_fences(mermaid).strip()
    code = _normalize_arrows(code)
    code = _repair_collapsed(code)
    code = _sanitize_flowchart(code)
    code = _sanitize_mindmap(code)
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
        # Generation strategy:
        #   1) initial generation attempt;
        #   2) on validation failure, a targeted LLM repair pass that gets the
        #      validator's complaint as feedback;
        #   3) one final fresh-generation retry if the repair also fails.
        groq = get_groq()
        attempts = 0
        last_reason = ""
        last_broken: str | None = None
        last_obj: dict | None = None
        MAX_ATTEMPTS = 3

        while attempts < MAX_ATTEMPTS:
            attempts += 1
            try:
                if attempts == 2 and last_broken is not None and last_reason:
                    # Attempt 2: targeted repair pass.
                    raw = await groq.repair_mermaid(
                        broken_mermaid=last_broken,
                        validation_error=last_reason,
                    )
                else:
                    # Attempts 1 + 3: fresh generation.
                    raw = await groq.generate_mermaid(
                        title=title, notes=capped, prompt=prompt, style=style,
                    )
            except Exception as exc:
                last_reason = f"groq call failed: {exc}"
                logger.warning("visuals: attempt %d groq fail (%s)", attempts, exc)
                continue

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
                last_broken = mermaid_raw or mermaid
                last_obj = obj
                logger.warning("visuals: attempt %d invalid (%s)", attempts, reason)
                continue

            diagram_type = _normalize_diagram_type(obj.get("diagram_type"), mermaid)
            visual = Visual(
                visual_id=visual_id,
                doc_id=doc_id,
                prompt=prompt,
                style=style,
                diagram_type=diagram_type,
                title=str(obj.get("title") or (last_obj or {}).get("title") or "Diagram"),
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
                "visuals: generated doc=%s id=%s type=%s len=%d attempts=%d",
                doc_id, visual_id, diagram_type, len(mermaid), attempts,
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
