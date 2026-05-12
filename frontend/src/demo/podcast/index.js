/**
 * Cached podcast scripts per demo doc.
 *
 * Shape matches the backend's PodcastScript:
 *   { doc_id, title, n_turns, cached, char_count, turns: [{ speaker, text }] }
 *
 * Demo audio for the podcast is synthesized client-side via the Web Speech
 * API (see lib/demoTts.js). The turn TEXT is what drives both subtitle
 * display and TTS — there is no MP3 to pre-bake.
 */

import { DEMO_DOCS, findDoc } from '../topics/index.js'

const TRANSFORMERS = [
  { speaker: 'host',  text: "Welcome back. Today we're tackling the architecture that quietly took over the field — transformers." },
  { speaker: 'guest', text: "And the title of the original paper said it all. Attention is all you need. Before that, everyone assumed you needed recurrence." },
  { speaker: 'host',  text: "Right. RNNs walked the sequence one step at a time. That was the bottleneck?" },
  { speaker: 'guest', text: 'Two bottlenecks. You can\'t parallelise across time, so GPUs are mostly idle. And long-range information has to survive every hidden-state update — distant tokens fade.' },
  { speaker: 'host',  text: 'So self-attention skips both?' },
  { speaker: 'guest', text: 'Exactly. Every token attends to every other token in one matrix multiply. Long-range dependencies are now one hop apart, and the whole sequence runs in parallel on the GPU.' },
  { speaker: 'host',  text: 'Walk me through what the math actually does.' },
  { speaker: 'guest', text: "Project the input three times — into queries, keys, and values. Score each query against every key with a dot-product. Divide by the square root of d_k. Softmax to get weights. Multiply by the values. The result, for each token, is a learned blend of every other token's value." },
  { speaker: 'host',  text: 'Why the square root?' },
  { speaker: 'guest', text: "Without it, the dot-products grow with the embedding dimension, the softmax saturates, and gradients vanish. Scaling by √d_k keeps the variance roughly one." },
  { speaker: 'host',  text: 'And multi-head?' },
  { speaker: 'guest', text: 'Multiple attention layers in parallel, each with its own projection. One head can track syntax, another long-range coreference. Concatenate, project, done.' },
  { speaker: 'host',  text: "What about the fact that attention doesn't know about order?" },
  { speaker: 'guest', text: "Permutation-invariance — right. So we add a positional encoding. Original paper used sinusoids; modern models use rotary embeddings. Either way, the model finally knows whether 'cat sat mat' or 'mat sat cat'." },
  { speaker: 'host',  text: "Last one — what makes inference tractable at long context?" },
  { speaker: 'guest', text: "The KV cache. Past keys and values never change during generation, so you cache them. Each new token attends against the cache instead of recomputing everything. Without it, every token would cost quadratic in the sequence length." },
  { speaker: 'host',  text: 'So the takeaway is — same maths, but the engineering tricks around it are what makes the cost survivable.' },
  { speaker: 'guest', text: "Exactly. Attention is conceptually simple; production transformers are an iceberg of inference optimisations on top." },
  { speaker: 'host',  text: 'Perfect. Until next time.' },
]

const AGI = [
  { speaker: 'host',  text: 'Today: the question everyone wants to dodge — what would AGI actually look like, and what makes it different from a really good chatbot?' },
  { speaker: 'guest', text: 'The key word is general. Narrow AI optimises one objective in one domain. AGI generalises — it transfers skills, reasons about novel problems, and there is no fixed task boundary.' },
  { speaker: 'host',  text: 'So GPT-4 is narrow?' },
  { speaker: 'guest', text: 'Closer to narrow than people think. It is broad inside text, but it still optimises a single objective on a fixed input modality. It is not yet doing the thing AGI does — improving its own training pipeline.' },
  { speaker: 'host',  text: 'Recursive self-improvement.' },
  { speaker: 'guest', text: 'Right. A system that improves the algorithms it uses to improve itself. Each generation builds tools for the next. Capability can compound rather than add.' },
  { speaker: 'host',  text: 'And that is the take-off speed conversation.' },
  { speaker: 'guest', text: 'Slow take-off: years or decades. Society can observe, react, regulate. Fast take-off: days or weeks. Decision time compresses past where institutions can keep up. Same failure mode, completely different consequences.' },
  { speaker: 'host',  text: 'Where does alignment sit in all this?' },
  { speaker: 'guest', text: 'A more powerful optimiser that is pointed at the wrong objective is not safer for being smarter — it is more efficient at the wrong target. Outer alignment is writing the right objective down. Inner alignment is getting the trained model to actually optimise it.' },
  { speaker: 'host',  text: 'If AGI does arrive, what happens to humans economically?' },
  { speaker: 'guest', text: 'Execution gets cheap, direction stays expensive. Leverage shifts from doing tasks to picking which tasks are worth doing. Judgement, taste, ethics — those become the scarce inputs.' },
  { speaker: 'host',  text: 'And the path is more likely one big system or many specialists?' },
  { speaker: 'guest', text: 'Probably a coalition. Reliable specialists composed by planners. Easier to evaluate and replace each piece than to make one monolith reliable everywhere.' },
  { speaker: 'host',  text: 'Sobering and exciting at the same time.' },
  { speaker: 'guest', text: 'That is roughly the technologist condition right now.' },
]

