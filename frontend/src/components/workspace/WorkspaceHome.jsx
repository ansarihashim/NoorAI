import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/auth.jsx'
import { useWorkspace } from './WorkspaceContext.jsx'
import UploadCard from '../dashboard/UploadCard.jsx'

/**
 * The center column when no document is open. Calm, single-column,
 * reading-first. Replaces the old Dashboard's hero + grid + upload stack.
 */
export default function WorkspaceHome() {
  const { user } = useAuth()
  const { docs, refreshDocs } = useWorkspace()
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

  function onUploaded(res) {
    refreshDocs().then(() => navigate(`/app/session/${res.doc_id}`, { state: { doc: res, fresh: true } }))
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 pb-16 pt-12">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="eyebrow">workspace</span>
        <h1 className="mt-2 font-serif text-display text-ink">
          {greeting}{firstName ? <span className="text-ink-muted">, {firstName}</span> : ''}.
        </h1>
        <p className="mt-3 max-w-xl font-serif text-prose text-ink-muted">
          Add a source on the left, or drop one in below. Once a source is open, choose a mode —
          Preparation, Revision, Podcast, or Narration — to study it.
        </p>
      </motion.div>

      {continueDoc && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => navigate(`/app/session/${continueDoc.doc.id}`)}
          className="group mt-8 flex w-full items-center gap-3 rounded-md border border-rule bg-raised px-4 py-3 text-left transition-colors hover:bg-elevated"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-page">
            <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px]" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">continue</div>
            <div className="mt-0.5 truncate font-serif text-[0.9375rem] text-ink">{continueDoc.doc.title}</div>
            <div className="text-[0.78rem] text-ink-dim">
              {continueDoc.pos.mode === 'podcast'
                ? `Discussion · turn ${(continueDoc.pos.podcastIdx ?? 0) + 1}`
                : `Reading · paragraph ${(continueDoc.pos.narrationIdx ?? 0) + 1}`}
            </div>
          </div>
          <span className="text-[0.8125rem] text-ink-dim transition-colors group-hover:text-accent">Resume →</span>
        </motion.button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
      >
        <UploadCard onUploaded={onUploaded} />
      </motion.div>

      {docs && docs.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: 0.10 }}
          className="mt-12"
        >
          <div className="flex items-end justify-between border-b border-rule pb-2">
            <span className="eyebrow">recent</span>
            <Link to="/app/library" className="text-[0.8125rem] text-ink-dim transition-colors hover:text-accent">
              All sources →
            </Link>
          </div>
          <ul className="mt-1">
            {docs.slice(0, 5).map((d) => (
              <li key={d.id} className="border-b border-rule">
                <button
                  onClick={() => navigate(`/app/session/${d.id}`)}
                  className="group flex w-full items-baseline justify-between gap-4 py-3 text-left"
                >
                  <span className="truncate font-serif text-[1rem] font-medium text-ink-muted group-hover:text-accent">
                    {d.title || 'Untitled'}
                  </span>
                  <span className="shrink-0 text-[0.78rem] text-ink-dim">{d.n_chunks} ¶</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </div>
  )
}
