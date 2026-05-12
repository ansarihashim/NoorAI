/**
 * Cached revision-mode outputs. Each function returns the same shape the
 * backend would return for the corresponding endpoint.
 */

// Helper: stretch a small seed across all docs with realistic-looking output.
function buildFlashcards(docId, title, cards) {
  return {
    title: `Flashcards · ${title}`,
    n_cards: cards.length,
    cards: cards.map((c, i) => ({
      id: `${docId}-card-${i}`,
      question: c.q,
      answer:   c.a,
      difficulty: c.d || 'medium',
      tags: c.tags || [],
      grounded_chunks: c.gc || [i % 6],
    })),
  }
}

const FLASHCARDS = {
  demo01transformers00000000000000: buildFlashcards('demo01transformers00000000000000', 'Transformers', [
    { q: 'What does the softmax in attention compute?', a: 'A probability distribution over keys, given a query. softmax(QKᵀ/√d) tells you how much weight every key gets when summing the values.', d: 'easy', tags: ['attention', 'softmax'], gc: [2] },
    { q: 'Why divide by √d_k in scaled dot-product attention?', a: 'To keep the variance of the dot-products ≈1 so the softmax stays in a region with usable gradients.', d: 'medium', tags: ['attention', 'scaling'], gc: [2] },
    { q: 'What is the role of multiple heads in attention?', a: 'Each head can specialise in a different relation (syntax, coreference, semantic role). The concat-then-project step blends those into one output.', d: 'medium', tags: ['multi-head'], gc: [4] },
    { q: 'Why do transformers need positional encoding?', a: 'Self-attention is permutation-invariant. Without injecting order, "cat sat mat" and "mat sat cat" produce identical representations.', d: 'easy', tags: ['position'], gc: [6] },
    { q: 'In a decoder-only transformer, what enforces autoregressive behaviour?', a: 'A causal mask sets future positions to −∞ before the softmax, so token i can never attend to token j>i.', d: 'medium', tags: ['decoder', 'masking'], gc: [12] },
    { q: 'What does the KV cache store, and why?', a: 'Keys and values for already-emitted tokens. They never change once written, so caching them turns each new token from O(n²) into O(n) attention.', d: 'hard', tags: ['inference', 'kv-cache'], gc: [16] },
    { q: 'Pre-norm vs post-norm — what is the practical difference?', a: 'Pre-norm (LayerNorm before the sub-layer) is more numerically stable and trains deeper stacks. Post-norm (the original "Attention is all you need" arrangement) is harder to scale without warm-up.', d: 'hard', tags: ['layernorm'], gc: [10] },
    { q: 'What does the position-wise FFN do?', a: 'A 2-layer MLP applied independently to each position. Provides a per-token non-linear transform after attention has mixed information across positions.', d: 'easy', tags: ['ffn'], gc: [8] },
    { q: 'State the Chinchilla finding in one line.', a: 'For a fixed compute budget, loss is minimised when parameters and training tokens are scaled together roughly equally — previous LLMs were over-parameterised and under-trained.', d: 'medium', tags: ['scaling'], gc: [20] },
    { q: 'Encoder-only vs decoder-only — what is each best at?', a: 'Encoder-only (BERT-style): understanding tasks — classification, retrieval, NER. Decoder-only (GPT-style): generation.', d: 'easy', tags: ['architecture'], gc: [12] },
    { q: 'What is grouped-query attention?', a: 'A trick that shares one set of K/V projections across multiple query heads, reducing KV-cache memory at minimal quality cost. Common in Llama 2/3.', d: 'hard', tags: ['inference'], gc: [16] },
    { q: 'Why is flash-attention faster than the naïve implementation?', a: 'It tiles the attention matrix into blocks that fit in fast SRAM, avoiding the n×n materialisation in HBM. Same maths, far fewer memory roundtrips.', d: 'hard', tags: ['inference'], gc: [16] },
  ]),
  demo02agianalysis00000000000000: buildFlashcards('demo02agianalysis00000000000000', 'AGI', [
    { q: 'Define narrow AI in one line.', a: 'A system that optimises one objective inside a fixed domain — chess, image classification, route planning. Strong inside, blind outside.', d: 'easy', tags: ['definitions'], gc: [0] },
    { q: 'What does "recursive self-improvement" mean precisely?', a: 'A system that can improve the algorithms it uses to improve itself. Each iteration changes the improver, not just the result.', d: 'medium', tags: ['core'], gc: [3] },
    { q: 'What is the alignment problem?', a: 'The gap between the objective we wrote down and the behaviour we actually want. An optimiser that maximises the wrong thing is not safer for being smarter.', d: 'medium', tags: ['safety'], gc: [8] },
    { q: 'Outer alignment vs inner alignment.', a: 'Outer: specifying the right objective at all. Inner: making the trained model actually optimise that objective rather than a correlated proxy it discovered.', d: 'hard', tags: ['safety'], gc: [8] },
    { q: 'Why does take-off speed matter for governance?', a: 'Slow take-off (years) leaves room for institutions to respond. Fast take-off compresses decision time past the point where regulation can keep up.', d: 'medium', tags: ['policy'], gc: [16] },
    { q: 'What is capability compounding?', a: 'Each generation of AI becomes infrastructure for the next — better code-writing → faster research → better models. Curves diverge from linear.', d: 'medium', tags: ['core'], gc: [5] },
    { q: 'Why might multi-agent systems precede a monolithic AGI?', a: 'Composing reliable specialists is easier than getting one model to be reliable everywhere. Each piece can be evaluated and replaced.', d: 'hard', tags: ['agents'], gc: [13] },
    { q: 'Where does human leverage shift in an AGI economy?', a: 'From doing tasks to picking which tasks deserve doing — judgement, taste, ethics, accountability.', d: 'medium', tags: ['economy'], gc: [11] },
  ]),
  demo03ragpipelines000000000000000: buildFlashcards('demo03ragpipelines000000000000000', 'RAG', [
    { q: 'Why retrieve at all when LLMs have parametric memory?', a: 'To ground answers in a corpus the model never saw, enable citations, and update knowledge without retraining.', d: 'easy', tags: ['core'], gc: [0] },
    { q: 'What does chunking try to balance?', a: 'Small enough that each chunk embeds cleanly; large enough that it carries usable context.', d: 'easy', tags: ['ingest'], gc: [2] },
    { q: 'What is an embedding?', a: 'A learned function mapping text to a vector such that semantically close text lands near each other in the vector space.', d: 'easy', tags: ['embeddings'], gc: [4] },
    { q: 'Why use HNSW or IVF instead of exact NN search?', a: 'Exact nearest-neighbour over millions of vectors is O(n). Approximate indexes trade a tiny recall loss for orders-of-magnitude speedup.', d: 'medium', tags: ['index'], gc: [7] },
    { q: 'When does BM25 outperform vector retrieval?', a: 'Whenever the query contains exact anchors a bi-encoder can\'t preserve — names, codes, section numbers, dates.', d: 'medium', tags: ['hybrid'], gc: [10] },
    { q: 'Why use a cross-encoder reranker?', a: 'It reads (query, candidate) jointly so the score is more accurate. Too slow to run over the whole corpus; perfect for re-scoring the top-k.', d: 'medium', tags: ['reranking'], gc: [13] },
    { q: 'What turns a black-box LLM into a verifiable system?', a: 'Citations. Returning the source passages alongside the answer is the difference between trust and theatre.', d: 'easy', tags: ['citations'], gc: [16] },
    { q: 'List three common RAG failure modes.', a: 'Wrong retrieval (none of the right passages), low-confidence retrieval the LLM papers over with hallucination, and contradictory chunks the LLM merges without flagging.', d: 'hard', tags: ['failures'], gc: [19] },
  ]),
  demo04neuralnetworks0000000000000: buildFlashcards('demo04neuralnetworks0000000000000', 'Neural Networks', [
    { q: 'What does back-propagation actually compute?', a: 'The gradient of the loss with respect to every parameter, by applying the chain rule one layer at a time, right-to-left.', d: 'easy', tags: ['training'], gc: [0] },
    { q: 'Why does deep + non-linear matter?', a: 'Composing non-linear functions creates feature hierarchies. A linear stack of any depth collapses to one linear function.', d: 'medium', tags: ['theory'], gc: [2] },
    { q: 'What does dropout do?', a: 'Randomly zeros some activations during training, forcing the network to not rely on any single neuron. A cheap regulariser.', d: 'medium', tags: ['regularisation'], gc: [5] },
  ]),
  demo05computervision0000000000000: buildFlashcards('demo05computervision0000000000000', 'Computer Vision', [
    { q: 'What is the inductive bias of a convolution?', a: 'Translation equivariance — features that fire at one location fire the same way at every other location. Drastically reduces the search space vs a fully-connected layer.', d: 'medium', tags: ['cnn'], gc: [0] },
    { q: 'Why do CNNs use pooling?', a: 'To downsample, build hierarchy, and gain a degree of translation invariance.', d: 'easy', tags: ['cnn'], gc: [2] },
    { q: 'How does a ViT differ from a CNN?', a: 'A Vision Transformer splits the image into patches, embeds each patch, and applies standard transformer attention — no convolutions.', d: 'medium', tags: ['vit'], gc: [5] },
  ]),
  demo06diffusion000000000000000000: buildFlashcards('demo06diffusion000000000000000000', 'Diffusion', [
    { q: 'What does the forward diffusion process do?', a: 'Adds Gaussian noise to data in T small steps, eventually turning a real image into pure noise.', d: 'easy', tags: ['forward'], gc: [0] },
    { q: 'What does the reverse process learn?', a: 'How to denoise — predicting the noise added at each step. Iterating the reverse turns noise back into a sample from the data distribution.', d: 'medium', tags: ['reverse'], gc: [2] },
  ]),
  demo07rlhf00000000000000000000000: buildFlashcards('demo07rlhf00000000000000000000000', 'RLHF', [
    { q: 'What problem does RLHF solve that plain supervised fine-tuning does not?', a: 'It optimises a learned reward model that captures human preferences rather than just imitating training data. Lets the model exceed the average human in helpfulness/harmlessness rather than match it.', d: 'medium', tags: ['rlhf'], gc: [0] },
    { q: 'Why is the KL penalty in PPO important here?', a: 'Without it, the policy can drift far from the SFT model and exploit reward-model artefacts. The KL keeps the policy on the manifold the reward model can score reliably.', d: 'hard', tags: ['ppo'], gc: [2] },
  ]),
}

