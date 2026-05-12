import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { speak as demoSpeak, stop as demoStop } from '../lib/demoTts.js'

/**
 * Chapter-aware HTML5 <audio> controller.
 *
 * Drives a single <audio> element with a playlist of "chapters" — each chapter
 * is a discrete MP3 file (a narration chunk or a podcast turn). Surfaces a
 * unified, Spotify-style timeline: a global currentTime that spans the whole
 * playlist, plus per-chapter `idx` and `localTime` for the UI.
 *
 *   const audio = useAudio({ chapters, onChapterChange, onEnded })
 *   audio.play() / audio.pause() / audio.toggle()
 *   audio.seekGlobal(t) / audio.seekChapter(idx, localTime?)
 *   audio.skip(delta) / audio.nextChapter() / audio.prevChapter()
 *   audio.setRate(1.5), audio.setVolume(0.6), audio.setMuted(true)
 *
 *   audio.state — { playing, paused, ended, ready, idx, localTime,
 *                   localDuration, globalTime, globalDuration, rate, volume,
 *                   muted, error }
 *
 * Chapter shape: { idx, url, label?, durationHint?, text?, role? }
 *   - durationHint (seconds) is used in the global timeline before the audio
 *     element loads metadata. Once `loadedmetadata` fires, the hook caches
 *     the real duration internally.
 *   - text / role are used in DEMO MODE only: when `url` starts with
 *     `demo://`, the hook plays audio via the browser's Web Speech API
 *     (lib/demoTts.js) and simulates the timeline locally. Production
 *     deployments never pass a `demo://` URL so this branch is dead code
 *     when the real backend is in use.
 */

