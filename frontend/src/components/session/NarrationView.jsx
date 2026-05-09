import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAudio } from '../../hooks/useAudio.js'
import { useMicStream } from '../../hooks/useMicStream.js'
import { useAudioPlayer } from '../../hooks/useAudioPlayer.js'
import { useMediaSession } from '../../hooks/useMediaSession.js'
import { useKeyboardControls } from '../../hooks/useKeyboardControls.js'
import { useVoicePrefs } from '../../hooks/useVoicePrefs.js'
import {
  getNarrationManifest,
  narrationChunkUrl,
  prefetchNarration,
} from '../../lib/api.js'
import PremiumPlayer from '../player/PremiumPlayer.jsx'
import ReadingPane from './ReadingPane.jsx'
import TranscriptDrawer from './TranscriptDrawer.jsx'
import { useToast } from '../ui/Toast.jsx'

/**
 * Narration mode, rebuilt on the new HTTP-audio architecture.
 *
 *  - Audio plays through a real HTML5 <audio> element (chunk = chapter).
 *  - The user has full Spotify-style control: pause/seek/skip/speed/volume.
 *  - The WebSocket is used only for the interrupt-and-answer loop:
 *      mic frames in, transcript out, Q&A audio bytes out via the legacy
 *      MediaSource player (kept for ephemeral Q&A audio only).
 *  - Click any paragraph in the reading pane to jump to that chunk.
 *  - Auto-resume after an interruption is dismissed; explicit Resume button
 *    when the user is in INTERRUPTED state and Whisper is still pending.
 */
