import { motion, useReducedMotion } from 'framer-motion'

/**
 * Premium AI-study notebook — the hero centerpiece.
 * Replaces the old static open-book illustration with an "intelligent
 * notebook" composition: a primary spread with handwritten-feeling structure,
 * an annotation card sliding in from the right (the AI margin), and a
 * citation chip clipped to the page. Black floor, vivid yellow accents,
 * thin elegant lines. No fog, no gradient overlays.
 */
export default function BookVisual() {
  const reduce = useReducedMotion()
  const ease = [0.22, 1, 0.36, 1]

  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      {/* faint paper rule on the entire frame */}
      <span aria-hidden className="rag-paper-rule" />

      <div className="relative aspect-[5/4]">
        {/* primary spread — solid surface, hairline rule, subtle inner shadow */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease }}
          className="absolute inset-x-2 inset-y-3 overflow-hidden rounded-xl border border-echo-border bg-echo-surface"
        >
          {/* notebook ruled lines, masked at edges */}
          <span aria-hidden className="rag-paper-rule" />

          {/* red margin line — academic touch */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[16%] top-6 bottom-6 w-px"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,214,10,0.30), transparent)' }}
          />

          {/* === handwritten-style heading ================================== */}
          <div className="relative px-8 pt-6">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-echo-muted">
              chapter · 04
            </div>
            <h3 className="mt-1 font-serif text-[1.4rem] font-semibold leading-tight tracking-tight text-echo-text">
              Deep Learning
            </h3>
            {/* yellow underline that "draws in" */}
            <motion.span
              aria-hidden
              initial={reduce ? false : { scaleX: 0 }}
              animate={reduce ? { scaleX: 1 } : { scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
              style={{ transformOrigin: 'left' }}
              className="mt-2 block h-[3px] w-32 rounded-full bg-echo-accent"
            />
          </div>

          {/* === outlined notes (left) + AI annotations (right) ============= */}
          <div className="relative mt-5 grid gap-6 px-8 pb-7 sm:grid-cols-[1.1fr_0.9fr]">
            {/* notes column */}
            <div className="space-y-2.5">
              {[
                { w: '92%', dim: false, hi: false },
                { w: '78%', dim: false, hi: true  },
                { w: '85%', dim: false, hi: false },
                { w: '64%', dim: true,  hi: false },
                { w: '88%', dim: false, hi: false },
                { w: '54%', dim: true,  hi: false },
              ].map((line, i) => (
                <motion.div
                  key={i}
                  initial={reduce ? false : { width: 0, opacity: 0 }}
                  animate={reduce ? { width: line.w, opacity: 1 } : { width: line.w, opacity: 1 }}
                  transition={{ duration: 0.65, delay: 0.55 + i * 0.07, ease }}
                  className={[
                    'relative h-[7px] rounded-full',
                    line.hi ? 'bg-echo-accent' : line.dim ? 'bg-white/[0.10]' : 'bg-white/[0.22]',
                  ].join(' ')}
                />
              ))}

              {/* equation badge — the canonical attention formula */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.0, ease }}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-echo-border bg-echo-bg px-2.5 py-1.5 font-mono text-[0.78rem] tabular-nums text-echo-text"
              >
                <span className="text-echo-muted">attention</span>
                <span>softmax(QKᵀ / √d) &nbsp;·&nbsp; V</span>
              </motion.div>
            </div>

            {/* AI annotation column — "the margin" */}
            <div className="relative">
              {/* connector line from notes → annotation */}
              <motion.svg
                aria-hidden
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute -left-6 top-2 h-24 w-12"
              >
                <motion.path
                  d="M0,16 C30,16 30,46 80,46"
                  fill="none"
                  stroke="rgba(255,214,10,0.55)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 0.9, ease }}
                />
              </motion.svg>

              <motion.div
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 1.05, ease }}
                className="rounded-lg border border-echo-accent/40 bg-echo-accent/[0.06] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-echo-accent text-echo-bg">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8z" />
                    </svg>
                  </span>
                  <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-echo-accent">
                    AI annotation
                  </span>
                </div>
                <p className="mt-2 font-serif text-[0.84rem] leading-snug text-echo-text">
                  Every token attends to every other token in parallel — the softmax over scaled dot-products decides which ones to listen to. That parallelism is what let transformers scale.
                </p>
                {/* citation chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {['¶c1', '¶c2', '¶c4'].map((c) => (
                    <span
                      key={c}
                      className="rounded-pill border border-echo-accent/40 bg-echo-bg px-1.5 py-0.5 font-mono text-[0.6rem] text-echo-accent"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* small "linking concept" tag underneath */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.25, ease }}
                className="mt-3 inline-flex items-center gap-1.5 text-[0.72rem] text-echo-muted"
              >
                <span className="h-1 w-1 rounded-full bg-echo-accent" />
                Linked to <span className="font-medium text-echo-text">Multi-Head Attention</span>
              </motion.div>
            </div>
          </div>

          {/* footer — page number + auto-tags */}
          <div className="absolute inset-x-7 bottom-3 flex items-center justify-between text-[0.66rem] text-echo-muted/80">
            <span className="font-mono">— pg 12 —</span>
            <span className="flex items-center gap-1.5">
              {['deep-learning', 'transformers', 'attention'].map((t) => (
                <span key={t} className="rounded-pill border border-echo-border bg-echo-bg px-1.5 py-0.5 font-mono text-[0.6rem]">
                  {t}
                </span>
              ))}
            </span>
          </div>
        </motion.div>

        {/* Floating concept tag (top-right) — drifts in from the corner */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -10, x: 8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, x: 0 }}
          transition={{ duration: 0.7, delay: 1.35, ease }}
          className="absolute -right-2 top-2 inline-flex items-center gap-2 rounded-pill border border-echo-accent/50 bg-echo-bg px-3 py-1.5 shadow-floatSoft"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-echo-accent" />
          <span className="text-[0.74rem] font-semibold text-echo-text">
            Concept:&nbsp;
            <span className="text-echo-accent">Self-Attention</span>
          </span>
        </motion.div>

        {/* Retrieval snippet (bottom-left) — looks like a chunk slipping into the notebook */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14, rotate: -1 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: -2 }}
          transition={{ duration: 0.85, delay: 1.55, ease }}
          className="absolute -left-1 bottom-0 w-[58%] origin-bottom-left rounded-md border border-echo-border bg-echo-bg p-3 shadow-floatSoft"
        >
          <div className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-echo-muted">
            <span className="inline-flex h-4 items-center rounded-sm bg-echo-accent px-1 text-echo-bg">PDF</span>
            <span>retrieved chunk · score 0.92</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="h-1.5 w-[90%] rounded-full bg-white/[0.18]" />
            <div className="h-1.5 w-[78%] rounded-full bg-echo-accent/85" />
            <div className="h-1.5 w-[64%] rounded-full bg-white/[0.10]" />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
