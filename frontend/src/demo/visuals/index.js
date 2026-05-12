/**
 * Cached AI-Visual mindmaps + flowcharts per demo doc.
 *
 * Each entry matches the shape `/api/visuals/{doc}/{id}` returns from the
 * real backend.
 */

function visual(id, docId, title, diagramType, mermaid, style = null, prompt = '') {
  return {
    visual_id:    id,
    doc_id:       docId,
    prompt,
    style,
    diagram_type: diagramType,
    title,
    mermaid,
    created_at:   1730841600 + Math.floor(Math.random() * 86400),
  }
}

const TRANSFORMERS_ID = 'demo01transformers00000000000000'
const AGI_ID = 'demo02agianalysis00000000000000'
const RAG_ID = 'demo03ragpipelines000000000000000'

const VISUALS = {
  [TRANSFORMERS_ID]: [
    visual('v-transformer-arch', TRANSFORMERS_ID, 'Transformer Block', 'flowchart',
`flowchart TD
  Input["Token Embeddings + Positions"] --> Attn["Multi-Head Self-Attention"]
  Attn --> AddNorm1["Add and LayerNorm"]
  AddNorm1 --> FFN["Position-wise FFN"]
  FFN --> AddNorm2["Add and LayerNorm"]
  AddNorm2 --> Output["To next block"]
  Attn -.cache.-> KV["KV Cache"]`,
      'flowchart', 'transformer architecture'),

    visual('v-transformer-mindmap', TRANSFORMERS_ID, 'Transformers — Mind Map', 'mindmap',
`mindmap
  root((Transformers))
    Attention
      ScaledDotProduct
      MultiHead
      Causal Mask
    Positions
      Sinusoidal
      Learned
      RoPE
    Blocks
      FFN
      LayerNorm
      Residual
    Inference
      KV Cache
      Flash Attention
      Grouped Query
    Variants
      Encoder Only
      Decoder Only
      Encoder Decoder`,
      'mindmap', 'transformer overview'),
  ],

  [AGI_ID]: [
    visual('v-agi-mindmap', AGI_ID, 'AGI — Conceptual Map', 'mindmap',
`mindmap
  root((AGI))
    Capabilities
      Generalisation
      Transfer
      Reasoning
    Mechanisms
      RecursiveSelfImprovement
      CapabilityCompounding
      MultiAgent
    Safety
      OuterAlignment
      InnerAlignment
      RewardHacking
    Economics
      HumanDirection
      LabourShift
      Compute Markets
    Trajectories
      SlowTakeoff
      FastTakeoff`,
      'mindmap', 'AGI concept map'),
  ],

  [RAG_ID]: [
    visual('v-rag-pipeline', RAG_ID, 'RAG Pipeline', 'flowchart',
`flowchart LR
  Query["User Query"] --> Embed["Embed query"]
  Embed --> Search["Vector Search"]
  Query --> BM25["BM25 Search"]
  Search --> Merge["Merge candidates"]
  BM25 --> Merge
  Merge --> Rerank["Cross-Encoder Rerank"]
  Rerank --> TopK["Top k passages"]
  TopK --> Prompt["Build grounded prompt"]
  Prompt --> LLM["LLM"]
  LLM --> Answer["Answer plus citations"]`,
      'flowchart', 'RAG pipeline'),
  ],
}

// Lightweight placeholders for the other docs so listVisuals never returns
// an empty page in demo mode.
const PLACEHOLDER_MERMAID =
`mindmap
  root((Concept Map))
    Foundations
    Architecture
    Training
    Applications
    Failure Modes`

function ensureSeed(docId, title) {
  if (VISUALS[docId]) return
  VISUALS[docId] = [visual(`v-${docId}-mindmap`, docId, `${title} — Mind Map`, 'mindmap', PLACEHOLDER_MERMAID, 'mindmap', 'overview')]
}

import { DEMO_DOCS } from '../topics/index.js'
for (const d of DEMO_DOCS) ensureSeed(d.id, d.title)

export function listVisuals(docId) {
  return VISUALS[docId] || []
}

export function getVisual(docId, visualId) {
  return (VISUALS[docId] || []).find((v) => v.visual_id === visualId) || null
}

/** "Generate" a visual: returns a cached one matching the requested style
 *  (best-effort), or the first seeded for the doc. */
export function generateVisual(docId, { prompt, style } = {}) {
  const list = VISUALS[docId] || []
  if (list.length === 0) return null
  if (style) {
    const match = list.find((v) => v.diagram_type === style || (v.style || '').toLowerCase() === style.toLowerCase())
    if (match) return { ...match, prompt: prompt || match.prompt, created_at: Date.now() / 1000 }
  }
  return { ...list[0], prompt: prompt || list[0].prompt, created_at: Date.now() / 1000 }
}
