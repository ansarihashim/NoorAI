"""Prompt template for the quick-revision chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

_TASK = """Produce a TOPPER-STYLE rapid-revision sheet for the document titled: {title}

This is the document a student reads in the final 30 minutes before walking into the exam. Dense, precise, exam-focused.

Group the content into AT MOST {max_topics} topics. For each topic:
- `title`: 2-5 word topic label using the NOTES' own terminology.
- `summary`: 3-6 sentences. Hit, in this order:
    1) the definition / core idea (in the NOTES' words);
    2) the mechanism or key formula (precise);
    3) the discriminating fact — what makes this topic different from the topic it's most easily confused with;
    4) the most exam-likely angle the NOTES emphasise.
   No filler ("In this section we discuss…"). No hedging.
- `key_points`: 3-6 bullet strings (plain strings, no leading "-" or "•"). Each is a single line worth memorising verbatim:
    * a precise definition;
    * a formula or rule with its scope;
    * a contrast pair ("X vs Y: X has property A, Y has property B");
    * a "watch out" / common mistake to avoid;
    * a high-yield example from the NOTES.
- `grounded_chunks`: at least one chunk index per topic.

DESIGN RULES:
- PRIORITISE high-yield content. Topics the NOTES spend significant space on get a topic entry; topics mentioned in passing don't.
- Cover the WHOLE document. If you find yourself writing two near-duplicate topics, MERGE them.
- Don't paraphrase definitions so loosely they lose precision. Keep technical terms.
- If the NOTES are very small, return fewer topics rather than padding.

ANTI-PATTERNS:
- Topic titles like "Introduction" or "Conclusion".
- `key_points` that restate the `summary`.
- Bullet strings longer than ~20 words.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the QuickRevisionSet schema."""

QUICK_REVISION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
