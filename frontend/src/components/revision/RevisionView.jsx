import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import FlashcardsView from './FlashcardsView.jsx'
import QuizView from './QuizView.jsx'
import ActiveRecallView from './ActiveRecallView.jsx'
import QuickRevisionView from './QuickRevisionView.jsx'
import NightBeforeView from './NightBeforeView.jsx'
import VivaView from './VivaView.jsx'

const SUB_TABS = [
  { value: 'flashcards', label: 'Flashcards',     hint: 'Tap to flip · ←/→ to move' },
  { value: 'quiz',       label: 'Quiz',           hint: 'Multiple choice · timed' },
  { value: 'recall',     label: 'Active Recall',  hint: 'Think first · then reveal' },
  { value: 'quick',      label: 'Quick Revision', hint: 'TL;DR for fast passes' },
  { value: 'night',      label: 'Night Before',   hint: 'High-yield essentials' },
  { value: 'viva',       label: 'Viva',           hint: 'Spoken oral practice' },
]

// AI-Studio right-rail action ids → revision sub-tab + auto-generate flag.
const ACTION_TO_TAB = {
  'generate-flashcards': { tab: 'flashcards', generate: true  },
  'start-quiz':          { tab: 'quiz',       generate: true  },
  'active-recall':       { tab: 'recall',     generate: true  },
  'viva-prep':           { tab: 'viva',       generate: true  },
  'quick-revision':      { tab: 'quick',      generate: true  },
  'night-before':        { tab: 'night',      generate: true  },
}

export default function RevisionView({ docId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState('flashcards')
  const [actionSignal, setActionSignal] = useState(null)
  const activeMeta = SUB_TABS.find((t) => t.value === tab)

  // Listen for ?action=... pings from the AI Studio rail.
  useEffect(() => {
    const action = searchParams.get('action')
    if (!action) return
    const at = searchParams.get('action_at') || ''
    const map = ACTION_TO_TAB[action]
    if (map) {
      setTab(map.tab)
      setActionSignal({ action, at, generate: map.generate })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    next.delete('action_at')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-rule px-5 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
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
                      layoutId="revision-tab-underline"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-x-0 -bottom-[9px] h-[2px] bg-accent"
                    />
                  )}
                </button>
              )
            })}
          </div>
          <div className="hidden text-[0.7rem] text-ink-faint md:inline">
            {activeMeta?.hint}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'flashcards' && <FlashcardsView docId={docId} action={actionSignal} />}
              {tab === 'quiz' && <QuizView docId={docId} action={actionSignal} />}
              {tab === 'recall' && <ActiveRecallView docId={docId} action={actionSignal} />}
              {tab === 'quick' && <QuickRevisionView docId={docId} action={actionSignal} />}
              {tab === 'night' && <NightBeforeView docId={docId} action={actionSignal} />}
              {tab === 'viva' && <VivaView docId={docId} action={actionSignal} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
