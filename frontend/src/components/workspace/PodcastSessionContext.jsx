import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAudio } from '../../hooks/useAudio.js'
import { useMediaSession } from '../../hooks/useMediaSession.js'
import { useKeyboardControls } from '../../hooks/useKeyboardControls.js'
import { generatePodcast, getPodcast, podcastTurnUrl } from '../../lib/api.js'

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

export function PodcastSessionProvider({ children }) {
  const { docId } = useParams()
  const [turns, setTurns] = useState([])
  const [status, setStatus] = useState('idle')        // idle | generating | ready | error
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset on doc change.
  useEffect(() => {
    setTurns([])
    setStatus('idle')
    setErrorMsg('')
    setBusy(false)
  }, [docId])

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
    setErrorMsg('')
    setBusy(true)
    setStatus('generating')
    try {
      const res = await generatePodcast(docId)
      setTurns(res.turns || [])
      setStatus('ready')
    } catch (err) {
      const m = err?.message || String(err)
      setErrorMsg(m)
      setStatus('idle')
    } finally {
      setBusy(false)
    }
  }, [docId])

  const value = useMemo(() => ({
    docId,
    turns, status, errorMsg, busy,
    chapters, audio,
    generate: handleGenerate,
    seekTurn: (i) => audio.seekChapter(i, 0),
  }), [docId, turns, status, errorMsg, busy, chapters, audio, handleGenerate])

  return <PodcastCtx.Provider value={value}>{children}</PodcastCtx.Provider>
}

export function usePodcastSession() {
  const ctx = useContext(PodcastCtx)
  if (!ctx) throw new Error('usePodcastSession must be used inside <PodcastSessionProvider>')
  return ctx
}
