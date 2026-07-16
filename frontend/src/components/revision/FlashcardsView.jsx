import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getFlashcards } from '../../lib/api.js'
import useRevisionStream from '../../hooks/useRevisionStream.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import FlashcardDeck from './FlashcardDeck.jsx'
import StreamingList from './StreamingList.jsx'

const N_OPTIONS = [10, 15, 20, 30]

export default function FlashcardsView({ docId, action }) {
  const toast = useToast()
  const [deck, setDeck] = useState(null) // null=loading, undefined=none, FlashcardSet=loaded
  const [n, setN] = useState(20)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [streaming, setStreaming] = useState(false) // a stream has been started

  const {
    items, isStreaming, isDone, error, total, startStream, reset,
  } = useRevisionStream(docId, 'flashcards')

  // Initial load — see if there's a cached deck.
  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await getFlashcards(docId)
        if (!cancelled) setDeck(d)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setDeck(undefined)
          else { setDeck(undefined); toast.error('Flashcards failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  // When a stream finishes, load the canonical saved set (same shape as the
  // non-streaming endpoints: correct title + validated cards). Fall back to the
  // streamed items if the cache write didn't land.
  useEffect(() => {
    if (!streaming || !isDone) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await getFlashcards(docId)
        if (!cancelled) setDeck(d)
      } catch {
        if (!cancelled && items.length) {
          setDeck({ title: deck?.title || 'Flashcards', cards: items })
        }
      }
      if (!cancelled) setStreaming(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, streaming])

  const beginStream = useCallback((opts) => {
    setStreaming(true)
    startStream(opts)
  }, [startStream])

  const onGenerate = useCallback(() => {
    if (streaming) return
    beginStream({ n })
  }, [streaming, n, beginStream])

  const onRegen = useCallback(() => {
    if (deck) setConfirmRegen(true)
    else onGenerate()
  }, [deck, onGenerate])

  const performRegen = useCallback(() => {
    setConfirmRegen(false)
    beginStream({ n, force: true })
  }, [n, beginStream])

  const onTryAgain = useCallback(() => {
    reset()
    beginStream({ n })
  }, [reset, n, beginStream])

  // Right-rail "Generate flashcards" — auto-trigger when we have no deck yet;
  // if a deck exists, ask before replacing.
  useEffect(() => {
    if (!action || !action.generate) return
    if (streaming || deck === null) return
    if (deck === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  // ---- render branches ----
  if (deck === null && !streaming) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-xl space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[320px] w-full rounded-2xl" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
    )
  }

  // Active stream (or its error state) takes over the view.
  if (streaming) {
    return (
      <StreamingList
        label="flashcards"
        items={items}
        isStreaming={isStreaming}
        isDone={isDone}
        error={error}
        total={total}
        onTryAgain={onTryAgain}
        noneLabel="No cards were produced."
        renderItem={(c) => (
          <>
            <p className="text-[0.9rem] font-medium leading-snug text-ink">{c.question}</p>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-muted">{c.answer}</p>
          </>
        )}
      />
    )
  }

  if (deck === undefined) {
    return <EmptyState n={n} onN={setN} onGenerate={onGenerate} />
  }

  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <span className="font-caption text-ink-muted">flashcards</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {deck.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NSelect value={n} onChange={setN} disabled={false} />
          <Button onClick={onRegen} variant="secondary" size="sm">
            <svg viewBox="0 0 24 24" className="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0118 0M21 12a9 9 0 01-18 0" />
              <path d="M16 8h5V3M8 16H3v5" />
            </svg>
            Regenerate
          </Button>
        </div>
      </motion.div>

      <FlashcardDeck
        cards={deck.cards}
        bookmarkKey={`echoverse.bookmarks.flashcards.${docId}`}
      />

      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate flashcards?"
        description={`This replaces the ${deck.cards.length}-card deck with a freshly generated ${n}-card deck. Your bookmarks for the current deck will reset.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="primary" onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function NSelect({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-white/[0.07] bg-white/[0.02] p-1">
      {N_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          aria-pressed={opt === value}
          className={[
            'h-7 rounded-pill px-2.5 font-mono text-[0.7rem] tabular-nums transition-colors',
            opt === value ? 'bg-white/[0.10] text-ink' : 'text-ink-muted hover:text-ink',
            disabled ? 'opacity-50' : '',
          ].join(' ')}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ n, onN, onGenerate }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 text-accent-purple-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <path d="M3 10h18M7 14h6M7 17h4" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Generate flashcards from this document.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          Each card is grounded in your notes — every answer cites the chunks it came from. Tap to flip, ←/→ to move, B to bookmark.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NSelect value={n} onChange={onN} disabled={false} />
          <Button onClick={onGenerate} size="lg">
            <svg viewBox="0 0 24 24" className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3v4M3 5h4M19 17v4M17 19h4M11 11l5-5M13 13l-5 5" />
            </svg>
            Generate {n} cards
          </Button>
        </div>
      </div>
    </div>
  )
}
