import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useAudio } from '../../hooks/useAudio.js'
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
 * Narration mode — calm reading with TTS playback.
 *
 * The voice-Q&A loop ("Ask a doubt") was removed: narration is now a
 * one-way listen experience driven entirely by the cached chunk audio.
 * The session-level WebSocket and mic stream are still available for any
 * future feature, but this mode does not open the microphone.
 */
export default function NarrationView({
  docId,
  serverState,                     // kept in props for the FSM reader pane
  // eslint-disable-next-line no-unused-vars
  wsStatus,                        // unused after ask-a-doubt removal; kept for compat
  // eslint-disable-next-line no-unused-vars
  sendJson,
  // eslint-disable-next-line no-unused-vars
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
  const [searchParams, setSearchParams] = useSearchParams()
  const action = searchParams.get('action')

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
      // Carried for demo-mode Web Speech playback (useAudio detects the
      // `demo://` URL scheme and reads `text` instead of the audio file).
      text: c.text,
      role: 'narrator',
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
            state={mapAudioToFsmState(audio.state)}
            hasStarted={audio.state.idx >= 0}
            onChunkClick={onChunkClick}
          />
        </div>
      </div>

      {/* Sticky bottom bar — player only. */}
      <div className="border-t border-rule bg-raised">
        <div className="mx-auto w-full max-w-[760px] px-6 py-3">
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
        </div>
      </div>
    </div>
  )
}

// The mode FSM used to fold in server-side ask-doubt states (thinking /
// speaking / interrupted). With ask-doubt removed, the reader only needs
// to know whether the audio is playing.
function mapAudioToFsmState(audioState) {
  return audioState.playing ? 'narrating' : 'idle'
}

function estimateChunkDuration(text) {
  if (!text) return 8
  return Math.max(4, Math.round(text.length / 13))
}
