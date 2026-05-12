"""Prompt template for the active recall chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

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
