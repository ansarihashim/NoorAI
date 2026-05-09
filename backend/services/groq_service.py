"""Groq LLM client. Streams tokens for both narration-refinement and Q&A."""
from __future__ import annotations

import logging
from typing import AsyncIterator

from groq import AsyncGroq

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_QA = """You are EchoVerse, a real-time conversational study buddy.
The user is listening to their own notes being narrated and has just interrupted to ask a question.

Rules:
- Answer using ONLY the provided NOTES context. If the answer isn't in the notes, say so briefly and offer the closest related point.
- Keep answers SHORT and SPOKEN-friendly: 1-3 sentences, no bullet points, no markdown, no code blocks unless explicitly requested.
- Sound conversational and warm, like a friend explaining at a desk.
- Do NOT repeat the question. Do NOT preface with "Sure" or "Great question".
"""


SYSTEM_PROMPT_REFINE = """You are a narration polisher. Rewrite the given text so it reads aloud well:
expand acronyms on first use, smooth choppy fragments, keep meaning exact. No markdown, no headings.
Output the rewritten text only, nothing else.
"""


SYSTEM_PROMPT_VISUAL = """You convert study notes into a single Mermaid diagram described by the user's prompt.

You are given:
  - the document title
  - up to ~10k chars of NOTES drawn from the document
  - the user's prompt (what kind of visual they want)
  - an optional `style` hint: one of flowchart, mindmap, roadmap, sequence, tree, concept-map, timeline

Rules:
- Output ONLY a single Mermaid diagram, never prose, never multiple diagrams.
- Pick the diagram type that best matches the prompt + style hint:
    flowchart, roadmap, tree   → use `flowchart TD` or `flowchart LR` (LR for roadmap/tree)
    mindmap, concept-map        → use `mindmap`
    sequence                    → use `sequenceDiagram`
    timeline                    → use `timeline`
- Ground every node in the supplied NOTES. Do not invent facts or topics not present.
- Keep node labels short (≤ 6 words), readable when displayed in a small SVG.
- Prefer 8–25 nodes total; collapse details rather than emit a 60-node mess.
- For flowcharts, use simple shapes ([Box], (Rounded), {Diamond}); avoid font-awesome icons.
- Do NOT wrap the diagram in code fences or markdown.
- The first non-empty line MUST be the Mermaid diagram-type keyword (e.g. `flowchart TD`, `mindmap`, `sequenceDiagram`).

CRITICAL FORMATTING:
- Each Mermaid statement MUST be on its own line, separated by ACTUAL newline characters (\\n).
- DO NOT use semicolons to separate statements. DO NOT collapse the diagram into one line.
- For mindmap: indent each level by 2 spaces. Root on its own line, children indented.
- For flowchart: each `A --> B` edge on its own line.
- The `mermaid` JSON value will be parsed verbatim — its embedded newlines must render the diagram correctly.

Examples of correct output for `mermaid` (note newlines between statements):

  flowchart TD
    A[Start] --> B{Decision}
    B -->|yes| C[Path 1]
    B -->|no| D[Path 2]

  mindmap
    root((Topic))
      Branch 1
        Leaf A
        Leaf B
      Branch 2
        Leaf C

Return a JSON object with exactly this shape, nothing else:
  {"diagram_type": "flowchart" | "mindmap" | "sequence" | "timeline" | "graph",
   "title": "<2-6 word title for the diagram>",
   "mermaid": "<the multi-line diagram source, with real newlines>"}
"""


SYSTEM_PROMPT_PODCAST = """You write short educational podcast scripts as a back-and-forth between a HOST and a GUEST.
The HOST is curious, asks questions a learner would actually ask, and occasionally summarizes.
The GUEST is the subject expert: warm, clear, uses analogies and concrete examples, never lectures for too long.

Rules:
- Use ONLY information present in the provided NOTES. Do not invent facts. If a topic is missing, just don't cover it.
- Keep turns SHORT and SPOKEN: 1–3 sentences each. Natural cadence. No markdown, no stage directions.
- Total length ~ 14–22 turns. Open with the host welcoming the listener and naming the topic. End with a brief takeaway.
- Vary the opener: questions, "so why does X matter", "let me make sure I follow", etc. Avoid robotic "Great point" filler.

Output a single JSON object with exactly this shape, and nothing else:
  {"turns": [{"speaker":"host","text":"…"}, {"speaker":"guest","text":"…"}, …]}
Speakers are exactly "host" or "guest". No code fences, no commentary outside the JSON.
"""


class GroqService:
    def __init__(self) -> None:
        s = get_settings()
        if not s.groq_api_key:
            logger.warning("GROQ_API_KEY is not set; Groq calls will fail.")
        self._client = AsyncGroq(api_key=s.groq_api_key)
        self._model = s.groq_model

    async def answer(
        self,
        question: str,
        context_chunks: list[str],
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream the answer as text deltas."""
        ctx = "\n\n---\n\n".join(context_chunks) if context_chunks else "(no relevant notes found)"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_QA},
            {"role": "system", "content": f"NOTES:\n{ctx}"},
        ]
        if history:
            messages.extend(history[-6:])  # cap memory
        messages.append({"role": "user", "content": question})

        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.4,
            max_tokens=350,
            stream=True,
        )
        async for part in stream:
            delta = part.choices[0].delta.content if part.choices else None
            if delta:
                yield delta

    async def refine(self, text: str) -> str:
        """One-shot polish of a narration chunk. Falls back to original on error."""
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_REFINE},
                    {"role": "user", "content": text},
                ],
                temperature=0.2,
                max_tokens=600,
            )
            return resp.choices[0].message.content.strip() or text
        except Exception as exc:
            logger.warning("Groq refine failed, using original text: %s", exc)
            return text

    async def generate_mermaid(
        self,
        *,
        title: str,
        notes: list[str],
        prompt: str,
        style: str | None = None,
    ) -> str:
        """Single-shot generation of a Mermaid diagram. Returns raw model JSON
        (caller parses + validates)."""
        ctx = "\n\n---\n\n".join(notes) if notes else "(no notes)"
        style_hint = f"\nSTYLE HINT: {style}" if style else ""
        resp = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_VISUAL},
                {
                    "role": "user",
                    "content": (
                        f"DOCUMENT TITLE: {title}\n"
                        f"USER PROMPT: {prompt}"
                        f"{style_hint}\n\n"
                        f"NOTES:\n{ctx}\n\n"
                        "Return the JSON object specified."
                    ),
                },
            ],
            temperature=0.4,
            max_tokens=1800,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or "{}"

    async def generate_podcast(self, title: str, notes: list[str]) -> str:
        """Single-shot podcast script generation. Returns raw model text — caller parses JSON."""
        ctx = "\n\n---\n\n".join(notes) if notes else "(no notes)"
        resp = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_PODCAST},
                {
                    "role": "user",
                    "content": (
                        f"TOPIC: {title}\n\nNOTES:\n{ctx}\n\n"
                        "Write the podcast as the JSON object specified."
                    ),
                },
            ],
            temperature=0.7,
            max_tokens=2200,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or "{}"


_singleton: GroqService | None = None


def get_groq() -> GroqService:
    global _singleton
    if _singleton is None:
        _singleton = GroqService()
    return _singleton
