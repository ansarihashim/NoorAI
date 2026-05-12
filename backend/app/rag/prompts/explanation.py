"""Prompt template for the simplest-explanation chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

_TASK = """Explain the topic "{topic}" the way a brilliant tutor explains it to a peer who has never seen it before. Ground every claim in the NOTES.

Output a SimpleExplanation object:
- `topic`: the topic name (echo what was asked).
- `explanation`: 4-10 sentences with a clear progression:
    1) anchor — what kind of thing is this and where does it sit in the subject;
    2) intuition — the mental picture, in everyday language;
    3) mechanism — how it actually works, using the NOTES' own terminology (define any jargon the first time it appears);
    4) why-it-matters — the consequence, contrast, or use-case the NOTES highlight.
   Plain English. Confident. No hedging, no "essentially", no "basically".
- `analogies`: 0-3 SHORT analogies (one sentence each). Each analogy must (a) be familiar, (b) have a structural match to the mechanism, not just a vibe match. Skip rather than invent a weak one.
- `examples`: 0-3 concrete examples. Prefer examples the NOTES give. If the NOTES give none, you may construct a minimal example that follows directly from the mechanism in the NOTES — but never bring in domain knowledge the NOTES don't cover.
- `chunks`: ChunkRef objects {{"doc_id": "...", "chunk_idx": 0}} covering every substantive claim. At least one.

RULES:
- ONLY use information from the NOTES. If the topic isn't covered, say so plainly in `explanation` (one sentence) and return empty `analogies` and `examples`.
- Use second person ("you") to keep it conversational.
- No "Sure!", no "Great question!" — just the explanation.
- Anti-patterns: defining the topic by repeating its name ("Consensus is when systems reach consensus"); chained analogies; bullet-list explanations.

NOTES:
{context}

Return a single JSON object matching the SimpleExplanation schema."""

EXPLANATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
