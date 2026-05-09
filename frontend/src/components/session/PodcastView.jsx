import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import Skeleton from '../ui/Skeleton.jsx'
import { useAudio } from '../../hooks/useAudio.js'
import { podcastTurnUrl } from '../../lib/api.js'
import PremiumPlayer from '../player/PremiumPlayer.jsx'
import { useMediaSession } from '../../hooks/useMediaSession.js'
import { useKeyboardControls } from '../../hooks/useKeyboardControls.js'

const SPEAKERS = {
  host: {
    name: 'Host',
    grad: 'from-accent-purple via-[#7c4ce9] to-accent-cyan',
    glow: '0 0 0 2px rgba(139,92,246,0.35), 0 0 60px rgba(139,92,246,0.45)',
    tint: 'bg-accent-purple/[0.07] border-accent-purple/25 text-ink',
    label: 'text-accent-purple-soft',
  },
  guest: {
    name: 'Guest',
    grad: 'from-accent-cyan via-[#5cd9eb] to-accent-green',
    glow: '0 0 0 2px rgba(34,211,238,0.35), 0 0 60px rgba(34,211,238,0.45)',
    tint: 'bg-accent-cyan/[0.07] border-accent-cyan/25 text-ink',
    label: 'text-accent-cyan-soft',
  },
}

function SpeakerAvatar({ speaker, active, size = 144 }) {
  const cfg = SPEAKERS[speaker] || SPEAKERS.host
  return (
    <div className="relative" aria-hidden style={{ width: size, height: size }}>
      {active && (
        <>
          <motion.span
            className="absolute inset-[-12px] rounded-full"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.6, 0], scale: [1, 1.18, 1.32] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(circle, currentColor 0%, transparent 70%)', color: speaker === 'host' ? '#8b5cf6' : '#22d3ee' }}
          />
          <motion.span
            className="absolute inset-[-4px] rounded-full ring-1"
            animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ borderColor: speaker === 'host' ? 'rgba(139,92,246,0.55)' : 'rgba(34,211,238,0.55)' }}
          />
        </>
      )}
      <motion.div
        animate={active ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className={[
          'relative grid h-full w-full place-items-center rounded-full bg-gradient-to-br shadow-lift transition-shadow duration-500',
          cfg.grad,
        ].join(' ')}
        style={{ boxShadow: active ? cfg.glow : '0 12px 40px -12px rgba(0,0,0,0.5)' }}
      >
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="14" x2="6" y2="10" />
          <line x1="10" y1="16" x2="10" y2="8" />
          <line x1="14" y1="14" x2="14" y2="10" />
          <line x1="18" y1="17" x2="18" y2="7" />
        </svg>
      </motion.div>
    </div>
  )
}

