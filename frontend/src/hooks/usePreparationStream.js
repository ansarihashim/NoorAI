/**
 * usePreparationStream — progressive (SSE) generation for the 3 preparation
 * features. Two shapes of stream:
 *
 *   - "items" mode (Important Questions): { items, isStreaming, isDone, error, total }
 *       appends each SSE `item` event — same shape as useRevisionStream.
 *   - "text"  mode (Overview, Explanation): { text, isStreaming, isDone, error }
 *       appends each SSE `token` event to a growing string (typewriter effect).
 *
 *   const s = usePreparationStream(docIds, 'overview', token, { n_min, n_max })
 *   s.startStream()                         // overview / questions
 *   s.startStream({ topic })                // explanation (topic via opts)
 *
 * Demo mode simulates the stream from the existing non-streaming fixtures.
 * On transport failure / >3s no-response, it falls back to the non-streaming
 * generate endpoint (items → items, text → JSON for overview / prose for
 * explanation). Aborts the reader on unmount / reset / restart.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  apiBase,
  getToken,
  generateOverview,
  generateImportantQuestions,
  generateExplanation,
  deleteOverview,
  deleteImportantQuestions,
} from '../lib/api.js'
import { DEMO_MODE } from '../config/demo.js'

const FEATURES = {
  questions: {
    mode: 'items',
    path: 'questions',
    gen: (ids, opts) => generateImportantQuestions(ids, opts),
    del: (ids) => deleteImportantQuestions(ids),
    items: (s) => s?.questions || [],
    query: (p) => (p.n != null ? { n: String(p.n) } : {}),
  },
  overview: {
    mode: 'text',
    path: 'overview',
    gen: (ids, opts) => generateOverview(ids, opts),
    del: (ids) => deleteOverview(ids),
    // Overview streams the OverviewMap JSON; fallback returns the parsed object,
    // so stringify it back to the same "text is JSON" contract the component parses.
    toText: (s) => JSON.stringify(s),
    query: (p) => {
      const q = {}
      if (p.n_min != null) q.n_min = String(p.n_min)
      if (p.n_max != null) q.n_max = String(p.n_max)
      return q
    },
  },
  explanation: {
    mode: 'text',
    path: 'explanation',
    gen: (ids, opts, extra) => generateExplanation(ids, extra.topic, opts),
    del: null, // no delete endpoint; explanations are per-topic + cache-replayed
    toText: (s) => s?.explanation || '',
    query: (p) => ({ topic: p.topic }),
  },
}

const WATCHDOG_MS = 15000

export default function usePreparationStream(docIds, feature, token, extraParams) {
  const [items, setItems] = useState([])
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(null)

  const cfg = FEATURES[feature] || null

  // Keep latest values without re-subscribing startStream.
  const latest = useRef({ docIds, token, extraParams })
  latest.current = { docIds, token, extraParams }

  const abortRef = useRef(null)
  const watchdogRef = useRef(null)
  const gotResponseRef = useRef(false)

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
    setItems([]); setText(''); setIsStreaming(false); setIsDone(false); setError(null); setTotal(null)
  }, [])

  const startStream = useCallback(
    async (opts = {}) => {
      if (!cfg) return
      const { docIds: ids, token: tok, extraParams: extra } = latest.current
      if (!ids || ids.length === 0) return
      const params = { ...(extra || {}), ...opts }

      abortInflight()
      gotResponseRef.current = false
      setItems([]); setText(''); setIsDone(false); setError(null); setTotal(null); setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      const alive = () => !controller.signal.aborted

      // Forced regenerate: clear the server cache first (if the feature supports it)
      // so the stream produces fresh output instead of replaying.
      if (params.force && cfg.del) {
        try { await cfg.del(ids) } catch { /* best effort */ }
        if (!alive()) return
      }

      const applySet = (set) => {
        if (cfg.mode === 'items') {
          const arr = cfg.items(set)
          setItems(arr); setTotal(arr.length)
        } else {
          setText(cfg.toText(set))
        }
        setIsStreaming(false); setIsDone(true)
      }

      // Demo mode: no backend — simulate a stream from fixtures.
      if (DEMO_MODE) {
        try {
          const set = await cfg.gen(ids, params, extra || {})
          if (!alive()) return
          if (cfg.mode === 'items') {
            const arr = cfg.items(set)
            setTotal(arr.length)
            for (let i = 0; i < arr.length; i++) {
              if (!alive()) return
              setItems((prev) => [...prev, arr[i]])
              await new Promise((r) => setTimeout(r, 90))
            }
          } else {
            const full = cfg.toText(set)
            for (let i = 0; i < full.length; i += 3) {
              if (!alive()) return
              setText((prev) => prev + full.slice(i, i + 3))
              await new Promise((r) => setTimeout(r, 16))
            }
          }
          if (!alive()) return
          setIsStreaming(false); setIsDone(true)
        } catch (err) {
          if (!alive()) return
          setIsStreaming(false); setError(err?.message || String(err))
        }
        return
      }

      const fallback = async () => {
        try {
          const set = await cfg.gen(ids, params, extra || {})
          if (!alive()) return
          applySet(set)
        } catch (err) {
          if (!alive()) return
          setIsStreaming(false); setError(err?.message || String(err))
        }
      }

      // Watchdog: unreachable endpoint (no response in 3s) → fall back.
      watchdogRef.current = setTimeout(() => {
        if (!gotResponseRef.current && alive()) {
          controller.abort()
          const fb = new AbortController()
          abortRef.current = fb
          ;(async () => {
            try {
              const set = await cfg.gen(ids, params, extra || {})
              if (fb.signal.aborted) return
              if (cfg.mode === 'items') { const arr = cfg.items(set); setItems(arr); setTotal(arr.length) }
              else { setText(cfg.toText(set)) }
              setIsStreaming(false); setIsDone(true)
            } catch (err) {
              if (fb.signal.aborted) return
              setIsStreaming(false); setError(err?.message || String(err))
            }
          })()
        }
      }, WATCHDOG_MS)

      try {
        const qs = new URLSearchParams()
        ids.forEach((id) => qs.append('doc_ids', id))
        const extraQuery = cfg.query(params)
        for (const [k, v] of Object.entries(extraQuery)) {
          if (v != null && v !== '') qs.set(k, v)
        }
        qs.set('token', tok || getToken() || '')
        const url = `${apiBase}/api/preparation/${cfg.path}/stream?${qs.toString()}`

        const res = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal })
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
            _handleFrame(frame, cfg.mode, { alive, setItems, setText, setTotal, setIsStreaming, setIsDone, setError })
          }
        }
        if (alive()) setIsStreaming(false)
      } catch (err) {
        if (!alive()) return
        clearWatchdog()
        if (!gotResponseRef.current) await fallback()
        else { setIsStreaming(false); setError(err?.message || String(err)) }
      }
    },
    [cfg, feature],
  )

  useEffect(() => () => abortInflight(), [])

  return { items, text, isStreaming, isDone, error, total, mode: cfg?.mode, startStream, reset }
}

function _handleFrame(frame, mode, s) {
  const line = frame.split('\n').find((l) => l.startsWith('data:'))
  if (!line) return
  let evt
  try { evt = JSON.parse(line.slice(5).trim()) } catch { return }
  if (!s.alive()) return
  if (evt.type === 'item') {
    s.setItems((prev) => [...prev, evt.data])
  } else if (evt.type === 'token') {
    s.setText((prev) => prev + (evt.token || ''))
  } else if (evt.type === 'done') {
    s.setTotal(evt.total ?? null)
    s.setIsStreaming(false)
    s.setIsDone(true)
  } else if (evt.type === 'error') {
    s.setIsStreaming(false)
    s.setError(evt.message || 'stream error')
  }
}
