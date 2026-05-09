import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  deleteVisual,
  generateVisual,
  listVisuals,
} from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import StyleChips from './StyleChips.jsx'
import MermaidRenderer from './MermaidRenderer.jsx'

const EXAMPLE_PROMPTS = [
  'Convert this chapter into a revision flowchart.',
  'Create a mind map of the key terms.',
  'Show the relationships between concepts.',
  'Generate a roadmap for studying this topic.',
  'Visualize the architecture using a flow diagram.',
]

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function VisualizeView({ docId, docTitle }) {
  const toast = useToast()
  const [history, setHistory] = useState(null)        // null = loading, [] = empty, [...] = list
  const [active, setActive] = useState(null)          // visual currently rendered
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const lastSvgRef = useRef('')
  const promptRef = useRef(null)

  // Initial fetch of cached visuals.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listVisuals(docId)
        if (cancelled) return
        setHistory(list)
        if (list.length > 0) setActive(list[0])
      } catch (err) {
        if (!cancelled) {
          setHistory([])
          if (err?.status && err.status !== 404) {
            toast.error('Visuals failed to load', err?.message)
          }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  const onGenerate = useCallback(async () => {
    if (busy) return
    const trimmed = prompt.trim()
    if (!trimmed) {
      toast.error('Tell me what to visualize', 'Try "Mind map of the key concepts"')
      promptRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const v = await generateVisual(docId, { prompt: trimmed, style })
      setActive(v)
      // Replace any earlier item with the same id; otherwise prepend.
      setHistory((cur) => {
        const list = (cur || []).filter((x) => x.visual_id !== v.visual_id)
        return [v, ...list]
      })
      toast.success('Diagram ready', v.title)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }, [busy, prompt, style, docId, toast])

  const onUseExample = useCallback((text) => {
    setPrompt(text)
    promptRef.current?.focus()
  }, [])

  const onDownload = useCallback(() => {
    if (!active || !lastSvgRef.current) return
    const blob = new Blob([lastSvgRef.current], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (active.title || 'diagram').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60)
    a.href = url
    a.download = `${safe}.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [active])

  const performDelete = useCallback(async () => {
    if (!confirmDelete) return
    try {
      await deleteVisual(docId, confirmDelete.visual_id)
      setHistory((cur) => (cur || []).filter((v) => v.visual_id !== confirmDelete.visual_id))
      if (active?.visual_id === confirmDelete.visual_id) {
        setActive((cur) => {
          const list = (history || []).filter((v) => v.visual_id !== confirmDelete.visual_id)
          return list[0] || null
        })
      }
      toast.success('Deleted', confirmDelete.title)
    } catch (err) {
      toast.error("Couldn't delete", err?.message)
    } finally {
      setConfirmDelete(null)
    }
  }, [confirmDelete, active, history, docId, toast])

  const isEmpty = history !== null && history.length === 0
  const showRail = (history?.length || 0) > 0

  return (
    <div className="flex h-full flex-col">
      {/* Composer */}
      <div className="border-b border-white/[0.05] bg-bg/40 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <span className="font-caption text-ink-muted">visualize</span>
          <h2 className="mt-1 text-balance font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Turn this document into a diagram.
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex-1">
              <div className="relative">
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  placeholder='e.g. "convert this chapter into a revision flowchart"'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      onGenerate()
                    }
                  }}
                  className="w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
                />
                <span className="pointer-events-none absolute right-3 bottom-3 hidden font-mono text-[0.65rem] text-ink-faint sm:inline">
                  ⌘+Enter to generate
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <StyleChips value={style} onChange={setStyle} />
              </div>
            </div>
            <div className="sm:w-44 sm:shrink-0">
              <Button
                onClick={onGenerate}
                loading={busy}
                size="lg"
                className="h-12 w-full"
              >
                {!busy && (
                  <svg viewBox="0 0 24 24" className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3v4M3 5h4M19 17v4M17 19h4M11 11l5-5M13 13l-5 5" />
                  </svg>
                )}
                Generate
              </Button>
              {active && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onDownload}
                  className="mt-2 w-full"
                >
                  <svg viewBox="0 0 24 24" className="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12M5 12l7 7 7-7M5 21h14" />
                  </svg>
                  Download SVG
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 overflow-hidden p-4 sm:p-6">
        <div className="min-w-0 flex-1 overflow-auto">
          {history === null ? (
            <Skeleton className="h-[360px] w-full rounded-xl" />
          ) : !active ? (
            <EmptyState examples={EXAMPLE_PROMPTS} onPick={onUseExample} />
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[0.95rem] font-medium text-ink">{active.title}</div>
                  <div className="mt-0.5 text-[0.7rem] text-ink-muted">
                    <span className="font-mono uppercase tracking-[0.08em]">{active.diagram_type}</span>
                    {active.style && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{active.style}</span>
                      </>
                    )}
                    <span className="mx-1.5">·</span>
                    <span>{relativeTime(active.created_at)}</span>
                  </div>
                  <div className="mt-1 text-xs italic text-ink-faint">
                    “{active.prompt}”
                  </div>
                </div>
              </div>
              <MermaidRenderer
                code={active.mermaid}
                title={active.title}
                onSvg={(svg) => { lastSvgRef.current = svg }}
              />
            </div>
          )}
        </div>

        {/* Sidebar of past visuals */}
        {showRail && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.015] p-2 sm:block">
            <div className="px-2 pb-2 pt-1 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
              History
            </div>
            <ul className="space-y-1">
              <AnimatePresence initial={false}>
                {(history || []).map((v) => {
                  const isActive = active?.visual_id === v.visual_id
                  return (
                    <motion.li
                      key={v.visual_id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      className="group relative"
                    >
                      <button
                        onClick={() => setActive(v)}
                        className={[
                          'block w-full rounded-lg px-3 py-2 text-left transition-colors',
                          isActive ? 'bg-accent-purple/[0.10] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                        ].join(' ')}
                      >
                        <div className="line-clamp-1 text-[0.8125rem] font-medium">{v.title}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-ink-faint">
                          <span className="font-mono uppercase tracking-[0.08em]">{v.diagram_type}</span>
                          <span aria-hidden>·</span>
                          <span>{relativeTime(v.created_at)}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(v) }}
                        aria-label="Delete diagram"
                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-faint opacity-0 transition-opacity hover:bg-accent-rose/[0.10] hover:text-accent-rose group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </aside>
        )}
      </div>

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this diagram?"
        description={confirmDelete ? `"${confirmDelete.title}" will be removed. You can always regenerate it later.` : undefined}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={performDelete}>Delete</Button>
        </div>
      </Dialog>
    </div>
  )
}

function EmptyState({ examples, onPick }) {
  return (
    <div className="grid h-full place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-pill bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 text-accent-purple-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M9 6h6M6 9v6M18 9v6M9 18h6" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          No diagrams yet for this document.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          Type what you'd like to see — a flowchart, mind map, roadmap, sequence — and EchoVerse will draw it from your notes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => onPick(ex)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-[0.75rem] text-ink-muted transition-colors hover:border-white/[0.14] hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
