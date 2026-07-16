import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAudio } from '../../hooks/useAudio.js'
import { useMediaSession } from '../../hooks/useMediaSession.js'
import { useKeyboardControls } from '../../hooks/useKeyboardControls.js'
import { apiBase, generatePodcast, getPodcast, getToken, podcastTurnUrl } from '../../lib/api.js'
import { DEMO_MODE } from '../../config/demo.js'

/**
 * Podcast session state lifted to the WorkspaceShell so both the center
 * playback surface AND the right-rail transcript panel can read the same
 * source of truth.
 *
 * Notes on rerender pressure: useAudio publishes a `state` that ticks while
 * playing. Consumers that don't need localTime (e.g. the transcript) should
 * read `state.idx` only and rely on memoization to avoid frame-rate
 * rerenders.
 */

const PodcastCtx = createContext(null)

const SAVE_KEY = 'echoverse.lastPosition'

function loadPodcastPos(docId) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')
    const p = all[docId]
    if (p && p.mode === 'podcast') return p
  } catch { /* no-op */ }
  return null
}

function persistPodcastPos(docId, idx, time) {
  if (!docId) return
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')
    all[docId] = { ...(all[docId] || {}), mode: 'podcast', podcastIdx: idx, podcastTime: time, updatedAt: Date.now() }
    localStorage.setItem(SAVE_KEY, JSON.stringify(all))
  } catch { /* ignore quota */ }
}

function estimateTurnDuration(text) {
  if (!text) return 4
  return Math.max(2, Math.round(text.length / 13))
}

/**
 * Drive the podcast progress SSE stream, invoking callbacks as events arrive.
 * Throws on transport failure (caller decides whether to fall back).
 */
async function streamPodcastProgress(docId, { signal, onOpen, onScriptReady, onTurn, onDone, onError }) {
  const qs = new URLSearchParams()
  qs.set('token', getToken() || '')
  const res = await fetch(`${apiBase}/api/podcast/${docId}/progress?${qs.toString()}`, {
    headers: { Accept: 'text/event-stream' },
    signal,
  })
  onOpen?.()
  if (!res.ok || !res.body) throw new Error(`progress HTTP ${res.status}`)
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
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      let evt
      try { evt = JSON.parse(line.slice(5).trim()) } catch { continue }
      if (evt.type === 'script_ready') onScriptReady?.(evt.total_turns)
      else if (evt.type === 'turn_ready') onTurn?.(evt)
      else if (evt.type === 'done') onDone?.()
      else if (evt.type === 'error') onError?.(evt.message || 'stream error')
    }
  }
}