// -----------------------------------------------------------------------
// Quizzes
// -----------------------------------------------------------------------

function buildQuiz(docId, title, qs) {
  return {
    title: `Quiz · ${title}`,
    n_questions: qs.length,
    questions: qs.map((q, i) => ({ id: `${docId}-q-${i}`, ...q, grounded_chunks: q.grounded_chunks || [i % 6] })),
  }
}

const QUIZZES = {
  demo01transformers00000000000000: buildQuiz('demo01transformers00000000000000', 'Transformers', [
    {
      type: 'mcq',
      question: 'Why is the dot-product divided by √d_k before the softmax?',
      options: [
        'To prevent the dot-products from saturating the softmax for large d_k',
        'To normalise the values across heads',
        'To compensate for dropout on the values',
        'To make the gradient symmetric across heads',
      ],
      correct_index: 0,
      explanation: 'Without scaling, dot-product variance grows with d_k and the softmax pushes nearly all mass onto one key — gradient vanishes. Dividing by √d_k keeps variance ≈ 1.',
    },
    {
      type: 'mcq',
      question: 'Which is true about a decoder-only transformer during inference?',
      options: [
        'It recomputes attention for all past tokens at every step',
        'It uses a KV cache so past tokens are read, not recomputed',
        'It attends to future tokens via a soft mask',
        'It runs the FFN before the attention layer',
      ],
      correct_index: 1,
      explanation: 'Past keys and values do not change after they\'re emitted, so caching them turns inference from O(n²) into O(n).',
    },
    {
      type: 'conceptual',
      question: 'In one sentence, explain why a transformer needs positional encoding but an RNN does not.',
      options: [],
      correct_index: 0,
      explanation: 'An RNN processes tokens sequentially so order is implicit in the time step. A transformer attends to all tokens in parallel, which is permutation-invariant unless position information is injected.',
    },
    {
      type: 'assertion_reason',
      question: 'Assertion: Multi-head attention can attend to multiple relations simultaneously.\nReason: Each head has its own Q/K/V projection so it can specialise.',
      options: [
        'Both assertion and reason are true and the reason is the correct explanation',
        'Both true but reason is not the correct explanation',
        'Assertion true, reason false',
        'Assertion false',
      ],
      correct_index: 0,
      explanation: 'Independent projections let each head learn a different attention pattern; concatenating them aggregates the specialisations.',
    },
  ]),
}

