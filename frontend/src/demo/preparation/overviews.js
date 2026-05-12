/**
 * Cached "Overview" outputs per demo doc.
 *
 * Shape matches the backend's `OverviewMap` schema (the same JSON the
 * /api/preparation/overview/generate endpoint returns), so the existing
 * OverviewView component renders these without any branch.
 */

const TRANSFORMERS_OVERVIEW = {
  title: 'Transformers & Attention',
  topics: [
    {
      title: 'Self-Attention',
      summary: 'The mechanism that lets every token in a sequence look at every other token in parallel. A learned query / key / value projection converts each token into three vectors; the dot-product of queries with keys, scaled by √d_k and softmaxed, becomes the attention weight applied to values.',
      importance: 5,
      depends_on: [],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 1 }],
    },
    {
      title: 'Scaled Dot-Product',
      summary: 'softmax(QKᵀ / √d_k) · V. Dividing by √d_k keeps the softmax in a region with usable gradients — without it, dot-products grow with the embedding dimension and saturate the softmax.',
      importance: 5,
      depends_on: ['Self-Attention'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 2 }],
    },
    {
      title: 'Multi-Head Attention',
      summary: 'Run h independent attention layers in parallel, each with its own projection. Concatenate, then apply a final linear. Heads specialise — some attend locally, some track long-range dependencies, some learn syntactic relations.',
      importance: 5,
      depends_on: ['Scaled Dot-Product'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 4 }],
    },
    {
      title: 'Positional Encoding',
      summary: 'Attention is permutation-invariant — without position information the model treats "cat sat mat" and "mat sat cat" identically. Sinusoidal encodings (or learned position embeddings, or RoPE) inject order back into the token stream.',
      importance: 4,
      depends_on: ['Self-Attention'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 6 }],
    },
    {
      title: 'Feed-Forward Block',
      summary: 'Two linear layers with a non-linearity (ReLU or GELU) applied position-wise after attention. Acts as a per-token "memory" of patterns the attention layer surfaced.',
      importance: 3,
      depends_on: ['Multi-Head Attention'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 8 }],
    },
    {
      title: 'Residual + LayerNorm',
      summary: 'Each sub-layer (attention, FFN) is wrapped in a residual connection and a LayerNorm. Residuals let gradients flow through deep stacks; LayerNorm stabilises activations across the hidden dimension.',
      importance: 4,
      depends_on: ['Feed-Forward Block'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 10 }],
    },
    {
      title: 'Encoder–Decoder Stack',
      summary: 'The original transformer pairs N encoder layers (self-attention over the source) with N decoder layers (masked self-attention + cross-attention to the encoder output). Modern LLMs are decoder-only, dropping the cross-attention.',
      importance: 4,
      depends_on: ['Residual + LayerNorm'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 12 }],
    },
    {
      title: 'KV Cache & Inference',
      summary: 'During autoregressive generation, keys and values for past tokens never change. Caching them turns inference from O(n²) re-computation into O(n) — the single largest reason production LLMs are tractable at scale.',
      importance: 5,
      depends_on: ['Multi-Head Attention'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 16 }],
    },
    {
      title: 'Scaling Laws',
      summary: 'Loss falls as a smooth power law with model size, dataset size, and compute. Compute-optimal training (Chinchilla) balances all three rather than pouring everything into parameters.',
      importance: 4,
      depends_on: ['Encoder–Decoder Stack'],
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 20 }],
    },
  ],
  mermaid:
`flowchart LR
  SelfAttention["Self-Attention"] --> ScaledDot["Scaled Dot-Product"]
  ScaledDot --> MultiHead["Multi-Head Attention"]
  SelfAttention --> PositionalEnc["Positional Encoding"]
  MultiHead --> FFN["Feed-Forward Block"]
  FFN --> ResidualLN["Residual + LayerNorm"]
  ResidualLN --> EncDec["Encoder-Decoder Stack"]
  MultiHead --> KVCache["KV Cache and Inference"]
  EncDec --> ScalingLaws["Scaling Laws"]`,
}

