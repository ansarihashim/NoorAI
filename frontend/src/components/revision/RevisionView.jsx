import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import FlashcardsView from './FlashcardsView.jsx'
import QuizView from './QuizView.jsx'
import ActiveRecallView from './ActiveRecallView.jsx'
import QuickRevisionView from './QuickRevisionView.jsx'
import NightBeforeView from './NightBeforeView.jsx'
import VivaView from './VivaView.jsx'
import VisualRevisionView from './VisualRevisionView.jsx'

const SUB_TABS = [
  { value: 'flashcards', label: 'Flashcards',     hint: 'Tap to flip · ←/→ to move' },
  { value: 'quiz',       label: 'Quiz',           hint: 'Multiple choice · timed' },
  { value: 'recall',     label: 'Active Recall',  hint: 'Think first · then reveal' },
  { value: 'quick',      label: 'Quick Revision', hint: 'TL;DR for fast passes' },
  { value: 'night',      label: 'Night Before',   hint: 'High-yield essentials' },
  { value: 'visual',     label: 'Visual',         hint: 'Concept maps · diagrams' },
  { value: 'viva',       label: 'Viva',           hint: 'Spoken oral practice' },
]

export default function RevisionView({ docId }) {
  const [tab, setTab] = useState('flashcards')
  const activeMeta = SUB_TABS.find((t) => t.value === tab)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-rule px-5 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
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
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === 'flashcards' && <FlashcardsView docId={docId} />}
              {tab === 'quiz' && <QuizView docId={docId} />}
              {tab === 'recall' && <ActiveRecallView docId={docId} />}
              {tab === 'quick' && <QuickRevisionView docId={docId} />}
              {tab === 'night' && <NightBeforeView docId={docId} />}
              {tab === 'visual' && <VisualRevisionView docId={docId} />}
              {tab === 'viva' && <VivaView docId={docId} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
