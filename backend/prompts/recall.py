"""Prompt template for the active recall chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build {n} active-recall prompts for the document titled: {title}

Active recall blends prompt KINDS (set the `kind` field):
- "concept": "Explain how X works" / "Why does Y happen?" — open-ended, deep.
- "fill_in_blank": a sentence from the notes with a key term replaced by ____. Put the missing term in `expected`.
- "explain_in_own_words": "In your own words, describe X." `expected` is a 1-2 sentence model answer.
- "short": one-line factual recall ("Define ATP"). `expected` is the short answer.

Rules:
- Roughly 35% concept, 25% fill_in_blank, 25% explain_in_own_words, 15% short.
- Cover the full breadth of the NOTES.
- The `expected` field is what a strong student would say — concise, exam-oriented, grounded.
- Every prompt MUST cite at least one chunk in `grounded_chunks`.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the RecallSet schema."""

RECALL_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