/** True iff a chapter URL signals demo-mode (Web Speech) playback. */
function isDemoUrl(u) { return typeof u === 'string' && u.startsWith('demo://') }
export function useAudio({ chapters = [], onChapterChange, onEnded } = {}) {
  const audioRef = useRef(null)
  const chaptersRef = useRef(chapters)
  const cbRef = useRef({ onChapterChange, onEnded })
  // map chapter idx → real (or hinted) duration in seconds
  const durationsRef = useRef(new Map())
  // pending action after `src` change & loadedmetadata (e.g. seek + play)
  const pendingRef = useRef(null)
  // user-intended playing state — we honor this across chapter switches
  const wantsPlayingRef = useRef(false)

  // --- demo-mode (Web Speech) bookkeeping -------------------------------
  // The current generation id for demo playback. Each time we start a new
  // chapter (or stop), we bump this; the resolve callback of the previous
  // speak() compares its captured id against the current one before doing
  // anything, so a stale completion can't auto-advance after a stop/seek.
  const demoGenRef = useRef(0)
  // setInterval id for the simulated timeupdate clock.
  const demoTickRef = useRef(null)
  // Monotonic clock anchor — when playback started (ms since epoch).
  const demoStartedAtRef = useRef(0)
  // Accumulated elapsed seconds across pauses for the active chapter.
  const demoElapsedRef = useRef(0)
  // Cache of the chapter we're currently speaking, so play() after a pause
  // knows what to resume.
  const demoChapterRef = useRef(null)

  const [idx, setIdx] = useState(-1)
  const [localTime, setLocalTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [paused, setPaused] = useState(true)
  const [ended, setEnded] = useState(false)
  const [ready, setReady] = useState(false)
  const [rate, setRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)
  const [muted, setMutedState] = useState(false)
  const [error, setError] = useState(null)
  // tick to recompute globalTime/globalDuration when durationsRef changes
  const [durationsTick, setDurationsTick] = useState(0)

  useEffect(() => {
    chaptersRef.current = chapters
    // Fold chapter hints into the durations map so global timeline reflects them
    const map = durationsRef.current
    for (const c of chapters) {
      if (c.durationHint && !map.has(c.idx)) {
        map.set(c.idx, c.durationHint)
      }
    }
    setDurationsTick((n) => n + 1)
  }, [chapters])

  useEffect(() => {
    cbRef.current = { onChapterChange, onEnded }
  }, [onChapterChange, onEnded])

  // ---- audio element setup ----
  useEffect(() => {
    const a = new Audio()
    a.preload = 'metadata'
    audioRef.current = a

    const onTime = () => setLocalTime(a.currentTime || 0)
    const onLoaded = () => {
      const d = isFinite(a.duration) ? a.duration : 0
      setLocalDuration(d)
      // Cache duration for the chapter currently loaded
      const list = chaptersRef.current
      const cur = pendingRef.current?.idx ?? null
      const useIdx = cur != null ? cur : list[0]?.idx
      if (useIdx != null) durationsRef.current.set(useIdx, d || 0)
      setDurationsTick((n) => n + 1)
      setReady(true)
      // Apply any pending seek + play.
      const p = pendingRef.current
      if (p) {
        if (typeof p.localTime === 'number' && isFinite(p.localTime)) {
          try { a.currentTime = Math.max(0, p.localTime) } catch {}
        }
        if (p.play) {
          a.play().catch(() => {})
        }
        pendingRef.current = null
      } else if (wantsPlayingRef.current) {
        a.play().catch(() => {})
      }
    }
    const onPlay = () => { setPaused(false); setEnded(false); wantsPlayingRef.current = true }
    const onPause = () => { setPaused(true) }
    const onEndedFn = () => {
      setEnded(true)
      // Auto-advance to next chapter if available; otherwise fire onEnded.
      const list = chaptersRef.current
      const curIdx = chapterIndexFor(a.src, list)
      const next = list.find((c) => c.idx === (curIdx ?? -1) + 1)
      if (next) {
        loadChapter(next.idx, { play: true })
      } else {
        wantsPlayingRef.current = false
        cbRef.current.onEnded?.()
      }
    }
    const onError = () => {
      const code = a.error?.code
      setError(code ? `audio error ${code}` : 'audio error')
    }
    const onRate = () => setRateState(a.playbackRate)
    const onVolume = () => { setVolumeState(a.volume); setMutedState(a.muted) }

    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEndedFn)
    a.addEventListener('error', onError)
    a.addEventListener('ratechange', onRate)
    a.addEventListener('volumechange', onVolume)

    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEndedFn)
      a.removeEventListener('error', onError)
      a.removeEventListener('ratechange', onRate)
      a.removeEventListener('volumechange', onVolume)
      try { a.pause() } catch {}
      a.src = ''
      // Cancel any in-flight Web Speech utterance and clear the tick.
      try { demoStop() } catch { /* no-op */ }
      if (demoTickRef.current != null) {
        clearInterval(demoTickRef.current)
        demoTickRef.current = null
      }
    }
  }, [])

  // ---- demo-mode helpers (Web Speech path) ----
  const stopDemoTick = useCallback(() => {
    if (demoTickRef.current != null) {
      clearInterval(demoTickRef.current)
      demoTickRef.current = null
    }
  }, [])

  const cancelDemo = useCallback(() => {
    demoGenRef.current += 1
    stopDemoTick()
    try { demoStop() } catch { /* no-op */ }
    demoElapsedRef.current = 0
    demoStartedAtRef.current = 0
    demoChapterRef.current = null
  }, [stopDemoTick])

  const startDemoSpeech = useCallback((ch, estDur, startOffset = 0) => {
    const gen = ++demoGenRef.current
    demoChapterRef.current = ch
    demoElapsedRef.current = startOffset
    demoStartedAtRef.current = Date.now()
    setPaused(false)
    setEnded(false)
    wantsPlayingRef.current = true

    // Drive the timeline at 4 Hz so the player's progress bar moves.
    stopDemoTick()
    demoTickRef.current = setInterval(() => {
      const elapsed = demoElapsedRef.current + (Date.now() - demoStartedAtRef.current) / 1000
      setLocalTime(Math.min(elapsed, estDur))
    }, 250)

    demoSpeak(ch.text || '', { role: ch.role || 'narrator' }).then(() => {
      // If a stop / new chapter happened mid-speech, ignore this completion.
      if (gen !== demoGenRef.current) return
      stopDemoTick()
      setLocalTime(estDur)
      setPaused(true)
      setEnded(true)
      // Auto-advance to the next chapter when the user was actively playing.
      const list = chaptersRef.current
      const next = list.find((c) => c.idx === ch.idx + 1)
      if (next && wantsPlayingRef.current) {
        // Recurse into the demo loader for the next chapter.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        loadDemoChapter(next, { play: true })
      } else {
        wantsPlayingRef.current = false
        cbRef.current.onEnded?.()
      }
    })
  }, [stopDemoTick])

  const loadDemoChapter = useCallback((ch, opts = {}) => {
    // Make sure the real <audio> element isn't fighting us.
    const a = audioRef.current
    try {
      if (a) {
        a.pause()
        a.removeAttribute('src')
        a.load()
      }
    } catch { /* no-op */ }
    cancelDemo()

    const text = ch.text || ''
    // Web Speech rate ≈ 14 chars/sec at default settings — close enough for
    // a believable progress bar. Floor at 4 s so short turns don't snap.
    const estDur = Math.max(4, Math.round(text.length / 14))

    setReady(false)
    setError(null)
    setEnded(false)
    setIdx(ch.idx)
    setLocalTime(0)
    setLocalDuration(estDur)
    durationsRef.current.set(ch.idx, estDur)
    setDurationsTick((n) => n + 1)
    setReady(true)
    cbRef.current.onChapterChange?.(ch.idx)

    const shouldPlay = opts.play ?? wantsPlayingRef.current
    if (shouldPlay && text) {
      startDemoSpeech(ch, estDur, opts.localTime || 0)
    } else {
      setPaused(true)
      demoChapterRef.current = ch
    }
    return true
  }, [cancelDemo, startDemoSpeech])

  // ---- chapter loader ----
  const loadChapter = useCallback((targetIdx, opts = {}) => {
    const a = audioRef.current
    const list = chaptersRef.current
    const ch = list.find((c) => c.idx === targetIdx)
    if (!a || !ch) return false
    // Demo branch: handled entirely by Web Speech, ignores the <audio> element.
    if (isDemoUrl(ch.url)) {
      return loadDemoChapter(ch, opts)
    }
    // Real-backend branch: cancel any in-flight demo first (mode switch).
    cancelDemo()
    setReady(false)
    setError(null)
    setEnded(false)
    setIdx(ch.idx)
    setLocalTime(0)
    setLocalDuration(durationsRef.current.get(ch.idx) || 0)
    pendingRef.current = {
      idx: ch.idx,
      localTime: opts.localTime ?? 0,
      play: opts.play ?? wantsPlayingRef.current,
    }
    a.src = ch.url
    try { a.load() } catch {}
    cbRef.current.onChapterChange?.(ch.idx)
    return true
  }, [cancelDemo, loadDemoChapter])

  // ---- public actions ----
  const play = useCallback(() => {
    wantsPlayingRef.current = true
    // If no chapter is loaded yet, kick off the first one.
    if (idx < 0 && chaptersRef.current.length > 0) {
      loadChapter(chaptersRef.current[0].idx, { play: true })
      return
    }
    // Demo branch: resume Web Speech if it's a demo chapter.
    const curCh = chaptersRef.current.find((c) => c.idx === idx)
    if (curCh && isDemoUrl(curCh.url)) {
      // Already speaking? speechSynthesis.paused tells us so.
      if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
        try { window.speechSynthesis.resume() } catch { /* no-op */ }
        demoStartedAtRef.current = Date.now()
        setPaused(false)
        // Restart the tick if it was cleared.
        if (demoTickRef.current == null) {
          const estDur = durationsRef.current.get(idx) || 0
          demoTickRef.current = setInterval(() => {
            const elapsed = demoElapsedRef.current + (Date.now() - demoStartedAtRef.current) / 1000
            setLocalTime(Math.min(elapsed, estDur))
          }, 250)
        }
        return
      }
      // Fresh start (e.g. after seek to the same chapter).
      const ch = demoChapterRef.current || curCh
      const estDur = durationsRef.current.get(ch.idx) || Math.max(4, (ch.text || '').length / 14)
      startDemoSpeech(ch, estDur, localTime || 0)
      return
    }
    // Real-backend branch.
    const a = audioRef.current
    if (!a) return
    a.play().catch(() => {})
  }, [idx, localTime, loadChapter, startDemoSpeech])

  const pause = useCallback(() => {
    wantsPlayingRef.current = false
    // Demo branch: pause Web Speech and accumulate elapsed time.
    const curCh = chaptersRef.current.find((c) => c.idx === idx)
    if (curCh && isDemoUrl(curCh.url)) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause()
          }
        } catch { /* no-op */ }
      }
      demoElapsedRef.current = demoElapsedRef.current + (Date.now() - demoStartedAtRef.current) / 1000
      stopDemoTick()
      setPaused(true)
      return
    }
    // Real-backend branch.
    const a = audioRef.current
    if (!a) return
    try { a.pause() } catch {}
  }, [idx, stopDemoTick])

  const toggle = useCallback(() => {
    if (paused || ended) play()
    else pause()
  }, [paused, ended, play, pause])

  const seekChapter = useCallback((targetIdx, localTime = 0) => {
    if (targetIdx === idx) {
      const a = audioRef.current
      if (a) {
        try { a.currentTime = Math.max(0, localTime) } catch {}
      }
      return
    }
    loadChapter(targetIdx, { localTime, play: wantsPlayingRef.current || !paused })
  }, [idx, paused, loadChapter])

  const seekGlobal = useCallback((globalT) => {
    const list = chaptersRef.current
    const map = durationsRef.current
    let acc = 0
    for (const c of list) {
      const d = map.get(c.idx) || c.durationHint || 0
      if (globalT < acc + d || c.idx === list[list.length - 1].idx) {
        seekChapter(c.idx, Math.max(0, globalT - acc))
        return
      }
      acc += d
    }
  }, [seekChapter])

  const skip = useCallback((deltaSec) => {
    const a = audioRef.current
    if (!a) return
    if (deltaSec > 0) {
      const list = chaptersRef.current
      const dur = a.duration || 0
      const remaining = dur - a.currentTime
      if (deltaSec <= remaining) {
        try { a.currentTime = Math.min(dur, a.currentTime + deltaSec) } catch {}
      } else {
        // overflow into the next chapter
        const next = list.find((c) => c.idx === idx + 1)
        if (next) {
          loadChapter(next.idx, { localTime: deltaSec - remaining, play: true })
        } else {
          try { a.currentTime = dur } catch {}
        }
      }
    } else {
      const target = a.currentTime + deltaSec // deltaSec is negative
      if (target >= 0) {
        try { a.currentTime = target } catch {}
      } else {
        const prev = chaptersRef.current.find((c) => c.idx === idx - 1)
        if (prev) {
          const prevDur = durationsRef.current.get(prev.idx) || 0
          loadChapter(prev.idx, { localTime: Math.max(0, prevDur + target), play: true })
        } else {
          try { a.currentTime = 0 } catch {}
        }
      }
    }
  }, [idx, loadChapter])

  const nextChapter = useCallback(() => {
    const list = chaptersRef.current
    const next = list.find((c) => c.idx === idx + 1)
    if (next) loadChapter(next.idx, { play: true })
  }, [idx, loadChapter])

  const prevChapter = useCallback(() => {
    const a = audioRef.current
    // If we're more than 3s into the chapter, restart it. Else go back one.
    if (a && a.currentTime > 3) {
      try { a.currentTime = 0 } catch {}
      return
    }
    const prev = chaptersRef.current.find((c) => c.idx === idx - 1)
    if (prev) loadChapter(prev.idx, { play: true })
  }, [idx, loadChapter])

  const setRate = useCallback((r) => {
    const a = audioRef.current
    const clamped = Math.max(0.5, Math.min(2.5, r))
    if (a) a.playbackRate = clamped
    setRateState(clamped)
  }, [])

  const setVolume = useCallback((v) => {
    const a = audioRef.current
    const clamped = Math.max(0, Math.min(1, v))
    if (a) a.volume = clamped
    setVolumeState(clamped)
  }, [])

  const setMuted = useCallback((m) => {
    const a = audioRef.current
    if (a) a.muted = !!m
    setMutedState(!!m)
  }, [])

  const stop = useCallback(() => {
    pause()
    cancelDemo()
    setIdx(-1)
    setLocalTime(0)
    setLocalDuration(0)
    setReady(false)
    setEnded(false)
    const a = audioRef.current
    if (a) {
      try { a.pause() } catch {}
      a.removeAttribute('src')
      try { a.load() } catch {}
    }
  }, [pause, cancelDemo])

  // ---- derived state ----
  const { globalDuration, globalTime } = useMemo(() => {
    void durationsTick // we depend on this to recompute
    const map = durationsRef.current
    const list = chaptersRef.current
    let total = 0
    let prefix = 0
    for (const c of list) {
      const d = map.get(c.idx) || c.durationHint || 0
      if (c.idx === idx) prefix = total
      total += d
    }
    return {
      globalDuration: total,
      globalTime: idx >= 0 ? prefix + (localTime || 0) : 0,
    }
  }, [idx, localTime, durationsTick])

  const state = useMemo(
    () => ({
      idx,
      ready,
      paused,
      ended,
      playing: !paused && !ended,
      localTime,
      localDuration,
      globalTime,
      globalDuration,
      rate,
      volume,
      muted,
      error,
    }),
    [idx, ready, paused, ended, localTime, localDuration, globalTime, globalDuration, rate, volume, muted, error],
  )

  return {
    state,
    play,
    pause,
    toggle,
    stop,
    seekChapter,
    seekGlobal,
    skip,
    nextChapter,
    prevChapter,
    setRate,
    setVolume,
    setMuted,
    /** Provide raw access for Media Session integration. */
    audioElement: audioRef,
  }
}

function chapterIndexFor(src, list) {
  if (!src) return null
  for (const c of list) {
    if (src === c.url || src.endsWith(c.url)) return c.idx
  }
  return null
}
