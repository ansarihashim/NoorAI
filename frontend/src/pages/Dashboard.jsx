import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { listDocuments } from '../lib/api.js'
import UploadCard from '../components/dashboard/UploadCard.jsx'
import Pill from '../components/ui/Pill.jsx'
import Card from '../components/ui/Card.jsx'
import Onboarding from '../components/onboarding/Onboarding.jsx'

function loadAllPositions() {
  try {
    return JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}')
  } catch {
    return {}
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recent, setRecent] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [continueDoc, setContinueDoc] = useState(null) // { doc, position }

  // Pull a few recent documents from the backend so the dashboard shows real
  // user state instead of localStorage scraps.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const docs = await listDocuments()
        if (cancelled) return
        setRecent(docs.slice(0, 4))

        // Find the most recently played doc that still exists.
        const positions = loadAllPositions()
        const candidates = Object.entries(positions)
          .map(([docId, pos]) => ({ docId, pos }))
          .filter(({ pos }) => pos && pos.updatedAt)
          .sort((a, b) => b.pos.updatedAt - a.pos.updatedAt)
        for (const { docId, pos } of candidates) {
          const found = docs.find((d) => d.id === docId)
          if (found) {
            // Only show the card if there's a real position to resume.
            const hasPos =
              (pos.mode === 'narration' && (pos.narrationIdx > 0 || (pos.narrationTime || 0) > 4)) ||
              (pos.mode === 'podcast' && (pos.podcastIdx > 0 || (pos.podcastTime || 0) > 4))
            if (hasPos) {
              setContinueDoc({ doc: found, pos })
            }
            break
          }
        }
      } catch {
        if (!cancelled) setRecent([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    try {
      if (localStorage.getItem('echoverse.firstRun') === '1') {
        setShowOnboarding(true)
      }
    } catch { /* no-op */ }
  }, [])

  function dismissOnboarding() {
    try { localStorage.removeItem('echoverse.firstRun') } catch {}
    setShowOnboarding(false)
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const firstName = (user?.display_name || user?.email?.split('@')[0] || '').split(' ')[0]

  function onUploaded(res) {
    navigate(`/app/session/${res.doc_id}`, { state: { doc: res, fresh: true } })
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="font-caption text-ink-muted">welcome</span>
        <h1 className="mt-2 font-display text-title text-ink">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-ink-muted">
          Drop a document below — NoorAI will narrate it back, answer your questions, and (soon) generate a
          podcast-style discussion from it.
        </p>
      </motion.div>

      {continueDoc && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate(`/app/session/${continueDoc.doc.id}`)}
          className="group glass relative mt-8 flex w-full items-center gap-4 overflow-hidden p-4 text-left hover:shadow-lift"
        >
          <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan text-white shadow-glow">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-caption text-ink-muted">continue listening</div>
            <div className="mt-1 truncate text-[0.95rem] font-medium text-ink">{continueDoc.doc.title}</div>
            <div className="mt-0.5 text-[0.7rem] text-ink-faint">
              {continueDoc.pos.mode === 'podcast'
                ? `Podcast · turn ${(continueDoc.pos.podcastIdx ?? 0) + 1}`
                : `Narration · ¶ ${(continueDoc.pos.narrationIdx ?? 0) + 1}`}
            </div>
          </div>
          <span className="hidden text-xs text-ink-muted transition-colors group-hover:text-ink sm:inline">
            Resume
          </span>
        </motion.button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="mt-10"
      >
        <UploadCard onUploaded={onUploaded} />
      </motion.div>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-14"
      >
        <div className="flex items-center justify-between">
          <span className="font-caption text-ink-muted">your library</span>
          {recent && recent.length > 0 && (
            <Link to="/app/library" className="text-xs text-ink-muted hover:text-ink">
              View all →
            </Link>
          )}
        </div>

        {recent === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="glass space-y-3 p-5">
                <div className="shimmer h-3 w-2/3 rounded" />
                <div className="shimmer h-2 w-1/3 rounded" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="mt-4 rounded-card border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-pill bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 text-accent-purple-soft ring-1 ring-white/[0.06]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7M3 7l9 4M21 7l-9 4M12 11v10" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-medium text-ink">Your library is quiet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
              The first document you upload will appear here, ready to listen back to in one tap.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recent.map((doc) => (
              <Card
                key={doc.id}
                interactive
                onClick={() => navigate(`/app/session/${doc.id}`)}
                className="cursor-pointer p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-[0.95rem] font-medium text-ink">{doc.title || 'Untitled'}</h3>
                    <p className="mt-1 font-mono text-[0.7rem] text-ink-faint">{doc.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Pill tone="purple" size="sm">
                      {doc.n_chunks} ¶
                    </Pill>
                    {doc.has_podcast && (
                      <Pill tone="cyan" size="sm">
                        Podcast
                      </Pill>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.section>

      {showOnboarding && <Onboarding onClose={dismissOnboarding} />}
    </div>
  )
}
