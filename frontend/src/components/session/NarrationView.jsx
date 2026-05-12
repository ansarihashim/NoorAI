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
