"""Prompt template for the Preparation overview chain (multi-doc)."""
from langchain_core.prompts import ChatPromptTemplate

from backend.prompts.system import GROUNDED_SYSTEM

_TASK = """Build a top-level overview of the syllabus described by the NOTES below.

The NOTES may come from multiple documents — each chunk is prefixed with
[<doc_id>#<chunk_idx>] so you can cite specific sources in `chunks`.

Output a single OverviewMap object:
- `title`: a concise overall title for the syllabus / set of documents.
- `topics`: a list of {n_min}-{n_max} TOPIC objects covering the syllabus end-to-end.
   For each topic:
   - `title`: 2-6 word topic name.
   - `summary`: 2-4 sentence high-level summary.
   - `importance`: 1-5 (5 = central / pre-requisite for everything else).
   - `depends_on`: list of OTHER topic titles in this same overview that this topic builds on.
     Empty list for foundational topics. Be honest — over-claiming dependencies hurts the map.
   - `chunks`: list of ChunkRef objects ({{"doc_id": "...", "chunk_idx": 0}}) for the chunks that
     genuinely support this topic. At least ONE entry per topic.
- `mermaid`: a Mermaid `flowchart LR` diagram showing the topic dependency graph.
   Each node label is a topic title. Use the `depends_on` relations as directed edges.
   Output the actual mermaid source on multiple lines, NOT one collapsed line.
   Example shape:
     flowchart LR
       A["Topic A"] --> B["Topic B"]
       A --> C["Topic C"]
       B --> D["Topic D"]

Rules:
- Use ONLY information present in the NOTES. Do not invent topics.
- The topic graph should reflect real conceptual dependencies — not just narrative order.
- Aim for breadth over depth — better to have 8 distinct topics than 4 detailed ones with 4 sub-points each.

NOTES:
{context}

Return a single JSON object matching the OverviewMap schema."""

OVERVIEW_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GROUNDED_SYSTEM),
    ("user", _TASK),
])
