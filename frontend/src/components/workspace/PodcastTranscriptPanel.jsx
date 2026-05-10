import { useEffect, useRef } from 'react'
import { usePodcastSession } from './PodcastSessionContext.jsx'

/**
 * Right-rail transcript companion to PodcastPlayback. Auto-scrolls the
 * active turn into view. Click any turn to seek playback to it.
 *
 * Reads from PodcastSessionContext so it shares state with the center
 * playback surface — no prop drilling, no second source of truth.
 */
export default function PodcastTranscriptPanel() {
  const { turns, audio, seekTurn, status } = usePodcastSession()
  const containerRef = useRef(null)
  const activeRef = useRef(null)
  const currentIdx = audio.state.idx

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
    <div className="flex h-full flex-col border-l border-rule">
      <div className="flex items-center justify-between border-b border-rule px-3 py-2.5">
        <span className="eyebrow">Transcript</span>
        {status === 'ready' && turns.length > 0 && (
          <span className="text-[0.7rem] text-ink-dim">{turns.length} turns</span>
        )}
      </div>

      {(status !== 'ready' || turns.length === 0) ? (
        <div className="px-3 py-4 text-[0.8125rem] text-ink-dim">
          The transcript appears here once a discussion has been generated.
        </div>
      ) : (
        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          <ul className="space-y-3">
            {turns.map((t, i) => {
              const active = i === currentIdx
              const past = i < currentIdx
              const isGuest = t.speaker === 'guest'
              return (
                <li
                  key={i}
                  ref={active ? activeRef : null}
                  className={[
                    'cursor-pointer transition-opacity',
                    active ? 'opacity-100' : past ? 'opacity-50 hover:opacity-75' : 'opacity-80 hover:opacity-100',
                  ].join(' ')}
                  onClick={() => seekTurn(i)}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={[
                      'inline-block h-1.5 w-1.5 rounded-full',
                      isGuest ? 'bg-sage' : 'bg-dusk',
                    ].join(' ')} />
                    <span className={[
                      'text-[0.7rem] uppercase tracking-[0.08em]',
                      isGuest ? 'text-sage' : 'text-dusk',
                    ].join(' ')}>
                      {isGuest ? 'Co-host' : 'Host'}
                    </span>
                    <span className="ml-auto text-[0.65rem] text-ink-faint">
                      turn {i + 1}
                    </span>
                  </div>
                  <p
                    className={[
                      'border-l-2 pl-3 font-serif text-[0.95rem] leading-[1.55] text-pretty',
                      active ? 'border-accent text-ink' : 'border-rule text-ink-muted',
                    ].join(' ')}
                  >
                    {t.text}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