function placeholderQuiz(docId, title) {
  return buildQuiz(docId, title, [
    { type: 'conceptual', question: `What is the central mechanism behind ${title}?`, options: [], correct_index: 0, explanation: 'A strong answer identifies the load-bearing idea and one consequence of it.' },
    { type: 'conceptual', question: `Where does ${title} fail?`, options: [], correct_index: 0, explanation: 'List the regimes where the method is unreliable.' },
  ])
}

// -----------------------------------------------------------------------
// Active recall, quick revision, night-before, viva
// -----------------------------------------------------------------------

const RECALL = {
  demo01transformers00000000000000: {
    title: 'Active recall · Transformers',
    prompts: [
      { id: 'r1', kind: 'concept', prompt: 'Walk through, step by step, what scaled dot-product attention does to a sequence of tokens.', expected: 'Project each token to Q, K, V. Compute QKᵀ. Scale by √d_k. Softmax row-wise. Multiply by V. The result, for each row, is a weighted blend of every token\'s value driven by Q·K similarity.', grounded_chunks: [2] },
      { id: 'r2', kind: 'fill_in_blank', prompt: 'In multi-head attention, the outputs of each head are ____ and then projected by W_O.', expected: 'concatenated', grounded_chunks: [4] },
      { id: 'r3', kind: 'explain_in_own_words', prompt: 'In your own words, describe what the KV cache is and why it matters.', expected: 'A store of past keys and values so generation does not re-process old tokens. Without it generation is quadratic; with it, linear.', grounded_chunks: [16] },
      { id: 'r4', kind: 'short', prompt: 'Define positional encoding.', expected: 'A function that injects order information into otherwise permutation-invariant token embeddings.', grounded_chunks: [6] },
    ],
  },
}

