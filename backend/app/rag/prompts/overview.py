"""Prompt template for the Preparation overview chain (multi-doc)."""
from langchain_core.prompts import ChatPromptTemplate

from app.rag.prompts.system import GROUNDED_SYSTEM

_TASK = """Build a TOPPER-LEVEL syllabus overview of the material in the NOTES below.

The NOTES may come from multiple documents — each chunk is prefixed with
[<doc_id>#<chunk_idx>] so you can cite specific sources in `chunks`.

Output a single OverviewMap object:
- `title`: a concise overall title that names the subject precisely (e.g. "Distributed Consensus & Replication", not "Computer Science Notes").
- `topics`: {n_min}-{n_max} TOPIC objects spanning the syllabus end-to-end.
   For each topic:
   - `title`: 2-6 word topic name using the NOTES' own terminology.
   - `summary`: 2-4 sentences. State what the topic actually IS, why it matters in this syllabus, and one defining mechanism or distinction. Avoid generic openers like "This topic covers…".
   - `importance`: 1-5. Use this rubric strictly:
       5 = foundational; if you skip it nothing else makes sense.
       4 = high-yield; appears repeatedly in the NOTES and is examined often.
       3 = standard coverage; one or two chunks devote real space to it.
       2 = supporting / context only.
       1 = peripheral; mentioned in passing.
   - `depends_on`: titles of OTHER topics in THIS overview that are REAL prerequisites (you literally need them to understand this one). Empty list for foundations. Do NOT add a dependency just because one topic was mentioned before another.
   - `chunks`: ChunkRef objects {{"doc_id": "...", "chunk_idx": 0}} that genuinely support this topic. At least ONE entry per topic.
- `mermaid`: a Mermaid `flowchart LR` of the dependency graph.

MERMAID SYNTAX (strict — Mermaid will fail to parse otherwise):
  * Each node is `<id>["<label>"]`.
  * `<id>` is letters/digits only, no spaces, no punctuation — CamelCase for multi-word ("Ensemble Learning" → `EnsembleLearning`).
  * `<label>` is the human-readable title, ALWAYS double-quoted.
  * Edges are `<id> --> <id>` (ids only, never labels).
  * USE LITERALLY THE THREE ASCII CHARACTERS `-->`. Do NOT use Unicode arrows like `→`, `⟶`, `⇒`, `➜`, `➡`. Do NOT use em-dash `—` or en-dash `–`. Do NOT use a single dash `-` as a separator. Only `-->`.
  * One statement per line — never collapse the body onto one line.
  * NEVER put these characters inside a label: `|`, `#`, `&`, `<`, `>`, `` ` ``, `*`, `_`. They break the parser. Use plain words.
  * No markdown formatting inside labels — no `**bold**`, no `*italics*`.
  * Keep labels short (2-5 words). Truncate aggressively rather than wrap.
Shape example (use as a TEMPLATE; do NOT copy these names):
  flowchart LR
    EnsembleLearning["Ensemble Learning"] --> Bagging["Bagging"]
    EnsembleLearning --> Boosting["Boosting"]
    Bagging --> RandomForest["Random Forest"]

DESIGN GUIDELINES:
- Cover BREADTH. Better to have 10 distinct topics that span the whole syllabus than 4 over-detailed ones from page 1.
- Make the dependency graph informative. If everything is foundational (importance 5, no deps) or everything is a leaf, you've done it wrong.
- The graph should reflect CONCEPTUAL dependency — what you must know first to understand this — not the narrative order of the source document.
- Anti-patterns to avoid: identical-sounding summaries for adjacent topics; titles like "Introduction" or "Overview"; over-claiming dependencies (`every topic depends on every previous topic`).

NOTES:
{context}

Return a single JSON object matching the OverviewMap schema."""

OVERVIEW_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
