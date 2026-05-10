"""Prompt template for the quiz chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build {n} quiz questions for the document titled: {title}

Mix question TYPES (set the `type` field accordingly):
- "mcq": 4 plausible options where exactly one is correct. Set `correct_index` to the option's 0-based index.
- "conceptual": short open-ended question. `options` should be empty, `correct_index` 0.
- "assertion_reason": "Assertion: ... Reason: ..." pattern with 4 options describing the truth value of each. Set correct_index.

Rules:
- Roughly 60% MCQ, 25% conceptual, 15% assertion-reason.
- Cover the full breadth of the NOTES; do not cluster on one paragraph.
- Every question MUST cite at least one chunk in `grounded_chunks`.
- The `explanation` is short (1-3 sentences) and ALWAYS justifies the correct answer using only the NOTES.
- For conceptual questions, the explanation IS the model answer.
- Do NOT use trick questions or trivia outside the NOTES.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the QuizSet schema."""

QUIZ_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
