import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from './WorkspaceContext.jsx'

/**
 * Right rail. Mode-contextual AI actions. Replaces the old "Visualize" page —
 * visual generation now appears here (Generate Flowchart / Mind Map) inside
 * the active mode's action set, never as a standalone destination.
 *
 * The action list is purely declarative. When clicked, an action either:
 *   - flips a query param (?action=generate-flashcards) for the active mode
 *     view to consume, or
 *   - navigates to a different mode and pre-arms it.
 *
 * Mode views opt in by reading useSearchParams().get('action') in their
 * effect chain.
 */

const ACTIONS_BY_MODE = {
  preparation: [
    { group: 'Analyse',  items: [
      { id: 'overview',           label: 'Generate overview' },
      { id: 'important-questions',label: 'Important questions' },
      { id: 'predict-paper',      label: 'Predict the paper' },
      { id: 'topic-relationships',label: 'Topic relationships' },
    ]},
    { group: 'Visualise', items: [
      { id: 'visual-syllabus-map',label: 'Syllabus mind map' },
      { id: 'visual-dependency',  label: 'Dependency graph' },
    ]},
    { group: 'Explain',  items: [
      { id: 'simplify-topic',     label: 'Simplify a topic' },
      { id: 'analogy',            label: 'Generate an analogy' },
    ]},
  ],
  revision: [
    { group: 'Practice', items: [
      { id: 'generate-flashcards',label: 'Generate flashcards' },
      { id: 'start-quiz',         label: 'Start quiz' },
      { id: 'active-recall',      label: 'Active recall' },
      { id: 'viva-prep',          label: 'Viva prep' },
    ]},
    { group: 'Cram',     items: [
      { id: 'quick-revision',     label: 'Quick revision' },
      { id: 'night-before',       label: 'Night-before pack' },
    ]},
    { group: 'Visualise', items: [
      { id: 'visual-summary',     label: 'Visual summary' },
      { id: 'visual-flowchart',   label: 'Generate flowchart' },
    ]},
  ],
  podcast: [
    { group: 'Audio',    items: [
      { id: 'generate-podcast',   label: 'Generate discussion' },
      { id: 'regenerate-podcast', label: 'Regenerate' },
      { id: 'ask-doubt',          label: 'Ask a doubt',  emphasis: true },
    ]},
    { group: 'Explore',  items: [
      { id: 'extract-quotes',     label: 'Notable quotes' },
      { id: 'turn-summary',       label: 'Summarise this turn' },
    ]},
  ],
  narration: [
    { group: 'Audio',    items: [
      { id: 'start-narration',    label: 'Begin reading' },
      { id: 'ask-doubt',          label: 'Ask a doubt',  emphasis: true },
    ]},
    { group: 'Explore',  items: [
      { id: 'simplify-passage',   label: 'Simplify this passage' },
      { id: 'concept-map',        label: 'Map concepts on this page' },
      { id: 'ask-context',        label: 'Ask about this section' },
    ]},
  ],
  // Fallback when no doc / mode is active.
  null: [
    { group: 'Get started', items: [
      { id: 'upload',             label: 'Upload a source' },
    ]},
  ],
}

export default function AIStudioPanel({ mode }) {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeScope } = useWorkspace()

  const docId = params.docId
  const inSession = location.pathname.startsWith('/app/session/')
  const effectiveMode = inSession ? (mode || 'narration') : null
  const groups = ACTIONS_BY_MODE[effectiveMode] ?? ACTIONS_BY_MODE.null

  function runAction(actionId) {
    if (actionId === 'upload') {
      navigate('/app')
      return
    }
    // Mode views opt in by reading ?action=...
    const next = new URLSearchParams(searchParams)
    next.set('action', actionId)
    next.set('action_at', String(Date.now()))
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-dim">
          AI Studio
        </span>
        {effectiveMode && (
          <span className="rounded-md border border-rule bg-page px-2 py-0.5 text-[0.7rem] capitalize text-ink-muted">
            {effectiveMode}
          </span>
        )}
      </div>

      {/* When no doc loaded, show a tiny prompt instead of an empty panel. */}
      {!inSession && (
        <div className="px-4 py-4 text-[0.82rem] leading-relaxed text-ink-dim">
          <p>Pick a source on the left to see contextual actions here.</p>
          {activeScope.size > 1 && (
            <p className="mt-2 text-ink-muted">
              {activeScope.size} sources in scope — open one to study, or switch to Preparation mode for cross-source work.
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">
        {groups.map((g) => (
          <div key={g.group} className="mb-4">
            <div className="px-3 pb-1.5 pt-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              {g.group}
            </div>
            <ul>
              {g.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => runAction(item.id)}
                    className={[
                      'group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[0.86rem] transition-colors duration-150',
                      item.emphasis
                        ? 'font-semibold text-accent hover:bg-elevated hover:text-accent-soft'
                        : 'text-ink-muted hover:bg-elevated hover:text-ink',
                    ].join(' ')}
                  >
                    <span>{item.label}</span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3 translate-x-0 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
