import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
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
import { useToast } from '../ui/Toast.jsx'

/**
 * Narration mode — calm reading + on-demand voice Q&A.
 *
 * Audio interaction model: NO automatic VAD interruption. The mic is OFF
 * by default; the user explicitly clicks "Ask a doubt" to pause narration
 * and open the mic. This removes accidental noise-triggered interruptions
 * (the brief pain point) while keeping the existing backend pipeline.
 *
 * The legacy WebSocket pipeline is still in use for the actual Q&A:
 *   click → pause audio → mic.start() → sendJson({type:'start_attend'})
 *   user speaks → backend's EOU detection ends the turn naturally
 *   AI replies (audio bytes via WS → MediaSource player)
 *   on `state: idle/attending` we resume narration
 */
export default function NarrationView({
  docId,
  serverState,
  wsStatus,
  sendJson,
  sendBytes,
  messages,
  interruption,
  clearInterruption,
  initialChapter,
  initialLocalTime,
  onPositionChange,
}) {
  const toast = useToast()
  const { host: hostVoiceId } = useVoicePrefs()
  const voiceId = hostVoiceId || undefined
  const [manifest, setManifest] = useState(null)
  const [warn, setWarn] = useState('')
  const [askArmed, setAskArmed] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const action = searchParams.get('action')

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

  const chapters = useMemo(() => {
    if (!manifest) return []
    return manifest.chunks.map((c) => ({
      idx: c.idx,
      url: narrationChunkUrl(docId, c.idx, voiceId),
      label: `¶ ${c.idx + 1}`,
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

  // -------- mic stream (off by default; only opened by Ask Doubt) --------
  const onMicFrame = useCallback((buf) => sendBytes(buf), [sendBytes])
  const mic = useMicStream({ onFrame: onMicFrame })

  // -------- Q&A audio sink (legacy MediaSource player) --------
  useEffect(() => {
    window.__echoverse_qa_player = qaPlayer
    return () => { delete window.__echoverse_qa_player }
  }, [qaPlayer])

  useEffect(() => {
    function onFlush() { qaPlayer.flush() }
    window.addEventListener('echoverse:flush_audio', onFlush)
    return () => window.removeEventListener('echoverse:flush_audio', onFlush)
  }, [qaPlayer])

  // -------- Ask Doubt flow (manual, replaces auto-VAD) --------
  const askDoubt = useCallback(async () => {
    setWarn('')
    if (audio.state.playing) audio.pause()
    if (!mic.active) {
      try {
        await mic.start()
      } catch (err) {
        const name = err?.name || 'Error'
        if (name === 'NotAllowedError') setWarn('Microphone permission denied — can\'t hear you.')
        else if (name === 'NotFoundError') setWarn('No microphone found.')
        else setWarn(`Mic unavailable (${name}).`)
        return
      }
    }
    if (wsStatus === 'open') {
      try { sendJson({ type: 'start_attend', doc_id: docId }) } catch { /* no-op */ }
    }
    setAskArmed(true)
  }, [audio, mic, wsStatus, sendJson, docId])

  const cancelAsk = useCallback(() => {
    try { sendJson({ type: 'stop' }) } catch { /* no-op */ }
    if (mic.active) mic.stop?.()
    setAskArmed(false)
    audio.play()
  }, [sendJson, mic, audio])

  // AI Studio "Ask a doubt" action triggers the same flow.
  useEffect(() => {
    if (action === 'ask-doubt' && !askArmed) {
      askDoubt()
      const next = new URLSearchParams(searchParams)
      next.delete('action'); next.delete('action_at')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, searchParams.get('action_at')])

  // When server returns to idle/attending after a Q&A, auto-resume narration.
  useEffect(() => {
    if (!askArmed) return
    if (serverState === 'idle' || serverState === 'attending') {
      // The model finished speaking — turn off the ask state and resume.
      setAskArmed(false)
      if (mic.active) mic.stop?.()
      audio.play()
    }
  }, [serverState, askArmed, audio, mic])

  // -------- explicit Resume Narration (banner) --------
  const handleResume = useCallback(() => {
    clearInterruption?.()
    audio.play()
  }, [audio, clearInterruption])

  const onChunkClick = useCallback((idx) => {
    audio.seekChapter(idx, 0)
    audio.play()
  }, [audio])

  useMediaSession({
    enabled: chapters.length > 0,
    title: manifest?.title || 'Reading',
    artist: 'NoorAI',
    album: 'Narration',
    onPlay: audio.play,
    onPause: audio.pause,
    onSeek: audio.seekGlobal,
    onPrev: audio.prevChapter,
    onNext: audio.nextChapter,
    onSkipBack: () => audio.skip(-15),
    onSkipForward: () => audio.skip(15),
    state: audio.state,
  })

  useKeyboardControls({ enabled: chapters.length > 0, audio })

  const noChapters = chapters.length === 0
  const lastQA = messages.length > 0 ? messages[messages.length - 1] : null

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence>
        {warn && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 max-w-3xl rounded-sm border border-rule bg-elevated px-3 py-1.5 text-[0.78rem] text-ink-muted"
          >
            {warn}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {interruption && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-3 rounded-sm border border-rule bg-elevated px-3 py-1.5 text-[0.78rem] text-ink-muted"
          >
            <span>{interruption.message || 'Reading paused.'}</span>
            <button
              onClick={handleResume}
              className="text-[0.78rem] text-accent transition-colors hover:text-accent-deep"
            >
              Resume →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reading column — single max-w, no glass card. */}
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col overflow-hidden px-6 pt-6">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ReadingPane
            chunks={(manifest?.chunks || []).map((c) => c.text)}
            currentIdx={audio.state.idx}
            totalChunks={manifest?.n_chunks || 0}
            state={mapAudioToFsmState(serverState, audio.state, askArmed)}
            hasStarted={audio.state.idx >= 0}
            onChunkClick={onChunkClick}
          />
        </div>
      </div>

      {/* Sticky bottom bar — player + Ask Doubt + last Q&A peek */}
      <div className="border-t border-rule bg-raised">
        <div className="mx-auto w-full max-w-[760px] px-6 py-3">
          {askArmed ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="live-dot" />
                <span className="text-[0.875rem] text-ink">Listening — speak your question</span>
              </div>
              <button
                onClick={cancelAsk}
                className="text-[0.8125rem] text-ink-dim transition-colors hover:text-ink"
              >
                Cancel · resume
              </button>
            </div>
          ) : (
            <PremiumPlayer
              audio={audio}
              chapters={chapters}
              title={manifest?.title || 'Reading'}
              nowPlayingLabel={
                audio.state.idx >= 0
                  ? `Paragraph ${audio.state.idx + 1} of ${chapters.length}`
                  : `${chapters.length} paragraphs · press play to begin`
              }
              disabled={noChapters}
              onChapterClick={onChunkClick}
            />
          )}

          {/* Ask Doubt + last Q&A peek (when not armed) */}
          {!askArmed && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                onClick={askDoubt}
                disabled={wsStatus !== 'open'}
                className="inline-flex items-center gap-2 rounded-md border border-rule bg-elevated px-3 py-1.5 text-[0.8125rem] text-ink-muted transition-colors hover:bg-float hover:text-ink disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM5 11v1a7 7 0 0014 0v-1M12 19v3" />
                </svg>
                Ask a doubt
              </button>
              {lastQA && (
                <div className="min-w-0 flex-1 truncate text-right text-[0.78rem] text-ink-dim">
                  <span className="text-ink-faint">{lastQA.role === 'user' ? 'You: ' : 'Claude: '}</span>
                  <span className="text-ink-muted">{lastQA.text}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function mapAudioToFsmState(serverState, audioState, askArmed) {
  if (askArmed && (serverState === 'attending' || serverState === 'idle')) return 'interrupted'
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
