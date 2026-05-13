import { motion } from 'framer-motion'
import { SectionHeader } from './primitives.jsx'

const MODES = [
  {
    key: 'preparation',
    title: 'Preparation Mode',
    description: 'Turn dense PDFs into structured overviews, important questions, and clear explanations before you start.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    key: 'revision',
    title: 'Revision Mode',
    description: 'Active recall, flashcards, viva drills, and night-before sprints — calibrated to what you forget.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1015 -6.7L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
  },
  {
    key: 'podcast',
    title: 'Podcast Mode',
    description: 'A host and guest discuss your notes like a real episode — analogies, examples, banter, the works.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8" />
      </svg>
    ),
  },
  {
    key: 'narration',
    title: 'Narration Mode',
    description: 'Calm read-aloud of your material in a natural voice. Pauses the moment you start speaking.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11v2M7 8v8M11 4v16M15 8v8M19 11v2" />
      </svg>
    ),
  },
  {
    key: 'doubts',
    title: 'Ask Doubts',
    description: 'Speak naturally, get answers grounded in your own notes — with citations back to the page.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 16h.01" />
      </svg>
    ),
  },
  {
    key: 'simplify',
    title: 'Simplify Topics',
    description: 'Strip away the jargon. Get the same idea explained at the level you actually need today.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M6 12h12M9 18h6" />
      </svg>
    ),
  },
]

function ModeCard({ mode, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 44, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.75, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-xl border border-echo-border bg-echo-surface p-7 transition-colors duration-150 hover:border-echo-border-strong"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-echo-border bg-echo-bg text-echo-accent transition-colors duration-150 group-hover:border-echo-accent">
          <span className="h-5 w-5">{mode.icon}</span>
        </span>
        <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-echo-muted">
          0{i + 1}
        </span>
      </div>

      <h3 className="mt-6 font-serif text-[1.4rem] font-semibold leading-snug tracking-tight text-echo-text">
        {mode.title}
      </h3>
      <p className="mt-2 text-[0.94rem] leading-relaxed text-echo-muted">
        {mode.description}
      </p>
    </motion.div>
  )
}

export default function StudyModesGrid() {
  return (
    <section id="study-modes" className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Six modes · one workspace"
          title={
            <>
              Six ways to study{' '}
              <span className="echo-text-warm">the way your brain wants to.</span>
            </>
          }
          subtitle="NoorAI adapts to where you are in the syllabus — from the first read to the night-before scramble."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m, i) => (
            <ModeCard key={m.key} mode={m} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
