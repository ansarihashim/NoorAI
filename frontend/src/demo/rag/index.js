/**
 * Pre-canned ask-a-doubt answers for narration / podcast mode.
 *
 * The demo "transcription" stage just picks the canonical question that
 * best matches the chunk currently being narrated. The "AI answer" is a
 * short, conversational response designed to feel like a tutor replying
 * mid-narration — short enough to TTS in under 8 seconds.
 */

import { findDoc } from '../topics/index.js'

// One short, spoken-style answer per chunk index per doc. Keyed by
// (doc_id, narration chunk index). The narration view passes its current
// chunk index to keep the answer contextual.
const ANSWERS = {
  demo01transformers00000000000000: {
    0: { user: 'What exactly is a transformer?', answer: "A transformer is a neural network whose central operation is attention — every token looks at every other token in parallel. That parallelism is what made modern LLMs scalable." },
    1: { user: 'Why query, key, and value?', answer: "Think of it as a tiny search engine. Each token writes a query — what am I looking for? — and looks at the keys other tokens put down. The value is what you grab if the match is good." },
    2: { user: 'Why divide by √d_k?', answer: "Without it, dot-products grow with the embedding dimension and the softmax saturates — one key wins and gradients die. The √d_k keeps the variance roughly one." },
    3: { user: 'What do multiple heads buy you?', answer: "Independent heads specialise. One can track syntax, another long-range coreference, a third semantic role. Concatenate them and the model can attend in multiple modes at once." },
    4: { user: 'Why does the model need positional encoding?', answer: "Self-attention is permutation-invariant — it cannot tell 'cat sat mat' from 'mat sat cat'. Positional encoding injects the order the attention layer would otherwise erase." },
    5: { user: 'What does LayerNorm actually normalise?', answer: "It normalises across the hidden dimension within each token, keeping activation variance stable as the signal flows through deep stacks. Pairs with residual connections to keep gradients clean." },
    6: { user: 'What is the KV cache for?', answer: "During generation, past keys and values never change. Caching them turns each new token from quadratic recomputation into linear lookup. It is the single biggest reason production LLMs are tractable." },
    7: { user: 'When is encoder-only the right choice?', answer: "For understanding tasks — classification, retrieval, named entity recognition — anything where you have the whole input upfront. Decoder-only is for generation." },
    8: { user: 'What is Chinchilla scaling?', answer: "It says: for a fixed compute budget, parameters and training tokens should roughly double together. Older big models were over-parameterised and under-trained." },
    9: { user: 'What is flash-attention?', answer: "An algorithm that tiles the attention matrix into blocks that fit in fast SRAM, avoiding the n-by-n materialisation in slow HBM. Same maths, far fewer memory roundtrips." },
  },
  demo02agianalysis00000000000000: {
    0: { user: 'What is AGI?', answer: "A single system that matches or exceeds humans across most cognitive tasks, with no fixed task boundary. Generalisation is the load-bearing word — it must transfer, not just memorise." },
    1: { user: 'What separates AGI from a great chatbot?', answer: "A great chatbot optimises one objective in one modality. AGI improves the algorithms it uses to improve itself, transfers skills across domains, and can reason about novel problems it was never trained on." },
    2: { user: 'What does recursive self-improvement mean?', answer: "A system that improves the tools it uses to improve itself. Each generation rewrites the next. Capability can compound rather than add — that compounding is what makes the scenario interesting." },
    3: { user: 'Could the intelligence explosion happen?', answer: "Only if the marginal returns to self-improvement don't diminish faster than the speed-up itself. Empirical evidence so far points toward diminishing returns, but past performance is a poor guide above the data manifold." },
    4: { user: 'Why does take-off speed matter?', answer: "Slow take-off gives society time to react and regulate. Fast take-off compresses decision time past the point where institutions can keep up. Same failure, completely different consequences." },
    5: { user: 'What is the alignment problem?', answer: "Specifying what we actually want — and getting the model to optimise that, not a correlated proxy. A powerful optimiser pointed at the wrong target is not safer for being smarter; it is more efficient at the wrong target." },
    6: { user: 'What happens to humans economically?', answer: "Execution gets cheap. Direction stays expensive. The scarce inputs become judgement, taste, ethics, and accountability — picking which problems are worth solving rather than solving them." },
    7: { user: 'Will it be one big model or many small ones?', answer: "Probably composition. Reliable specialists coordinated by a planner. Each piece can be evaluated and replaced independently — easier than making one monolith reliable everywhere." },
  },
  demo03ragpipelines000000000000000: {
    0: { user: 'Why retrieve if the LLM already knows things?', answer: "Parametric knowledge is static and unverifiable. Retrieval grounds the answer in a corpus you control, lets the model cite, and lets you update knowledge by editing the corpus instead of retraining." },
    1: { user: 'What is the point of chunking?', answer: "Documents are too long for the context window. You split them into pieces small enough to embed cleanly but large enough to carry meaning. The boundary choices matter more than the embedding model." },
    2: { user: 'What is an embedding?', answer: "A learned function from text to a vector such that semantically similar text lands near each other. Retrieval becomes nearest-neighbour search in that space." },
    3: { user: 'Why approximate nearest-neighbour?', answer: "Exact search is linear in the corpus. HNSW and IVF give you sublinear search with a tiny recall loss — at any non-toy scale it's mandatory." },
    4: { user: 'When does BM25 beat vector search?', answer: "Whenever the query contains literal anchors a bi-encoder can't preserve — names, codes, dates, section numbers. Vector finds semantically close text; BM25 finds the actual word the user typed." },
    5: { user: 'Why a cross-encoder reranker?', answer: "It reads the (query, candidate) pair jointly, so the score is sharper. Too slow to run over the whole corpus — perfect for re-scoring the top-100 from the first stage." },
    6: { user: 'How do citations help?', answer: "They turn a black-box LLM into something a human can verify. Production RAG is judged on citation quality, not just answer fluency." },
    7: { user: 'What goes wrong most often?', answer: "Bad retrieval the model papers over with hallucinations. The fix is forcing grounding — citations required, refuse if confidence is low. More code than the happy path." },
  },
}

function genericAnswer(docId, idx) {
  const doc = findDoc(docId)
  const title = doc?.title || 'this topic'
  return {
    user: 'Could you elaborate on this part?',
    answer: `${title} is one of the load-bearing ideas here. The mechanism is straightforward once you separate it from the engineering. Want me to walk through the specific step the narrator just mentioned?`,
  }
}

export function answerFor(docId, chunkIdx) {
  const byDoc = ANSWERS[docId] || {}
  if (byDoc[chunkIdx]) return byDoc[chunkIdx]
  // Fall back: pick the nearest seeded chunk index.
  const keys = Object.keys(byDoc).map(Number).sort((a, b) => a - b)
  if (keys.length === 0) return genericAnswer(docId, chunkIdx)
  const nearest = keys.reduce((best, k) => Math.abs(k - chunkIdx) < Math.abs(best - chunkIdx) ? k : best, keys[0])
  return byDoc[nearest]
}