export default function NarrationView({
  docId,
  serverState,            // 'idle' | 'attending' | 'interrupted' | 'thinking' | 'speaking'
  wsStatus,
  sendJson,
  sendBytes,
  messages,               // Q&A transcript log
  interruption,           // { reason, message } | null — last dismissal reason
  clearInterruption,
  initialChapter,
  initialLocalTime,
  onPositionChange,       // (idx, time) — Continue Listening persistence
}) {
  const toast = useToast()
  const { host: hostVoiceId } = useVoicePrefs()
  const voiceId = hostVoiceId || undefined
  const [manifest, setManifest] = useState(null)   // { doc_id, title, n_chunks, chunks: [{idx, text, audio_ready}] }
  const [warn, setWarn] = useState('')
  const [transcriptOpen, setTranscriptOpen] = useState(true)
  const [attended, setAttended] = useState(false)  // have we sent start_attend yet?

  // Q&A audio uses the legacy streaming MediaSource player (ephemeral, no
  // need to cache or seek). Narration uses the new HTML5 player.
  const qaPlayer = useAudioPlayer()

  // -------- manifest fetch --------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await getNarrationManifest(docId, voiceId)
        if (!cancelled) setManifest(m)
      } catch (err) {
        if (!cancelled) toast.error('Could not load narration', err?.message)
      }
    })()
    return () => { cancelled = true }
  }, [docId, voiceId, toast])

  // -------- chapters for the new audio hook --------
  const chapters = useMemo(() => {
    if (!manifest) return []
    return manifest.chunks.map((c) => ({
      idx: c.idx,
      url: narrationChunkUrl(docId, c.idx, voiceId),
      label: `Chunk ${c.idx + 1}`,
      durationHint: estimateChunkDuration(c.text),
    }))
  }, [manifest, docId, voiceId])

  const audio = useAudio({ chapters })

  // -------- restore "Continue listening" position --------
  const appliedRef = useRef(false)
  useEffect(() => {
    if (appliedRef.current) return
    if (chapters.length === 0) return
    if (typeof initialChapter === 'number' && initialChapter >= 0 && initialChapter < chapters.length) {
      audio.seekChapter(initialChapter, initialLocalTime || 0)
      audio.pause()
    }
    appliedRef.current = true
  }, [chapters.length, initialChapter, initialLocalTime, audio])

  // -------- persist position --------
  useEffect(() => {
    const t = setInterval(() => {
      if (audio.state.idx >= 0) {
        onPositionChange?.(audio.state.idx, audio.state.localTime)
      }
    }, 1500)
    return () => clearInterval(t)
  }, [audio, onPositionChange])

  // -------- rolling prefetch (always 2 ahead) --------
  useEffect(() => {
    if (audio.state.idx < 0 || !manifest) return
    const ahead = [audio.state.idx + 1, audio.state.idx + 2].filter(
      (i) => i < manifest.n_chunks,
    )
    if (ahead.length === 0) return
    prefetchNarration(docId, ahead, voiceId).catch(() => {})
  }, [audio.state.idx, manifest, docId, voiceId])

  // -------- mic + start_attend --------
  const onMicFrame = useCallback((buf) => sendBytes(buf), [sendBytes])
  const mic = useMicStream({ onFrame: onMicFrame })

  const ensureAttending = useCallback(async () => {
    if (attended || wsStatus !== 'open') return
    try {
      sendJson({ type: 'start_attend', doc_id: docId })
      setAttended(true)
    } catch { /* no-op */ }
  }, [attended, wsStatus, sendJson, docId])

  const handlePlay = useCallback(async () => {
    setWarn('')
    // Attach mic best-effort so interruption works.
    if (!mic.active) {
      try {
        await mic.start()
      } catch (err) {
        const name = err?.name || 'Error'
        if (name === 'NotAllowedError') setWarn('Microphone permission denied — narration plays without voice interruption.')
        else if (name === 'NotFoundError') setWarn('No microphone — narration plays without voice interruption.')
        else setWarn(`Mic unavailable (${name}) — narration plays without interruption.`)
      }
    }
    await ensureAttending()
    audio.play()
  }, [mic, ensureAttending, audio])

  // -------- interruption coordination --------
  // When the server tells us narration was interrupted, pause the HTML5 audio.
  // Q&A audio bytes flow into the legacy useAudioPlayer (passed up to Session
  // via onBytes there). When the server returns to ATTENDING, resume narration.
  const wasPlayingBeforeInterruptionRef = useRef(false)
  useEffect(() => {
    if (serverState === 'interrupted' || serverState === 'thinking' || serverState === 'speaking') {
      if (audio.state.playing) {
        wasPlayingBeforeInterruptionRef.current = true
        audio.pause()
      }
    } else if (serverState === 'attending' || serverState === 'idle') {
      if (wasPlayingBeforeInterruptionRef.current) {
        wasPlayingBeforeInterruptionRef.current = false
        audio.play()
      }
    }
  }, [serverState, audio])

  // Q&A audio bytes from WS go into the streaming MediaSource player.
  // We expose a setter back to Session via callback prop (qaPlayerRef).
  // Easier: PUSH bytes via window event isn't great. Let Session pass us a
  // stable ref instead. We expose qaPlayer.push via a ref the parent reads.
  useEffect(() => {
    window.__echoverse_qa_player = qaPlayer
    return () => { delete window.__echoverse_qa_player }
  }, [qaPlayer])

  // Flush Q&A audio queue when server says so.
  useEffect(() => {
    function onFlush() { qaPlayer.flush() }
    window.addEventListener('echoverse:flush_audio', onFlush)
    return () => window.removeEventListener('echoverse:flush_audio', onFlush)
  }, [qaPlayer])

  // -------- explicit Resume Narration handler --------
  const handleResume = useCallback(() => {
    clearInterruption?.()
    audio.play()
  }, [audio, clearInterruption])

  // -------- click-paragraph-to-jump --------
  const onChunkClick = useCallback((idx) => {
    audio.seekChapter(idx, 0)
    audio.play()
  }, [audio])

  // Wrap the audio controller so any caller (keyboard shortcuts, OS lockscreen,
  // PremiumPlayer button) goes through handlePlay — that's where we attach the
  // mic and send start_attend to the server.
  const wrappedAudio = useMemo(
    () => ({
      ...audio,
      play: handlePlay,
      toggle: () => {
        if (audio.state.paused || audio.state.ended) handlePlay()
        else audio.pause()
      },
    }),
    [audio, handlePlay],
  )

  // -------- OS lockscreen + keyboard --------
  useMediaSession({
    enabled: chapters.length > 0,
    title: manifest?.title || 'Narration',
    artist: 'EchoVerse',
    album: 'EchoVerse Narration',
    onPlay: handlePlay,
    onPause: audio.pause,
    onSeek: audio.seekGlobal,
    onPrev: audio.prevChapter,
    onNext: audio.nextChapter,
    onSkipBack: () => audio.skip(-15),
    onSkipForward: () => audio.skip(15),
    state: audio.state,
  })

  useKeyboardControls({ enabled: chapters.length > 0, audio: wrappedAudio })

  // -------- render --------
  const noChapters = chapters.length === 0

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence>
        {warn && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-3 max-w-3xl rounded-xl border border-accent-amber/30 bg-accent-amber/[0.08] px-4 py-2 text-xs text-accent-amber"
          >
            {warn}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {interruption && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-auto mt-3 flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-accent-cyan/30 bg-accent-cyan/[0.06] px-4 py-2 text-xs text-accent-cyan-soft"
          >
            <span className="flex-1 text-left text-ink-muted">
              {interruption.message || 'Narration paused.'}
            </span>
            <button
              onClick={handleResume}
              className="rounded-pill border border-accent-cyan/40 bg-accent-cyan/[0.10] px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-accent-cyan-soft hover:bg-accent-cyan/[0.18]"
            >
              Resume narration
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 overflow-hidden p-4 sm:p-6">
        <div className="glass relative min-w-0 flex-1 overflow-hidden">
          <ReadingPane
            chunks={(manifest?.chunks || []).map((c) => c.text)}
            currentIdx={audio.state.idx}
            totalChunks={manifest?.n_chunks || 0}
            state={mapAudioToFsmState(serverState, audio.state)}
            hasStarted={audio.state.idx >= 0}
            onChunkClick={onChunkClick}
          />
        </div>
        <TranscriptDrawer
          messages={messages}
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen((v) => !v)}
        />
      </div>

      {/* Player bar */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-5 sm:px-6">
        <PremiumPlayer
          audio={wrappedAudio}
          chapters={chapters}
          title={manifest?.title || 'Narration'}
          nowPlayingLabel={
            audio.state.idx >= 0
              ? `Chunk ${audio.state.idx + 1} of ${chapters.length}${mic.active ? ' · listening for interruptions' : ''}`
              : `${chapters.length} chunks · press play to begin`
          }
          disabled={noChapters}
          onChapterClick={onChunkClick}
        />
        {noChapters && (
          <p className="mt-2 text-center text-xs text-ink-faint">
            Preparing audio…
          </p>
        )}
      </div>
    </div>
  )
}

function mapAudioToFsmState(serverState, audioState) {
  if (serverState === 'thinking') return 'thinking'
  if (serverState === 'interrupted') return 'interrupted'
  if (serverState === 'speaking') return 'speaking'
  if (audioState.playing) return 'narrating'
  return 'idle'
}

function estimateChunkDuration(text) {
  if (!text) return 8
  return Math.max(4, Math.round(text.length / 13))
}
