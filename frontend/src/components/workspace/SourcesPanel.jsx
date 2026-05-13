import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from './WorkspaceContext.jsx'
import { useSound } from '../../lib/sound.jsx'

/**
 * Left rail — sources library.
 * Visual: solid surface, generous spacing, refined hover (subtle lift only),
 * amber active treatment via a thin left bar + tinted bg + bright text.
 */
export default function SourcesPanel() {
  const { docs, activeScope, toggleSource, openUploadDialog } = useWorkspace()
  const { play } = useSound()
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
      {/* Header — framed as a notebook index, not a generic file list */}
      <div className="border-b border-rule px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[0.6rem] font-mono font-semibold uppercase tracking-[0.18em] text-accent">
              Notebook
            </span>
            <span className="mt-0.5 block font-serif text-[0.92rem] font-semibold text-ink">
              Index
            </span>
          </div>
          <button
            type="button"
            onClick={() => { play('tap'); openUploadDialog() }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-dim transition-colors duration-150 hover:bg-elevated hover:text-ink"
            title="Add a page"
            aria-label="Add a page"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[0.7rem] leading-snug text-ink-dim">
          Pages of your study notebook · check to add to scope.
        </p>
      </div>

      {/* Search — fixed-layout pill input. The clear button slot is ALWAYS
          present (visibility-toggled, not conditionally rendered) so the
          input width never jumps mid-typing. The focus ring is a box-shadow,
          which doesn't push siblings around either. */}
      <div className="px-3 pb-2 pt-3">
        <div
          className={[
            'flex h-9 items-center gap-2 rounded-lg border bg-page px-3 transition-[border-color,box-shadow] duration-150',
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
            className="h-full min-w-0 flex-1 bg-transparent text-[0.82rem] text-ink placeholder:text-ink-faint outline-none"
            aria-label="Search pages"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            tabIndex={query ? 0 : -1}
            className={[
              'inline-flex h-4 w-4 shrink-0 items-center justify-center text-ink-dim transition-opacity duration-150 hover:text-ink',
              query ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <ul className="min-h-0 flex-1 overflow-y-auto pb-2 pt-1">
        {docs === null && (
          <li className="px-4 py-3 text-[0.82rem] text-ink-dim">Loading…</li>
        )}
        {docs !== null && docs.length === 0 && (
          <li className="px-4 py-8 text-center">
            <p className="text-[0.82rem] text-ink-muted">Notebook is blank.</p>
            <button
              type="button"
              onClick={() => { play('tap'); openUploadDialog() }}
              className="mt-3 inline-block text-[0.82rem] font-medium text-accent transition-colors hover:text-accent-soft"
            >
              Add the first page
            </button>
          </li>
        )}
        {filtered && filtered.length === 0 && docs?.length > 0 && (
          <li className="px-4 py-3 text-[0.82rem] text-ink-dim">No matches for &ldquo;{query}&rdquo;.</li>
        )}
        {filtered && filtered.map((doc, i) => (
          <SourceRow
            key={doc.id}
            doc={doc}
            index={i + 1}
            active={doc.id === activeDocId}
            inScope={activeScope.has(doc.id)}
            onOpen={() => { play('page'); navigate(`/app/session/${doc.id}`) }}
            onToggleScope={() => { play('tap'); toggleSource(doc.id) }}
          />
        ))}
      </ul>

      {/* Footer — pages currently in study scope */}
      {activeScope.size > 0 && (
        <div className="border-t border-rule px-4 py-2.5 text-[0.74rem] text-ink-dim">
          <span className="font-medium text-ink-muted">{activeScope.size}</span>
          {' '}page{activeScope.size === 1 ? '' : 's'} in study scope
        </div>
      )}
    </div>
  )
}

function SourceRow({ doc, index, active, inScope, onOpen, onToggleScope }) {
  // Two-digit zero-padded index, like a TOC: 01, 02, … This is a small
  // visual cue that turns the rail from "files" into "pages of a notebook".
  // We render as a plain <li> (no FLIP animation) so search-filter typing
  // is a calm show/hide rather than an animated reorder cascade.
  const tocIdx = String(index).padStart(2, '0')
  return (
    <li
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
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={[
              'shrink-0 font-mono text-[0.66rem] tabular-nums tracking-[0.06em]',
              active ? 'text-accent' : 'text-ink-faint group-hover:text-ink-dim',
            ].join(' ')}
          >
            {tocIdx}
          </span>
          <div
            className={[
              'truncate text-[0.875rem] leading-snug',
              active ? 'font-semibold text-accent' : 'font-medium text-ink-muted group-hover:text-ink',
            ].join(' ')}
          >
            {doc.title || 'Untitled'}
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 pl-7 text-[0.72rem] text-ink-dim">
          <span>{doc.n_chunks} ¶</span>
          {doc.has_podcast && (
            <>
              <span aria-hidden className="text-ink-faint">·</span>
              <span>discussion</span>
            </>
          )}
        </div>
      </button>
    </li>
  )
}
