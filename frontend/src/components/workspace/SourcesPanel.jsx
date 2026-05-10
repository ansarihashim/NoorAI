import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWorkspace } from './WorkspaceContext.jsx'

/**
 * Left rail — sources library.
 * Visual: solid surface, generous spacing, refined hover (subtle lift only),
 * amber active treatment via a thin left bar + tinted bg + bright text.
 */
export default function SourcesPanel() {
  const { docs, activeScope, toggleSource } = useWorkspace()
  const params = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const activeDocId = params.docId

  const filtered = useMemo(() => {
    if (!docs) return null
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => (d.title || '').toLowerCase().includes(q))
  }, [docs, query])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          Sources
        </span>
        <Link
          to="/app"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-dim transition-colors duration-150 hover:bg-elevated hover:text-ink"
          title="Add a source"
          aria-label="Add a source"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      {/* Search — refined pill input */}
      <div className="px-3 pb-2 pt-3">
        <div
          className={[
            'flex h-9 items-center gap-2 rounded-lg border bg-page px-3 transition-colors duration-150',
            searchFocused
              ? 'border-accent shadow-[0_0_0_3px_rgba(255,214,10,0.20)]'
              : 'border-rule hover:border-rule-strong',
          ].join(' ')}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search sources"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="h-full w-full bg-transparent text-[0.82rem] text-ink placeholder:text-ink-faint outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-ink-dim transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <ul className="min-h-0 flex-1 overflow-y-auto pb-2 pt-1">
        {docs === null && (
          <li className="px-4 py-3 text-[0.82rem] text-ink-dim">Loading…</li>
        )}
        {docs !== null && docs.length === 0 && (
          <li className="px-4 py-8 text-center">
            <p className="text-[0.82rem] text-ink-muted">No sources yet.</p>
            <Link
              to="/app"
              className="mt-3 inline-block text-[0.82rem] font-medium text-accent transition-colors hover:text-accent-soft"
            >
              Add your first
            </Link>
          </li>
        )}
        {filtered && filtered.length === 0 && docs?.length > 0 && (
          <li className="px-4 py-3 text-[0.82rem] text-ink-dim">No matches for &ldquo;{query}&rdquo;.</li>
        )}
        {filtered && filtered.map((doc) => (
          <SourceRow
            key={doc.id}
            doc={doc}
            active={doc.id === activeDocId}
            inScope={activeScope.has(doc.id)}
            onOpen={() => navigate(`/app/session/${doc.id}`)}
            onToggleScope={() => toggleSource(doc.id)}
          />
        ))}
      </ul>

      {/* Footer */}
      {activeScope.size > 0 && (
        <div className="border-t border-rule px-4 py-2.5 text-[0.74rem] text-ink-dim">
          <span className="font-medium text-ink-muted">{activeScope.size}</span>
          {' '}in study scope
        </div>
      )}
    </div>
  )
}

function SourceRow({ doc, active, inScope, onOpen, onToggleScope }) {
  return (
    <motion.li
      layout="position"
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className={[
        'group relative flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors duration-150',
        active ? 'bg-elevated' : 'hover:bg-elevated/70',
      ].join(' ')}
    >
      {/* active left bar */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent"
        />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleScope() }}
        title={inScope ? 'Remove from study scope' : 'Add to study scope'}
        aria-pressed={inScope}
        className={[
          'mt-[3px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150',
          inScope
            ? 'border-accent bg-accent text-page'
            : 'border-rule-strong bg-transparent text-transparent group-hover:border-ink-dim',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div
          className={[
            'truncate text-[0.875rem] leading-snug',
            active ? 'font-semibold text-accent' : 'font-medium text-ink-muted group-hover:text-ink',
          ].join(' ')}
        >
          {doc.title || 'Untitled'}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[0.72rem] text-ink-dim">
          <span>{doc.n_chunks} ¶</span>
          {doc.has_podcast && (
            <>
              <span aria-hidden className="text-ink-faint">·</span>
              <span>discussion</span>
            </>
          )}
        </div>
      </button>
    </motion.li>
  )
}
