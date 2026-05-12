/**
 * Cached "Important Questions" outputs per demo doc.
 * Matches the backend's ImportantQuestionSet schema.
 */

const TRANSFORMERS = {
  title: 'Transformers — exam-worthy questions',
  questions: [
    {
      question: 'Why does scaled dot-product attention divide by √d_k before the softmax?',
      answer: 'For large d_k the dot-product variance grows linearly with d_k, pushing the softmax into a region where one entry dominates and gradients vanish. Dividing by √d_k normalises the variance back to ≈ 1 so the softmax stays in a usable regime and gradients flow through every key.',
      type: 'analyze', confidence: 0.92,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 2 }],
    },
    {
      question: 'What does multi-head attention buy you over a single attention layer of the same total width?',
      answer: 'Independent heads can specialise. One head can track local syntax, another long-range coreference, another semantic role. With a single head, the softmax must commit to one attention pattern per query, losing the ability to attend in multiple modes simultaneously.',
      type: 'analyze', confidence: 0.88,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 4 }],
    },
    {
      question: 'Without positional encoding, what behaviour would a transformer exhibit on "the cat sat on the mat"?',
      answer: 'Self-attention is permutation-invariant, so the model would produce identical representations for any ordering of those tokens. It could not distinguish "cat sat on mat" from "mat sat on cat". Sinusoidal or learned positional embeddings inject the missing order signal.',
      type: 'apply', confidence: 0.86,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 6 }],
    },
    {
      question: 'What is the role of the residual connection around each sub-layer?',
      answer: 'It lets the gradient bypass the sub-layer during back-propagation, keeping training stable in very deep stacks. It also gives the sub-layer the option to be the identity, which biases optimisation toward useful transforms only when they help.',
      type: 'recall', confidence: 0.81,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 10 }],
    },
    {
      question: 'Why does the KV cache make autoregressive generation tractable?',
      answer: 'During generation the past keys and values never change. Caching them turns each new token from an O(n²) recomputation of the full attention matrix into an O(n) attention against the cache. Without it, generating 4 k tokens would be ~16 M attention dot-products instead of 4 k × n.',
      type: 'analyze', confidence: 0.93,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 16 }],
    },
    {
      question: 'How do encoder-only, decoder-only, and encoder-decoder transformers differ in attention masking?',
      answer: 'Encoder-only (BERT) uses bidirectional attention — every token attends to every other. Decoder-only (GPT) uses a causal mask so token i only attends to ≤ i. Encoder-decoder (original transformer) uses bidirectional in the encoder and causal + cross-attention in the decoder.',
      type: 'analyze', confidence: 0.9,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 12 }],
    },
    {
      question: 'What does Chinchilla scaling tell us that earlier scaling laws missed?',
      answer: 'Earlier work scaled parameters faster than data. Chinchilla showed that for a given compute budget, the loss-minimising allocation roughly doubles parameters and doubles tokens together. Previously over-parameterised models were under-trained.',
      type: 'evaluate', confidence: 0.84,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 20 }],
    },
    {
      question: 'Apply: the softmax of a head outputs near-uniform weights across all keys. What is likely happening?',
      answer: 'Either d_k is unusually large and the scaling factor is wrong, or the query / key projections have collapsed (e.g. small weights, no learnt structure). Diagnose by inspecting the pre-softmax logits — if their variance is tiny, the head has not learnt anything yet; if it is huge, the scaling is broken.',
      type: 'apply', confidence: 0.78,
      chunks: [{ doc_id: 'demo01transformers00000000000000', chunk_idx: 2 }],
    },
  ],
}

const AGI = {
  title: 'AGI — exam-worthy questions',
  questions: [
    {
      question: 'What distinguishes recursive self-improvement from ordinary capability scaling?',
      answer: 'Ordinary scaling improves a fixed system. RSI changes the system that does the improving — each generation builds better tools for the next, so capability can compound rather than add. The growth curve is determined by the system\'s ability to redesign itself, not by external compute alone.',
      type: 'analyze', confidence: 0.9,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 3 }],
    },
    {
      question: 'Distinguish outer alignment from inner alignment.',
      answer: 'Outer alignment is the problem of writing down the objective you actually want. Inner alignment is the problem of getting the trained model to optimise that objective rather than a correlated proxy it discovered during training (mesa-optimisation).',
      type: 'analyze', confidence: 0.85,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 8 }],
    },
    {
      question: 'Why does take-off speed matter for policy?',
      answer: 'Slow take-off (years) gives society time to observe, regulate, and course-correct. Fast take-off (days/weeks) compresses the decision window past the point where institutions can react. The same alignment failure is recoverable in the first case and catastrophic in the second.',
      type: 'evaluate', confidence: 0.83,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 16 }],
    },
    {
      question: 'In what sense does human leverage shift in an AGI-rich economy?',
      answer: 'Execution gets cheap; direction stays expensive. Picking which problems are worth solving, applying taste, navigating ethics, and accepting accountability remain human-scarce inputs even when "doing the work" is largely automated.',
      type: 'evaluate', confidence: 0.78,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 11 }],
    },
    {
      question: 'Why might multi-agent systems be a more likely path to AGI than a single monolithic model?',
      answer: 'Composing reliable narrow tools with a planner is easier than getting one model to be reliable across every domain. Each component can be evaluated and replaced independently. The aggregate behaviour can be more capable than any single piece — the same way human institutions outperform individuals.',
      type: 'analyze', confidence: 0.76,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 13 }],
    },
    {
      question: 'Define "intelligence explosion" and one assumption it depends on.',
      answer: 'A hypothetical phase where each generation of AI rapidly produces a more capable successor, compounding within months or less. It assumes the marginal cost of improvement does not rise faster than capability itself — i.e. that diminishing returns do not kick in before the explosion.',
      type: 'recall', confidence: 0.7,
      chunks: [{ doc_id: 'demo02agianalysis00000000000000', chunk_idx: 3 }],
    },
  ],
}

