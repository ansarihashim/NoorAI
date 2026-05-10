import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  deleteImportantQuestions,
  generateImportantQuestions,
  getImportantQuestions,
} from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'

const N_OPTIONS = [8, 10, 15, 20]

const TYPE_TONE = {
  recall:   'border-accent-purple/30 bg-accent-purple/[0.08] text-accent-purple-soft',
  apply:    'border-accent-cyan/30 bg-accent-cyan/[0.08] text-accent-cyan-soft',
  analyze:  'border-accent-green/30 bg-accent-green/[0.08] text-accent-green',
  evaluate: 'border-accent-amber/30 bg-accent-amber/[0.10] text-accent-amber',
}

export default function ImportantQuestionsView({ docIds }) {
  const toast = useToast()
  const [set, setSet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(10)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [open, setOpen] = useState(new Set([0]))

  useEffect(() => {
    if (!docIds || docIds.length === 0) return
    let cancelled = false
    setSet(null)
    setOpen(new Set([0]))
    ;(async () => {
      try {
        const r = await getImportantQuestions(docIds)
        if (!cancelled) setSet(r)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setSet(undefined)
          else { setSet(undefined); toast.error('Questions failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docIds.join('|'), toast])

  const onGenerate = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await generateImportantQuestions(docIds, { n, force: set != null })
      setSet(r)
      setOpen(new Set([0]))
      toast.success('Questions ready', `${r.questions.length} questions`)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [busy, n, docIds, set, toast])

  const onRegen = useCallback(() => {
    if (set) setConfirmRegen(true)
    else onGenerate()
  }, [set, onGenerate])

  const performRegen = useCallback(async () => {
    setBusy(true)
    try {
      try { await deleteImportantQuestions(docIds) } catch {}
      const r = await generateImportantQuestions(docIds, { n, force: true })
      setSet(r)
      setOpen(new Set([0]))
      toast.success('Regenerated', `${r.questions.length} questions`)
    } catch (err) {
      toast.error('Regeneration failed', err?.message)
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [docIds, n, toast])

  const toggle = (i) => {
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  if (set === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  if (set === undefined) {
    return <EmptyState n={n} onN={setN} busy={busy} onGenerate={onGenerate} nDocs={docIds.length} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">important questions</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {set.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={n} onChange={setN} disabled={busy} />
          <Button onClick={onRegen} loading={busy} variant="secondary" size="sm">Regenerate</Button>
        </div>
      </div>

      <ul className="space-y-2">
        {set.questions.map((q, i) => {
          const isOpen = open.has(i)
          return (
            <motion.li key={i} layout className="glass overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(i)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] font-mono text-[0.65rem] text-ink-muted">
                  Q{i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[0.9rem] font-medium text-ink">{q.question}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className={[
                      'rounded-pill border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.08em]',
                      TYPE_TONE[q.type] || TYPE_TONE.apply,
                    ].join(' ')}>
                      {q.type}
                    </span>
                    <ConfidenceBar value={q.confidence} />
                  </span>
                </span>
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-ink-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path d="M6 9l6 6 6-6" />
                </motion.svg>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
                      <p className="text-pretty text-[0.9rem] leading-relaxed text-ink-muted">
                        {q.answer}
                      </p>
                      {q.chunks && q.chunks.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1 text-[0.65rem] text-ink-faint">
                          <span>Grounded in:</span>
                          {q.chunks.map((c, k) => (
                            <span
                              key={k}
                              className="rounded-pill bg-white/[0.04] px-1.5 py-0.5 font-mono"
                              title={c.doc_id}
                            >
                              {c.doc_id.slice(0, 6)}#{c.chunk_idx}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          )
        })}
      </ul>

      <Dialog
        open={confirmRegen}
        onClose={() => !busy && setConfirmRegen(false)}
        title="Regenerate questions?"
        description={`This replaces ${set.questions.length} questions with ${n} fresh ones.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function ConfidenceBar({ value = 0.5 }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
          style={{ width: `${Math.round((value || 0) * 100)}%` }}
        />
      </span>
      <span className="font-mono text-[0.6rem] tabular-nums text-ink-faint">
        {Math.round((value || 0) * 100)}%
      </span>
    </span>
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

function EmptyState({ n, onN, busy, onGenerate, nDocs }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-cyan/30 to-accent-purple/15 text-accent-cyan-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11a3 3 0 016 0c0 2-3 2-3 4M12 17v.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Predicted exam questions, grounded.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          {nDocs > 1
            ? `Spans all ${nDocs} selected documents — every answer cites the chunks it drew from.`
            : 'Every answer cites the chunks it drew from. Confidence calibrated by the model.'}
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={busy} />
          <Button onClick={onGenerate} loading={busy} size="lg">Generate {n} questions</Button>
        </div>
      </div>
    </div>
  )
}