export default function PodcastView({
  docId,
  title,
  status, // 'idle' | 'generating' | 'ready' | 'error'
  errorMsg,
  turns,
  onGenerate,
  busy,
  onPositionChange,    // (turnIdx, localTime) — for "Continue listening" persistence
  initialChapter,      // optional: resume on mount
  initialLocalTime,
}) {
  const chapters = useMemo(
    () =>
      (turns || []).map((t, idx) => ({
        idx,
        url: podcastTurnUrl(docId, idx),
        speaker: t.speaker,
        label: t.speaker === 'guest' ? 'Guest' : 'Host',
        durationHint: estimateTurnDuration(t.text),
      })),
    [turns, docId],
  )

  const audio = useAudio({
    chapters,
    onChapterChange: () => {}, // handled by state.idx below
  })

  // Apply requested initial position once chapters land.
  const appliedInitialRef = useRef(false)
  useEffect(() => {
    if (appliedInitialRef.current) return
    if (chapters.length === 0) return
    if (typeof initialChapter === 'number' && initialChapter >= 0) {
      audio.seekChapter(initialChapter, initialLocalTime || 0)
      audio.pause()
      appliedInitialRef.current = true
    }
  }, [chapters.length, initialChapter, initialLocalTime, audio])

  // Persist playback position so "Continue listening" works.
  useEffect(() => {
    const t = setInterval(() => {
      if (audio.state.idx >= 0) {
        onPositionChange?.(audio.state.idx, audio.state.localTime)
      }
    }, 1500)
    return () => clearInterval(t)
  }, [audio, onPositionChange])

  // OS lockscreen / headset / Bluetooth controls.
  useMediaSession({
    enabled: chapters.length > 0,
    title: title || 'Podcast',
    artist: turns?.[audio.state.idx]?.speaker
      ? `${SPEAKERS[turns[audio.state.idx].speaker]?.name || ''}`
      : 'EchoVerse',
    album: 'EchoVerse Podcast',
    onPlay: audio.play,
    onPause: audio.pause,
    onSeek: audio.seekGlobal,
    onPrev: audio.prevChapter,
    onNext: audio.nextChapter,
    onSkipBack: () => audio.skip(-15),
    onSkipForward: () => audio.skip(15),
    state: audio.state,
  })

  // Keyboard shortcuts only fire when not typing in a form.
  useKeyboardControls({
    enabled: chapters.length > 0,
    audio,
  })

  // Generation states — surface a friendly empty state.
  if (status === 'idle' || status === 'generating') {
    return (
      <div className="grid h-full place-items-center px-6 py-16 text-center">
        <div className="max-w-md">
          <div className="relative mx-auto inline-flex">
            <div className="flex -space-x-4">
              <SpeakerAvatar speaker="host" size={64} active={status === 'generating'} />
              <SpeakerAvatar speaker="guest" size={64} active={status === 'generating'} />
            </div>
          </div>
          <h2 className="mt-6 font-display text-2xl font-semibold text-ink">
            {status === 'generating' ? 'Cooking up an episode…' : 'Generate a podcast about this.'}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-pretty text-sm text-ink-muted">
            {status === 'generating'
              ? 'A host and a co-host are riffing on your notes. This usually takes 5–15 seconds.'
              : 'EchoVerse will write a host + co-host conversation grounded in your document — perfect for a passive listen.'}
          </p>
          {status === 'generating' ? (
            <div className="mx-auto mt-6 max-w-xs space-y-2">
              <Skeleton className="h-2.5 w-full rounded-full" />
              <Skeleton className="h-2.5 w-3/4 rounded-full" />
              <Skeleton className="h-2.5 w-5/6 rounded-full" />
            </div>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent-purple to-[#7c4ce9] px-6 py-3 text-sm font-medium text-white shadow-glow transition-transform duration-200 ease-expo hover:brightness-110 disabled:opacity-50 active:scale-95"
            >
              {busy ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.5 8.5l-5.5 5.5M9 8.5l5.5 5.5" />
                </svg>
              )}
              Generate podcast
            </button>
          )}
          {errorMsg && <p className="mt-4 text-xs text-accent-rose">{errorMsg}</p>}
        </div>
      </div>
    )
  }

  // Ready / playing — show speakers + transcript + premium player at bottom.
  const currentSpeaker = turns?.[audio.state.idx]?.speaker
  const hostActive = audio.state.playing && currentSpeaker === 'host'
  const guestActive = audio.state.playing && currentSpeaker === 'guest'

  return (
    <div className="flex h-full flex-col">
      {/* Speakers */}
      <div className="grid place-items-center px-6 pb-4 pt-8 sm:pt-12">
        <div className="flex items-center gap-10 sm:gap-16">
          <div className="flex flex-col items-center">
            <SpeakerAvatar speaker="host" active={hostActive} size={120} />
            <span className="mt-3 text-[0.7rem] uppercase tracking-[0.16em] text-accent-purple-soft">Host</span>
          </div>
          <div className="font-mono text-[0.7rem] text-ink-faint">·</div>
          <div className="flex flex-col items-center">
            <SpeakerAvatar speaker="guest" active={guestActive} size={120} />
            <span className="mt-3 text-[0.7rem] uppercase tracking-[0.16em] text-accent-cyan-soft">Guest</span>
          </div>
        </div>
      </div>

      {/* Transcript stream */}
      <TranscriptStream
        turns={turns}
        currentIdx={audio.state.idx}
        onJump={(i) => audio.seekChapter(i, 0)}
      />

      {/* Player */}
      <div className="px-4 pb-2 sm:px-6">
        <PremiumPlayer
          audio={audio}
          chapters={chapters}
          title={title || 'Podcast'}
          nowPlayingLabel={
            audio.state.idx >= 0
              ? `${SPEAKERS[currentSpeaker]?.name || 'Turn'} · turn ${audio.state.idx + 1} of ${chapters.length}`
              : `${chapters.length}-turn discussion · ready when you are`
          }
          onChapterClick={(i) => audio.seekChapter(i, 0)}
        />
      </div>
    </div>
  )
}

function TranscriptStream({ turns, currentIdx, onJump }) {
  const containerRef = useRef(null)
  const activeRef = useRef(null)

  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return
    const c = containerRef.current
    const a = activeRef.current
    const cRect = c.getBoundingClientRect()
    const aRect = a.getBoundingClientRect()
    const target = c.scrollTop + (aRect.top - cRect.top) - cRect.height / 2 + aRect.height / 2
    c.scrollTo({ top: target, behavior: 'smooth' })
  }, [currentIdx])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 pb-6 sm:px-12">
      <ul className="mx-auto max-w-prose space-y-4">
        {turns.map((t, i) => {
          const cfg = SPEAKERS[t.speaker] || SPEAKERS.host
          const active = i === currentIdx
          const past = i < currentIdx
          return (
            <motion.li
              key={i}
              ref={active ? activeRef : null}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: past ? 0.5 : 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={[
                'cursor-pointer rounded-2xl border px-4 py-3.5 text-[0.95rem] leading-relaxed transition-all duration-500 hover:border-white/[0.12]',
                active ? cfg.tint + ' shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]' : 'border-white/[0.05] bg-white/[0.015]',
              ].join(' ')}
              onClick={() => onJump?.(i)}
            >
              <div className={['mb-1 inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.08em]', cfg.label].join(' ')}>
                <span
                  className={[
                    'inline-block h-1.5 w-1.5 rounded-full',
                    t.speaker === 'host' ? 'bg-accent-purple' : 'bg-accent-cyan',
                  ].join(' ')}
                />
                {cfg.name}
              </div>
              <p className="text-pretty text-ink">{t.text}</p>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

// Rough estimate so the timeline isn't empty before chunks load. We assume a
// natural narration cadence of ~13 chars/sec; the real duration replaces this
// once the audio element loads metadata.
function estimateTurnDuration(text) {
  if (!text) return 4
  return Math.max(2, Math.round(text.length / 13))
}
