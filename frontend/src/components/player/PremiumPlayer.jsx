import { useMemo } from 'react'
import SeekBar from './SeekBar.jsx'
import SpeedControl from './SpeedControl.jsx'
import VolumeControl from './VolumeControl.jsx'
import { formatTime } from './formatTime.js'

const SKIP_SEC = 15

function IconButton({ onClick, ariaLabel, disabled, children, size = 'md', tone = 'default' }) {
  const sizes = {
    sm: 'h-9 w-9',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }
  const tones = {
    default: 'text-ink-muted hover:text-ink hover:bg-elevated border border-rule',
    primary: 'text-page bg-accent hover:bg-accent-deep border border-transparent',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'group relative inline-flex items-center justify-center rounded-full transition-colors duration-180 ease-expo',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:scale-95',
        sizes[size],
        tones[tone],
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/**
 * Calm warm-dark player. Reused by both Narration and Podcast modes.
 * No glow, no gradients — single amber primary, hairline secondaries.
 */
export default function PremiumPlayer({
  audio,
  chapters,
  title,
  nowPlayingLabel,
  onChapterClick,
  disabled = false,
  showSpeed = true,
  showVolume = true,
  showSkip = true,
  showPrevNext = true,
  className = '',
}) {
  const { state } = audio

  const annotated = useMemo(() => {
    let acc = 0
    return chapters.map((c) => {
      const startTime = acc
      acc += c.duration || c.durationHint || 0
      return { ...c, startTime, duration: c.duration || c.durationHint || 0 }
    })
  }, [chapters])

  const playing = state.playing
  const ended = state.ended
  const noChapters = chapters.length === 0

  return (
    <div className={['rounded-md border border-rule bg-raised p-4', className].join(' ')}>
      {/* Top row: now-playing label + speed/volume */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && (
            <div className="truncate text-[0.8125rem] font-medium text-ink">{title}</div>
          )}
          {nowPlayingLabel && (
            <div className="mt-0.5 truncate text-[0.7rem] text-ink-dim">{nowPlayingLabel}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showSpeed && <SpeedControl rate={state.rate} onChange={audio.setRate} />}
          {showVolume && (
            <VolumeControl
              volume={state.volume}
              muted={state.muted}
              onVolume={audio.setVolume}
              onMuted={audio.setMuted}
            />
          )}
        </div>
      </div>

      {/* Seek bar */}
      <div className="mt-4">
        <SeekBar
          globalTime={state.globalTime}
          globalDuration={state.globalDuration}
          chapters={annotated}
          currentIdx={state.idx}
          onSeek={audio.seekGlobal}
          disabled={disabled || noChapters}
        />
      </div>

      {/* Transport controls */}
      <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
        {showPrevNext && (
          <IconButton onClick={audio.prevChapter} ariaLabel="Previous chapter" disabled={disabled || state.idx <= 0}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M6 6h2v12H6V6zm12 0v12L9 12l9-6z" /></svg>
          </IconButton>
        )}
        {showSkip && (
          <IconButton onClick={() => audio.skip(-SKIP_SEC)} ariaLabel={`Back ${SKIP_SEC} seconds`} disabled={disabled}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 109-9" />
              <path d="M3 5v5h5" />
            </svg>
          </IconButton>
        )}

        <IconButton
          onClick={audio.toggle}
          ariaLabel={playing ? 'Pause' : 'Play'}
          disabled={disabled || noChapters}
          size="lg"
          tone="primary"
        >
          {playing && !ended ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
          )}
        </IconButton>

        {showSkip && (
          <IconButton onClick={() => audio.skip(SKIP_SEC)} ariaLabel={`Forward ${SKIP_SEC} seconds`} disabled={disabled}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 11-9-9" />
              <path d="M21 5v5h-5" />
            </svg>
          </IconButton>
        )}
        {showPrevNext && (
          <IconButton
            onClick={audio.nextChapter}
            ariaLabel="Next chapter"
            disabled={disabled || state.idx >= chapters.length - 1}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M16 6h2v12h-2V6zM6 6l9 6-9 6V6z" /></svg>
          </IconButton>
        )}
      </div>

      {/* Chapter chip strip — when chapters have labels (e.g. host/guest turns) */}
      {chapters.some((c) => c.label) && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {annotated.map((c) => {
            const active = c.idx === state.idx
            const past = c.idx < state.idx
            const isGuest = c.speaker === 'guest'
            return (
              <button
                key={c.idx}
                onClick={() => onChapterClick?.(c.idx) ?? audio.seekChapter(c.idx, 0)}
                title={c.label || `Chapter ${c.idx + 1}`}
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[0.65rem] tabular-nums transition-colors',
                  active
                    ? 'border-accent bg-accent-soft text-ink'
                    : past
                      ? 'border-rule text-ink-faint hover:border-rule-strong hover:text-ink-dim'
                      : 'border-rule text-ink-dim hover:border-rule-strong hover:text-ink-muted',
                ].join(' ')}
              >
                <span className={[
                  'inline-block h-1.5 w-1.5 rounded-full',
                  isGuest ? 'bg-sage' : 'bg-dusk',
                ].join(' ')} />
                <span className="uppercase tracking-wider">
                  {c.label || `Ch ${c.idx + 1}`}
                </span>
                {c.duration > 0 && <span className="opacity-70">{formatTime(c.duration)}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
