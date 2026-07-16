/**
 * useRevisionStream — progressive (SSE) generation for the 6 revision features.
 *
 * Opens a fetch() stream to the backend `GET /api/revision/{docId}/{feature}/stream`
 * endpoint (JWT via ?token=, since an SSE request can't carry the Authorization
 * header), and surfaces items as they arrive.
 *
 *   const { items, isStreaming, isDone, error, total, startStream, reset } =
 *     useRevisionStream(docId, 'flashcards', token)
 *
 * Behaviours:
 *   - Appends each SSE `item` event to `items`; `done` sets `isDone`+`total`;
 *     `error` sets `error` (partial items are kept).
 *   - Demo mode: there is no backend, so it "simulates" a stream from the
 *     existing non-streaming generate (local fixtures), emitting items one by
 *     one so the UI still animates.
 *   - Fallback: if the streaming endpoint can't be reached (fetch rejects, non-OK
 *     response, or no response within 3s), it automatically falls back to the
 *     existing non-streaming generate endpoint. A mid-stream server `error`
 *     event is surfaced as `error` (the "Try again" button re-runs it), not
 *     silently retried.
 *   - Aborts the in-flight reader on unmount / reset / restart.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  apiBase,
  getToken,
  generateFlashcards,
  generateQuiz,
  generateRecall,
  generateViva,
  generateNightBefore,
  generateQuickRevision,
  deleteFlashcards,
  deleteQuiz,
  deleteRecall,
  deleteViva,
  deleteNightBefore,
  deleteQuickRevision,
} from '../lib/api.js'
import { DEMO_MODE } from '../config/demo.js'

// feature key → { path, param, gen, del, items }
//   path  : URL segment for the /stream endpoint (matches the backend routes)
//   param : query param carrying the count (n | max_topics)
//   gen   : non-streaming generate (used for demo + 3s fallback)
//   del   : delete cache (used so a forced restart re-generates instead of
//           replaying the cached set)
//   items : extract the item array from a full Set payload
const FEATURES = {
  flashcards: {
    path: 'flashcards', param: 'n',
    gen: generateFlashcards, del: deleteFlashcards, items: (s) => s?.cards || [],
  },
  quiz: {
    path: 'quiz', param: 'n',
    gen: generateQuiz, del: deleteQuiz, items: (s) => s?.questions || [],
  },
  recall: {
    path: 'recall', param: 'n',
    gen: generateRecall, del: deleteRecall, items: (s) => s?.prompts || [],
  },
  viva: {
    path: 'viva', param: 'n',
    gen: generateViva, del: deleteViva, items: (s) => s?.questions || [],
  },
  night_before: {
    path: 'night_before', param: 'n',
    gen: generateNightBefore, del: deleteNightBefore, items: (s) => s?.items || [],
  },
  quick_revision: {
    path: 'quick_revision', param: 'max_topics',
    gen: generateQuickRevision, del: deleteQuickRevision, items: (s) => s?.topics || [],
  },
}

// Accept the RevisionView tab aliases too, so callers can pass either.
const ALIASES = { quick: 'quick_revision', night: 'night_before', active_recall: 'recall' }

function resolveFeature(feature) {
  return FEATURES[feature] || FEATURES[ALIASES[feature]] || null
}

const WATCHDOG_MS = 15000

export default function useRevisionStream(docId, feature, token) {
  const [items, setItems] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(null)

  const abortRef = useRef(null)
  const watchdogRef = useRef(null)
  const gotResponseRef = useRef(false) // headers received from the SSE endpoint

  const clearWatchdog = () => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null }
  }
  const abortInflight = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    clearWatchdog()
  }

  const reset = useCallback(() => {
    abortInflight()
    gotResponseRef.current = false
    setItems([])
    setIsStreaming(false)
    setIsDone(false)
    setError(null)
    setTotal(null)
  }, [])

  const startStream = useCallback(
    async (opts = {}) => {
      const cfg = resolveFeature(feature)
      if (!docId || !cfg) return

      // Idempotent restart: drop any in-flight stream, clear state.
      abortInflight()
      gotResponseRef.current = false
      setItems([])
      setIsDone(false)
      setError(null)
      setTotal(null)
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      const alive = () => !controller.signal.aborted

      // A forced (re)generation must not just replay the cached set — clear the
      // server cache first so the stream produces fresh items.
      if (opts.force) {
        try { await cfg.del(docId) } catch { /* best effort */ }
        if (!alive()) return
      }

      // --- Demo mode: no backend SSE. Simulate a stream from fixtures. ---
      if (DEMO_MODE) {
        try {
          const set = await cfg.gen(docId, opts)
          const arr = cfg.items(set)
          if (!alive()) return
          setTotal(arr.length)
          for (let i = 0; i < arr.length; i++) {
            if (!alive()) return
            setItems((prev) => [...prev, arr[i]])
            // small stagger so cards animate in like a real stream
            await new Promise((r) => setTimeout(r, 90))
          }
          if (!alive()) return
          setIsStreaming(false)
          setIsDone(true)
        } catch (err) {
          if (!alive()) return
          setIsStreaming(false)
          setError(err?.message || String(err))
        }
        return
      }

      // Fall back to the non-streaming generate endpoint, keeping any items
      // already streamed only if we have none (transport failure path).
      const fallback = async () => {
        try {
          const set = await cfg.gen(docId, opts)
          if (!alive()) return
          const arr = cfg.items(set)
          setItems(arr)
          setTotal(arr.length)
          setIsStreaming(false)
          setIsDone(true)
        } catch (err) {
          if (!alive()) return
          setIsStreaming(false)
          setError(err?.message || String(err))
        }
      }

      // Watchdog: if the endpoint hasn't even responded within 3s, treat it as
      // unreachable and fall back to non-streaming generation.
      watchdogRef.current = setTimeout(() => {
        if (!gotResponseRef.current && alive()) {
          controller.abort()
          // re-open an abort scope for the fallback's alive() checks
          const fb = new AbortController()
          abortRef.current = fb
          const fbAlive = () => !fb.signal.aborted
          ;(async () => {
            try {
              const set = await cfg.gen(docId, opts)
              if (!fbAlive()) return
              const arr = cfg.items(set)
              setItems(arr); setTotal(arr.length); setIsStreaming(false); setIsDone(true)
            } catch (err) {
              if (!fbAlive()) return
              setIsStreaming(false); setError(err?.message || String(err))
            }
          })()
        }
      }, WATCHDOG_MS)

      try {
        const qs = new URLSearchParams()
        if (cfg.param === 'n' && opts.n != null) qs.set('n', String(opts.n))
        if (cfg.param === 'max_topics' && opts.max_topics != null) qs.set('max_topics', String(opts.max_topics))
        qs.set('token', token || getToken() || '')
        const url = `${apiBase}/api/revision/${docId}/${cfg.path}/stream?${qs.toString()}`

        const res = await fetch(url, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        gotResponseRef.current = true
        clearWatchdog()
        if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let sep
          while ((sep = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, sep)
            buf = buf.slice(sep + 2)
            _handleFrame(frame, { alive, setItems, setTotal, setIsStreaming, setIsDone, setError })
          }
        }
        // Stream closed without an explicit done (rare) — settle as done.
        if (alive()) setIsStreaming(false)
      } catch (err) {
        if (!alive()) return // aborted by reset/unmount/watchdog — nothing to do
        clearWatchdog()
        if (!gotResponseRef.current) {
          // Never connected → transport failure → fall back.
          await fallback()
        } else {
          setIsStreaming(false)
          setError(err?.message || String(err))
        }
      }
    },
    [docId, feature, token],
  )

  // Abort any in-flight stream on unmount.
  useEffect(() => () => abortInflight(), [])

  return { items, isStreaming, isDone, error, total, startStream, reset }
}

function _handleFrame(frame, s) {
  const line = frame.split('\n').find((l) => l.startsWith('data:'))
  if (!line) return
  let evt
  try { evt = JSON.parse(line.slice(5).trim()) } catch { return }
  if (!s.alive()) return
  if (evt.type === 'item') {
    s.setItems((prev) => [...prev, evt.data])
  } else if (evt.type === 'done') {
    s.setTotal(evt.total ?? null)
    s.setIsStreaming(false)
    s.setIsDone(true)
  } else if (evt.type === 'error') {
    s.setIsStreaming(false)
    s.setError(evt.message || 'stream error')
  }
}
