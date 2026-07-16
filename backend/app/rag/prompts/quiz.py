"""Prompt template for the quiz chain."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM, GROUNDED_SYSTEM_STREAM

_TASK = """Build {n} exam-grade quiz questions for the document titled: {title}

Mix question TYPES (set the `type` field accordingly):
- "mcq" — 4 options, EXACTLY one correct. Set `correct_index` (0-3). See distractor rules below.
- "conceptual" — short open-ended. `options` empty, `correct_index` 0. The `explanation` IS the model answer.
- "assertion_reason" — two statements (Assertion / Reason), 4 options describing combinations of truth values, 1 correct. Set `correct_index`.

MCQ DISTRACTOR RULES (the difference between a good MCQ and a bad one):
- The correct option must be unambiguously supported by the NOTES.
- Each of the 3 distractors should be a PLAUSIBLE misconception or a near-miss — not "obviously wrong" filler.
  Good distractors target: confusable adjacent concepts, off-by-one mistakes, common student errors, statements that are true in general but not in the context the question sets up.
- No "All of the above" / "None of the above" unless the NOTES explicitly support that as an answer.
- Options must be comparable in length and grammatical form — never make the correct option twice as long as the others.

MIX:
- Roughly 60% MCQ, 25% conceptual, 15% assertion-reason. Treat as a guideline; coverage is the real goal.

QUALITY:
- `explanation` is 1-3 sentences. It must (a) state the correct answer and (b) say briefly why, grounded in the NOTES. For MCQs, optionally add one sentence on why a tempting distractor is wrong.
- Cover the WHOLE document. Do not cluster on one chunk.
- Every question MUST cite at least one chunk in `grounded_chunks`.
- No trick questions or trivia outside the NOTES.

NOTES (numbered by chunk index):
{context}

Return a single JSON object matching the QuizSet schema."""

QUIZ_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])


# --- Streaming (JSONL) variant -------------------------------------------------
_STREAM_FOOTER = """STREAMING OUTPUT (read carefully):
- Emit each question as a SEPARATE JSON object on its OWN line (JSON Lines). One object, a newline, the next object.
- Do NOT wrap them in an array or a top-level object. No prose, no markdown fences, no blank lines.
- Each line must be exactly one JSON object with these keys:
  {{"question": "...", "type": "mcq|conceptual|assertion_reason", "options": ["..."], "correct_index": 0, "explanation": "...", "grounded_chunks": [0]}}
Begin now — one question JSON object per line, nothing else."""

_STREAM_TASK = _TASK.replace(
    "Return a single JSON object matching the QuizSet schema.", _STREAM_FOOTER
)

QUIZ_STREAM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM_STREAM),
    ("user", _STREAM_TASK),
])
