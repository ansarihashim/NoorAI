"""Prompt template for the night-before-exam chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build a "night before the exam" cheat sheet for the document titled: {title}

Each item is a single line of high-yield content. Mix CATEGORIES (set the `category` field):
- "definition": one-line definitions of important terms.
- "formula": formulas / equations with brief context.
- "derivation": one-line derivation summaries (key insight, not full work).
- "mistake": common mistakes / misconceptions to avoid.
- "high_yield": "if you only remember 5 things, remember these" — must-know facts.

Rules:
- Aim for {n} items total; bias toward definition + formula + high_yield.
- Each item's `content` is 1-2 sentences MAX. Tight. Memorizable.
- Set `importance` 1-5 (5 = absolutely must remember).
- Set `exam_probability` 0.0-1.0 — your honest estimate of how likely this concept appears in an exam.
- Cover the WHOLE document, not just the first paragraph.
- Every item MUST cite at least one chunk in `grounded_chunks`.
- Skip anything not in the NOTES — even if it would normally be high-yield in this subject.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the NightBeforeSet schema."""

NIGHT_BEFORE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
