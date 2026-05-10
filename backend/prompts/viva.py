"""Prompt template for the viva-prep chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build {n} viva-style questions for the document titled: {title}

Viva questions probe understanding, not just recall. For each question:
- `question`: a question an examiner would ask in a 5-minute viva.
- `expected_answer`: a tight 2-4 sentence model answer (what a strong student would say).
- `follow_ups`: 1-3 short follow-up questions an examiner might ask if the answer is shallow.
- `difficulty`: easy / medium / hard — calibrated to the depth of the question.

Rules:
- Vary difficulty: ~30% easy, 50% medium, 20% hard.
- Cover the WHOLE document.
- Prefer "why" / "how" / "what if" / "compare" questions over "define X".
- Every question MUST cite at least one chunk in `grounded_chunks`.
- The `expected_answer` is the GOLD STANDARD answer; don't hedge or add caveats.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the VivaSet schema."""

VIVA_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
