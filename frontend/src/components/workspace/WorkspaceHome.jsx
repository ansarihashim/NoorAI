import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/auth.jsx'
import { useSound } from '../../lib/sound.jsx'
import { useWorkspace } from './WorkspaceContext.jsx'
import UploadCard from '../dashboard/UploadCard.jsx'
import {
  NotebookEyebrow,
  NotebookChip,
} from '../ui/NotebookSurface.jsx'

/**
 * The workspace home reads as the inside cover of a notebook.
 *  - Title page block: greeting, scholarly subtitle, today's date.
 *  - Resume strip ("bookmark"): if the user was mid-page, restore them.
 *  - "New page" upload card.
 *  - "Recent pages" — a TOC list of sources, numbered.
 */
export default function WorkspaceHome() {
  const { user } = useAuth()
  const { docs, refreshDocs } = useWorkspace()
  const { play } = useSound()
  const navigate = useNavigate()
  const [continueDoc, setContinueDoc] = useState(null)

  // Resolve the most-recent in-progress doc from localStorage positions.
  useEffect(() => {
    if (!docs) return
    let positions = {}
    try { positions = JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}') } catch { /* no-op */ }
    const candidates = Object.entries(positions)
      .map(([docId, pos]) => ({ docId, pos }))
      .filter(({ pos }) => pos && pos.updatedAt)
      .sort((a, b) => b.pos.updatedAt - a.pos.updatedAt)
    for (const { docId, pos } of candidates) {
      const found = docs.find((d) => d.id === docId)
      if (found) {
        const meaningful =
          (pos.mode === 'narration' && (pos.narrationIdx > 0 || (pos.narrationTime || 0) > 4)) ||
          (pos.mode === 'podcast'   && (pos.podcastIdx   > 0 || (pos.podcastTime   || 0) > 4))
        if (meaningful) setContinueDoc({ doc: found, pos })
        return
      }
    }
  }, [docs])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()
  const firstName = (user?.display_name || user?.email?.split('@')[0] || '').split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  function onUploaded(res) {
    play('page')
    refreshDocs().then(() => navigate(`/app/session/${res.doc_id}`, { state: { doc: res, fresh: true } }))
  }

  return (
    <div className="relative mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
      {/* faint paper rule on the home column too — keeps the notebook feel
          even when no source is open */}
      <span aria-hidden className="notebook-rule pointer-events-none absolute inset-0 -z-10" />

      {/* === Title page ============================================== */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <NotebookEyebrow accent>Volume i · workspace</NotebookEyebrow>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink-faint">
            {today}
          </span>
        </div>
        <h1 className="mt-3 break-words font-serif text-[clamp(1.6rem,7vw,2.8rem)] font-semibold leading-[1.08] tracking-tight text-ink">
          {greeting}{firstName ? <span className="text-ink-muted">, {firstName}</span> : ''}.
        </h1>
        <p className="mt-3 max-w-xl font-serif text-[clamp(0.95rem,2.6vw,1.05rem)] leading-[1.6] text-ink-muted">
          Add a page on the left, or open a new one below. Once a page is open,
          choose a study mode — Preparation, Revision, Podcast, or Narration —
          to illuminate it.
        </p>
      </motion.header>

      {/* === Bookmark strip — resume an in-progress page ============== */}
      {continueDoc && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => { play('page'); navigate(`/app/session/${continueDoc.doc.id}`) }}
          className="group relative mt-8 flex w-full items-center gap-3 overflow-hidden rounded-md border border-rule bg-raised px-3 py-3 text-left transition-colors hover:border-rule-strong hover:bg-elevated sm:gap-4 sm:px-4 sm:py-3.5"
        >
          {/* yellow page-corner triangle (the bookmark) */}
          <span aria-hidden className="pointer-events-none absolute right-0 top-0">
            <svg width="28" height="28" viewBox="0 0 28 28" className="block">
              <path d="M28 0 H0 L28 28 Z" fill="rgba(255,214,10,0.10)" />
              <path d="M28 0 L28 28 L18 18 Z" fill="#FFD60A" opacity="0.35" />
            </svg>
          </span>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-page">
            <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px]" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="nb-eyebrow">bookmark · resume</div>
            <div className="mt-0.5 truncate font-serif text-[1rem] text-ink">{continueDoc.doc.title}</div>
            <div className="text-[0.78rem] text-ink-dim">
              {continueDoc.pos.mode === 'podcast'
                ? `Discussion · turn ${(continueDoc.pos.podcastIdx ?? 0) + 1}`
                : `Reading · paragraph ${(continueDoc.pos.narrationIdx ?? 0) + 1}`}
            </div>
          </div>
          <span className="hidden shrink-0 text-[0.82rem] text-ink-dim transition-colors group-hover:text-accent sm:inline">
            Resume →
          </span>
        </motion.button>
      )}

      {/* === New page — upload =========================================== */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12"
      >
        <div className="flex items-end justify-between">
          <NotebookEyebrow>new page</NotebookEyebrow>
        </div>
        <div className="mt-3">
          <UploadCard onUploaded={onUploaded} />
        </div>
      </motion.section>

      {/* === Recent pages — TOC-style listing ============================= */}
      {docs && docs.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: 0.10 }}
          className="mt-14"
        >
          <div className="flex items-end justify-between border-b border-rule pb-2.5">
            <NotebookEyebrow>recent pages</NotebookEyebrow>
            <Link
              to="/app/library"
              onClick={() => play('tap')}
              className="text-[0.8rem] text-ink-dim transition-colors hover:text-accent"
            >
              Full index →
            </Link>
          </div>
          <ul className="mt-1 divide-y divide-rule">
            {docs.slice(0, 6).map((d, i) => (
              <li key={d.id}>
                <button
                  onClick={() => { play('page'); navigate(`/app/session/${d.id}`) }}
                  className="group flex w-full items-baseline gap-4 py-3 text-left"
                >
                  <span className="shrink-0 font-mono text-[0.72rem] tabular-nums tracking-wider text-ink-faint group-hover:text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-serif text-[1rem] font-medium text-ink-muted group-hover:text-accent">
                    {d.title || 'Untitled'}
                  </span>
                  <span className="hidden shrink-0 text-[0.74rem] text-ink-dim sm:inline">
                    {d.n_chunks} ¶
                  </span>
                  {d.has_podcast && <NotebookChip>discussion</NotebookChip>}
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </div>
  )
}
