import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  deleteVisual,
  generateVisual,
  listVisuals,
} from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import MermaidRenderer from '../visualize/MermaidRenderer.jsx'

/**
 * Visual Revision is a curated set of revision-oriented diagram presets that
 * fan into the existing /api/visuals service — no duplication of the Mermaid
 * pipeline. Generated diagrams persist alongside any custom Visualize-tab
 * outputs and share the same cache.
 */
const PRESETS = [
  {
    id: 'rev-flowchart',
    label: 'Revision flowchart',
    description: 'Top-down flowchart of the chapter\'s key steps.',
    prompt: 'Convert the entire chapter into a clean revision flowchart showing the main steps and how they connect. Aim for 8–14 nodes.',
    style: 'flowchart',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <rect x="3" y="13" width="6" height="4" rx="1" />
        <rect x="15" y="13" width="6" height="4" rx="1" />
        <path d="M12 7v3M12 10l-6 3M12 10l6 3" />
      </svg>
    ),
  },
  {
    id: 'rev-mindmap',
    label: 'Mind map',
    description: 'Hierarchical mind map of every key term.',
    prompt: 'Create a mind map starting from the chapter title at the centre, branching into all key concepts and sub-concepts.',
    style: 'mindmap',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="20" cy="6" r="2" />
        <circle cx="4" cy="18" r="2" />
        <circle cx="20" cy="18" r="2" />
        <path d="M9.5 11l-4-4M14.5 11l4-4M9.5 13l-4 4M14.5 13l4 4" />
      </svg>
    ),
  },
  {
    id: 'rev-roadmap',
    label: 'Study roadmap',
    description: 'Left-to-right roadmap ordering topics from prerequisite to advanced.',
    prompt: 'Generate a left-to-right study roadmap that groups the chapter\'s topics from prerequisite/foundational to advanced. Use subgraphs for groups.',
    style: 'roadmap',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h4M9 12h4M15 12h4M21 12h.01" />
        <circle cx="7" cy="12" r="1" fill="currentColor" />
        <circle cx="13" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'rev-tree',
    label: 'Concept hierarchy',
    description: 'Tree showing how concepts derive from broader ones.',
    prompt: 'Show the concepts in this chapter as a tree hierarchy: broader concepts at the top, derived/specific concepts below. Aim for 3 levels.',
    style: 'tree',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v3M12 6l-4 3M12 6l4 3M8 9v3M16 9v3M8 12l-2 3M8 12l2 3M16 12l-2 3M16 12l2 3" />
      </svg>
    ),
  },
  {
    id: 'rev-sequence',
    label: 'Sequence / process',
    description: 'Sequence diagram of an interaction or process from the chapter.',
    prompt: 'Identify the most important process/interaction in this chapter and draw it as a sequenceDiagram between the actors involved.',
    style: 'sequence',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="21" />
        <line x1="18" y1="3" x2="18" y2="21" />
        <path d="M6 8l12 0M18 14l-12 0" />
      </svg>
    ),
  },
  {
    id: 'rev-concept-map',
    label: 'Concept map',
    description: 'Free-form graph of how concepts relate (with labelled edges).',
    prompt: 'Draw a concept map showing how key concepts in this chapter relate to each other. Use labelled edges to describe each relationship.',
    style: 'concept-map',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6h7M6 8.5v7M18 8.5v7M8.5 18h7M8 8l8 8M16 8l-8 8" />
      </svg>
    ),
  },
]

export default function VisualRevisionView({ docId }) {
  const toast = useToast()
  const [history, setHistory] = useState(null) // existing visuals for this doc
  const [active, setActive] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await listVisuals(docId)
        if (!cancelled) setHistory(list || [])
      } catch (err) {
        if (!cancelled) setHistory([])
        if (err?.status && err.status !== 404) {
          toast.error("Couldn't load existing visuals", err?.message)
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  const onPreset = useCallback(async (preset) => {
    if (busyId) return
    setBusyId(preset.id)
    try {
      const v = await generateVisual(docId, { prompt: preset.prompt, style: preset.style })
      setActive(v)
      setHistory((cur) => {
        const list = (cur || []).filter((x) => x.visual_id !== v.visual_id)
        return [v, ...list]
      })
      toast.success('Diagram ready', v.title)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusyId(null)
    }
  }, [busyId, docId, toast])

  const performDelete = useCallback(async () => {
    if (!confirmDelete) return
    try {
      await deleteVisual(docId, confirmDelete.visual_id)
      setHistory((cur) => (cur || []).filter((v) => v.visual_id !== confirmDelete.visual_id))
      if (active?.visual_id === confirmDelete.visual_id) setActive(null)
      toast.success('Deleted', confirmDelete.title)
    } catch (err) {
      toast.error("Couldn't delete", err?.message)
    } finally {
      setConfirmDelete(null)
    }
  }, [confirmDelete, active, docId, toast])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-caption text-ink-muted">visual revision</span>
        <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
          Pick a diagram style.
        </h2>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Each preset funnels into the same Mermaid pipeline as the Visualize tab — diagrams cache across both.
        </p>
      </div>

      {/* Preset grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((p) => {
          const isBusy = busyId === p.id
          return (
            <motion.button
              key={p.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPreset(p)}
              disabled={Boolean(busyId)}
              className={[
                'group relative flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all',
                'hover:border-white/[0.14] hover:bg-white/[0.04]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-purple/20 to-accent-cyan/15 text-accent-purple-soft ring-1 ring-white/[0.06]">
                {p.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[0.9rem] font-medium text-ink">{p.label}</h3>
                  {isBusy && (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent text-accent-purple-soft" />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{p.description}</p>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Active diagram */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.95rem] font-medium text-ink">{active.title}</div>
              <div className="mt-0.5 text-[0.7rem] text-ink-muted">
                <span className="font-mono uppercase tracking-[0.08em]">{active.diagram_type}</span>
              </div>
            </div>
          </div>
          <MermaidRenderer code={active.mermaid} title={active.title} />
        </motion.div>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 font-caption text-ink-muted">recent diagrams for this doc</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {history.slice(0, 6).map((v) => (
                <motion.div
                  key={v.visual_id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="group glass relative p-3"
                >
                  <button
                    onClick={() => setActive(v)}
                    className="block w-full text-left"
                  >
                    <div className="line-clamp-1 text-[0.85rem] font-medium text-ink">
                      {v.title}
                    </div>
                    <div className="mt-0.5 truncate text-[0.65rem] text-ink-faint">
                      <span className="font-mono uppercase tracking-[0.08em]">{v.diagram_type}</span>
                      {v.style && <> · {v.style}</>}
                    </div>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(v) }}
                    aria-label="Delete diagram"
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity hover:bg-accent-rose/[0.10] hover:text-accent-rose group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {history === null && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this diagram?"
        description={confirmDelete ? `"${confirmDelete.title}" will be removed.` : undefined}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={performDelete}>Delete</Button>
        </div>
      </Dialog>
    </div>
  )
}
