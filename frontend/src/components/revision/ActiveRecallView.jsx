import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { deleteRecall, generateRecall, getRecall } from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'

const N_OPTIONS = [8, 12, 16, 24]

const KIND_LABEL = {
  concept: 'Concept',
  fill_in_blank: 'Fill in the blank',
  explain_in_own_words: 'Explain in your own words',
  short: 'Quick recall',
}

const KIND_TONE = {
  concept: 'border-accent-purple/30 bg-accent-purple/[0.08] text-accent-purple-soft',
  fill_in_blank: 'border-accent-cyan/30 bg-accent-cyan/[0.08] text-accent-cyan-soft',
  explain_in_own_words: 'border-accent-green/30 bg-accent-green/[0.08] text-accent-green',
  short: 'border-accent-amber/30 bg-accent-amber/[0.08] text-accent-amber',
}

export default function ActiveRecallView({ docId }) {
  const toast = useToast()
  const [set, setSet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(12)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(new Set())
  const [userAnswer, setUserAnswer] = useState({})

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await getRecall(docId)
        if (!cancelled) setSet(r)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setSet(undefined)
          else { setSet(undefined); toast.error('Recall failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  const onGenerate = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await generateRecall(docId, { n, force: set != null })
      setSet(r); setIdx(0); setRevealed(new Set()); setUserAnswer({})
      toast.success('Recall set ready', `${r.prompts.length} prompts generated`)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [busy, n, docId, set, toast])

  const onRegen = useCallback(() => {
    if (set) setConfirmRegen(true)
    else onGenerate()
  }, [set, onGenerate])

  const performRegen = useCallback(async () => {
    setBusy(true)
    try {
      try { await deleteRecall(docId) } catch {}
      const r = await generateRecall(docId, { n, force: true })
      setSet(r); setIdx(0); setRevealed(new Set()); setUserAnswer({})
      toast.success('Regenerated', `${r.prompts.length} prompts`)
    } catch (err) {
      toast.error('Regeneration failed', err?.message)
    } finally {
      setBusy(false); setConfirmRegen(false)
    }
  }, [docId, n, toast])

  if (set === null) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[260px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (set === undefined) {
    return <EmptyState n={n} onN={setN} busy={busy} onGenerate={onGenerate} />
  }

  const p = set.prompts[idx]
  const isRevealed = revealed.has(idx)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">active recall</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {set.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={n} onChange={setN} disabled={busy} />
          <Button onClick={onRegen} loading={busy} variant="secondary" size="sm">Regenerate</Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[0.8rem]">
        <span className="font-mono tabular-nums text-ink-muted">
          Prompt {idx + 1} / {set.prompts.length}
        </span>
        <span className="text-ink-muted">{revealed.size} revealed</span>
      </div>

      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-strong relative overflow-hidden p-6 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span className={[
            'rounded-pill border px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.08em]',
            KIND_TONE[p.kind] || KIND_TONE.concept,
          ].join(' ')}>
            {KIND_LABEL[p.kind] || p.kind}
          </span>
          <span className="font-mono text-[0.65rem] text-ink-faint">
            {(p.grounded_chunks || []).map((c) => `#${c}`).join(' · ')}
          </span>
        </div>

        <p className="mt-4 text-pretty text-[1.05rem] leading-relaxed text-ink">{p.prompt}</p>

        {/* User scratch area for fill_in_blank / short */}
        {(p.kind === 'fill_in_blank' || p.kind === 'short') && (
          <input
            type="text"
            value={userAnswer[idx] || ''}
            onChange={(e) => setUserAnswer((u) => ({ ...u, [idx]: e.target.value }))}
            placeholder={p.kind === 'fill_in_blank' ? 'Your answer…' : 'Your one-line answer…'}
            disabled={isRevealed}
            className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50"
          />
        )}

        {(p.kind === 'concept' || p.kind === 'explain_in_own_words') && !isRevealed && (
          <textarea
            value={userAnswer[idx] || ''}
            onChange={(e) => setUserAnswer((u) => ({ ...u, [idx]: e.target.value }))}
            placeholder="Type your answer (optional, just for self-checking)…"
            rows={4}
            className="mt-4 w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[0.9rem] leading-relaxed text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50"
          />
        )}

        <div className="mt-5">
          {!isRevealed ? (
            <Button onClick={() => setRevealed((s) => new Set([...s, idx]))} variant="primary" size="md">
              Reveal expected answer
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-accent-green/25 bg-accent-green/[0.06] p-4"
              >
                <div className="font-caption text-accent-green">expected</div>
                <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink">{p.expected}</p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ← Previous
        </Button>
        <span className="font-mono text-[0.7rem] text-ink-faint">
          {idx + 1} / {set.prompts.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.min(set.prompts.length - 1, i + 1))}
          disabled={idx >= set.prompts.length - 1}
        >
          Next →
        </Button>
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => !busy && setConfirmRegen(false)}
        title="Regenerate the recall set?"
        description={`This replaces ${set.prompts.length} prompts with ${n} fresh ones.`}
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

function EmptyState({ n, onN, busy, onGenerate }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-green/25 to-accent-cyan/15 text-accent-green ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11a3 3 0 016 0v1l-2 2h-2l-2-2v-1z" />
            <path d="M5 21h14M12 17v4" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Active recall, the science-backed way to learn.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          A mix of conceptual prompts, fill-in-the-blanks, and "explain it back" exercises — every prompt grounded in your notes.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={busy} />
          <Button onClick={onGenerate} loading={busy} size="lg">Generate {n} prompts</Button>
        </div>
      </div>
    </div>
  )
}
