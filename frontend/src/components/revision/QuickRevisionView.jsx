import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  deleteQuickRevision,
  generateQuickRevision,
  getQuickRevision,
} from '../../lib/api.js'
import { useCitations } from '../../lib/citations.jsx'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'

const TOPIC_OPTIONS = [5, 8, 10, 15]

export default function QuickRevisionView({ docId, action }) {
  const citations = useCitations()
  const toast = useToast()
  const [set, setSet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [maxTopics, setMaxTopics] = useState(8)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [open, setOpen] = useState(new Set([0])) // first topic open by default

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await getQuickRevision(docId)
        if (!cancelled) setSet(r)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setSet(undefined)
          else { setSet(undefined); toast.error('Quick revision failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  const onGenerate = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await generateQuickRevision(docId, { max_topics: maxTopics, force: set != null })
      setSet(r); setOpen(new Set([0]))
      toast.success('Quick revision ready', `${r.topics.length} topics`)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [busy, maxTopics, docId, set, toast])

  const onRegen = useCallback(() => {
    if (set) setConfirmRegen(true)
    else onGenerate()
  }, [set, onGenerate])

  // Right-rail "Quick revision" trigger.
  useEffect(() => {
    if (!action || !action.generate) return
    if (busy || set === null) return
    if (set === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const performRegen = useCallback(async () => {
    setBusy(true)
    try {
      try { await deleteQuickRevision(docId) } catch {}
      const r = await generateQuickRevision(docId, { max_topics: maxTopics, force: true })
      setSet(r); setOpen(new Set([0]))
      toast.success('Regenerated', `${r.topics.length} topics`)
    } catch (err) {
      toast.error('Regeneration failed', err?.message)
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [docId, maxTopics, toast])

  const toggleAll = useCallback(() => {
    if (!set) return
    if (open.size === set.topics.length) setOpen(new Set())
    else setOpen(new Set(set.topics.map((_, i) => i)))
  }, [set, open])

  const toggle = useCallback((i) => {
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }, [])

  if (set === null) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-2xl space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (set === undefined) {
    return <EmptyState n={maxTopics} onN={setMaxTopics} busy={busy} onGenerate={onGenerate} />
  }

  const allOpen = open.size === set.topics.length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">quick revision</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {set.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={maxTopics} onChange={setMaxTopics} disabled={busy} />
          <Button onClick={toggleAll} variant="ghost" size="sm">
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button onClick={onRegen} loading={busy} variant="secondary" size="sm">
            Regenerate
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {set.topics.map((t, i) => {
            const isOpen = open.has(i)
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="glass overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] font-mono text-[0.7rem] text-ink-muted">
                      {i + 1}
                    </span>
                    <h3 className="truncate text-[0.95rem] font-medium text-ink">{t.title}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-[0.65rem] text-ink-faint sm:inline">
                      {citations.format(t.grounded_chunks || [])}
                    </span>
                    <motion.svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-ink-muted"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </motion.svg>
                  </div>
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
                      <div className="border-t border-white/[0.05] px-5 pb-5 pt-4">
                        <p className="text-pretty text-[0.95rem] leading-relaxed text-ink-muted">
                          {t.summary}
                        </p>
                        {t.key_points && t.key_points.length > 0 && (
                          <ul className="mt-4 space-y-1.5">
                            {t.key_points.map((kp, k) => (
                              <li key={k} className="flex items-start gap-2.5 text-[0.875rem] text-ink">
                                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan" />
                                <span>{kp}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => !busy && setConfirmRegen(false)}
        title="Regenerate the revision summary?"
        description={`This replaces ${set.topics.length} topics with up to ${maxTopics} fresh ones.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function NPill({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-white/[0.07] bg-white/[0.02] p-1">
      {TOPIC_OPTIONS.map((opt) => (
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

function EmptyState({ n, onN, busy, onGenerate }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple/25 to-accent-cyan/15 text-accent-purple-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h12M4 18h8" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          A tight, exam-ready summary of this document.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          Topic-grouped summaries with must-remember key points — perfect for the day before an exam.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={busy} />
          <Button onClick={onGenerate} loading={busy} size="lg">Generate up to {n} topics</Button>
        </div>
      </div>
    </div>
  )
}