function placeholderRecall(docId, title) {
  return {
    title: `Active recall · ${title}`,
    prompts: [
      { id: `${docId}-r1`, kind: 'concept', prompt: `Explain how ${title} works.`, expected: 'A strong answer states the mechanism, the failure modes, and one example.', grounded_chunks: [0] },
    ],
  }
}

const QUICK = {
  demo01transformers00000000000000: {
    title: 'Quick revision · Transformers',
    topics: [
      { title: 'Attention', summary: 'softmax(QKᵀ/√d)·V. Each token attends to every other in parallel; the softmax picks which to listen to. Replaced recurrence because it parallelises and shortens long-range paths.', key_points: ['Q/K/V are linear projections of the input.', 'Scale by √d_k or the softmax saturates.', 'Permutation-invariant — needs positional encoding.'], grounded_chunks: [2] },
      { title: 'Multi-head', summary: 'h parallel heads, each with its own projection. Concatenate then project. Lets the model attend to multiple relations at once.', key_points: ['h × d_head = d_model usually.', 'Heads specialise in syntactic / semantic / coreference patterns.', 'Grouped-query attention reduces KV memory by sharing K/V across heads.'], grounded_chunks: [4] },
      { title: 'KV Cache', summary: 'Past keys / values do not change during generation. Caching them turns the per-token cost from O(n²) to O(n).', key_points: ['The dominant memory cost at long context lengths.', 'Quantised / paged KV caches shrink it further.'], grounded_chunks: [16] },
    ],
  },
}

function placeholderQuick(docId, title) {
  return {
    title: `Quick revision · ${title}`,
    topics: [
      { title, summary: `Core ideas underpinning ${title}.`, key_points: ['Key idea one.', 'Key idea two.', 'Key idea three.'], grounded_chunks: [0] },
    ],
  }
}

