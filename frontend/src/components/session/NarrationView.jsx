import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAudio } from '../../hooks/useAudio.js'
import { useMediaSession } from '../../hooks/useMediaSession.js'
import { useKeyboardControls } from '../../hooks/useKeyboardControls.js'
import { useVoicePrefs } from '../../hooks/useVoicePrefs.js'
import {
  getNarrationManifest,
  narrationChunkUrl,
  prefetchNarration,
} from '../../lib/api.js'
import { DEMO_MODE } from '../../config/demo.js'
import PremiumPlayer from '../player/PremiumPlayer.jsx'
import ReadingPane from './ReadingPane.jsx'
import { useToast } from '../ui/Toast.jsx'

/**
 * Narration mode — calm reading with TTS playback.
 *
 * One-way listen experience driven by cached chunk audio served over HTTP.
 * The voice-Q&A barge-in loop, interruption banner, and mic stream were
 * removed along with the Whisper backend.
 */
export default function NarrationView({
  docId,
  // eslint-disable-next-line no-unused-vars
  serverState,                     // unused after ask-a-doubt removal; kept for compat
  // eslint-disable-next-line no-unused-vars
  wsStatus,
  // eslint-disable-next-line no-unused-vars
  sendJson,
  initialChapter,
  initialLocalTime,
  onPositionChange,
}) {
  const toast = useToast()
  const { host: hostVoiceId } = useVoicePrefs()
  const voiceId = hostVoiceId || undefined
  const [manifest, setManifest] = useState(null)
  // Live set of chunk indices whose audio is cached (buffered). Kept separate
  // from `manifest` so refreshing it never rebuilds `chapters` (which would
  // disturb the audio engine). Polled from the manifest's audio_ready flags.
  const [readySet, setReadySet] = useState(() => new Set())

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

  // -------- track buffered chunks (visual feedback only) --------
  // Seed from the initial manifest, then poll audio_ready flags until every
  // chunk is cached. In demo mode audio is synthesized client-side (Web
  // Speech), so treat every chunk as ready.
  useEffect(() => {
    if (!manifest) return
    const total = manifest.n_chunks || 0
    if (DEMO_MODE) {
      setReadySet(new Set(Array.from({ length: total }, (_, i) => i)))
      return
    }
    const seed = new Set((manifest.chunks || []).filter((c) => c.audio_ready).map((c) => c.idx))
    setReadySet(seed)
    if (seed.size >= total) return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const m = await getNarrationManifest(docId, voiceId)
        if (cancelled) return
        const s = new Set((m.chunks || []).filter((c) => c.audio_ready).map((c) => c.idx))
        setReadySet(s)
        if (s.size >= (m.n_chunks || 0)) clearInterval(timer)
      } catch { /* transient — keep the last known set */ }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [manifest, docId, voiceId])

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
  const totalChunks = manifest?.n_chunks || 0
  const bufferedCount = readySet.size
  const curIdx = audio.state.idx
  // Current chunk is still synthesizing/loading — a "preparing" state, not a
  // broken/stalled one.
  const preparing = curIdx >= 0 && !audio.state.ready
  // Next couple of chunks aren't all cached yet → background prefetch in flight.
  const prefetching = curIdx >= 0 && [curIdx + 1, curIdx + 2].some((i) => i < totalChunks && !readySet.has(i))

  return (
    <div className="flex h-full flex-col">
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

      {/* Sticky bottom bar — buffering status + player. */}
      <div className="border-t border-rule bg-raised">
        <div className="mx-auto w-full max-w-[760px] px-6 py-3">
          {totalChunks > 0 && (
            <BufferStatus
              buffered={bufferedCount}
              total={totalChunks}
              preparing={preparing}
              prefetching={prefetching}
            />
          )}
          <PremiumPlayer
            audio={audio}
            chapters={chapters}
            title={manifest?.title || 'Reading'}
            nowPlayingLabel={
              curIdx >= 0
                ? `Paragraph ${curIdx + 1} of ${chapters.length}${preparing ? ' · Preparing audio…' : ''}`
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

// Visual-only buffering feedback layered above the player: a buffered/total
// progress bar, a "Preparing audio…" spinner when the current chunk is still
// synthesizing, and a WiFi-style pulse while chunks ahead are prefetching.
function BufferStatus({ buffered, total, preparing, prefetching }) {
  const pct = total > 0 ? Math.round((buffered / total) * 100) : 0
  return (
    <div className="mb-2 flex items-center gap-3 text-[0.7rem] text-ink-faint">
      {prefetching && <WifiPulse />}
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-rule">
        <div
          className="h-full rounded-full bg-sage/70 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums">{buffered}/{total} buffered</span>
      {preparing && (
        <span className="flex shrink-0 items-center gap-1 text-ink-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Preparing audio…
        </span>
      )}
    </div>
  )
}

function WifiPulse() {
  return (
    <span className="inline-flex shrink-0" title="Buffering ahead…" aria-label="Buffering ahead">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 animate-pulse text-sage"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.55a11 11 0 0 1 14 0" />
        <path d="M8.5 15.85a6 6 0 0 1 7 0" />
        <path d="M12 19h.01" />
      </svg>
    </span>
  )
}
