"""Prompt template for the simplest-explanation chain."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Explain the topic "{topic}" at the simplest possible level, grounded in the NOTES.

Audience: a curious beginner who has never seen this material before. Pretend you are teaching a friend.

Output a SimpleExplanation object:
- `topic`: the topic name (echo what was asked).
- `explanation`: 4-10 sentences. Plain English. No jargon without defining it.
   Use everyday words. Be precise but unhurried. Focus on intuition first, then mechanics.
- `analogies`: 1-3 SHORT analogies (one sentence each) that link the topic to something familiar.
   Skip if no honest analogy fits — better to omit than to invent a bad one.
- `examples`: 1-3 concrete examples FROM THE NOTES. If the NOTES don't contain examples, use examples
   that follow directly from the NOTES' content (not invented domain knowledge).
- `chunks`: list of ChunkRef objects ({{"doc_id": "...", "chunk_idx": 0}}) covering every claim
   in the explanation. At least one entry.

Rules:
- ONLY use information from the NOTES. If the topic isn't covered, say so in `explanation` and
  return an empty `analogies` and `examples`.
- Use second-person ("you") to keep it conversational.
- Keep each analogy to a single sentence; don't chain analogies on top of analogies.

NOTES:
{context}

Return a single JSON object matching the SimpleExplanation schema."""

EXPLANATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
