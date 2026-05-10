"""Prompt template for the Preparation important-questions chain (multi-doc)."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build the {n} most important exam-oriented questions for the material described by the NOTES.

The NOTES may come from multiple documents — each chunk is prefixed with
[<doc_id>#<chunk_idx>] so you can cite specific sources.

For each question:
- `question`: a clear, exam-style question.
- `answer`: a tight, complete answer (2-6 sentences) grounded entirely in the NOTES.
- `type`: one of:
    "recall"    — straightforward fact recall
    "apply"     — apply a concept to a scenario
    "analyze"   — break down / compare / contrast
    "evaluate"  — judge / weigh / argue
- `confidence`: 0.0-1.0 — how confident you are this is *the* kind of question that would appear.
- `chunks`: list of ChunkRef objects ({{"doc_id": "...", "chunk_idx": 0}}). At least one entry.

Rules:
- Mix difficulty: ~30% recall, 35% apply, 25% analyze, 10% evaluate.
- Cover breadth — different topics, not all on one chunk.
- The answer MUST be derivable from the NOTES; if you don't have the information, skip the question.
- Do NOT include any general-knowledge filler not in the NOTES.

NOTES:
{context}

Return a single JSON object matching the ImportantQuestionSet schema."""

IMPORTANT_QUESTIONS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
