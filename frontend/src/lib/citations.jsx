import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDocumentCitations } from './api.js'

/**
 * Per-document citation mapping: RAG chunk index → 1-based page number.
 *
 * Backed by GET /api/documents/{docId}/citations. Cached in a module-level
 * Map so the same payload isn't re-fetched per render or per surface.
 *
 *   const { format, isPaged } = useCitations(docId)
 *   format(3)              → "Page 12"
 *   format([1, 2, 3])      → "Pages 11–13"
 *   format(3, { short })   → "p.12"
 *
 * When the document is non-paged (text upload, or a legacy doc ingested
 * before page metadata existed), the formatter falls back to the previous
 * "Note 4" wording — never user-facing "chunk".
 */

const _cache = new Map() // docId -> Promise<{ pages, total_pages, is_paged }>

function fetchCitations(docId) {
  if (!docId) return Promise.resolve({ pages: [], total_pages: null, is_paged: false })
  if (!_cache.has(docId)) {
    _cache.set(
      docId,
      getDocumentCitations(docId).catch(() => ({
        pages: [], total_pages: null, is_paged: false,
      })),
    )
  }
  return _cache.get(docId)
}

const CitationsCtx = createContext(null)

/** Provider scoped to a single document — typically mounted at Session. */
export function CitationsProvider({ docId, children }) {
  const [data, setData] = useState({ pages: [], total_pages: null, is_paged: false })

  useEffect(() => {
    if (!docId) return undefined
    let alive = true
    fetchCitations(docId).then((r) => { if (alive) setData(r) })
    return () => { alive = false }
  }, [docId])

  const value = useMemo(() => {
    return { ...data, format: formatterFor(data) }
  }, [data])

  return <CitationsCtx.Provider value={value}>{children}</CitationsCtx.Provider>
}

/**
 * Hook usable INSIDE a CitationsProvider (single-doc views) OR standalone
 * with an explicit docId (preparation mode is multi-doc — see
 * useMultiDocCitations).
 */
export function useCitations(docIdOverride) {
  const ctx = useContext(CitationsCtx)
  // If a docId is explicitly passed and the context doesn't match, fetch.
  const [override, setOverride] = useState(null)
  const lastFetchRef = useRef(null)

  useEffect(() => {
    if (!docIdOverride) return undefined
    if (ctx && !docIdOverride) return undefined
    if (lastFetchRef.current === docIdOverride) return undefined
    let alive = true
    lastFetchRef.current = docIdOverride
    fetchCitations(docIdOverride).then((r) => { if (alive) setOverride(r) })
    return () => { alive = false }
  }, [docIdOverride, ctx])

  const data = docIdOverride ? (override || { pages: [], total_pages: null, is_paged: false }) : (ctx || { pages: [], total_pages: null, is_paged: false })
  return { ...data, format: formatterFor(data) }
}

/**
 * Multi-doc helper: returns one cached map of doc_id → { pages, is_paged, format }.
 * Used by Preparation (overview/questions/explanation) which displays
 * citations from several documents at once.
 */
export function useMultiDocCitations(docIds) {
  const [byDoc, setByDoc] = useState({})

  useEffect(() => {
    if (!docIds || docIds.length === 0) { setByDoc({}); return undefined }
    let alive = true
    Promise.all(
      docIds.map((id) => fetchCitations(id).then((r) => [id, r])),
    ).then((rows) => {
      if (!alive) return
      const next = {}
      for (const [id, r] of rows) next[id] = { ...r, format: formatterFor(r) }
      setByDoc(next)
    })
    return () => { alive = false }
  }, [docIds && docIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return byDoc
}

/* ---------------- formatter ---------------- */

function formatterFor({ pages, is_paged }) {
  return (idxOrArray, opts = {}) => format(pages, is_paged, idxOrArray, opts)
}

/**
 * Turn a chunk index (or list) into a human-readable label.
 *
 *   format(pages, true,  3,       {})            → "Page 12"
 *   format(pages, true,  [1,2,3], {})            → "Pages 11–13"
 *   format(pages, true,  [1,3],   {})            → "Pages 11, 14"
 *   format(pages, true,  3,       {short: true}) → "p.12"
 *   format(pages, false, 3,       {})            → "Note 4"
 *   format([],    false, 3,       {})            → "Note 4"
 */
export function format(pages, isPaged, idxOrArray, { short = false } = {}) {
  const arr = Array.isArray(idxOrArray) ? idxOrArray : [idxOrArray]
  if (!isPaged || !pages || pages.length === 0) {
    // Non-paged source — surface a friendlier label than "chunk".
    if (arr.length === 1) {
      const i = arr[0]
      return short ? `n.${i + 1}` : `Note ${i + 1}`
    }
    return short
      ? arr.map((i) => `n.${i + 1}`).join(', ')
      : `Notes ${arr.map((i) => i + 1).join(', ')}`
  }
  // Map each chunk index to its page. Drop unknown pages.
  const resolved = []
  for (const i of arr) {
    const p = pages[i]
    if (typeof p === 'number' && p > 0) resolved.push(p)
  }
  if (resolved.length === 0) {
    // Couldn't resolve any (out-of-range indices) — fall back to note labels.
    return short ? `n.${arr[0] + 1}` : `Note ${arr[0] + 1}`
  }
  // Deduplicate while preserving order.
  const dedup = []
  for (const p of resolved) if (!dedup.includes(p)) dedup.push(p)
  dedup.sort((a, b) => a - b)
  if (dedup.length === 1) return short ? `p.${dedup[0]}` : `Page ${dedup[0]}`
  // Detect contiguous range.
  const min = dedup[0], max = dedup[dedup.length - 1]
  if (max - min + 1 === dedup.length) {
    return short ? `p.${min}–${max}` : `Pages ${min}–${max}`
  }
  return short ? `pp.${dedup.join(', ')}` : `Pages ${dedup.join(', ')}`
}
