import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { listDocuments } from '../../lib/api.js'
import Skeleton from '../ui/Skeleton.jsx'

/**
 * Multi-doc picker for Preparation Mode.
 *
 *   <DocPicker activeDocId={docId} value={[ids]} onChange={fn} />
 *
 * The session's primary doc is auto-included and pinned (cannot be unchecked
 * unless the user has at least one other selected).
 */
export default function DocPicker({ activeDocId, value, onChange, disabled = false }) {
  const [docs, setDocs] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listDocuments()
        if (!cancelled) setDocs(list || [])
      } catch {
        if (!cancelled) setDocs([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Ensure the active doc is always in the value at mount.
  useEffect(() => {
    if (!activeDocId) return
    if (!value.includes(activeDocId)) {
      onChange([activeDocId, ...value])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId])

  const sorted = useMemo(() => {
    if (!docs) return []
    return [...docs].sort((a, b) => {
      if (a.id === activeDocId) return -1
      if (b.id === activeDocId) return 1
      return (b.created_at || 0) - (a.created_at || 0)
    })
  }, [docs, activeDocId])

  const toggle = (id) => {
    if (disabled) return
    if (value.includes(id)) {
      // Don't allow removing the active doc unless others are selected.
      if (id === activeDocId && value.length === 1) return
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (docs === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center text-sm text-ink-muted">
        No other documents in your library yet.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="font-caption text-ink-muted">documents in this preparation</div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {sorted.map((d) => {
          const isActive = d.id === activeDocId
          const isSelected = value.includes(d.id)
          return (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                type="button"
                onClick={() => toggle(d.id)}
                disabled={disabled || (isActive && value.length === 1)}
                className={[
                  'group relative flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                  isSelected
                    ? 'border-accent-purple/40 bg-accent-purple/[0.10]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                <span className={[
                  'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  isSelected
                    ? 'border-accent-purple bg-accent-purple text-white'
                    : 'border-white/[0.18] bg-white/[0.02]',
                ].join(' ')}>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4 4 10-11" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="line-clamp-1 text-[0.85rem] font-medium text-ink">{d.title || 'Untitled'}</span>
                    {isActive && (
                      <span className="rounded-pill bg-white/[0.10] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                        current
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.65rem] text-ink-faint">
                    {d.id} · {d.n_chunks} chunks
                  </span>
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