const RAG = [
  { speaker: 'host',  text: 'Today we are demystifying RAG — Retrieval-Augmented Generation. The trick that turned LLMs from confident liars into something you can actually deploy.' },
  { speaker: 'guest', text: 'The core idea is simple. A raw LLM answers from whatever ended up in its weights. RAG fetches relevant passages at query time and pastes them into the prompt with instructions to use only those.' },
  { speaker: 'host',  text: "So it's an open-book exam for the model." },
  { speaker: 'guest', text: 'Exactly. And the open book is your corpus — not the model\'s training data. You can update knowledge by updating the corpus, and you can cite, which means humans can verify.' },
  { speaker: 'host',  text: 'How does the fetching part work?' },
  { speaker: 'guest', text: 'Embeddings. A learned function maps text to a vector such that semantically similar text lands near each other. You embed the query, find the nearest k passage vectors in an index, and inject those passages into the prompt.' },
  { speaker: 'host',  text: 'And in production it is rarely pure vector search?' },
  { speaker: 'guest', text: 'Right. Vector search misses literal anchors — proper nouns, section numbers, codes. So you combine BM25 with vector recall, then rerank the union with a cross-encoder. Two-stage: cheap recall, expensive precision.' },
  { speaker: 'host',  text: "What's the biggest gotcha?" },
  { speaker: 'guest', text: "Chunking. Bad splits delete information before retrieval starts. No embedding model can recover a fact that was severed across chunks. Sentence-aware splits with overlap are table stakes." },
  { speaker: 'host',  text: 'And when it fails?' },
  { speaker: 'guest', text: 'The model wants to be helpful, so it papers over weak retrieval with parametric guessing. The fix is forcing grounding — citations required, refuse if confidence is low. Production RAG spends more code on the failure path than the happy path.' },
  { speaker: 'host',  text: 'Beautiful. So a system, not a model.' },
  { speaker: 'guest', text: 'Exactly. The model is the smallest interesting part.' },
]

function placeholder(title) {
  return [
    { speaker: 'host',  text: `Welcome back. Today we're talking ${title}.` },
    { speaker: 'guest', text: `${title} is one of the load-bearing ideas in modern AI. Let me start with what problem it solves.` },
    { speaker: 'host',  text: 'Walk me through it.' },
    { speaker: 'guest', text: 'In short: a mechanism, a training regime, and a set of failure modes. The mechanism is what makes it work; the failure modes are what real engineers spend their time on.' },
    { speaker: 'host',  text: 'And the takeaway?' },
    { speaker: 'guest', text: 'Understand the mechanism, but ship the failure-mode handling. That is how production AI is actually built.' },
  ]
}

const SCRIPTS = {
  demo01transformers00000000000000: TRANSFORMERS,
  demo02agianalysis00000000000000:  AGI,
  demo03ragpipelines000000000000000: RAG,
}

function ensure(docId, title) {
  if (!SCRIPTS[docId]) SCRIPTS[docId] = placeholder(title)
}
for (const d of DEMO_DOCS) ensure(d.id, d.title)

export function getPodcast(docId) {
  const turns = SCRIPTS[docId]
  if (!turns) return null
  const doc = findDoc(docId)
  return {
    doc_id:    docId,
    title:     doc?.title || 'Discussion',
    n_turns:   turns.length,
    cached:    true,
    char_count: turns.reduce((s, t) => s + t.text.length, 0),
    turns,
  }
}
