"""Prompt template for the quick-revision chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Produce a concise revision summary of the document titled: {title}

Group the content into AT MOST {max_topics} TOPICS. For each topic:
- `title`: 2-5 word topic label.
- `summary`: 3-6 sentences that a student would re-read the night before an exam. Tight, exam-oriented, no fluff.
- `key_points`: 3-6 bullet-style strings — the must-remember facts/formulas/distinctions.
- `grounded_chunks`: at least one RAG chunk index that supports this topic.

Rules:
- Cover the WHOLE document; pick topics that span its breadth.
- Don't repeat content across topics — each topic should have a distinct angle.
- No markdown headers, no numbering inside summary/key_points strings.
- If the NOTES are very small, return fewer topics rather than padding.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the QuickRevisionSet schema."""

QUICK_REVISION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
