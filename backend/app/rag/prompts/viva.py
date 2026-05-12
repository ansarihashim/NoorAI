"""Prompt template for the viva-prep chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

_TASK = """Build {n} viva-style questions for the document titled: {title}

A viva tests UNDERSTANDING under live questioning. Each item is one main question plus the follow-ups an examiner would use to probe whether the student really gets it.

EACH QUESTION:
- `question`: a question an examiner would ask in a 5-minute viva. Phrased as if spoken. Prefer:
    * mechanism probes ("Walk me through what happens when…");
    * comparison probes ("How is X different from Y, and why does the difference matter?");
    * judgement probes ("When would you NOT use X? Why?");
    * boundary probes ("What's the smallest input that breaks this?");
    * causal probes ("If we removed step N, what fails first?").
  Avoid "Define X" as the main question (that's a flashcard, not a viva).
- `expected_answer`: 2-4 sentences of gold-standard answer. Confident, specific, in the NOTES' terminology. This is what a strong student would actually say out loud — not a textbook excerpt.
- `follow_ups`: 1-3 SHORT drill-down questions an examiner would use to test depth. Each follow-up should require deeper reasoning than the main question — never just a paraphrase of it. Examples: "Why does that fail?", "Show me an example where that doesn't hold.", "How would you prove this?"
- `difficulty`: easy / medium / hard — calibrated to the depth of the question, not the topic.

MIX:
- Roughly 30% easy / 50% medium / 20% hard.

COVERAGE:
- Span the WHOLE document. Don't crowd questions onto a single chunk.
- Every question MUST cite at least one chunk in `grounded_chunks`.

ANTI-PATTERNS:
- `follow_ups` that are just rewordings of the main question.
- `expected_answer` that hedges ("It depends…") when the NOTES are crisp.
- Multiple questions that test the same chunk in slightly different words.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the VivaSet schema."""

VIVA_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
