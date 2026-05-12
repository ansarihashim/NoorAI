import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader, FadeUp } from './primitives.jsx'

/**
 * Premium RAG visualization — three-stage retrieval pipeline rendered as
 * a floating constellation of knowledge chunks → embedding lane → answer
 * column. Pure black floor, vivid yellow accents, hairline rules. No fog,
 * no neon, no cinematic blur.
 *
 *   [ chunk grid ]   →   [ vector lane ]   →   [ grounded answer ]
 *
 * Animations are scroll-gated and stagger once on entry; nothing loops
 * forever (avoids the "always-pulsing dashboard" feel).
 */

// ---------- chunk grid (left column) ----------
const CHUNKS = [
  { id: 'c1', label: 'Attention is all you need · pg 4', tag: 'NOTES',    weight: 0.92, retrieved: true  },
  { id: 'c2', label: 'Self-attention matrix derivation', tag: 'PDF',      weight: 0.88, retrieved: true  },
  { id: 'c3', label: 'Tokeniser internals · BPE',        tag: 'NOTES',    weight: 0.41, retrieved: false },
  { id: 'c4', label: 'Scaling laws · table 2.1',         tag: 'TABLE',    weight: 0.74, retrieved: true  },
  { id: 'c5', label: 'RNN history · intro',              tag: 'PDF',      weight: 0.18, retrieved: false },
  { id: 'c6', label: 'KV cache + flash attention',       tag: 'DIAGRAM',  weight: 0.81, retrieved: true  },
]

// ---------- answer column (right) ----------
const ANSWER_LINES = [
  { w: 92, accent: false },
  { w: 78, accent: false },
  { w: 86, accent: true  },
  { w: 70, accent: false },
  { w: 60, accent: false },
]