const AGI_OVERVIEW = {
  title: 'AGI — Recursive Self-Improvement',
  topics: [
    {
      title: 'Narrow vs General AI',
      summary: 'Narrow AI optimises a single objective in a fixed domain. AGI generalises across domains, transfers skills, and reasons about novel problems. The gap is not just capability — it is the absence of a fixed task boundary.',
      importance: 5,
      depends_on: [],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 0 }],
    },
    {
      title: 'Recursive Self-Improvement',
      summary: 'A system that can improve the algorithms it uses to improve itself. Each generation builds tools for the next; capabilities can compound rather than add. This is the load-bearing assumption behind "intelligence explosion" scenarios.',
      importance: 5,
      depends_on: ['Narrow vs General AI'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 3 }],
    },
    {
      title: 'Capability Compounding',
      summary: 'When a model passes a threshold (writing code, doing research, designing chips), the output becomes infrastructure for the next model. Tools build tools; the ladder is recursive.',
      importance: 4,
      depends_on: ['Recursive Self-Improvement'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 5 }],
    },
    {
      title: 'Alignment Problem',
      summary: 'Specifying what we actually want is hard. A system optimising the wrong objective at superhuman level is not safer for being smarter — it is more efficient at the wrong target. Outer alignment vs inner alignment vs reward hacking all sit here.',
      importance: 5,
      depends_on: ['Recursive Self-Improvement'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 8 }],
    },
    {
      title: 'Human Direction',
      summary: 'In an AGI-rich economy, leverage shifts from doing tasks to picking which tasks deserve doing. Judgement, taste, and ethics become scarce inputs rather than execution speed.',
      importance: 4,
      depends_on: ['Capability Compounding'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 11 }],
    },
    {
      title: 'Multi-Agent Systems',
      summary: 'Modern "agent" stacks compose narrow tools with planning loops. A reliable AGI economy is more likely to emerge from coordinated specialists than from one monolithic super-model.',
      importance: 3,
      depends_on: ['Capability Compounding'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 13 }],
    },
    {
      title: 'Take-off Speed',
      summary: 'Slow take-off (years/decades) vs fast take-off (days/weeks) shapes every policy decision. Empirical evidence so far favours slow take-off, but past performance is a poor guide above the data manifold.',
      importance: 4,
      depends_on: ['Recursive Self-Improvement', 'Capability Compounding'],
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 16 }],
    },
  ],
  mermaid:
`flowchart LR
  Narrow["Narrow vs General AI"] --> Recursive["Recursive Self-Improvement"]
  Recursive --> Compounding["Capability Compounding"]
  Recursive --> Alignment["Alignment Problem"]
  Compounding --> Direction["Human Direction"]
  Compounding --> MultiAgent["Multi-Agent Systems"]
  Recursive --> Takeoff["Take-off Speed"]
  Compounding --> Takeoff`,
}

const RAG_OVERVIEW = {
  title: 'RAG Pipelines & Vector Databases',
  topics: [
    {
      title: 'Why Retrieval',
      summary: 'LLMs have a fixed parametric memory. Retrieval grounds answers in a corpus the model never saw at training time — letting it cite, update, and reason over text that fits no context window.',
      importance: 5,
      depends_on: [],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 0 }],
    },
    {
      title: 'Chunking',
      summary: 'Documents are split into chunks small enough to embed cleanly but large enough to carry meaning. Naïve splits on tokens lose context; sentence-aware splits with overlap preserve cross-boundary references.',
      importance: 5,
      depends_on: ['Why Retrieval'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 2 }],
    },
    {
      title: 'Embeddings',
      summary: 'A learned function maps text to a vector. Semantically similar text lands near each other in the embedding space. The retrieval problem becomes: find the nearest k vectors to the query.',
      importance: 5,
      depends_on: ['Chunking'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 4 }],
    },
    {
      title: 'Vector Indexes',
      summary: 'Exact nearest-neighbour search is O(n). Approximate indexes (HNSW, IVF, ScaNN) trade a tiny recall loss for orders-of-magnitude speedup. Required at any non-toy corpus size.',
      importance: 4,
      depends_on: ['Embeddings'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 7 }],
    },
    {
      title: 'Hybrid Search',
      summary: 'Vector similarity misses keyword anchors ("Section 3.4", proper nouns). Combining BM25 with vector recall, then re-ranking, beats either alone on real corpora.',
      importance: 4,
      depends_on: ['Vector Indexes'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 10 }],
    },
    {
      title: 'Re-ranking',
      summary: 'A cross-encoder reranker reads (query, candidate) pairs jointly and produces a fine-grained score. Slower than bi-encoder retrieval, so we only rerank the top-k from the first stage.',
      importance: 3,
      depends_on: ['Hybrid Search'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 13 }],
    },
    {
      title: 'Citations',
      summary: 'Returning the source passages alongside the answer turns a black-box LLM into something a user can verify. Production RAG is judged on citation quality, not just answer fluency.',
      importance: 4,
      depends_on: ['Re-ranking'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 16 }],
    },
    {
      title: 'Failure Modes',
      summary: '"I don\'t know" answers, irrelevant retrievals, contradictory chunks, stale data. Real RAG systems spend more code on the failure modes than the happy path.',
      importance: 3,
      depends_on: ['Citations'],
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 19 }],
    },
  ],
  mermaid:
