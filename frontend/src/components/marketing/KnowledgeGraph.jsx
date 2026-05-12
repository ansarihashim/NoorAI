import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader, FadeUp } from './primitives.jsx'

/**
 * Animated SVG knowledge graph: nodes pulse, edges draw in,
 * a "scanning" line walks across to suggest live AI synthesis.
 */
const NODES = [
  { id: 'main',   label: 'Modern AI',           x: 50, y: 50, size: 'lg', tone: 'accent' },
  { id: 'trans',  label: 'Transformers',        x: 22, y: 28, size: 'md', tone: 'accent' },
  { id: 'attn',   label: 'Attention',           x: 78, y: 28, size: 'md', tone: 'accent' },
  { id: 'rag',    label: 'RAG · Retrieval',     x: 78, y: 72, size: 'md', tone: 'accent' },
  { id: 'agent',  label: 'Agentic Systems',     x: 22, y: 72, size: 'md', tone: 'sage' },

  { id: 'tokens', label: 'Tokens',              x: 12, y: 50, size: 'sm', tone: 'muted' },
  { id: 'vec',    label: 'Vector DB',           x: 90, y: 50, size: 'sm', tone: 'muted' },
  { id: 'agi',    label: 'AGI',                 x: 50, y: 12, size: 'sm', tone: 'dusk' },
  { id: 'tools',  label: 'Tool Use',            x: 50, y: 88, size: 'sm', tone: 'muted' },
]

const EDGES = [
  ['main', 'trans'], ['main', 'attn'], ['main', 'rag'], ['main', 'agent'],
  ['trans', 'tokens'], ['rag', 'vec'], ['main', 'agi'], ['main', 'tools'],
  ['trans', 'attn'], ['attn', 'rag'], ['rag', 'agent'],
]

function nodeColor(tone) {
  if (tone === 'accent') return { fill: '#FFD60A', glow: 'rgba(255,214,10,0.55)' }
  if (tone === 'sage') return { fill: '#FFD60A', glow: 'rgba(255,214,10,0.4)' }
  if (tone === 'dusk') return { fill: '#FFD60A', glow: 'rgba(255,214,10,0.4)' }
  return { fill: '#FFFFFF', glow: 'rgba(255,255,255,0.25)' }
}

function nodeRadius(size) {
  if (size === 'lg') return 16
  if (size === 'md') return 9
  return 6
}

export default function KnowledgeGraph() {
  const reduce = useReducedMotion()
  const nodeMap = Object.fromEntries(NODES.map((n) => [n.id, n]))

  return (
    <section className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="The mind map, automatically"
          title={
            <>
              NoorAI sees the{' '}
              <span className="echo-text-warm">shape of your syllabus.</span>
            </>
          }
          subtitle="Every upload becomes a graph of concepts and dependencies. When you ask a question, NoorAI pulls the right node — not just the nearest paragraph."
        />

        <FadeUp className="mt-16" duration={0.9}>
          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            {/* graph */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-echo-border bg-echo-surface p-3 sm:aspect-[16/10]">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,200,87,0.65), transparent)',
                }}
              />
              <div className="echo-grid pointer-events-none absolute inset-0 opacity-30" />

              <svg viewBox="0 0 100 100" className="relative h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="kg-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,214,10,0)" />
                    <stop offset="50%" stopColor="rgba(255,214,10,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,214,10,0)" />
                  </linearGradient>
                  <radialGradient id="kg-node-glow">
                    <stop offset="0%" stopColor="rgba(255,214,10,0.7)" />
                    <stop offset="100%" stopColor="rgba(255,214,10,0)" />
                  </radialGradient>
                </defs>

                {/* edges */}
                {EDGES.map(([a, b], i) => {
                  const A = nodeMap[a]
                  const B = nodeMap[b]
                  return (
                    <motion.line
                      key={`${a}-${b}`}
                      x1={A.x}
                      y1={A.y}
                      x2={B.x}
                      y2={B.y}
                      stroke="url(#kg-line)"
                      strokeWidth="0.25"
                      initial={reduce ? { pathLength: 1, opacity: 0.5 } : { pathLength: 0, opacity: 0 }}
                      whileInView={reduce ? undefined : { pathLength: 1, opacity: 0.7 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ duration: 1.1, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                    />
                  )
                })}

                {/* nodes */}
                {NODES.map((n, i) => {
                  const c = nodeColor(n.tone)
                  const r = nodeRadius(n.size) / 5
                  return (
                    <motion.g
                      key={n.id}
                      initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                      whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ duration: 0.7, delay: 0.4 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      style={{ transformOrigin: `${n.x}% ${n.y}%`, transformBox: 'fill-box' }}
                    >
                      {/* halo */}
                      <circle cx={n.x} cy={n.y} r={r * 2.4} fill="url(#kg-node-glow)" opacity="0.45" />
                      {/* main dot */}
                      <circle cx={n.x} cy={n.y} r={r} fill={c.fill} />
                      {/* ring */}
                      <circle cx={n.x} cy={n.y} r={r * 1.4} stroke={c.fill} strokeWidth="0.12" fill="none" opacity="0.5" />
                    </motion.g>
                  )
                })}
              </svg>

              {/* HTML labels overlaid for crisp typography */}
              {NODES.map((n) => (
                <span
                  key={`label-${n.id}`}
                  className={[
                    'pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-echo-border bg-echo-bg px-2.5 py-1',
                    n.size === 'lg'
                      ? 'text-[0.78rem] font-semibold text-echo-text'
                      : n.size === 'md'
                        ? 'text-[0.72rem] font-medium text-echo-text'
                        : 'text-[0.66rem] text-echo-muted',
                  ].join(' ')}
                  style={{ left: `${n.x}%`, top: `calc(${n.y}% + ${nodeRadius(n.size) + 14}px)` }}
                >
                  {n.label}
                </span>
              ))}
            </div>

            {/* side panel */}
            <div className="flex flex-col justify-center gap-6">
              {[
                {
                  k: 'Concept extraction',
                  v: 'Every PDF becomes a structured graph of named concepts and their relationships.',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <circle cx="5" cy="6" r="2" />
                      <circle cx="19" cy="6" r="2" />
                      <circle cx="5" cy="18" r="2" />
                      <circle cx="19" cy="18" r="2" />
                      <path d="M12 12L5 6M12 12L19 6M12 12L5 18M12 12L19 18" />
                    </svg>
                  ),
                },
                {
                  k: 'Dependency-aware retrieval',
                  v: 'Ask about attention, NoorAI already knows you mean inside the transformer stack.',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                      <path d="M3.27 6.96L12 12l8.73-5.04M12 22V12" />
                    </svg>
                  ),
                },
                {
                  k: 'Visual revision',
                  v: 'Use the graph itself as your revision map. Pulse a node, NoorAI explains it from your notes.',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  ),
                },
              ].map((row) => (
                <div key={row.k} className="flex items-start gap-4 rounded-md border border-echo-border bg-echo-surface p-5 transition-colors duration-150 hover:border-echo-border-strong">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-echo-accent text-echo-bg">
                    <span className="block h-5 w-5">{row.icon}</span>
                  </span>
                  <div>
                    <div className="text-[0.95rem] font-medium text-echo-text">{row.k}</div>
                    <div className="mt-1 text-[0.86rem] leading-relaxed text-echo-muted">{row.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
