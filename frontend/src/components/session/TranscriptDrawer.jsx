import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ROLE = {
  user: { label: 'You', tint: 'border-accent-purple/30 bg-accent-purple/[0.06]', dot: 'bg-accent-purple' },
  assistant: { label: 'NoorAI', tint: 'border-accent-cyan/30 bg-accent-cyan/[0.06]', dot: 'bg-accent-cyan' },
  narrator: { label: 'Narrator', tint: 'border-white/[0.06] bg-white/[0.02]', dot: 'bg-ink-muted' },
}

export default function TranscriptDrawer({ messages, open, onToggle }) {
  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  return (
    <aside
      className={[
        'glass flex h-full flex-col overflow-hidden transition-[width] duration-400 ease-expo',
        open ? 'w-full sm:w-80' : 'w-12',
      ].join(' ')}
    >
      <button
        onClick={onToggle}
        className="flex h-12 w-full items-center justify-between border-b border-white/[0.05] px-3.5 text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        <span className={open ? '' : 'sr-only'}>Transcript</span>
        <svg
          viewBox="0 0 24 24"
          className={['h-4 w-4 transition-transform', open ? '' : 'rotate-180'].join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto px-3 py-3"
          >
            {messages.length === 0 ? (
              <p className="px-2 text-sm italic text-ink-faint">
                Speak during narration to ask a question — your turn appears here.
              </p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m, i) => {
                  const r = ROLE[m.role] || ROLE.narrator
                  return (
                    <li
                      key={i}
                      className={[
                        'rounded-xl border px-3 py-2.5 text-[0.85rem] leading-relaxed',
                        r.tint,
                      ].join(' ')}
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-ink-muted">
                        <span className={['inline-block h-1.5 w-1.5 rounded-full', r.dot].join(' ')} />
                        {r.label}
                      </div>
                      <div className="text-ink">{m.text}</div>
                    </li>
                  )
                })}
                <li ref={endRef} />
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
