/**
 * The canonical list of demo "documents" the user can study.
 * Each entry maps to fixture data under src/demo/{preparation,revision,...}.
 *
 * Ids are 32-char hex (matching the backend's doc_id regex) so the routing
 * layer treats them like real docs end-to-end — no special casing in the UI.
 */
export const DEMO_DOCS = [
  {
    id: 'demo01transformers00000000000000',
    title: 'Transformers & Attention',
    n_chunks: 28,
    created_at: 1730841600,         // 2024-11-06
    has_podcast: true,
    total_pages: 18,
  },
  {
    id: 'demo02agianalysis00000000000000',
    title: 'AGI — Recursive Self-Improvement',
    n_chunks: 22,
    created_at: 1730755200,
    has_podcast: true,
    total_pages: 14,
  },
  {
    id: 'demo03ragpipelines000000000000000',
    title: 'RAG Pipelines & Vector Databases',
    n_chunks: 31,
    created_at: 1730668800,
    has_podcast: true,
    total_pages: 22,
  },
  {
    id: 'demo04neuralnetworks0000000000000',
    title: 'Neural Networks — Foundations',
    n_chunks: 24,
    created_at: 1730582400,
    has_podcast: false,
    total_pages: 16,
  },
  {
    id: 'demo05computervision0000000000000',
    title: 'Computer Vision & CNNs',
    n_chunks: 26,
    created_at: 1730496000,
    has_podcast: false,
    total_pages: 17,
  },
  {
    id: 'demo06diffusion000000000000000000',
    title: 'Diffusion Models — Image Generation',
    n_chunks: 20,
    created_at: 1730409600,
    has_podcast: false,
    total_pages: 13,
  },
  {
    id: 'demo07rlhf00000000000000000000000',
    title: 'RLHF & Alignment',
    n_chunks: 19,
    created_at: 1730323200,
    has_podcast: false,
    total_pages: 12,
  },
]

export function findDoc(docId) {
  return DEMO_DOCS.find((d) => d.id === docId) || null
}

/** True iff a doc id matches the demo prefix. */
export function isDemoDocId(id) {
  return typeof id === 'string' && id.startsWith('demo')
}
