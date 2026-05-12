"""Prompt template for the Preparation important-questions chain (multi-doc)."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

_TASK = """Write the {n} most exam-worthy questions for the material in the NOTES — the questions a top student would predict will appear on the paper.

The NOTES may come from multiple documents — each chunk is prefixed with
[<doc_id>#<chunk_idx>] so you can cite specific sources.

Return a SINGLE JSON object with exactly:
- `title`: a precise subject-line for this question set (e.g. "Distributed Consensus — exam-worthy questions"). REQUIRED.
- `questions`: an array of question objects (length {n}).

Each question object:
- `question`: a CLEAN exam question. Self-contained — a student reading it for the first time should know what's being asked without seeing the NOTES.
- `answer`: 2-6 sentences. A model answer a top student would write — definitions stated precisely, mechanisms explained with the NOTES' terminology, edge cases acknowledged where the NOTES raise them. No filler.
- `type`: one of "recall" | "apply" | "analyze" | "evaluate".
    recall   — state / define / list (memory & comprehension).
    apply    — use a concept in a NEW scenario or worked example.
    analyze  — compare, contrast, break down a process, identify the cause of an outcome.
    evaluate — argue, judge, weigh trade-offs, justify a design choice.
- `confidence`: 0.0-1.0. Score this honestly — high (>0.8) only if the topic gets sustained attention in the NOTES and is the kind of thing exams test; low (<0.5) if you included it for breadth.
- `chunks`: non-empty array of ChunkRef objects {{"doc_id": "...", "chunk_idx": <int>}}.

DESIGN GUIDELINES:
- DO NOT cluster questions on a single chunk or topic. Spread coverage across the entire syllabus.
- Mix cognitive depth — at least a third of the questions should be apply/analyze/evaluate. A list of pure "define X" questions is a fail.
- Prefer questions that target NON-OBVIOUS content: a distinction the NOTES emphasise, a comparison the NOTES set up, a worked example the NOTES walk through. Avoid trivia.
- Skip questions whose answer you can't derive cleanly from the NOTES. Returning fewer strong questions is correct.
- Anti-patterns: "Explain X" with a 1-sentence answer; questions that are just a chunk's first line rephrased; every question starting with "What is…".

Output schema example (SHAPE only — do not copy the content):
{{
  "title": "<short subject-line>",
  "questions": [
    {{
      "question": "Why does Raft reject AppendEntries when prevLogTerm doesn't match?",
      "answer": "...",
      "type": "analyze",
      "confidence": 0.86,
      "chunks": [{{"doc_id": "abc123", "chunk_idx": 4}}]
    }}
  ]
}}

NOTES:
{context}

Return ONLY the JSON object — no prose, no markdown fences."""

IMPORTANT_QUESTIONS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
