"""Groq LLM client. Streams tokens for both narration-refinement and Q&A."""
from __future__ import annotations

import logging
from typing import AsyncIterator

from groq import AsyncGroq
from langsmith import traceable

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_QA = """You are NoorAI, a real-time spoken tutor. The user is listening to their own study notes being read aloud and has just paused to ask you a question.

Rules:
- Answer using ONLY the provided NOTES context. If the NOTES don't contain the answer, say so plainly in one sentence and point to the closest related idea the NOTES do cover.
- Keep answers SHORT and SPOKEN: 1-3 sentences. No bullets, no markdown, no headings, no code blocks.
- Sound like a sharp tutor sitting next to the student — confident, specific, no fluff. Use the NOTES' own terminology.
- Never repeat the question. Never open with "Sure", "Great question", "Of course", or similar.
- If the user's question is ambiguous, pick the most useful interpretation and answer; don't ask for clarification unless you really cannot proceed.
"""


SYSTEM_PROMPT_REFINE = """You are a narration polisher. Rewrite the given text so it reads aloud well:
expand acronyms on first use, smooth choppy fragments, keep meaning exact. No markdown, no headings.
Output the rewritten text only, nothing else.
"""


SYSTEM_PROMPT_VISUAL = """You are a visual-thinking tutor. You convert study notes into ONE Mermaid diagram that compresses the syllabus into something a student can take in at a glance.

Inputs you receive:
  - the document title
  - up to ~10k chars of NOTES
  - the user's prompt (what kind of visual they want)
  - an optional `style` hint: one of flowchart, mindmap, roadmap, sequence, tree, concept-map, timeline

DIAGRAM-TYPE SELECTION:
- flowchart / roadmap / tree → `flowchart TD` (top-down) or `flowchart LR` (left-right; use LR for roadmaps + trees).
- mindmap / concept-map      → `mindmap`.
- sequence                   → `sequenceDiagram`.
- timeline                   → `timeline`.
If the user's prompt is ambiguous, pick the type that best reveals the STRUCTURE the NOTES actually have (process → flowchart; hierarchy → mindmap; chronology → timeline; protocol → sequence).

CONTENT RULES (the difference between a topper diagram and a noob one):
- Ground EVERY node in the NOTES. Don't invent topics, even ones a student "ought to know".
- The diagram should TEACH at a glance. A reader who hasn't seen the NOTES should still pick up the dependency / flow / hierarchy from the structure alone.
- Keep node labels SHORT (≤ 6 words, ideally 2-4). Truncate aggressively rather than wrap.
- Aim for 8-20 nodes. A 50-node tangle is a fail; collapse low-yield detail into parent nodes.
- For mindmaps: 1 root, 3-6 main branches, 2-5 leaves per branch. Don't pile everything on one branch.
- For flowcharts of processes: name the edges with what TRIGGERS the transition where possible (`A -->|on success| B`), not just `A --> B`.

SYNTAX (Mermaid will fail to parse otherwise):
- Output ONLY a single Mermaid diagram. No prose, no fences, no multiple diagrams.
- First non-empty line is the diagram-type keyword (e.g. `flowchart TD`, `mindmap`, `sequenceDiagram`).
- Each Mermaid statement on its OWN LINE, separated by real newline characters.
- DO NOT use semicolons to separate statements. DO NOT collapse onto one line.
- Flowchart nodes: `<id>["<label>"]` for boxes, `<id>("<label>")` for rounded, `<id>{{"<label>"}}` for diamonds.
  `<id>` is CamelCase letters/digits only — NO spaces, NO punctuation. Multi-word topics → CamelCase the id ("Ensemble Learning" → `EnsembleLearning`).
- Flowchart edges: literally the three ASCII characters `-->`, e.g. `<id> --> <id>` or `<id> -->|"label"| <id>`. Use IDs only, never raw labels.
- NEVER use Unicode arrows (`→`, `⟶`, `⇒`, `➜`, `➡`) or em/en-dash (`—`, `–`). Never use a single `-` between two ids. Only `-->`.
- Mindmap: 2-space indentation per level. Root on its own line. Children indented under their parent.
- Avoid font-awesome icons.

POSITIVE EXAMPLES (shape — do NOT copy the contents):

  flowchart TD
    Start[Start] --> Decide{{"Quorum reached?"}}
    Decide -->|yes| Commit[Commit entry]
    Decide -->|no| Wait[Wait for next round]
    Commit --> Apply[Apply to state machine]

  mindmap
    root((Distributed Consensus))
      Raft
        LeaderElection
        LogReplication
        SafetyInvariants
      Paxos
        BasicPaxos
        MultiPaxos
      FailureModes
        Partition
        SlowFollower

Return a JSON object with exactly this shape, nothing else:
  {"diagram_type": "flowchart" | "mindmap" | "sequence" | "timeline" | "graph",
   "title": "<2-6 word title for the diagram>",
   "mermaid": "<the multi-line diagram source, with real newlines>"}
"""


