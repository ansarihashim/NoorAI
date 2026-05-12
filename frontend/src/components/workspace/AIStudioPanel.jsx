import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from './WorkspaceContext.jsx'
import { useSound } from '../../lib/sound.jsx'
import { NotebookEyebrow } from '../ui/NotebookSurface.jsx'

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
  ],
  podcast: [
    { group: 'Audio',    items: [
      { id: 'generate-podcast',   label: 'Generate discussion' },
      { id: 'regenerate-podcast', label: 'Regenerate' },
    ]},
  ],
  narration: [],
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
  const { play } = useSound()

  const docId = params.docId
  const inSession = location.pathname.startsWith('/app/session/')
  const effectiveMode = inSession ? (mode || 'narration') : null
  const groups = ACTIONS_BY_MODE[effectiveMode] ?? ACTIONS_BY_MODE.null

  function runAction(actionId) {
    play('tap')
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
      {/* Header — AI Studio is the cognitive layer of the workspace */}
      <div className="border-b border-rule px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <NotebookEyebrow accent>cognitive layer</NotebookEyebrow>
            <div className="mt-0.5 font-serif text-[0.92rem] font-semibold text-ink">
              AI Studio
            </div>
          </div>
          {effectiveMode && (
            <span className="nb-chip">{effectiveMode}</span>
          )}
        </div>
      </div>

      {/* Empty state — written like a scholar's instruction */}
      {!inSession && (
        <div className="border-b border-rule px-4 py-5 text-[0.84rem] leading-relaxed text-ink-dim">
          <p>Open a page on the left, then choose a study mode — actions for that mode appear here.</p>
          {activeScope.size > 1 && (
            <p className="mt-2 text-ink-muted">
              <span className="font-medium text-ink">{activeScope.size} pages</span>
              {' '}in scope — open any to study, or switch to Preparation for cross-source work.
            </p>
          )}
        </div>
      )}

      {/* Scrollable annotation list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-3">
        {groups.map((g, gi) => (
          <section key={g.group} className="mb-5">
            <div className="flex items-baseline gap-3 px-1 pb-2">
              <span className="font-mono text-[0.62rem] font-semibold tabular-nums tracking-wider text-ink-faint">
                §{String(gi + 1).padStart(2, '0')}
              </span>
              <NotebookEyebrow>{g.group}</NotebookEyebrow>
              <span aria-hidden className="ml-auto h-px flex-1 translate-y-[1px] bg-rule/70" />
            </div>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => runAction(item.id)}
                    className={[
                      'group relative flex w-full items-center justify-between rounded-md py-2 pl-3 pr-2.5 text-left text-[0.88rem] transition-colors duration-150',
                      item.emphasis
                        ? 'font-semibold text-accent hover:bg-accent/[0.07]'
                        : 'text-ink-muted hover:bg-elevated hover:text-ink',
                    ].join(' ')}
                  >
                    {/* yellow margin tick — only visible on hover, like a fresh
                        highlight running down the side of a page */}
                    <span
                      aria-hidden
                      className={[
                        'pointer-events-none absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-opacity duration-150',
                        item.emphasis ? 'bg-accent opacity-100' : 'bg-accent opacity-0 group-hover:opacity-100',
                      ].join(' ')}
                    />
                    <span className="flex items-center gap-2">
                      {item.emphasis && (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                      {item.label}
                    </span>
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
          </section>
        ))}
      </div>
    </div>
  )
}
