"""Prompt template for the flashcard chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build {n} flashcards for the document titled: {title}

Rules specific to flashcards:
- Each card has a short, focused QUESTION (the kind a student would self-test on) and a tight ANSWER.
- Mix difficulties: roughly 30% easy, 50% medium, 20% hard — set the `difficulty` field accordingly.
- Cover the full breadth of the NOTES; don't cluster all cards on one paragraph.
- Tags should be lowercase 1-3 word topic labels (max 6 per card).
- Every card MUST cite at least one chunk in its `grounded_chunks` array.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the FlashcardSet schema."""

FLASHCARD_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
