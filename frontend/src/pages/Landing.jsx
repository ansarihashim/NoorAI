import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import MarketingNav from '../components/marketing/MarketingNav.jsx'
import AmbientBackground from '../components/marketing/AmbientBackground.jsx'
import BookVisual from '../components/marketing/BookVisual.jsx'
import StudyModesGrid from '../components/marketing/StudyModesGrid.jsx'
import InteractiveDemo from '../components/marketing/InteractiveDemo.jsx'
import ProblemSolutions from '../components/marketing/ProblemSolutions.jsx'
import KnowledgeGraph from '../components/marketing/KnowledgeGraph.jsx'
import FinalCTA from '../components/marketing/FinalCTA.jsx'
import MarketingFooter from '../components/marketing/MarketingFooter.jsx'

const TRUST_BADGES = [
  { label: 'Narration Mode', icon: 'narration' },
  { label: 'Podcast Discussions', icon: 'podcast' },
  { label: 'AI Revision', icon: 'revision' },
  { label: 'Doubt Solving', icon: 'doubt' },
]

function TrustIcon({ kind }) {
  const sw = '1.6'
  if (kind === 'narration')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
        <path d="M3 11v2M7 8v8M11 4v16M15 8v8M19 11v2" />
      </svg>
    )
  if (kind === 'podcast')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v4" />
      </svg>
    )
  if (kind === 'revision')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round">
        <path d="M3 12a9 9 0 1015 -6.7L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const yLeft = useTransform(scrollYProgress, [0, 1], [0, -40])
  const opacityLeft = useTransform(scrollYProgress, [0, 1], [1, 0.6])

  return (
    <section ref={ref} className="relative isolate overflow-hidden pt-36 sm:pt-40">
      <AmbientBackground density={12} />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          {/* LEFT */}
          <motion.div
            style={reduce ? undefined : { y: yLeft, opacity: opacityLeft }}
            className="relative"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-echo-border bg-echo-surface px-3 py-1"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-echo-accent" />
              <span className="text-[0.74rem] font-semibold tracking-[0.04em] text-echo-muted">
                Your AI study companion · in beta
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 font-serif text-[clamp(2.4rem,5.4vw,4.2rem)] font-semibold leading-[1.02] tracking-[-0.01em] text-echo-text"
            >
              Your notes,{' '}
              <span className="text-echo-accent">illuminated by AI.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-xl text-[1.05rem] leading-[1.65] text-echo-muted"
            >
              Upload notes, listen to explanations, revise faster, and study conversationally —
              with your AI-powered learning companion.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-echo-accent px-6 text-[0.92rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright active:scale-[0.985]"
              >
                <span>Start studying</span>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-lg border border-echo-border bg-transparent px-5 text-[0.9rem] font-medium text-echo-text transition-colors duration-150 hover:border-echo-border-strong hover:bg-echo-surface"
              >
                Sign in
              </Link>
            </motion.div>

            {/* trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12"
            >
              <div className="text-[0.78rem] font-medium text-echo-muted">
                Built for the way you actually study
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {TRUST_BADGES.map((b) => (
                  <span
                    key={b.label}
                    className="inline-flex items-center gap-2 rounded-full border border-echo-border bg-echo-surface px-3 py-1.5 text-[0.82rem] font-medium text-echo-text"
                  >
                    <span className="inline-flex h-4 w-4 text-echo-accent">
                      <TrustIcon kind={b.icon} />
                    </span>
                    {b.label}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <BookVisual />
          </motion.div>
        </div>

        {/* Trusted-by strip */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-24 grid items-center gap-8 border-t border-echo-border pt-10 sm:grid-cols-[auto_1fr] sm:gap-12"
        >
          <div className="text-[0.66rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
            Trusted by students at
          </div>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-echo-muted/70">
            {['IIT', 'NIT', 'AIIMS', 'ISB', 'IIM', 'BITS'].map((u) => (
              <span key={u} className="font-serif text-[1.1rem] tracking-wide opacity-60 transition-opacity hover:opacity-100">
                {u}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <MarketingNav />
      <Hero />
      <StudyModesGrid />
      <InteractiveDemo />
      <ProblemSolutions />
      <KnowledgeGraph />
      <FinalCTA />
      <MarketingFooter />
    </div>
  )
}