export function PodcastSessionProvider({ children }) {
  const { docId } = useParams()
  const [turns, setTurns] = useState([])
  const [status, setStatus] = useState('idle')        // idle | generating | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 }) // turns synthesized / total
  const abortRef = useRef(null)

  // Reset on doc change (and abort any in-flight progress stream).
  useEffect(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setTurns([])
    setStatus('idle')
    setErrorMsg('')
    setBusy(false)
    setProgress({ done: 0, total: 0 })
  }, [docId])

  // Abort the stream on unmount.
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort() }, [])

  // Probe for an existing podcast script for this doc.
  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const script = await getPodcast(docId)
        if (!cancelled && script?.turns?.length) {
          setTurns(script.turns)
          setStatus('ready')
        }
      } catch (err) {
        if (err?.status && err.status !== 404 && !cancelled) {
          // 404 = no podcast yet; anything else = log and stay idle.
          // eslint-disable-next-line no-console
          console.warn('[podcast] probe failed:', err)
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId])

  const chapters = useMemo(
    () =>
      (turns || []).map((t, idx) => ({
        idx,
        url: podcastTurnUrl(docId, idx),
        speaker: t.speaker,
        label: t.speaker === 'guest' ? 'Guest' : 'Host',
        durationHint: estimateTurnDuration(t.text),
        // Carried for demo-mode Web Speech playback (useAudio detects the
        // `demo://` URL scheme and reads `text` instead of the audio file).
        text: t.text,
        role: t.speaker,
      })),
    [turns, docId],
  )

  const audio = useAudio({ chapters, onChapterChange: () => {} })

  // One-time resume position application.
  const appliedInitialRef = useRef(false)
  useEffect(() => { appliedInitialRef.current = false }, [docId])
  useEffect(() => {
    if (appliedInitialRef.current) return
    if (chapters.length === 0) return
    const saved = loadPodcastPos(docId)
    if (saved && typeof saved.podcastIdx === 'number' && saved.podcastIdx >= 0) {
      audio.seekChapter(saved.podcastIdx, saved.podcastTime || 0)
      audio.pause()
      appliedInitialRef.current = true
    }
  }, [chapters.length, docId, audio])

  // Persist position every 1.5s.
  useEffect(() => {
    if (!docId) return
    const t = setInterval(() => {
      if (audio.state.idx >= 0) persistPodcastPos(docId, audio.state.idx, audio.state.localTime)
    }, 1500)
    return () => clearInterval(t)
  }, [audio, docId])

  // OS lockscreen / headset controls.
  useMediaSession({
    enabled: chapters.length > 0,
    title: 'Discussion',
    artist: turns?.[audio.state.idx]?.speaker
      ? (turns[audio.state.idx].speaker === 'guest' ? 'Guest' : 'Host')
      : 'NoorAI',
    album: 'NoorAI',
    onPlay: audio.play,
    onPause: audio.pause,
    onSeek: audio.seekGlobal,
    onPrev: audio.prevChapter,
    onNext: audio.nextChapter,
    onSkipBack: () => audio.skip(-15),
    onSkipForward: () => audio.skip(15),
    state: audio.state,
  })

  // Keyboard controls.
  useKeyboardControls({ enabled: chapters.length > 0, audio })

  const handleGenerate = useCallback(async () => {
    if (!docId) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const alive = () => !controller.signal.aborted

    setErrorMsg('')
    setBusy(true)
    setStatus('generating')
    setTurns([])
    setProgress({ done: 0, total: 0 })

    // Demo mode: no backend — simulate the transcript building line by line.
    if (DEMO_MODE) {
      try {
        const res = await generatePodcast(docId)
        const all = res.turns || []
        if (!alive()) return
        setProgress({ done: 0, total: all.length })
        for (let i = 0; i < all.length; i++) {
          if (!alive()) return
          setTurns((prev) => [...prev, { speaker: all[i].speaker, text: all[i].text }])
          setProgress({ done: i + 1, total: all.length })
          await new Promise((r) => setTimeout(r, 160))
        }
        if (!alive()) return
        setStatus('ready')
      } catch (err) {
        if (!alive()) return
        setErrorMsg(err?.message || String(err)); setStatus('error')
      } finally {
        if (alive()) setBusy(false)
      }
      return
    }

    // Fallback: the blocking generate endpoint (whole script at once).
    const runFallback = () => {
      const fb = new AbortController()
      abortRef.current = fb
      ;(async () => {
        try {
          const res = await generatePodcast(docId)
          if (fb.signal.aborted) return
          const all = res.turns || []
          setTurns(all)
          setProgress({ done: all.length, total: all.length })
          setStatus('ready')
        } catch (err) {
          if (fb.signal.aborted) return
          setErrorMsg(err?.message || String(err)); setStatus('error')
        } finally {
          if (!fb.signal.aborted) setBusy(false)
        }
      })()
    }

    let gotResponse = false
    const watchdog = setTimeout(() => {
      if (!gotResponse && alive()) { controller.abort(); runFallback() }
    }, 3000)

    try {
      await streamPodcastProgress(docId, {
        signal: controller.signal,
        onOpen: () => { gotResponse = true; clearTimeout(watchdog) },
        onScriptReady: (total) => { if (alive()) setProgress((p) => ({ ...p, total })) },
        onTurn: (evt) => {
          if (!alive()) return
          setTurns((prev) => {
            const next = prev.slice()
            next[evt.turn_index] = { speaker: evt.speaker, text: evt.text }
            return next
          })
          setProgress((p) => ({ done: evt.turn_index + 1, total: p.total || evt.turn_index + 1 }))
        },
        onDone: () => { if (alive()) { setStatus('ready'); setBusy(false) } },
        onError: (msg) => { if (alive()) { setErrorMsg(msg); setStatus('error'); setBusy(false) } },
      })
      if (alive() && status !== 'error') { /* stream closed; done/error already handled */ }
    } catch (err) {
      clearTimeout(watchdog)
      if (!alive()) return // aborted by watchdog (fallback running) or doc change
      if (!gotResponse) runFallback() // transport failure → blocking generate
      else { setErrorMsg(err?.message || String(err)); setStatus('error'); setBusy(false) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const value = useMemo(() => ({
    docId,
    turns, status, errorMsg, busy, progress,
    chapters, audio,
    generate: handleGenerate,
    seekTurn: (i) => audio.seekChapter(i, 0),
  }), [docId, turns, status, errorMsg, busy, progress, chapters, audio, handleGenerate])

  return <PodcastCtx.Provider value={value}>{children}</PodcastCtx.Provider>
}

export function usePodcastSession() {
  const ctx = useContext(PodcastCtx)
  if (!ctx) throw new Error('usePodcastSession must be used inside <PodcastSessionProvider>')
  return ctx
}
