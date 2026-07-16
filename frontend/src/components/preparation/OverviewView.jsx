import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getOverview } from '../../lib/api.js'
import usePreparationStream from '../../hooks/usePreparationStream.js'
import { useMultiDocCitations, format as formatCitation } from '../../lib/citations.jsx'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'

export default function OverviewView({ docIds, action }) {
  const toast = useToast()
  const citationsByDoc = useMultiDocCitations(docIds)
  const [overview, setOverview] = useState(null) // null=loading|undefined=none|object=loaded
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [open, setOpen] = useState(new Set())

  const { text, isStreaming, isDone, error, startStream, reset } =
    usePreparationStream(docIds, 'overview')

  // Reset whenever the doc set changes.
  useEffect(() => {
    if (!docIds || docIds.length === 0) return
    let cancelled = false
    setOverview(null)
    setOpen(new Set())
    ;(async () => {
      try {
        const o = await getOverview(docIds)
        if (!cancelled) setOverview(o)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setOverview(undefined)
          else { setOverview(undefined); toast.error('Overview failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docIds.join('|'), toast])

  // Stream finished → the backend persisted the parsed OverviewMap, so load the
  // canonical object. Fall back to parsing the streamed JSON text directly.
  useEffect(() => {
    if (!streaming || !isDone) return
    let cancelled = false
    ;(async () => {
      let parsed = null
      try { parsed = await getOverview(docIds) } catch { /* not persisted / invalid */ }
      if (!parsed) {
        try { const p = JSON.parse(text); if (p && Array.isArray(p.topics)) parsed = p } catch { /* invalid */ }
      }
      if (!cancelled) {
        if (parsed && Array.isArray(parsed.topics)) { setOverview(parsed); setOpen(new Set([0])) }
        else { toast.error('Overview failed', 'Could not parse the generated overview.'); setOverview((o) => (o === null ? undefined : o)) }
        setStreaming(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, streaming])

  const beginStream = useCallback((opts) => { setStreaming(true); startStream(opts) }, [startStream])
  const onGenerate = useCallback(() => { if (!streaming) beginStream({}) }, [streaming, beginStream])
  const onRegen = useCallback(() => { if (overview) setConfirmRegen(true); else onGenerate() }, [overview, onGenerate])
  const performRegen = useCallback(() => { setConfirmRegen(false); beginStream({ force: true }) }, [beginStream])
  const onTryAgain = useCallback(() => { reset(); beginStream({}) }, [reset, beginStream])

  // React to right-rail "Generate overview" / "Topic relationships" actions.
  useEffect(() => {
    if (!action) return
    if (action.action !== 'overview' && action.action !== 'topic-relationships') return
    if (streaming || overview === null) return
    if (overview === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const toggle = (i) => {
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  if (overview === null && !streaming) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    )
  }

  if (streaming) {
    return <OverviewStreaming text={text} isStreaming={isStreaming} error={error} onTryAgain={onTryAgain} />
  }

  if (overview === undefined) {
    return <EmptyState onGenerate={onGenerate} nDocs={docIds.length} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">overview</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {overview.title}
          </h2>
        </div>
        <Button onClick={onRegen} variant="secondary" size="sm">
          Regenerate
        </Button>
      </div>

      <div>
        <div className="mb-2 font-caption text-ink-muted">topics</div>
        <div className="space-y-2">
          {overview.topics.map((t, i) => {
            const isOpen = open.has(i)
            return (
              <motion.div key={i} layout className="glass overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] font-mono text-[0.65rem] text-ink-muted">
                      {i + 1}
                    </span>
                    <h3 className="truncate text-[0.9rem] font-medium text-ink">{t.title}</h3>
                    <ImportancePips level={t.importance} />
                  </div>
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
                        <p className="text-pretty text-[0.875rem] leading-relaxed text-ink-muted">
                          {t.summary}
                        </p>
                        {t.depends_on && t.depends_on.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.7rem]">
                            <span className="text-ink-faint">Builds on:</span>
                            {t.depends_on.map((d) => (
                              <span
                                key={d}
                                className="rounded-pill border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-ink-muted"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.chunks && t.chunks.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[0.65rem] text-ink-faint">
                            <span>Grounded in:</span>
                            {(() => {
                              // Group chunk indices by doc, then render one
                              // chip per doc with a page-range label.
                              const byDoc = new Map()
                              for (const c of t.chunks) {
                                if (!byDoc.has(c.doc_id)) byDoc.set(c.doc_id, [])
                                byDoc.get(c.doc_id).push(c.chunk_idx)
                              }
                              const chips = []
                              for (const [docId, idxs] of byDoc.entries()) {
                                const meta = citationsByDoc[docId] || { pages: [], is_paged: false, format: null }
                                const label = meta.format ? meta.format(idxs) : formatCitation(meta.pages, meta.is_paged, idxs)
                                chips.push(
                                  <span
                                    key={docId}
                                    className="rounded-pill bg-white/[0.04] px-1.5 py-0.5"
                                    title={docId}
                                  >
                                    {label}
                                  </span>,
                                )
                              }
                              return chips
                            })()}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate the overview?"
        description="This re-runs the analysis for the current document set and streams the result."
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="primary" onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function ImportancePips({ level = 3 }) {
  return (
    <span className="hidden gap-0.5 sm:flex" title={`Importance ${level}/5`}>
      {[1, 2, 3, 4, 5].map((d) => (
        <span
          key={d}
          className={[
            'h-1 w-1 rounded-full',
            d <= level ? 'bg-accent-purple' : 'bg-white/[0.10]',
          ].join(' ')}
        />
      ))}
    </span>
  )
}

// While streaming, show the raw model output flowing in with a typewriter
// cursor (the overview is JSON — we deliberately don't parse mid-stream). On
// completion the parent parses it and renders the formatted topic list.
function OverviewStreaming({ text, isStreaming, error, onTryAgain }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-caption text-ink-muted">overview</span>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
          Analyzing…
        </h2>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-relaxed text-ink-muted">
          {text}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[3px] animate-pulse bg-accent-purple-soft" />
          )}
        </pre>
      </div>
      {error && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/[0.06] p-4">
          <p className="text-[0.9rem] text-ink">Generation failed.</p>
          <p className="mt-1 text-[0.8rem] text-ink-muted">{error}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={onTryAgain}>Try again</Button>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onGenerate, nDocs }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/15 text-accent-purple-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="2.5" />
            <circle cx="5" cy="5" r="2" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <path d="M10 11l-4-4M14 11l4-4M10 13l-4 4M14 13l4 4" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Build a syllabus overview.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          NoorAI analyses the {nDocs > 1 ? `${nDocs} documents` : 'document'}, identifies topics and dependencies, and streams the result as it writes.
        </p>
        <Button onClick={onGenerate} size="lg" className="mt-6">
          Build overview
        </Button>
      </div>
    </div>
  )
}
