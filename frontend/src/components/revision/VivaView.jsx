import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getViva } from '../../lib/api.js'
import useRevisionStream from '../../hooks/useRevisionStream.js'
import { useCitations } from '../../lib/citations.jsx'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import StreamingList from './StreamingList.jsx'

const N_OPTIONS = [8, 12, 16, 24]

const DIFF_TONE = {
  easy: 'border-accent-green/30 bg-accent-green/[0.08] text-accent-green',
  medium: 'border-accent-cyan/30 bg-accent-cyan/[0.08] text-accent-cyan-soft',
  hard: 'border-accent-rose/30 bg-accent-rose/[0.08] text-accent-rose',
}

export default function VivaView({ docId, action }) {
  const toast = useToast()
  const citations = useCitations()
  const [set, setSet] = useState(null)
  const [n, setN] = useState(12)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(new Set())
  const [openFollowUps, setOpenFollowUps] = useState(new Set())

  const {
    items: streamItems, isStreaming, isDone, error, total, startStream, reset,
  } = useRevisionStream(docId, 'viva')

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await getViva(docId)
        if (!cancelled) setSet(r)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setSet(undefined)
          else { setSet(undefined); toast.error('Viva failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  useEffect(() => {
    if (!streaming || !isDone) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await getViva(docId)
        if (!cancelled) { setSet(r); setIdx(0); setRevealed(new Set()); setOpenFollowUps(new Set()) }
      } catch {
        if (!cancelled && streamItems.length) {
          setSet({ title: set?.title || 'Viva', questions: streamItems })
          setIdx(0); setRevealed(new Set()); setOpenFollowUps(new Set())
        }
      }
      if (!cancelled) setStreaming(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, streaming])

  const beginStream = useCallback((opts) => { setStreaming(true); startStream(opts) }, [startStream])
  const onGenerate = useCallback(() => { if (!streaming) beginStream({ n }) }, [streaming, n, beginStream])
  const onRegen = useCallback(() => { if (set) setConfirmRegen(true); else onGenerate() }, [set, onGenerate])
  const performRegen = useCallback(() => { setConfirmRegen(false); beginStream({ n, force: true }) }, [n, beginStream])
  const onTryAgain = useCallback(() => { reset(); beginStream({ n }) }, [reset, n, beginStream])

  // Right-rail "Viva prep" trigger.
  useEffect(() => {
    if (!action || !action.generate) return
    if (streaming || set === null) return
    if (set === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  if (set === null && !streaming) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[260px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (streaming) {
    return (
      <StreamingList
        label="viva"
        items={streamItems}
        isStreaming={isStreaming}
        isDone={isDone}
        error={error}
        total={total}
        onTryAgain={onTryAgain}
        noneLabel="No questions were produced."
        renderItem={(qq) => (
          <>
            <p className="text-[0.9rem] font-medium leading-snug text-ink">{qq.question}</p>
            <p className="mt-1.5 text-[0.75rem] uppercase tracking-[0.08em] text-ink-faint">
              {qq.difficulty}
            </p>
          </>
        )}
      />
    )
  }

  if (set === undefined) {
    return <EmptyState n={n} onN={setN} onGenerate={onGenerate} />
  }

  const q = set.questions[idx]
  const isRevealed = revealed.has(idx)
  const fuOpen = openFollowUps.has(idx)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">viva</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {set.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={n} onChange={setN} disabled={false} />
          <Button onClick={onRegen} variant="secondary" size="sm">Regenerate</Button>
        </div>
      </div>

      {/* Examiner card */}
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-strong relative overflow-hidden p-6 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan text-white shadow-glow">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z" />
                <path d="M19 10a7 7 0 01-14 0" />
              </svg>
            </span>
            <span className="font-caption text-ink-muted">examiner</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={[
              'rounded-pill border px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.08em]',
              DIFF_TONE[q.difficulty] || DIFF_TONE.medium,
            ].join(' ')}>
              {q.difficulty}
            </span>
            <span className="text-[0.65rem] text-ink-faint">
              {citations.format(q.grounded_chunks || [])}
            </span>
          </div>
        </div>

        <p className="mt-4 text-pretty text-[1.0625rem] leading-relaxed text-ink">{q.question}</p>

        <div className="mt-5">
          {!isRevealed ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setRevealed((s) => new Set([...s, idx]))}
            >
              Show model answer
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/[0.06] p-4"
              >
                <div className="flex items-center gap-2 font-caption text-accent-cyan-soft">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                  model answer
                </div>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink">
                  {q.expected_answer}
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {q.follow_ups && q.follow_ups.length > 0 && isRevealed && (
          <div className="mt-3">
            <button
              onClick={() => {
                setOpenFollowUps((cur) => {
                  const next = new Set(cur)
                  if (next.has(idx)) next.delete(idx); else next.add(idx)
                  return next
                })
              }}
              className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-muted hover:text-ink"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                animate={{ rotate: fuOpen ? 90 : 0 }}
              >
                <path d="M9 6l6 6-6 6" />
              </motion.svg>
              {q.follow_ups.length} follow-up question{q.follow_ups.length === 1 ? '' : 's'}
            </button>
            <AnimatePresence>
              {fuOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 space-y-1 overflow-hidden"
                >
                  {q.follow_ups.map((fu, i) => (
                    <li key={i} className="flex items-start gap-2 text-[0.85rem] text-ink-muted">
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-accent-purple" />
                      <span>{fu}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ← Previous
        </Button>
        <span className="font-mono text-[0.7rem] text-ink-faint">
          {idx + 1} / {set.questions.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.min(set.questions.length - 1, i + 1))}
          disabled={idx >= set.questions.length - 1}
        >
          Next →
        </Button>
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate the viva set?"
        description={`This replaces ${set.questions.length} questions with ${n} fresh ones.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="primary" onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function NPill({ value, onChange, disabled }) {
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
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple/30 to-accent-rose/15 text-accent-purple-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 015 5v3a5 5 0 01-10 0V7a5 5 0 015-5z" />
            <path d="M19 10a7 7 0 01-14 0M12 19v3" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Practice your viva — like an examiner just asked.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          Each question comes with a model answer and a few follow-ups an examiner might dig into. Speak the answer out loud, then reveal.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={false} />
          <Button onClick={onGenerate} size="lg">Generate {n} questions</Button>
        </div>
      </div>
    </div>
  )
}