export default function RagFlow() {
  const reduce = useReducedMotion()

  return (
    <section id="rag" className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Retrieval, visible"
          title={
            <>
              Every answer is{' '}
              <span className="echo-text-warm">traced back to your notes.</span>
            </>
          }
          subtitle="NoorAI breaks your material into chunks, ranks them against your question, and answers using only the highest-signal passages — with citations you can step into."
        />

        <FadeUp className="mt-16" duration={0.9}>
          <div
            className="relative grid gap-5 rounded-xl border border-echo-border bg-echo-surface p-4 sm:gap-6 sm:p-7 lg:grid-cols-[1.1fr_0.7fr_1fr]"
          >
            {/* faint paper rule on the surface — keeps the lab/notebook feel */}
            <span aria-hidden className="rag-paper-rule" />

            {/* === Stage 1 — chunk grid =================================== */}
            <div className="relative">
              <Stamp idx="01" label="Source chunks" />
              <ul className="mt-4 space-y-2">
                {CHUNKS.map((c, i) => (
                  <motion.li
                    key={c.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                    className={[
                      'group relative flex min-w-0 items-center gap-3 rounded-md border bg-echo-bg px-3 py-2.5 transition-colors duration-200',
                      c.retrieved
                        ? 'border-echo-accent/45 ring-1 ring-echo-accent/15'
                        : 'border-echo-border opacity-60',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm font-mono text-[0.62rem] font-semibold tracking-wider',
                        c.retrieved
                          ? 'bg-echo-accent text-echo-bg'
                          : 'border border-echo-border text-echo-muted',
                      ].join(' ')}
                    >
                      {c.tag.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.84rem] font-medium text-echo-text">
                        {c.label}
                      </div>
                      <ScoreBar weight={c.weight} active={c.retrieved} />
                    </div>
                    {c.retrieved && (
                      <span
                        aria-hidden
                        className="rag-pulse-dot"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    )}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* === Stage 2 — vector lane ================================== */}
            <div className="relative flex flex-col">
              <Stamp idx="02" label="Embedding lane" />
              <div className="mt-4 flex-1">
                <VectorLane />
              </div>
              <p className="mt-4 max-w-xs text-[0.78rem] leading-relaxed text-echo-muted">
                Cosine similarity over your private index. Top-k passages flow
                into the prompt; the rest stay quiet.
              </p>
            </div>

            {/* === Stage 3 — grounded answer ============================== */}
            <div className="relative">
              <Stamp idx="03" label="Grounded answer" />
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="mt-4 rounded-md border border-echo-border bg-echo-bg p-4"
              >
                <div className="flex items-center gap-2 text-[0.7rem] font-mono uppercase tracking-[0.16em] text-echo-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-echo-accent" />
                  Answer
                </div>
                <div className="mt-3 space-y-2">
                  {ANSWER_LINES.map((l, i) => (
                    <motion.div
                      key={i}
                      initial={reduce ? false : { width: 0 }}
                      whileInView={reduce ? undefined : { width: `${l.w}%` }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ duration: 0.6, delay: 0.55 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      className={[
                        'h-2 rounded-full',
                        l.accent ? 'bg-echo-accent' : 'bg-white/[0.14]',
                      ].join(' ')}
                    />
                  ))}
                </div>
                {/* citation chips */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {['c1', 'c2', 'c4', 'c6'].map((cid) => (
                    <span
                      key={cid}
                      className="rounded-pill border border-echo-accent/40 bg-echo-accent/[0.08] px-2 py-0.5 font-mono text-[0.65rem] tracking-wide text-echo-accent"
                    >
                      ¶{cid}
                    </span>
                  ))}
                </div>
              </motion.div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: 'k', v: 4 },
                  { k: 'recall', v: '0.93' },
                  { k: 'tokens', v: '512' },
                ].map((m) => (
                  <div key={m.k} className="rounded-md border border-echo-border bg-echo-bg px-3 py-2">
                    <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-echo-muted">
                      {m.k}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.95rem] font-semibold tabular-nums text-echo-text">
                      {m.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeUp>

        {/* one-line caption strip below — keeps marketing copy outside the visual */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[0.78rem] text-echo-muted">
          <span>
            Indexed locally · Top-k = 4 · cosine similarity · re-ranked before generation.
          </span>
          <span className="font-mono text-echo-muted/70">v · noor-rag-1</span>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- */

function Stamp({ idx, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-echo-border bg-echo-bg font-mono text-[0.62rem] font-semibold tracking-wider text-echo-accent">
        {idx}
      </span>
      <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-echo-muted">
        {label}
      </span>
    </div>
  )
}

function ScoreBar({ weight, active }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className={[
            'absolute inset-y-0 left-0 rounded-full',
            active ? 'bg-echo-accent' : 'bg-white/[0.18]',
          ].join(' ')}
          style={{ width: `${Math.round(weight * 100)}%` }}
        />
      </span>
      <span className="font-mono text-[0.6rem] tabular-nums text-echo-muted">
        {weight.toFixed(2)}
      </span>
    </div>
  )
}

/**
 * The middle "embedding lane" — five horizontal traces that pulse a token
 * across left → right once per scroll-into-view. Nothing loops; nothing
 * neon.
 */
function VectorLane() {
  const reduce = useReducedMotion()
  // five horizontal lane positions, expressed as % of the container's height.
  const lanes = [18, 36, 50, 66, 82]

  return (
    <div className="relative h-[260px] overflow-hidden rounded-md border border-echo-border bg-echo-bg">
      {/* baseline guides — drawn as plain divs so they layer cleanly under tokens */}
      {[20, 40, 60, 80].map((x) => (
        <span
          key={`v-${x}`}
          aria-hidden
          className="pointer-events-none absolute top-2 bottom-2 w-px bg-white/[0.05]"
          style={{ left: `${x}%` }}
        />
      ))}
      {lanes.map((y) => (
        <span
          key={`h-${y}`}
          aria-hidden
          className="pointer-events-none absolute left-3 right-3 h-px bg-white/[0.08]"
          style={{ top: `${y}%` }}
        />
      ))}

      {/* moving tokens — translateX(0 → calc(100% - 12px)) along each lane */}
      {!reduce &&
        lanes.map((y, i) => (
          <span
            key={`tok-${y}`}
            aria-hidden
            className="rag-token"
            style={{
              top: `calc(${y}% - 3px)`,
              animationDuration: `${4 + i * 0.6}s`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}

      {/* left + right docks */}
      <span className="absolute left-2 top-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-echo-muted">
        query
      </span>
      <span className="absolute right-2 top-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-echo-muted">
        context
      </span>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-echo-accent/25" />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-echo-accent/25" />
    </div>
  )
}
