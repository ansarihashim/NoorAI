import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Reads the narration aloud — but lets the user follow along visually.
 * - chunks: array of { idx, text } (sparse — index === chunk_idx)
 * - currentIdx: chunk being narrated right now (or last seen)
 * - totalChunks: total expected chunk count (from /api/upload/{id} meta)
 * - state: backend FSM state, used to dim during interruption
 */
export default function ReadingPane({ chunks, currentIdx, totalChunks, state, hasStarted, onChunkClick }) {
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

  const dim = state === 'interrupted' || state === 'thinking'

  if (!hasStarted) {
    return (
      <div className="grid h-full place-items-center px-6 py-16 text-center">
        <div className="max-w-md">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-md border border-rule bg-elevated text-ink-dim">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h18M3 12h18M3 19h13" />
            </svg>
          </div>
          <h2 className="mt-5 font-serif text-title text-ink">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-2 max-w-sm font-serif text-[0.95rem] leading-relaxed text-ink-muted">
            Press <span className="rounded-sm border border-rule bg-elevated px-1.5 py-0.5 font-mono text-[0.7rem]">Play</span> below to begin reading. Click <span className="text-accent">Ask a doubt</span> any time to pause and ask a question — reading resumes automatically.
          </p>
        </div>
      </div>
    )
  }

  // Render placeholders for un-arrived chunks so the layout settles early.
  const known = chunks
    .map((c, i) => ({ idx: i, text: c }))
    .filter((c) => typeof c.text === 'string' && c.text.length > 0)

  const placeholderCount = Math.max(0, (totalChunks ?? known.length) - known.length)

  return (
    <div
      ref={containerRef}
      className={[
        'h-full overflow-y-auto px-6 py-10 sm:px-12 sm:py-14 transition-[filter,opacity] duration-500',
        dim ? 'opacity-70 saturate-50' : '',
      ].join(' ')}
    >
      <div className="mx-auto max-w-prose">
        <ul className="space-y-5">
          {known.map(({ idx, text }) => {
            const active = idx === currentIdx
            const past = idx < currentIdx
            const interactive = typeof onChunkClick === 'function'
            return (
              <motion.li
                key={idx}
                ref={active ? activeRef : null}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? () => onChunkClick(idx) : undefined}
                onKeyDown={interactive ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChunkClick(idx)
                  }
                } : undefined}
                title={interactive ? `Jump to paragraph ${idx + 1}` : undefined}
                className={[
                  'group relative rounded-md px-4 py-3 transition-colors duration-300',
                  interactive ? 'cursor-pointer' : '',
                  active
                    ? 'text-ink'
                    : past
                      ? 'text-ink-dim hover:text-ink-muted'
                      : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {active && (
                  <motion.span
                    layoutId="reading-cursor"
                    className="absolute -left-3 top-3 bottom-3 w-[2px] rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                )}
                {interactive && !active && (
                  <span className="pointer-events-none absolute right-3 top-3 text-[0.65rem] font-mono uppercase tracking-[0.08em] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                    play from here
                  </span>
                )}
                <p className="font-serif text-[1.0625rem] leading-[1.7] text-pretty">{text}</p>
              </motion.li>
            )
          })}
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <li key={`pl-${i}`} className="space-y-2 px-4 py-3">
              <div className="shimmer h-3 w-[78%] rounded" />
              <div className="shimmer h-3 w-[62%] rounded" />
              <div className="shimmer h-3 w-[44%] rounded" />
            </li>
          ))}
        </ul>
        <AnimatePresence>
          {state === 'idle' && currentIdx >= 0 && totalChunks && currentIdx >= totalChunks - 1 && known.length === totalChunks && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-10 rounded-md border border-rule bg-elevated p-5 text-center"
            >
              <p className="font-serif text-[0.95rem] text-ink-muted">You've reached the end.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