`flowchart LR
  Why["Why Retrieval"] --> Chunking["Chunking"]
  Chunking --> Embeddings["Embeddings"]
  Embeddings --> Indexes["Vector Indexes"]
  Indexes --> Hybrid["Hybrid Search"]
  Hybrid --> Rerank["Re-ranking"]
  Rerank --> Citations["Citations"]
  Citations --> Failures["Failure Modes"]`,
}

// Lightweight placeholder for topics we haven't fully seeded yet — the
// real outputs will be added file-by-file. Still rich enough to render
// without anything looking obviously empty.
function placeholder(title, docId, mermaidBody) {
  return {
    title,
    topics: [
      { title: 'Foundations', summary: `Core ideas underpinning ${title}.`, importance: 5, depends_on: [], chunks: [{ doc_id: docId, chunk_idx: 0 }] },
      { title: 'Architecture', summary: `How the components fit together in ${title}.`, importance: 4, depends_on: ['Foundations'], chunks: [{ doc_id: docId, chunk_idx: 2 }] },
      { title: 'Training Dynamics', summary: `How the system is fit to data in ${title}.`, importance: 4, depends_on: ['Architecture'], chunks: [{ doc_id: docId, chunk_idx: 5 }] },
      { title: 'Applications', summary: `Where ${title} is used in practice.`, importance: 3, depends_on: ['Training Dynamics'], chunks: [{ doc_id: docId, chunk_idx: 8 }] },
    ],
    mermaid: mermaidBody,
  }
}

const OVERVIEWS = {
  demo01transformers00000000000000: TRANSFORMERS_OVERVIEW,
  demo02agianalysis00000000000000:  AGI_OVERVIEW,
  demo03ragpipelines000000000000000: RAG_OVERVIEW,
  demo04neuralnetworks0000000000000: placeholder(
    'Neural Networks — Foundations',
    'demo04neuralnetworks0000000000000',
`flowchart LR
  Foundations["Foundations"] --> Architecture["Architecture"]
  Architecture --> Training["Training Dynamics"]
  Training --> Applications["Applications"]`,
  ),
  demo05computervision0000000000000: placeholder(
    'Computer Vision & CNNs',
    'demo05computervision0000000000000',
`flowchart LR
  Foundations["Convolutions"] --> Architecture["CNN Architecture"]
  Architecture --> Training["Training Dynamics"]
  Training --> Applications["Vision Applications"]`,
  ),
  demo06diffusion000000000000000000: placeholder(
    'Diffusion Models',
    'demo06diffusion000000000000000000',
`flowchart LR
  Foundations["Forward Process"] --> Architecture["Score Networks"]
  Architecture --> Training["Training Dynamics"]
  Training --> Applications["Generation"]`,
  ),
  demo07rlhf00000000000000000000000: placeholder(
    'RLHF & Alignment',
    'demo07rlhf00000000000000000000000',
`flowchart LR
  Foundations["Reward Modelling"] --> Architecture["PPO Loop"]
  Architecture --> Training["KL Constraint"]
  Training --> Applications["Aligned Outputs"]`,
  ),
}

/** Multi-doc set key matches the backend convention: sha1(sorted(ids))[:12].
 * For demo mode we accept a single doc and return its overview. Multi-doc
 * sets are not seeded — clicking "generate" on a multi-doc combo just uses
 * the first doc in the set, which is a reasonable demo fallback. */
export function getOverview(docIds) {
  if (!Array.isArray(docIds) || docIds.length === 0) return null
  return OVERVIEWS[docIds[0]] || null
}
