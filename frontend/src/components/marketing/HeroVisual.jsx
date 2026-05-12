import { motion, useReducedMotion } from 'framer-motion'
import Waveform from './Waveform.jsx'
import ConceptOrb from './ConceptOrb.jsx'

/**
 * Right-side hero scene — a layered composition that reads as
 * "knowledge becoming alive": a podcast player, a notebook page,
 * a narration orb, concept nodes, all gently floating.
 */
export default function HeroVisual() {
  const reduce = useReducedMotion()

  return (
    <div className="relative mx-auto h-[600px] w-full max-w-[640px] sm:h-[640px] lg:h-[720px]">
      {/* warm halo behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 60% 45%, rgba(217,160,102,0.18), rgba(217,160,102,0.04) 45%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* faint concept-line web */}
      <svg
        aria-hidden
        viewBox="0 0 600 700"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(217,160,102,0.0)" />
            <stop offset="50%" stopColor="rgba(217,160,102,0.4)" />
            <stop offset="100%" stopColor="rgba(217,160,102,0.0)" />
          </linearGradient>
        </defs>
        <g stroke="url(#hero-line)" strokeWidth="1" fill="none">
          <motion.path
            d="M 80 120 Q 250 80 420 200"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 2, delay: 0.6, ease: 'easeOut' }}
          />
          <motion.path
            d="M 120 520 Q 280 600 480 420"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 2.4, delay: 0.9, ease: 'easeOut' }}
          />
          <motion.path
            d="M 460 80 Q 560 250 480 460"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.4 }}
            transition={{ duration: 2.4, delay: 1.2, ease: 'easeOut' }}
          />
        </g>
      </svg>

      {/* Center orb */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ConceptOrb size={240} label="" />
      </motion.div>

      {/* Floating: notebook page (top-left) */}
      <motion.div
        className="absolute left-0 top-6 w-[260px] sm:left-2 sm:top-2"
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -8, 0], rotate: [-1.5, 0.5, -1.5] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="echo-card-strong rounded-2xl p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
          style={{ transform: 'rotate(-3deg)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-echo-muted">
              AGI · Note 04
            </span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-echo-accent" />
          </div>
          <div className="mt-3 font-serif text-[0.95rem] leading-snug text-echo-text">
            AGI does not just <span className="rounded bg-echo-accent/20 px-1 text-echo-accent-soft">automate tasks</span> — it recursively improves the systems that automate tasks.
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1 rounded-full bg-echo-text/10" />
            <div className="h-1 w-4/5 rounded-full bg-echo-text/10" />
            <div className="h-1 w-3/5 rounded-full bg-echo-text/10" />
          </div>
        </motion.div>
      </motion.div>

      {/* Floating: podcast player (bottom) */}
      <motion.div
        className="absolute bottom-2 left-1/2 w-[300px] -translate-x-1/2 sm:w-[340px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="echo-card-strong rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-echo-accent/40 to-echo-accent/10 ring-1 ring-echo-accent/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-echo-accent-soft" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="absolute -inset-1 rounded-xl bg-echo-accent/20 blur-md" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.88rem] font-medium text-echo-text">
                Will AI replace humans? · Episode 02
              </div>
              <div className="text-[0.7rem] text-echo-muted">Host & Guest · 12:48 / 18:30</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-7 w-7 rounded-full border border-echo-border" />
              <span className="h-7 w-7 rounded-full border border-echo-border" />
            </div>
          </div>
          <div className="mt-3">
            <Waveform bars={42} height={36} width={2} gap={3} tone="accent" />
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-echo-text/[0.08]">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-echo-accent/80 to-echo-accent" />
          </div>
        </motion.div>
      </motion.div>

      {/* Floating: AI chat answer (right) */}
      <motion.div
        className="absolute right-0 top-[18%] w-[240px] sm:w-[260px]"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, 9, 0], rotate: [1.5, -0.5, 1.5] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="echo-card-strong rounded-2xl p-4"
          style={{ transform: 'rotate(2.5deg)' }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-echo-accent/15 ring-1 ring-echo-accent/30">
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-echo-accent-soft" fill="currentColor">
                <path d="M8 0L9.5 6.5 16 8 9.5 9.5 8 16 6.5 9.5 0 8 6.5 6.5z" />
              </svg>
            </span>
            <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-echo-muted">
              NoorAI · Reply
            </span>
          </div>
          <p className="mt-3 font-serif text-[0.88rem] leading-relaxed text-echo-text">
            Humans may shift from execution toward direction, judgement, and creativity — the work AI still struggles to do well.
          </p>
        </motion.div>
      </motion.div>

      {/* Concept node tag (top-right) */}
      <motion.div
        className="absolute right-6 top-2"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex items-center gap-1.5 rounded-full border border-echo-border bg-echo-surface/80 px-3 py-1.5 text-[0.7rem] font-medium tracking-wide text-echo-text shadow-floatSoft backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-echo-sage" />
          Transformers
        </motion.div>
      </motion.div>

      {/* Concept node tag (bottom-left) */}
      <motion.div
        className="absolute bottom-[28%] left-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex items-center gap-1.5 rounded-full border border-echo-border bg-echo-surface/80 px-3 py-1.5 text-[0.7rem] font-medium tracking-wide text-echo-text shadow-floatSoft backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-echo-dusk" />
          RAG · Vector DB
        </motion.div>
      </motion.div>

      {/* Subtle pencil */}
      <motion.svg
        viewBox="0 0 64 64"
        className="absolute right-[8%] bottom-[28%] h-12 w-12 text-echo-accent-soft/70"
        initial={{ opacity: 0, rotate: 30 }}
        animate={{ opacity: 1, rotate: 25 }}
        transition={{ duration: 0.8, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M44 8L56 20 L24 52 L10 56 L14 42z" />
        <path d="M40 12 L52 24" />
      </motion.svg>
    </div>
  )
}
