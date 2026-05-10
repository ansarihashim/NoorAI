import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DocPicker from './DocPicker.jsx'
import OverviewView from './OverviewView.jsx'
import ImportantQuestionsView from './ImportantQuestionsView.jsx'
import ExplanationView from './ExplanationView.jsx'

const SUB_TABS = [
  { value: 'overview',    label: 'Overview' },
  { value: 'questions',   label: 'Important Qs' },
  { value: 'explanation', label: 'Simplest Explanation' },
]

/**
 * Top-level Preparation tab. Three sub-features all share the same multi-doc
 * selection — pick docs once, then switch between modes.
 */
export default function PreparationView({ activeDocId }) {
  const [tab, setTab] = useState('overview')
  // Initialize with the active doc selected by default.
  const [docIds, setDocIds] = useState(() => (activeDocId ? [activeDocId] : []))
  const [pickerOpen, setPickerOpen] = useState(false)

  const summary =
    docIds.length === 0
      ? 'no documents selected'
      : docIds.length === 1
        ? '1 document'
        : `${docIds.length} documents`

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab strip — text-link style with amber underline */}
      <div className="border-b border-rule px-5 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-5 overflow-x-auto">
            {SUB_TABS.map((t) => {
              const active = tab === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className="relative shrink-0 py-1.5 text-[0.8125rem] font-medium transition-colors"
                >
                  <span className={active ? 'text-ink' : 'text-ink-muted hover:text-ink'}>
                    {t.label}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="prep-tab-underline"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-x-0 -bottom-[9px] h-[2px] bg-accent"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-rule bg-elevated px-3 py-1.5 text-[0.75rem] text-ink-muted transition-colors hover:bg-float hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            <span className="font-mono tabular-nums">{summary}</span>
            <motion.svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              animate={{ rotate: pickerOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M6 9l6 6 6-6" />
            </motion.svg>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {pickerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-5xl overflow-hidden"
            >
              <div className="pt-3">
                <DocPicker
                  activeDocId={activeDocId}
                  value={docIds}
                  onChange={setDocIds}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {docIds.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="max-w-sm text-sm text-ink-muted">
                Pick one or more documents above to begin.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {tab === 'overview' && <OverviewView docIds={docIds} />}
                {tab === 'questions' && <ImportantQuestionsView docIds={docIds} />}
                {tab === 'explanation' && <ExplanationView docIds={docIds} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
