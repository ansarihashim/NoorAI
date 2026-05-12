/**
 * Narration manifests per demo doc. Each manifest has a list of chunks
 * (paragraphs the narrator reads), with their text + page number for
 * citation rendering.
 *
 * Audio is synthesised client-side via the Web Speech API (no audio files
 * are bundled — keeps the deploy under Vercel's free-tier asset budget).
 */

import { findDoc } from '../topics/index.js'

const TRANSFORMERS = [
  'Transformers are a class of neural network whose central operation is attention. At training time and inference time, every token in a sequence looks at every other token in parallel.',
  'The attention operation is straightforward. Each token is projected into three vectors — a query, a key, and a value. The dot-product of a query with every key, scaled by the square root of the key dimension, gives a row of similarity scores.',
  'Apply a softmax to that row and you get a probability distribution over the other tokens. Use it to take a weighted average of the values. The result is the new representation of this token — informed by every other.',
  'Multi-head attention runs that process several times in parallel, each head with its own learned projection. The heads can specialise: one tracks local syntax, another long-range coreference, a third semantic role. Their outputs are concatenated and projected.',
  'Because attention is permutation-invariant, transformers add a positional encoding before the first layer — either sinusoids, learned embeddings, or rotary encodings. Without this, the model cannot distinguish "the cat sat on the mat" from "the mat sat on the cat".',
  'Each transformer block then applies a position-wise feed-forward network, wrapped in residual connections and LayerNorm. The residuals keep gradients flowing through deep stacks; LayerNorm stabilises the activations.',
  'During autoregressive generation, the keys and values for every past token are cached. This is the KV cache. Without it, each new token would cost a full quadratic re-computation; with it, the cost is linear in the sequence length.',
  'The encoder-only design — BERT — uses bidirectional attention for understanding tasks. The decoder-only design — GPT — uses a causal mask for generation. The original encoder-decoder transformer combined both for translation.',
  'Scaling laws govern training. Loss falls as a smooth power law with model size, dataset size, and compute. The Chinchilla finding showed that for a fixed budget, parameters and tokens should scale roughly together — older models were over-parameterised and under-trained.',
  'In production, the mathematics is small; the engineering is large. Flash-attention, paged KV caches, grouped-query attention, quantisation — these are what make a transformer affordable to serve at scale.',
]

const AGI = [
  'AGI — artificial general intelligence — is the hypothesis that a single system can match or exceed human capability across most cognitive tasks, with no fixed task boundary.',
  'The contrast with today\'s systems is sharp. Narrow AI optimises one objective in one domain. AGI generalises — it transfers skills, reasons about novel problems, and can learn new tasks without being retrained from scratch.',
  'The most interesting hypothesis about AGI is recursive self-improvement. A system that can improve the algorithms it uses to improve itself. Each generation builds tools for the next, so capability could compound rather than add.',
  'This is the mechanism behind intelligence-explosion scenarios. If the marginal returns to self-improvement do not diminish faster than the speed-up, a phase change is possible where every successor is built faster than the last.',
  'Take-off speed is therefore the load-bearing parameter for policy. Slow take-off — years or decades — gives institutions time to observe and respond. Fast take-off — days or weeks — compresses decision time past where regulation can keep up.',
  'Alignment sits at the centre of these scenarios. A more powerful optimiser pointed at the wrong objective is not safer for being smarter; it is more efficient at the wrong target. Outer alignment is the problem of writing the right objective down. Inner alignment is the problem of getting the trained model to optimise it rather than a correlated proxy.',
  'In an AGI-rich economy, leverage shifts. Execution gets cheap; direction stays expensive. Judgement, taste, ethics, and accountability become the scarce inputs rather than the speed of doing the work.',
  'A monolithic super-model is one path. A more likely path is composition — reliable narrow specialists coordinated by a planner. Each piece can be evaluated and replaced independently, which is much easier than making one model reliable across every domain.',
]

const RAG = [
  'Retrieval-augmented generation pairs a large language model with a search system. Instead of relying on what ended up in the model\'s weights at training time, the system fetches relevant passages from a corpus and includes them in the prompt.',
  'The motivation is simple. Parametric knowledge is static; the corpus can change. The model can cite; the user can verify. And the model can answer questions about documents it never saw.',
  'The pipeline begins with chunking. Documents are split into segments small enough to embed cleanly but large enough to carry meaning. Naïve splits on token count lose context; sentence-aware splits with overlap preserve cross-boundary references.',
  'Each chunk is then embedded. An embedding model — typically a transformer encoder — maps text to a vector such that semantically similar text lands near each other. The retrieval problem becomes finding the nearest k vectors to the query.',
  'Exact nearest-neighbour search is linear in the corpus size. At any non-trivial scale, approximate indexes — HNSW, IVF, ScaNN — trade a tiny recall loss for orders-of-magnitude speedup.',
  'Vector retrieval misses literal anchors — proper nouns, section numbers, dates. Hybrid systems combine BM25 with vector recall, then rerank the union with a cross-encoder for a final score.',
  'Citations are what turn the system from a black box into something trustworthy. Returning the source passages alongside the answer is the difference between fluency and verifiability.',
  'Most failure modes appear in production: weak retrieval, contradictory chunks, stale corpora, the model papering over uncertainty with hallucinations. Real RAG systems spend more code on the failure path than on the happy path.',
]

function placeholder(title) {
  return [
    `${title} is one of the load-bearing ideas in modern AI.`,
    `The core mechanism is best understood as a chain of three steps. First, you transform the input into a representation the system can manipulate. Second, the system applies its core operation — the one that makes this method distinctive. Third, the output is decoded back into the form a user can consume.`,
    `What makes ${title} interesting is the failure modes — the regimes where the method breaks. Engineers building production systems spend most of their time on those, not on the happy path.`,
    `In one sentence: ${title} is a tool, and a strong intuition for it comes from understanding both what it does well and the assumptions baked into its design.`,
  ]
}

const NARRATIONS = {
  demo01transformers00000000000000: TRANSFORMERS,
  demo02agianalysis00000000000000:  AGI,
  demo03ragpipelines000000000000000: RAG,
}

/** Build a narration manifest matching what /api/narration/{doc}/manifest
 *  returns. `audio_ready=true` on every chunk because demo mode synthesises
 *  audio on demand client-side. */
export function getManifest(docId, voiceId) {
  const doc = findDoc(docId)
  if (!doc) return null
  const chunks = (NARRATIONS[docId] || placeholder(doc.title)).map((text, idx) => ({
    idx, text, audio_ready: true,
  }))
  return {
    doc_id:    docId,
    title:     doc.title,
    n_chunks:  chunks.length,
    voice_id:  voiceId || null,
    chunks,
  }
}

/** Return the raw narration text per index (used by the Web Speech TTS layer). */
export function getChunkText(docId, idx) {
  const list = NARRATIONS[docId] || []
  return list[idx] || null
}

/** Citations: per-chunk page-number array. We synthesise believable
 *  numbers — same approach the real backend would return for a real PDF. */
export function getCitations(docId) {
  const doc = findDoc(docId)
  if (!doc) return null
  const chunks = NARRATIONS[docId] || placeholder(doc.title)
  // Spread chunks evenly across the doc's pages.
  const pages = chunks.map((_, i) => 1 + Math.floor((i / chunks.length) * doc.total_pages))
  return { pages, total_pages: doc.total_pages, is_paged: true }
}
