import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  deleteFlashcards,
  generateFlashcards,
  getFlashcards,
} from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import FlashcardDeck from './FlashcardDeck.jsx'

const N_OPTIONS = [10, 15, 20, 30]

export default function FlashcardsView({ docId, action }) {
  const toast = useToast()
  const [deck, setDeck] = useState(null) // null=loading, undefined=none, FlashcardSet=loaded
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(20)
  const [confirmRegen, setConfirmRegen] = useState(false)

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
          else {
            setDeck(undefined)
            toast.error('Flashcards failed to load', err?.message)
          }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  const onGenerate = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const d = await generateFlashcards(docId, { n, force: deck != null })
      setDeck(d)
      toast.success('Flashcards ready', `${d.cards.length} cards generated`)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false)
      setConfirmRegen(false)
    }
  }, [busy, n, docId, deck, toast])

  const onClearAndRegen = useCallback(async () => {
    if (deck) {
      setConfirmRegen(true)
      return
    }
    onGenerate()
  }, [deck, onGenerate])

  // Right-rail "Generate flashcards" — auto-trigger when user clicks the
  // action while we have no deck yet; if a deck exists, ask before replacing.
  useEffect(() => {
    if (!action || !action.generate) return
    if (busy) return
    if (deck === null) return
    if (deck === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const performClearAndRegen = useCallback(async () => {
    setBusy(true)
    try {
      try { await deleteFlashcards(docId) } catch {}
      const d = await generateFlashcards(docId, { n, force: true })
      setDeck(d)
      toast.success('Flashcards regenerated', `${d.cards.length} cards`)
    } catch (err) {
      toast.error('Regeneration failed', err?.message || String(err))
    } finally {
      setBusy(false)
      setConfirmRegen(false)
    }
  }, [docId, n, toast])

  // ---- render branches ----
  if (deck === null) {
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

  if (deck === undefined) {
    return (
      <EmptyState
        n={n}
        onN={setN}
        busy={busy}
        onGenerate={onGenerate}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
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
          <NSelect value={n} onChange={setN} disabled={busy} />
          <Button onClick={onClearAndRegen} loading={busy} variant="secondary" size="sm">
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
        onClose={() => !busy && setConfirmRegen(false)}
        title="Regenerate flashcards?"
        description={`This replaces the ${deck.cards.length}-card deck with a freshly generated ${n}-card deck. Your bookmarks for the current deck will reset.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={performClearAndRegen}>
            Regenerate
          </Button>
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
            opt === value
              ? 'bg-white/[0.10] text-ink'
              : 'text-ink-muted hover:text-ink',
            disabled ? 'opacity-50' : '',
          ].join(' ')}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ n, onN, busy, onGenerate }) {
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
          <NSelect value={n} onChange={onN} disabled={busy} />
          <Button onClick={onGenerate} loading={busy} size="lg">
            {!busy && (
              <svg viewBox="0 0 24 24" className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3v4M3 5h4M19 17v4M17 19h4M11 11l5-5M13 13l-5 5" />
              </svg>
            )}
            Generate {n} cards
          </Button>
        </div>
      </div>
    </div>
  )
}