const NIGHT = {
  demo01transformers00000000000000: {
    title: 'Night-before · Transformers',
    items: [
      { id: 'n1', category: 'formula',    content: 'Attention(Q,K,V) = softmax(QKᵀ / √d_k) · V', importance: 5, exam_probability: 0.95, grounded_chunks: [2] },
      { id: 'n2', category: 'definition', content: 'Multi-head: h parallel attention layers, outputs concatenated then linearly projected.', importance: 4, exam_probability: 0.9, grounded_chunks: [4] },
      { id: 'n3', category: 'high_yield', content: 'Positional encoding exists because self-attention is permutation-invariant.', importance: 5, exam_probability: 0.85, grounded_chunks: [6] },
      { id: 'n4', category: 'mistake',    content: 'Don\'t forget the causal mask in decoder-only models — without it the model can attend to future tokens.', importance: 4, exam_probability: 0.8, grounded_chunks: [12] },
      { id: 'n5', category: 'high_yield', content: 'KV cache makes autoregressive generation tractable: O(n²) → O(n).', importance: 5, exam_probability: 0.85, grounded_chunks: [16] },
      { id: 'n6', category: 'definition', content: 'Pre-norm = LayerNorm BEFORE the sub-layer. More stable in deep stacks than post-norm.', importance: 3, exam_probability: 0.6, grounded_chunks: [10] },
    ],
  },
}

function placeholderNight(docId, title) {
  return {
    title: `Night-before · ${title}`,
    items: [
      { id: `${docId}-n1`, category: 'high_yield', content: `Core idea of ${title}: …`, importance: 5, exam_probability: 0.8, grounded_chunks: [0] },
    ],
  }
}

const VIVA = {
  demo01transformers00000000000000: {
    title: 'Viva · Transformers',
    questions: [
      { id: 'v1', question: 'Walk me through what happens when you process a 5-token sentence through a 6-layer decoder-only transformer.', expected_answer: 'Token embeddings + positional encodings enter layer 1. Layer 1 applies masked self-attention (each token only sees earlier tokens), then FFN, with residual + LayerNorm around each. The output enters layer 2. Repeat 6 times. The final layer\'s last-token output is projected to vocab logits for the next-token prediction.', follow_ups: ['What changes during inference vs training?', 'Why is the mask necessary?', 'What stops gradients from exploding through 6 stacked layers?'], difficulty: 'medium', grounded_chunks: [12] },
      { id: 'v2', question: 'When would you NOT use a transformer?', expected_answer: 'Latency-critical tasks where attention\'s n² is prohibitive (most extreme: continuous control loops). Tiny datasets where the inductive bias of an RNN or CNN beats data-hungry attention. Domains with strong locality where convolutions are more parameter-efficient.', follow_ups: ['Could state-space models change that calculus?'], difficulty: 'hard', grounded_chunks: [12] },
    ],
  },
}

function placeholderViva(docId, title) {
  return {
    title: `Viva · ${title}`,
    questions: [
      { id: `${docId}-v1`, question: `Walk me through ${title}.`, expected_answer: '…', follow_ups: ['Where does it fail?'], difficulty: 'medium', grounded_chunks: [0] },
    ],
  }
}

// -----------------------------------------------------------------------
// Public lookup
// -----------------------------------------------------------------------

function lookup(map, fallbackFn, docId, title) {
  if (map[docId]) return map[docId]
  return fallbackFn(docId, title)
}

import { DEMO_DOCS, findDoc } from '../topics/index.js'

export function getFlashcards(docId) { return lookup(FLASHCARDS, (id, t) => buildFlashcards(id, t, []), docId, (findDoc(docId)?.title || 'Untitled')) }
export function getQuiz(docId)       { return lookup(QUIZZES,    placeholderQuiz, docId, (findDoc(docId)?.title || 'Untitled')) }
export function getRecall(docId)     { return lookup(RECALL,     placeholderRecall, docId, (findDoc(docId)?.title || 'Untitled')) }
export function getQuick(docId)      { return lookup(QUICK,      placeholderQuick, docId, (findDoc(docId)?.title || 'Untitled')) }
export function getNight(docId)      { return lookup(NIGHT,      placeholderNight, docId, (findDoc(docId)?.title || 'Untitled')) }
export function getViva(docId)       { return lookup(VIVA,       placeholderViva, docId, (findDoc(docId)?.title || 'Untitled')) }

// suppress unused-import lint
void DEMO_DOCS
