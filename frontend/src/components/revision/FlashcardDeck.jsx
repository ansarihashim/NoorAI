import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCitations } from '../../lib/citations.jsx'

const DIFF_TONE = {
  easy: 'bg-accent-green/[0.10] text-accent-green border-accent-green/30',
  medium: 'bg-accent-cyan/[0.10] text-accent-cyan-soft border-accent-cyan/30',
  hard: 'bg-accent-rose/[0.10] text-accent-rose border-accent-rose/30',
}

/**
 * Swipe-deck flashcard UI.
 *
 *   <FlashcardDeck cards={[...]} bookmarkKey="echoverse.bookmarks.flashcards.<docId>" />
 *
 * Behavior:
 *   - One card centered, two stacked behind for depth.
 *   - Click card or press Space → flip to reveal answer.
 *   - ←/→ or A/D navigate (resets flip).
 *   - B toggles bookmark on the active card; bookmarks persist in localStorage.
 *   - Reduced-motion users get a static crossfade instead of the rotateY flip.
 */
export default function FlashcardDeck({ cards, bookmarkKey, onChunkHover }) {
  const citations = useCitations()
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [bookmarks, setBookmarks] = useState(() => {
    if (!bookmarkKey) return new Set()
    try {
      const raw = localStorage.getItem(bookmarkKey)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch {
      return new Set()
    }
  })

  const card = cards[idx]
  const total = cards.length

  const persistBookmarks = useCallback(
    (next) => {
      if (!bookmarkKey) return
      try {
        localStorage.setItem(bookmarkKey, JSON.stringify([...next]))
      } catch {
        /* quota — ignore */
      }
    },
    [bookmarkKey],
  )

  const flip = useCallback(() => setFlipped((v) => !v), [])

  const next = useCallback(() => {
    setIdx((i) => Math.min(total - 1, i + 1))
    setFlipped(false)
  }, [total])

  const prev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1))
    setFlipped(false)
  }, [])

  const toggleBookmark = useCallback(() => {
    if (!card) return
    setBookmarks((cur) => {
      const next = new Set(cur)
      const id = `${idx}-${card.question.slice(0, 24)}`
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistBookmarks(next)
      return next
    })
  }, [card, idx, persistBookmarks])

  // Reset to first card when the source array changes (e.g. regenerated).
  useEffect(() => {
    setIdx(0)
    setFlipped(false)
  }, [cards])

  // Keyboard shortcuts — only when no input is focused.
  useEffect(() => {
    function onKey(e) {
      const t = e.target
      if (t && t.matches && t.matches('input, textarea, [contenteditable="true"]')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          flip()
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          prev()
          break
        case 'b':
        case 'B':
          e.preventDefault()
          toggleBookmark()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip, next, prev, toggleBookmark])

  const bookmarkId = card ? `${idx}-${card.question.slice(0, 24)}` : null
  const isBookmarked = bookmarkId ? bookmarks.has(bookmarkId) : false

  if (!card) {
    return (
      <div className="grid place-items-center py-16 text-sm text-ink-faint">
        No cards yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Counter / bookmark count */}
      <div className="flex items-center gap-4 text-[0.75rem] text-ink-muted">
        <span className="font-mono tabular-nums">
          {idx + 1} / {total}
        </span>
        {bookmarks.size > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-faint">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            {bookmarks.size} bookmarked
          </span>
        )}
      </div>

      {/* Stack: two faded cards behind, the live one centered */}
      <div className="relative h-[320px] w-full max-w-xl select-none sm:h-[360px]">
        {[2, 1].map((depth) => {
          const i = idx + depth
          if (i >= total) return null
          return (
            <div
              key={i}
              aria-hidden
              className="absolute inset-0 rounded-2xl border border-white/[0.04] bg-white/[0.015]"
              style={{
                transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.04})`,
                opacity: 0.3 - (depth - 1) * 0.1,
              }}
            />
          )
        })}

        {/* Active card (clickable to flip) */}
        <button
          type="button"
          onClick={flip}
          aria-pressed={flipped}
          aria-label={flipped ? 'Show question' : 'Show answer'}
          className="group absolute inset-0 [perspective:1200px] cursor-pointer focus:outline-none"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`${idx}-${flipped ? 'a' : 'q'}`}
              initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={[
                'glass-strong relative h-full w-full overflow-hidden p-7 sm:p-9',
                'flex flex-col text-left',
                '[transform-style:preserve-3d] group-focus-visible:shadow-glow',
              ].join(' ')}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Top row: face label + difficulty pill */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-caption text-ink-muted">
                  {flipped ? 'answer' : 'question'}
                </span>
                <span
                  className={[
                    'inline-flex h-6 items-center rounded-pill border px-2.5 text-[0.65rem] font-medium uppercase tracking-[0.08em]',
                    DIFF_TONE[card.difficulty] || DIFF_TONE.medium,
                  ].join(' ')}
                >
                  {card.difficulty}
                </span>
              </div>

              {/* Body */}
              <div className="mt-5 flex-1 overflow-y-auto pr-1">
                <p className="text-pretty text-[1.05rem] leading-relaxed text-ink sm:text-[1.15rem]">
                  {flipped ? card.answer : card.question}
                </p>
              </div>

              {/* Footer: tags + grounded chunks */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {(card.tags || []).map((t) => (
                  <span
                    key={t}
                    className="rounded-pill border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[0.65rem] text-ink-muted"
                  >
                    #{t}
                  </span>
                ))}
                {(card.grounded_chunks || []).length > 0 && (
                  <span
                    key="gc-citation"
                    onMouseEnter={(e) => {
                      e.stopPropagation()
                      onChunkHover?.(card.grounded_chunks[0])
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation()
                      onChunkHover?.(null)
                    }}
                    className="cursor-help rounded-pill border border-accent-purple/30 bg-accent-purple/[0.10] px-2 py-0.5 text-[0.65rem] text-accent-purple-soft"
                  >
                    {citations.format(card.grounded_chunks)}
                  </span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </button>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-3">
        <ControlButton onClick={prev} disabled={idx === 0} ariaLabel="Previous card (←)">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M15 6l-6 6 6 6V6z" /></svg>
        </ControlButton>
        <ControlButton onClick={flip} primary ariaLabel={flipped ? 'Show question (Space)' : 'Show answer (Space)'}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0118 0M21 12a9 9 0 01-18 0" />
            <path d="M16 8h5V3M8 16H3v5" />
          </svg>
          {flipped ? 'Show question' : 'Show answer'}
        </ControlButton>
        <ControlButton
          onClick={toggleBookmark}
          active={isBookmarked}
          ariaLabel={isBookmarked ? 'Remove bookmark (B)' : 'Bookmark (B)'}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
        </ControlButton>
        <ControlButton onClick={next} disabled={idx >= total - 1} ariaLabel="Next card (→)">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M9 6l6 6-6 6V6z" /></svg>
        </ControlButton>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full max-w-xl overflow-hidden rounded-full bg-white/[0.05]">
        <motion.span
          className="block h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
          animate={{ width: `${((idx + 1) / total) * 100}%` }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Keyboard hint (desktop only) */}
      <div className="hidden text-[0.65rem] text-ink-faint sm:flex sm:items-center sm:gap-3">
        <Kbd>Space</Kbd> flip · <Kbd>←</Kbd> <Kbd>→</Kbd> nav · <Kbd>B</Kbd> bookmark
      </div>
    </div>
  )
}

function ControlButton({ onClick, children, disabled, primary, active, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-pill border px-3 py-1.5 text-[0.75rem] font-medium transition-all duration-150 active:scale-95',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        primary
          ? 'border-accent-purple/40 bg-accent-purple/[0.14] text-accent-purple-soft hover:bg-accent-purple/[0.22]'
          : active
            ? 'border-accent-cyan/40 bg-accent-cyan/[0.14] text-accent-cyan-soft'
            : 'border-white/[0.08] bg-white/[0.03] text-ink-muted hover:bg-white/[0.07] hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Kbd({ children }) {
  return (
    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] px-1 font-mono text-[0.6rem] text-ink-muted">
      {children}
    </span>
  )
}
