import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useCallback, useEffect } from 'react'
import PremiumPlayer from '../player/PremiumPlayer.jsx'
import GenerationProgress, { PODCAST_STAGES } from '../ui/GenerationProgress.jsx'
import { usePodcastSession } from '../workspace/PodcastSessionContext.jsx'

/**
 * Center playback surface for Podcast mode. Calm — two small avatars,
 * a thin "now playing" line, and the player. The transcript is hosted in
 * the right rail (NotebookLM-style).
 *
 * The Ask-a-Doubt voice loop was removed: podcast is now a one-way listen
 * experience. The session-level WebSocket props are still received from
 * <Session/> for backwards compatibility but the mic is not opened.
 *
 * Props (from <Session/>):
 *   docId — only used to dedupe action handling
 */
export default function PodcastPlayback({
  // eslint-disable-next-line no-unused-vars
  docId,
  // eslint-disable-next-line no-unused-vars
  serverState, wsStatus, sendJson, sendBytes, messages = [],
}) {
  const { turns, status, errorMsg, busy, chapters, audio, generate, seekTurn } = usePodcastSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const action = searchParams.get('action')

  // Consume AI-Studio "?action=..." pings — only generate / regenerate now.
  useEffect(() => {
    if (!action) return
    if (action === 'generate-podcast' || action === 'regenerate-podcast') {
      generate()
    }
    const next = new URLSearchParams(searchParams)
    next.delete('action'); next.delete('action_at')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, searchParams.get('action_at')])

  // Idle / generating empty states
  if (status === 'idle' || status === 'generating') {
    return (
      <div className="flex h-full items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto inline-flex items-center gap-3">
            <SpeakerDot speaker="host" active={status === 'generating'} />
            <SpeakerDot speaker="guest" active={status === 'generating'} />
          </div>
          <h2 className="mt-6 font-serif text-title text-ink">
            {status === 'generating' ? 'Composing the discussion…' : 'Generate a discussion'}
          </h2>
          <p className="mx-auto mt-3 max-w-sm font-serif text-[1rem] leading-relaxed text-ink-muted">
            {status === 'generating'
              ? 'A host and a co-host are talking through your source. This usually takes 5–15 seconds.'
              : 'Two voices riff on this source — useful for a passive listen or a different angle on the material.'}
          </p>
          {status === 'generating' ? (
            <div className="mt-6">
              <GenerationProgress
                active
                stages={PODCAST_STAGES}
                overrunLabel="Finalising — almost there"
              />
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={busy}
              className="btn btn-primary mt-6"
            >
              {busy && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
              Generate discussion
            </button>
          )}
          {errorMsg && <p className="mt-4 text-[0.8rem] text-accent">{errorMsg}</p>}
        </div>
      </div>
    )
  }

  // Ready / playing
  const currentSpeaker = turns?.[audio.state.idx]?.speaker
  const hostActive = audio.state.playing && currentSpeaker === 'host'
  const guestActive = audio.state.playing && currentSpeaker === 'guest'
  const lastQA = messages.length > 0 ? messages[messages.length - 1] : null

  return (
    <div className="flex h-full flex-col">
      {/* Speakers — calm pair indicator */}
      <div className="flex items-center justify-center gap-12 px-6 pb-6 pt-12">
        <SpeakerCard role="host" name="Host" active={hostActive} />
        <SpeakerCard role="guest" name="Co-host" active={guestActive} />
      </div>

      {/* Player */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-6 sm:px-6">
        <PremiumPlayer
          audio={audio}
          chapters={chapters}
          title="Discussion"
          nowPlayingLabel={
            audio.state.idx >= 0
              ? `${currentSpeaker === 'guest' ? 'Co-host' : 'Host'} · turn ${audio.state.idx + 1} of ${chapters.length}`
              : `${chapters.length}-turn discussion · ready`
          }
          onChapterClick={seekTurn}
        />
      </div>
    </div>
  )
}

/* ---------- Calm speaker indicator (no neon orbs / auras) ---------- */

function SpeakerDot({ speaker, active }) {
  const tone = speaker === 'guest' ? 'bg-sage' : 'bg-dusk'
  return (
    <span
      className={[
        'inline-block h-2 w-2 rounded-full transition-opacity',
        tone,
        active ? 'opacity-100' : 'opacity-50',
      ].join(' ')}
    />
  )
}

function SpeakerCard({ role, name, active }) {
  const tone = role === 'guest' ? 'sage' : 'dusk'
  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className={[
          'relative grid h-12 w-12 place-items-center rounded-full border bg-elevated',
          active
            ? (tone === 'sage' ? 'border-sage' : 'border-dusk')
            : 'border-rule',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" className={[
          'h-5 w-5 transition-colors',
          active ? 'text-ink' : 'text-ink-dim',
        ].join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="14" x2="6" y2="10" />
          <line x1="10" y1="16" x2="10" y2="8" />
          <line x1="14" y1="14" x2="14" y2="10" />
          <line x1="18" y1="17" x2="18" y2="7" />
        </svg>
        {active && (
          <span className={[
            'absolute -right-0.5 -top-0.5 inline-block h-2 w-2 rounded-full',
            tone === 'sage' ? 'bg-sage' : 'bg-dusk',
            'animate-breathe',
          ].join(' ')} />
        )}
      </motion.div>
      <div className="min-w-0">
        <div className={[
          'font-serif text-[0.95rem] font-medium leading-tight',
          active ? 'text-ink' : 'text-ink-muted',
        ].join(' ')}>{name}</div>
        <div className="text-[0.7rem] uppercase tracking-[0.10em] text-ink-faint">
          {active ? 'speaking' : 'standing by'}
        </div>
      </div>
    </div>
  )
}
