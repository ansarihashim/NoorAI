"""Prompt template for the active recall chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM, GROUNDED_SYSTEM_STREAM

_TASK = """Build {n} active-recall prompts for the document titled: {title}

Active recall makes the student PRODUCE the answer from memory — not recognise it. Each prompt below pushes a different retrieval pattern.

PROMPT KINDS (set the `kind` field):
- "concept" — open-ended depth probe. "Explain how X works" / "Why does Y happen?" / "Walk through the steps of Z." `expected` is a 2-4 sentence model answer that hits the key beats.
- "fill_in_blank" — a sentence drawn from the NOTES with ONE high-information term replaced by ____. The blank should be the load-bearing word (a key term, formula symbol, or distinguishing word), not an article. `expected` is the missing term, exactly.
- "explain_in_own_words" — "In your own words, describe X." `expected` is a 1-2 sentence model answer in plain language that nevertheless preserves precision.
- "short" — one-line factual recall ("Define ATP" / "State Bayes' rule"). `expected` is the short answer in one tight sentence.

MIX (guideline, not a quota):
- Roughly 35% concept, 25% fill_in_blank, 25% explain_in_own_words, 15% short.
- More important than the mix: cover the syllabus breadth, and bias toward the chunks where the NOTES go deep.

QUALITY:
- `expected` is the gold-standard answer — what a top student would say. No hedging. No "it depends" unless the NOTES make the dependency explicit.
- Don't pad fill-in-blanks with throwaway sentences. Pick sentences that are themselves worth committing to memory.
- Every prompt MUST cite at least one chunk in `grounded_chunks`.
- Anti-patterns: concept prompts that ask the same thing as a previous fill-in-blank; blanks where the word is obvious from context; "describe X" with a definition-only answer.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the RecallSet schema."""

RECALL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])


# --- Streaming (JSONL) variant -------------------------------------------------
_STREAM_FOOTER = """STREAMING OUTPUT (read carefully):
- Emit each recall prompt as a SEPARATE JSON object on its OWN line (JSON Lines). One object, a newline, the next object.
- Do NOT wrap them in an array or a top-level object. No prose, no markdown fences, no blank lines.
- Each line must be exactly one JSON object with these keys:
  {{"prompt": "...", "kind": "concept|fill_in_blank|explain_in_own_words|short", "expected": "...", "grounded_chunks": [0]}}
Begin now — one recall JSON object per line, nothing else."""

_STREAM_TASK = _TASK.replace(
    "Return a single JSON object matching the RecallSet schema.", _STREAM_FOOTER
)

RECALL_STREAM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM_STREAM),
    ("user", _STREAM_TASK),
])
