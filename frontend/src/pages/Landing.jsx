import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import MarketingNav from '../components/marketing/MarketingNav.jsx'
import NotebookBackdrop from '../components/marketing/NotebookBackdrop.jsx'
import MashaalCursor from '../components/marketing/MashaalCursor.jsx'
import BookVisual from '../components/marketing/BookVisual.jsx'
import StudyModesGrid from '../components/marketing/StudyModesGrid.jsx'
import InteractiveDemo from '../components/marketing/InteractiveDemo.jsx'
import ProblemSolutions from '../components/marketing/ProblemSolutions.jsx'
import RagFlow from '../components/marketing/RagFlow.jsx'
import FinalCTA from '../components/marketing/FinalCTA.jsx'
import MarketingFooter from '../components/marketing/MarketingFooter.jsx'

function Hero() {
  const reduce = useReducedMotion()
  // Page-scroll-driven parallax. The earlier `useScroll({ target, offset })`
  // form triggered a framer-motion "container has a static position" warning
  // because the offset-parent chain in marketing mode includes static
  // wrappers; switching to the default (document scroll) removes the warning
  // and the visual effect (40px fade + slight rise) reads identically over
  // the first viewport of scroll.
  const { scrollY } = useScroll()
  const yLeft = useTransform(scrollY, [0, 600], [0, -40])
  const opacityLeft = useTransform(scrollY, [0, 600], [1, 0.6])

  return (
    <section className="relative isolate overflow-hidden pt-28 sm:pt-36 lg:pt-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          {/* LEFT */}
          <motion.div
            style={reduce ? undefined : { y: yLeft, opacity: opacityLeft }}
            className="relative"
          >
            {/* eyebrow — replaces the old "in beta" badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-echo-muted"
            >
              The intelligent research notebook
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 break-words font-serif text-[clamp(2rem,8vw,4.2rem)] font-semibold leading-[1.05] tracking-[-0.01em] text-echo-text sm:mt-6 sm:leading-[1.02]"
            >
              Your notes,{' '}
              <span className="text-echo-accent">illuminated by AI.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-xl text-[clamp(0.95rem,2.6vw,1.05rem)] leading-[1.6] text-echo-muted sm:mt-6 sm:leading-[1.65]"
            >
              A premium AI workspace for the way scholars actually study —
              upload, retrieve, narrate, revise. Every answer traced back to
              your own notebook.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <Link
                to="/signup"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-echo-accent px-6 text-[0.92rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright active:scale-[0.985]"
              >
                <span>Start studying</span>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-echo-border bg-transparent px-5 text-[0.9rem] font-medium text-echo-text transition-colors duration-150 hover:border-echo-border-strong hover:bg-echo-surface"
              >
                Sign in
              </Link>
            </motion.div>
          </motion.div>

          {/* RIGHT — premium AI notebook visual */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <BookVisual />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <NotebookBackdrop />
      <MashaalCursor />
      <MarketingNav />
      <Hero />
      <StudyModesGrid />
      <InteractiveDemo />
      <ProblemSolutions />
      <RagFlow />
      <FinalCTA />
      <MarketingFooter />
    </div>
  )
}
