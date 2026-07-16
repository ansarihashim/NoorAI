import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getNightBefore } from '../../lib/api.js'
import useRevisionStream from '../../hooks/useRevisionStream.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import StreamingList from './StreamingList.jsx'

const N_OPTIONS = [15, 25, 35, 50]

const CATEGORIES = [
  { key: 'all',        label: 'All' },
  { key: 'definition', label: 'Definitions' },
  { key: 'formula',    label: 'Formulas' },
  { key: 'derivation', label: 'Derivations' },
  { key: 'mistake',    label: 'Common mistakes' },
  { key: 'high_yield', label: 'High-yield' },
]

const CAT_TONE = {
  definition: 'border-accent-purple/30 bg-accent-purple/[0.08] text-accent-purple-soft',
  formula:    'border-accent-cyan/30 bg-accent-cyan/[0.08] text-accent-cyan-soft',
  derivation: 'border-accent-green/30 bg-accent-green/[0.08] text-accent-green',
  mistake:    'border-accent-rose/30 bg-accent-rose/[0.08] text-accent-rose',
  high_yield: 'border-accent-amber/30 bg-accent-amber/[0.10] text-accent-amber',
}

export default function NightBeforeView({ docId, action }) {
  const toast = useToast()
  const [set, setSet] = useState(null)
  const [n, setN] = useState(25)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('importance') // importance | exam_probability | category

  const {
    items: streamItems, isStreaming, isDone, error, total, startStream, reset,
  } = useRevisionStream(docId, 'night_before')

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await getNightBefore(docId)
        if (!cancelled) setSet(r)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setSet(undefined)
          else { setSet(undefined); toast.error('Night before failed to load', err?.message) }
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
        const r = await getNightBefore(docId)
        if (!cancelled) setSet(r)
      } catch {
        if (!cancelled && streamItems.length) {
          setSet({ title: set?.title || 'Night Before', items: streamItems })
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

  // Right-rail "Night-before pack" trigger.
  useEffect(() => {
    if (!action || !action.generate) return
    if (streaming || set === null) return
    if (set === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const items = useMemo(() => {
    if (!set) return []
    const filtered = filter === 'all' ? set.items : set.items.filter((i) => i.category === filter)
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'importance') return (b.importance || 0) - (a.importance || 0)
      if (sortBy === 'exam_probability') return (b.exam_probability || 0) - (a.exam_probability || 0)
      return (a.category || '').localeCompare(b.category || '')
    })
    return sorted
  }, [set, filter, sortBy])

  if (set === null && !streaming) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-3xl space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (streaming) {
    return (
      <StreamingList
        label="night before exam"
        items={streamItems}
        isStreaming={isStreaming}
        isDone={isDone}
        error={error}
        total={total}
        onTryAgain={onTryAgain}
        noneLabel="No items were produced."
        renderItem={(it) => (
          <>
            <p className="text-[0.9rem] font-medium leading-snug text-ink">{it.content}</p>
            <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.08em] text-ink-faint">
              {(it.category || '').replace('_', ' ')}
            </p>
          </>
        )}
      />
    )
  }

  if (set === undefined) {
    return <EmptyState n={n} onN={setN} onGenerate={onGenerate} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">night before exam</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {set.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={n} onChange={setN} disabled={false} options={N_OPTIONS} />
          <Button onClick={onRegen} variant="secondary" size="sm">Regenerate</Button>
        </div>
      </div>

      {/* Filter + sort row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-pill border border-white/[0.07] bg-white/[0.02] p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={[
                'h-7 rounded-pill px-2.5 text-[0.7rem] font-medium transition-colors',
                filter === c.key ? 'bg-white/[0.10] text-ink' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[0.7rem] text-ink-muted">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-pill border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[0.7rem] text-ink-muted outline-none focus:text-ink"
        >
          <option value="importance">Importance</option>
          <option value="exam_probability">Exam probability</option>
          <option value="category">Category</option>
        </select>
      </div>

      {/* Item rows */}
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={`${item.category}-${i}-${item.content.slice(0, 20)}`}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="glass relative flex items-start gap-3 px-4 py-3"
            >
              <span className={[
                'shrink-0 rounded-pill border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em]',
                CAT_TONE[item.category] || CAT_TONE.high_yield,
              ].join(' ')}>
                {item.category.replace('_', ' ')}
              </span>
              <p className="flex-1 text-pretty text-[0.9rem] leading-relaxed text-ink">{item.content}</p>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <ImportanceDots level={item.importance} />
                <span className="font-mono text-[0.65rem] text-ink-faint">
                  {Math.round((item.exam_probability || 0) * 100)}%
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-muted">
            No items match this filter.
          </p>
        )}
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate the cheat sheet?"
        description={`This replaces ${set.items.length} items with up to ${n} fresh ones.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="primary" onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function ImportanceDots({ level = 3 }) {
  return (
    <span className="flex gap-0.5" title={`Importance ${level}/5`}>
      {[1, 2, 3, 4, 5].map((d) => (
        <span
          key={d}
          className={[
            'h-1.5 w-1.5 rounded-full',
            d <= level ? 'bg-accent-amber' : 'bg-white/[0.10]',
          ].join(' ')}
        />
      ))}
    </span>
  )
}

function NPill({ value, onChange, disabled, options }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-white/[0.07] bg-white/[0.02] p-1">
      {options.map((opt) => (
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
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-amber/30 to-accent-rose/15 text-accent-amber ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          The night before the exam.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          A ranked cheat sheet — definitions, formulas, must-remembers, and common mistakes — every line grounded in your notes.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={false} options={N_OPTIONS} />
          <Button onClick={onGenerate} size="lg">Generate {n} items</Button>
        </div>
      </div>
    </div>
  )
}