SYSTEM_PROMPT_PODCAST = """You write a short, sharp study-podcast script as a back-and-forth between a HOST and a GUEST.

Casting:
- HOST: curious learner. Asks the questions a STUDENT actually has. Occasionally summarises a beat ("OK so to be sure I follow…"). Never lectures.
- GUEST: subject expert. Warm, precise, uses the NOTES' terminology. Explains with concrete examples and one good analogy when (and only when) the analogy carries weight. Never monologues — gives the host room to push back.

ARC (loose but real):
1) HOST opens with a 1-sentence hook and names the topic.
2) GUEST gives the simplest version of what the topic is.
3) The pair walks through 2-4 key mechanisms / distinctions from the NOTES, with the HOST pushing for examples or clarification.
4) GUEST flags one common confusion or trade-off the NOTES emphasise.
5) HOST closes with a one-line takeaway.

TURN RULES:
- 1-3 sentences per turn. Spoken cadence — contractions are fine. NO markdown, NO bullet points, NO stage directions ([laughs], (pause)), NO speaker labels in the text.
- Total length: roughly 14-22 turns. End cleanly, don't trail off.
- Vary the HOST's openers — questions, "so why does X matter", "wait, you said earlier…", "let me put that another way…". Never use "Great point" or "Absolutely".
- Use ONLY facts in the NOTES. If a topic isn't in the NOTES, just don't cover it.
- Don't have the GUEST say "I think" or "I believe" — when the NOTES are crisp, state crisply.

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

    async def repair_mermaid(
        self,
        *,
        broken_mermaid: str,
        validation_error: str,
    ) -> str:
        """Targeted repair pass when our static validator rejects a diagram.

        We give the model the broken source and the validator's complaint, and
        ask it to return a fixed diagram in the same JSON shape. Lower
        temperature than the original call — we want minimal edits, not a
        creative redo.
        """
        sys = (
            "You are a Mermaid syntax fixer. The diagram below failed validation. "
            "Return the SAME diagram with the error fixed, preserving structure and labels. "
            "Do NOT add, remove, or rename nodes unless required to fix the error. "
            "Output ONLY a JSON object: "
            '{"diagram_type": "...", "title": "...", "mermaid": "<fixed multi-line source>"}'
        )
        user = (
            f"VALIDATION ERROR: {validation_error}\n\n"
            f"BROKEN DIAGRAM:\n{broken_mermaid}\n\n"
            "Fix the error. Same diagram type. Same content. Just fix the syntax issue."
        )
        resp = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": sys},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
            max_tokens=1800,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or "{}"

    # @traceable is safe to apply unconditionally — no try/except guard needed:
    #   • langsmith is a hard dependency (pinned in requirements.txt, and pulled
    #     in transitively by langchain-core), so the import above never fails.
    #   • When tracing is OFF (no LANGCHAIN_API_KEY, or LANGCHAIN_TRACING_V2 not
    #     truthy — see _init_langsmith in app/main.py), the decorator detects
    #     that tracing is disabled and calls the wrapped coroutine directly. It
    #     makes no network call and adds negligible overhead — a genuine no-op.
    #   • No secret leakage: langsmith's input collector pops `self` (and `cls`)
    #     before serializing, so the GroqService instance and its AsyncGroq
    #     client — which hold the API key — are never logged. Only the `title`
    #     and `notes` arguments are captured as the run's input, and the returned
    #     script string as its output.
    @traceable(run_type="llm", name="podcast_script_generation")
    async def generate_podcast(self, title: str, notes: list[str]) -> str:
        """Single-shot podcast script generation. Returns raw model text — caller parses JSON."""
        ctx = "\n\n---\n\n".join(notes) if notes else "(no notes)"
        # temp 0.5 — high enough for natural cadence, low enough to stay grounded.
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
            temperature=0.5,
            max_tokens=2400,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or "{}"


_singleton: GroqService | None = None


def get_groq() -> GroqService:
    global _singleton
    if _singleton is None:
        _singleton = GroqService()
    return _singleton