const RAG = {
  title: 'RAG — exam-worthy questions',
  questions: [
    {
      question: 'Why does chunking quality usually dominate RAG performance more than embedding quality?',
      answer: 'No embedding can recover a fact that was split across two chunks. Bad chunking deletes information before retrieval starts; better embeddings can only re-rank what survives. In practice, switching to a sentence-aware splitter with overlap moves recall further than upgrading the embedding model.',
      type: 'evaluate', confidence: 0.86,
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 2 }],
    },
    {
      question: 'When does hybrid (BM25 + vector) search beat pure vector search?',
      answer: 'Whenever the query contains anchors a bi-encoder embedding can\'t preserve cleanly — proper nouns, section numbers, codes, dates. Vector recall finds semantically similar passages but can miss the literal "Section 3.4" the user typed. BM25 catches the literals; the union is reranked.',
      type: 'analyze', confidence: 0.85,
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 10 }],
    },
    {
      question: 'Why use a cross-encoder reranker on the top-k instead of replacing the bi-encoder?',
      answer: 'Cross-encoders read (query, candidate) jointly, which is more accurate but far slower. Running it over the whole corpus is infeasible. The two-stage pipeline keeps recall cheap and reserves the expensive scorer for the ≤100 candidates that already look promising.',
      type: 'analyze', confidence: 0.82,
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 13 }],
    },
    {
      question: 'A user complains the system "made things up". Where do you look first?',
      answer: 'First the retrieval logs: was a relevant passage actually returned? If not, the failure is in chunking / retrieval, not the LLM. If yes, look at whether the prompt forced grounding (citations required) — without that constraint the model will paper over weak retrieval with its parametric knowledge.',
      type: 'apply', confidence: 0.84,
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 19 }],
    },
    {
      question: 'What does "I don\'t know" look like in a RAG system, and why is it the hardest answer to produce?',
      answer: 'It requires the model to refuse when retrieved chunks are weak, low-similarity, or contradictory. LLMs are heavily trained to be helpful, so the default behaviour is to answer anyway. Calibrated refusal needs explicit instruction plus retrieval confidence signals in the prompt.',
      type: 'evaluate', confidence: 0.79,
      chunks: [{ doc_id: 'demo03ragpipelines000000000000000', chunk_idx: 19 }],
    },
  ],
}

function placeholderQ(title, docId) {
  return {
    title: `${title} — exam-worthy questions`,
    questions: [
      { question: `What is the central claim of ${title}?`, answer: `${title} models a core mechanism in modern AI; a strong answer states the claim precisely and gives one worked example.`, type: 'recall', confidence: 0.7, chunks: [{ doc_id: docId, chunk_idx: 0 }] },
      { question: `Compare ${title} to its closest alternative.`, answer: 'Identify the discriminating property and the regime in which each is the better choice.', type: 'analyze', confidence: 0.6, chunks: [{ doc_id: docId, chunk_idx: 2 }] },
      { question: `When would you NOT use ${title}?`, answer: 'List the failure modes the source material flags explicitly.', type: 'evaluate', confidence: 0.55, chunks: [{ doc_id: docId, chunk_idx: 5 }] },
    ],
  }
}

const QUESTIONS = {
  demo01transformers00000000000000: TRANSFORMERS,
  demo02agianalysis00000000000000:  AGI,
  demo03ragpipelines000000000000000: RAG,
  demo04neuralnetworks0000000000000: placeholderQ('Neural Networks', 'demo04neuralnetworks0000000000000'),
  demo05computervision0000000000000: placeholderQ('Computer Vision', 'demo05computervision0000000000000'),
  demo06diffusion000000000000000000: placeholderQ('Diffusion Models', 'demo06diffusion000000000000000000'),
  demo07rlhf00000000000000000000000: placeholderQ('RLHF', 'demo07rlhf00000000000000000000000'),
}

export function getQuestions(docIds) {
  if (!Array.isArray(docIds) || docIds.length === 0) return null
  return QUESTIONS[docIds[0]] || null
}
