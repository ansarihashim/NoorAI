import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader, FadeUp } from './primitives.jsx'

const PAIRS = [
  {
    problem: 'Too much syllabus?',
    pSub: "It's 200 pages, the exam is on Sunday, and you don't know where to start.",
    solution: 'Preparation Mode',
    sSub: 'NoorAI extracts the spine of every chapter, ranks the high-yield questions, and walks you through them — in the order an examiner cares about.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4 6h16M4 12h12M4 18h8" />
      </svg>
    ),
  },
  {
    problem: 'Sleepy while studying?',
    pSub: 'Your eyes are open, the page is open, but nothing is going in.',
    solution: 'Podcast Mode',
    sSub: 'Two voices discussing your notes like an episode you actually want to listen to. Walk, cook, commute, learn — without forcing a screen.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v4" />
      </svg>
    ),
  },
  {
    problem: 'Hard textbook language?',
    pSub: 'A definition should not require five re-reads.',
    solution: 'Simplify Topics',
    sSub: 'Strip jargon, keep meaning. NoorAI re-explains the same idea at the level you actually need today — with analogies that stick.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2l2.39 6.95H21l-5.31 4.05L17.78 20 12 16.27 6.22 20l2.09-6.99L3 8.95h6.61z" />
      </svg>
    ),
  },
  {
    problem: 'No revision strategy?',
    pSub: 'Re-reading the same notes the night before isn\'t a plan, it\'s a habit.',
    solution: 'Revision Mode',
    sSub: 'Active recall, flashcard decks, a viva drill, and a "night-before" sprint — calibrated to what you forget and what shows up most.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 12a9 9 0 1015 -6.7L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
  },
]

function PairCard({ pair, i }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="echo-hover-bright group relative overflow-hidden rounded-lg border border-echo-border bg-echo-surface p-1"
    >
      <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
        {/* problem */}
        <div className="rounded-3xl p-7">
          <div className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted/70">
            The problem
          </div>
          <h3 className="mt-3 font-serif text-[1.4rem] font-medium leading-tight text-echo-text">
            {pair.problem}
          </h3>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-echo-muted">
            {pair.pSub}
          </p>
        </div>

        {/* arrow */}
        <div className="hidden items-center justify-center sm:flex">
          <div className="flex flex-col items-center gap-2">
            <span className="h-12 w-px bg-echo-border" />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-echo-accent text-echo-bg">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
            <span className="h-12 w-px bg-echo-border" />
          </div>
        </div>

        {/* divider for mobile */}
        <div className="my-2 sm:hidden">
          <div className="echo-divider" />
        </div>

        {/* solution */}
        <div className="rounded-md p-7 sm:bg-echo-bg">
          <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-echo-accent">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-echo-accent text-echo-bg">
              <span className="block h-3 w-3">{pair.icon}</span>
            </span>
            NoorAI · {pair.solution}
          </div>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-echo-text">
            {pair.sSub}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProblemSolutions() {
  return (
    <section className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="For real students, real semesters"
          title={
            <>
              The friction is real.{' '}
              <span className="echo-text-warm">NoorAI meets you in it.</span>
            </>
          }
          subtitle="Built around the four moments most study tools ignore — when you're overwhelmed, drained, lost in jargon, or out of time."
        />
        <FadeUp className="mt-16">
          <div className="grid gap-5 lg:grid-cols-2">
            {PAIRS.map((p, i) => (
              <PairCard key={p.problem} pair={p} i={i} />
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
