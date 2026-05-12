/**
 * Cached "Simplest Explanation" outputs per (doc, topic).
 * Matches the backend's SimpleExplanation schema.
 *
 * The key shape is `<doc_id>::<topic-slug>`. Topic slugs are lowercase,
 * non-alphanumeric → `-`, collapsed.
 */

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const EXPLANATIONS = {
  'demo01transformers00000000000000::attention-mechanism': {
    topic: 'Attention mechanism',
    explanation:
      "Think of attention as a search engine the model runs once per token. Each token writes a query — what am I looking for? — and looks at the keys every other token has put down. The closer the query and key match, the more weight that token's value gets in the final mix. " +
      'Mechanically: project the input three times into queries Q, keys K, and values V. Score = QKᵀ. Divide by √d to keep the softmax stable. softmax the scores; the result tells you, for every token, how much it should listen to every other token. Multiply by V and you get the new representation. ' +
      'Why it matters: this is what replaced recurrence. Where an RNN had to walk a sequence token by token, attention lets all positions communicate in one parallel step. That parallelism — and the resulting throughput on GPUs — is what made modern LLMs possible.',
    analogies: [
      'Like reading a paragraph and underlining the words that help you understand the current word — except you do it for every word at once.',
      'Like a meeting where everyone briefly shares what they want, then listens hardest to the people whose offerings match.',
    ],
    examples: [
      'In "the cat sat on the mat", computing attention for "sat" gives high weight to "cat" (subject) and "mat" (prepositional object) and low weight to "the".',
      'In a translation model, attention from a French token to the English tokens it depends on is what aligns the two sequences.',
    ],
    chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 2 }],
  },

  'demo01transformers00000000000000::why-transformers-replaced-rnns': {
    topic: 'Why transformers replaced RNNs',
    explanation:
      "RNNs process one token at a time. That sequential dependency is fatal for two reasons: you can't parallelise across the time axis on GPUs, and information from distant tokens has to survive many hidden-state updates without being overwritten — long-range dependencies decay. " +
      'Transformers throw the time-step recurrence away. Every token attends to every other token in one matrix multiply. Long-range dependencies are now one hop apart instead of n hops. GPUs run the whole sequence in parallel. Both wins compound: faster training → more data → better models.',
    analogies: [
      'An RNN reads a book one word at a time and tries to remember it all. A transformer photocopies the page and writes notes on every line at once.',
    ],
    examples: [
      'Translating a 50-token sentence: an RNN does 50 sequential updates; a transformer does one parallel batch of attention.',
    ],
    chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 12 }],
  },

  'demo03ragpipelines000000000000000::how-rag-grounds-an-llm': {
    topic: 'How RAG grounds an LLM',
    explanation:
      "A raw LLM answers from whatever ended up in its weights at training time. RAG flips this: at query time you fetch passages from a corpus the model never saw, paste them into the prompt, and tell the model to answer using only those passages. " +
      'The fetching step uses embeddings — a learned function that turns text into a vector such that semantically similar text lands near each other. Given a question, you embed it, find the nearest k passage vectors in an index, and inject those passages. The model now has the right text in its context window, with citations you can verify, and answers can be updated by changing the corpus instead of retraining the model.',
    analogies: [
      'Like an open-book exam: instead of memorising the textbook, you bring it in and look things up while writing.',
    ],
    examples: [
      'Asking "When did the policy change?" — pure LLM might hallucinate a date; RAG retrieves the announcement passage and reports the actual date from it.',
    ],
    chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 4 }],
  },

  'demo02agianalysis00000000000000::recursive-self-improvement': {
    topic: 'Recursive self-improvement',
    explanation:
      "Most progress in AI today is people improving models. Recursive self-improvement is when the model improves itself — and improves the way it does the improving. Each generation makes a better tool for building the next generation, so capability can compound rather than add. " +
      'The reason this matters is that compounding curves look very different from additive ones near a threshold. Once a system can do the engineering work needed to build a slightly better successor — design experiments, write training code, evaluate the result — the slope of the improvement curve becomes a function of how fast that successor can do the same to a yet-better successor. The take-off speed depends on whether marginal returns to self-improvement diminish faster than the speed-up itself.',
    analogies: [
      'A toolmaker who can build a better lathe is more dangerous than a single skilled craftsman, because the lathe makes everything else.',
    ],
    examples: [
      'A model that writes the training code for the next model. A model that designs better chips that train the next model. Both are concrete instances of the recursive case.',
    ],
    chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 3 }],
  },
}

function placeholderExp(topic, docId) {
  return {
    topic,
    explanation: `Imagine ${topic} as one of the load-bearing ideas in this subject. At its core it answers a specific question: how do we move from a vague intuition to a precise mechanism that can be implemented? The answer is what the source material walks through, step by step. Once you see the mechanism, ${topic} stops being a label and becomes a piece of working machinery you can reason about.`,
    analogies: [],
    examples: [],
    chunks: [{ doc_id: docId, chunk_idx: 0 }],
  }
}

export function getExplanation(docIds, topic) {
  if (!Array.isArray(docIds) || docIds.length === 0) return null
  const docId = docIds[0]
  const key = `${docId}::${slugify(topic)}`
  if (EXPLANATIONS[key]) return EXPLANATIONS[key]
  // Fall through to a clean placeholder so the UI never breaks on a topic
  // the demo doesn't have a hand-written answer for.
  return placeholderExp(topic, docId)
}
