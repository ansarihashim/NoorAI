"""Prompt template for the night-before-exam chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM, GROUNDED_SYSTEM_STREAM

_TASK = """Build a "NIGHT BEFORE THE EXAM" cheat sheet for the document titled: {title}

This is the single-page revision sheet the student reads last. Each item is one line of HIGH-YIELD content. If something doesn't pay off for an exam — leave it out.

CATEGORIES (set the `category` field):
- "definition" — one-line definition of an important term. Precise, in the NOTES' wording.
- "formula" — formula / equation with its variable meanings AND its scope of validity (when it applies).
- "derivation" — one-line summary of a derivation's KEY INSIGHT (the trick or substitution that makes it work), not the full algebra.
- "mistake" — a common misconception or trap the NOTES warn against ("Don't confuse X with Y because…").
- "high_yield" — a must-remember fact, statement, or distinction the NOTES emphasise hard.

ITEM DESIGN:
- `content` is 1-2 sentences MAX. Memorisable in one read. Specific.
- Prefer items that compress a lot of meaning into a short line. Avoid generic statements ("X is important").
- Set `importance` 1-5:
    5 = absolutely must remember — drops a whole topic if missed.
    4 = high payoff — saves a question.
    3 = useful — buys partial credit.
    2 = nice to know.
    1 = peripheral.
  Be honest. A sheet of all-5s is useless.
- Set `exam_probability` 0.0-1.0 honestly. High (>0.8) only if the NOTES treat the item as a centerpiece (dedicated section, repeated reference, worked example).

COVERAGE:
- Aim for {n} items. Bias toward definition + formula + high_yield, but include at least 1-2 "mistake" items if the NOTES warn against anything.
- Cover the WHOLE document — not just the first few chunks.
- Every item MUST cite at least one chunk in `grounded_chunks`.

ANTI-PATTERNS:
- Definitions that are circular ("Velocity is the velocity of a moving object").
- Formulas without variable meanings.
- "Mistakes" the NOTES don't actually flag — don't invent traps.
- Multiple items that say the same thing in different words.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the NightBeforeSet schema."""

NIGHT_BEFORE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])


# --- Streaming (JSONL) variant -------------------------------------------------
_STREAM_FOOTER = """STREAMING OUTPUT (read carefully):
- Emit each cheat-sheet item as a SEPARATE JSON object on its OWN line (JSON Lines). One object, a newline, the next object.
- Do NOT wrap them in an array or a top-level object. No prose, no markdown fences, no blank lines.
- Each line must be exactly one JSON object with these keys:
  {{"category": "definition|formula|derivation|mistake|high_yield", "content": "...", "importance": 3, "exam_probability": 0.5, "grounded_chunks": [0]}}
Begin now — one item JSON object per line, nothing else."""

_STREAM_TASK = _TASK.replace(
    "Return a single JSON object matching the NightBeforeSet schema.", _STREAM_FOOTER
)

NIGHT_BEFORE_STREAM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM_STREAM),
    ("user", _STREAM_TASK),
])
