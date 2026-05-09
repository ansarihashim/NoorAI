import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { deleteDocument, listDocuments } from '../lib/api.js'
import { useToast } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import Pill from '../components/ui/Pill.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import Dialog from '../components/ui/Dialog.jsx'

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  const d = new Date(ts * 1000)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const SORTS = [
  { value: 'recent', label: 'Recent' },
  { value: 'title', label: 'A–Z' },
  { value: 'size', label: 'Largest' },
]

export default function Library() {
  const [docs, setDocs] = useState(null) // null=loading, [] = empty
  const [sort, setSort] = useState('recent')
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await listDocuments()
        if (!cancelled) setDocs(data)
      } catch (err) {
        if (!cancelled) toast.error('Library failed to load', err?.message)
      }
    })()
    return () => { cancelled = true }
  }, [toast])

  const sorted = useMemo(() => {
    if (!docs) return null
    const list = [...docs]
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'size') list.sort((a, b) => b.n_chunks - a.n_chunks)
    else list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    return list
  }, [docs, sort])

  async function performDelete() {
    if (!confirm) return
    setDeleting(true)
    try {
      await deleteDocument(confirm.id)
      setDocs((cur) => cur?.filter((d) => d.id !== confirm.id) ?? null)
      toast.success('Deleted', confirm.title)
      setConfirm(null)
    } catch (err) {
      toast.error("Couldn't delete", err?.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between gap-3"
      >
        <div>
          <span className="font-caption text-ink-muted">your library</span>
          <h1 className="mt-2 font-display text-title text-ink">Everything you've uploaded.</h1>
        </div>
        <Button as={Link} to="/app" variant="secondary" size="md">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New document
        </Button>
      </motion.div>

      {sorted && sorted.length > 0 && (
        <div className="mt-6 flex items-center gap-1 rounded-pill border border-white/[0.06] bg-white/[0.03] p-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={[
                'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
                sort === s.value ? 'bg-white/[0.10] text-ink' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {docs === null && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass space-y-3 p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {docs !== null && docs.length === 0 && (
          <div className="rounded-card border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-pill bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 text-accent-purple-soft ring-1 ring-white/[0.06]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7M3 7l9 4M21 7l-9 4M12 11v10" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-medium text-ink">Nothing here yet.</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
              Drop your first document to start a session. It'll show up here for later.
            </p>
            <Button as={Link} to="/app" className="mt-6">
              Upload something
            </Button>
          </div>
        )}

        {sorted && sorted.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {sorted.map((d) => (
                <motion.li
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="glass group relative p-5"
                >
                  <button
                    onClick={() => navigate(`/app/session/${d.id}`)}
                    className="block w-full text-left"
                  >
                    <h3 className="line-clamp-2 pr-10 text-[0.95rem] font-medium text-ink">{d.title}</h3>
                    <p className="mt-1 font-mono text-[0.7rem] text-ink-faint">{d.id}</p>
                    <div className="mt-3 flex items-center gap-2 text-[0.7rem] text-ink-muted">
                      <span>{formatRelative(d.created_at)}</span>
                      <span aria-hidden>·</span>
                      <span>{d.n_chunks} chunks</span>
                      {d.has_podcast && (
                        <>
                          <span aria-hidden>·</span>
                          <Pill tone="cyan" size="sm">Podcast ready</Pill>
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirm(d)
                    }}
                    aria-label="Delete document"
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-pill text-ink-faint opacity-0 transition-opacity hover:bg-accent-rose/[0.10] hover:text-accent-rose group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => !deleting && setConfirm(null)}
        title="Delete this document?"
        description={confirm ? `"${confirm.title}" and any generated podcast will be removed. This cannot be undone.` : undefined}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" loading={deleting} onClick={performDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
