import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import Skeleton from '../ui/Skeleton.jsx'
import PremiumPlayer from '../player/PremiumPlayer.jsx'
import { usePodcastSession } from '../workspace/PodcastSessionContext.jsx'

/**
 * Center playback surface for Podcast mode. Calm — two small avatars,
 * a thin "now playing" line, the player, and an explicit Ask Doubt
 * button. The transcript is hosted in the right rail (NotebookLM-style).
 *
 * Reacts to AI Studio actions via ?action= search param:
 *   ?action=generate-podcast | regenerate-podcast → trigger generation
 *   ?action=ask-doubt                              → arm Ask Doubt
 */
export default function PodcastPlayback() {
  const { turns, status, errorMsg, busy, chapters, audio, generate, seekTurn } = usePodcastSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const action = searchParams.get('action')

  useEffect(() => {
    if (!action) return
    if (action === 'generate-podcast' || action === 'regenerate-podcast') {
      generate()
    }
    // Clear action so it's not re-fired on re-render. Ask Doubt is consumed below.
    if (action !== 'ask-doubt') {
      const next = new URLSearchParams(searchParams)
      next.delete('action'); next.delete('action_at')
      setSearchParams(next, { replace: true })
    }
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
            <div className="mx-auto mt-6 max-w-xs space-y-2">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2 w-3/4 rounded-full" />
              <Skeleton className="h-2 w-5/6 rounded-full" />
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

  return (
    <div className="flex h-full flex-col">
      {/* Speakers — calm pair indicator */}
      <div className="flex items-center justify-center gap-12 px-6 pb-6 pt-12">
        <SpeakerCard role="host" name="Claude (host)" active={hostActive} />
        <SpeakerCard role="guest" name="Co-host" active={guestActive} />
      </div>

      {/* Player + ask doubt */}
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
        <AskDoubtButton />
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

/* ---------- Manual Ask Doubt button (frontend stub for now) ---------- */

function AskDoubtButton() {
  const { audio } = usePodcastSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const armed = searchParams.get('action') === 'ask-doubt'

  function trigger() {
    audio.pause()
    const next = new URLSearchParams(searchParams)
    next.set('action', 'ask-doubt')
    next.set('action_at', String(Date.now()))
    setSearchParams(next, { replace: true })
  }

  function dismiss() {
    audio.play()
    const next = new URLSearchParams(searchParams)
    next.delete('action'); next.delete('action_at')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mt-3 flex items-center justify-center">
      {!armed ? (
        <button
          onClick={trigger}
          className="inline-flex items-center gap-2 rounded-md border border-rule bg-elevated px-4 py-2 text-[0.8125rem] text-ink-muted transition-colors hover:bg-float hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1v3M12 20v3M4 12H1M23 12h-3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          Ask a doubt
        </button>
      ) : (
        <div className="inline-flex items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2">
          <span className="live-dot" />
          <span className="text-[0.8125rem] text-ink">Listening… (mic loop coming next pass)</span>
          <button
            onClick={dismiss}
            className="text-[0.75rem] text-ink-dim transition-colors hover:text-ink"
          >
            Cancel · resume
          </button>
        </div>
      )}
    </div>
  )
}
