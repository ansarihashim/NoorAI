"""Prompt template for the flashcard chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM, GROUNDED_SYSTEM_STREAM

_TASK = """Build {n} flashcards for the document titled: {title}

A flashcard is a single atomic prompt → answer pair the student will see in seconds. Design like a spaced-repetition expert: one card = one fact, distinction, or mechanism.

CARD DESIGN PRINCIPLES:
- The QUESTION must isolate ONE thing. If you're tempted to write "and" in the question, split it into two cards.
- The QUESTION must be answerable WITHOUT the question text appearing in the answer. If the answer is essentially the question rephrased, the card is broken — rewrite it.
- The ANSWER is tight — typically one sentence, two at most. A flashcard answer is not a paragraph.
- Prefer cards that test:
    * precise definitions (term → exact definition),
    * distinctions (X vs Y: what is the discriminating property?),
    * mechanisms ("Why does X happen?" → one-line cause),
    * formula recall (formula → name, or name → formula),
    * worked-example triggers ("What goes wrong if you skip step N?").
- Avoid: "Explain X in detail" cards (too broad), trivia not in the NOTES, two-part questions, cards whose answer is a list of more than 4 items.

DIFFICULTY MIX:
- About 30% easy (raw recall), 50% medium (apply / distinguish), 20% hard (mechanism / synthesis). Set `difficulty` accordingly. Treat the mix as a guideline — what matters more is covering the NOTES' breadth honestly.

COVERAGE:
- Spread cards across the WHOLE document. No more than ~3 cards on any one chunk.
- Every card MUST cite at least one chunk in `grounded_chunks`.

TAGS:
- Lowercase, 1-3 words each, max 6 per card. Tags should form an emergent taxonomy across the deck — pick consistent labels (e.g. always "raft consensus", not sometimes "raft" and sometimes "consensus algorithm").

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the FlashcardSet schema."""

FLASHCARD_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])


# --- Streaming (JSONL) variant -------------------------------------------------
# Same guidance as _TASK; only the final output instruction changes to JSON
# Lines. Literal JSON braces are doubled so ChatPromptTemplate treats them as
# text (single-brace {n}/{title}/{context} remain template variables).
_STREAM_FOOTER = """STREAMING OUTPUT (read carefully):
- Emit each flashcard as a SEPARATE JSON object on its OWN line (JSON Lines). One object, a newline, the next object.
- Do NOT wrap them in an array or a top-level object. No prose, no markdown fences, no blank lines.
- Each line must be exactly one JSON object with these keys:
  {{"question": "...", "answer": "...", "difficulty": "easy|medium|hard", "tags": ["..."], "grounded_chunks": [0]}}
Begin now — one flashcard JSON object per line, nothing else."""

_STREAM_TASK = _TASK.replace(
    "Return a single JSON object matching the FlashcardSet schema.", _STREAM_FOOTER
)

FLASHCARD_STREAM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM_STREAM),
    ("user", _STREAM_TASK),
])
