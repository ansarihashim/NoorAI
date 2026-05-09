import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import Button from '../components/ui/Button.jsx'
import Pill from '../components/ui/Pill.jsx'
import { LogoMark } from '../components/ui/Logo.jsx'

function HeroOrb({ reduce }) {
  // The orb tracks the cursor very subtly. Intentionally muted on mobile.
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (reduce) return
    function onMove(e) {
      const w = window.innerWidth
      const h = window.innerHeight
      setPos({
        x: ((e.clientX / w) - 0.5) * 30,
        y: ((e.clientY / h) - 0.5) * 30,
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [reduce])

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* center glow */}
      <motion.div
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: 'spring', stiffness: 40, damping: 18 }}
        className="absolute left-1/2 top-[40%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(139,92,246,0.40) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <motion.div
        animate={{ x: -pos.x * 0.5, y: -pos.y * 0.5 }}
        transition={{ type: 'spring', stiffness: 30, damping: 20 }}
        className="absolute right-[15%] top-[20%] h-[400px] w-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(34,211,238,0.30) 0%, rgba(34,211,238,0.05) 45%, transparent 75%)',
          filter: 'blur(60px)',
        }}
      />
      <motion.div
        animate={{ x: pos.x * 0.3, y: pos.y * 0.3 }}
        transition={{ type: 'spring', stiffness: 30, damping: 20 }}
        className="absolute bottom-[10%] left-[10%] h-[360px] w-[360px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(52,211,153,0.20) 0%, rgba(52,211,153,0.04) 45%, transparent 75%)',
          filter: 'blur(70px)',
        }}
      />
    </div>
  )
}

function FloatingWaveform({ accent = 'purple', bars = 36, seed = 0, paused = false }) {
  const colorClass =
    accent === 'cyan' ? 'bg-accent-cyan/70' : accent === 'green' ? 'bg-accent-green/70' : 'bg-accent-purple/80'
  return (
    <div className="flex h-24 items-center justify-between gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i + seed * 7) * 0.31
        const baseHeight = 22 + Math.abs(Math.sin(phase)) * 60
        return (
          <motion.span
            key={i}
            className={['inline-block w-[3px] rounded-full', colorClass].join(' ')}
            initial={{ height: 6 }}
            animate={paused ? { height: baseHeight * 0.4 } : { height: [baseHeight * 0.4, baseHeight, baseHeight * 0.5] }}
            transition={
              paused
                ? { duration: 0.4 }
                : { duration: 1.4 + (i % 5) * 0.18, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
            }
          />
        )
      })}
    </div>
  )
}

function ModeCard({ tone, label, title, description, lines, voices, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass relative overflow-hidden p-7"
    >
      <div className="flex items-center justify-between">
        <Pill tone={tone}>{label}</Pill>
        {voices && (
          <div className="flex -space-x-2">
            {voices.map((v, i) => (
              <span
                key={i}
                className={[
                  'h-7 w-7 rounded-full border-2 border-bg ring-1 ring-white/10 bg-gradient-to-br',
                  v,
                ].join(' ')}
              />
            ))}
          </div>
        )}
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-ink-muted">{description}</p>

      <div className="mt-6 rounded-xl border border-white/[0.06] bg-bg-panel/40 p-4">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-start gap-2 text-[0.85rem]">
              {l.speaker && (
                <span
                  className={[
                    'mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]',
                    l.tone === 'cyan'
                      ? 'bg-accent-cyan/10 text-accent-cyan-soft'
                      : l.tone === 'green'
                        ? 'bg-accent-green/10 text-accent-green'
                        : 'bg-accent-purple/10 text-accent-purple-soft',
                  ].join(' ')}
                >
                  {l.speaker}
                </span>
              )}
              <span className="text-ink-muted">{l.text}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-white/[0.05] pt-3">
          <FloatingWaveform accent={accent} seed={tone === 'purple' ? 0 : 1} bars={28} />
        </div>
      </div>
    </motion.div>
  )
}

function StepCard({ index, title, description, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill border border-white/[0.08] bg-white/[0.03] font-mono text-[0.7rem] text-ink-muted">
          0{index + 1}
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-gradient-to-br from-accent-purple/30 to-accent-cyan/20 text-accent-purple-soft">
          {icon}
        </span>
      </div>
      <h4 className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
    </motion.div>
  )
}

export default function Landing() {
  const reduce = useReducedMotion()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroFade = useTransform(scrollYProgress, [0, 1], [1, 0.4])
  const heroLift = useTransform(scrollYProgress, [0, 1], [0, -40])

  return (
    <div>
      {/* HERO */}
      <section ref={heroRef} className="relative isolate overflow-hidden">
        <HeroOrb reduce={reduce} />
        <motion.div
          style={reduce ? undefined : { opacity: heroFade, y: heroLift }}
          className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-pill border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[0.7rem] uppercase tracking-[0.16em] text-ink-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-cyan" />
              Real-time AI study partner
            </span>
            <h1 className="mt-7 text-balance font-display text-display text-ink">
              Your notes,{' '}
              <span className="bg-gradient-to-r from-accent-purple-soft via-accent-cyan-soft to-accent-green bg-clip-text text-transparent">
                spoken aloud.
              </span>
              <br />
              <span className="text-ink-muted">Conversational. On demand.</span>
            </h1>
            <p className="mt-7 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-ink-muted">
              EchoVerse turns the PDFs and notes you already have into a study partner that narrates clearly,
              answers your questions out loud, and produces engaging podcast-style discussions on demand.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
              <Button as={Link} to="/signup" size="lg" variant="primary">
                Start free
                <svg viewBox="0 0 24 24" className="ml-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Button>
              <Button as={Link} to="/login" size="lg" variant="outline">
                Sign in
              </Button>
            </div>
            <div className="mt-12 flex items-center gap-2 text-xs text-ink-faint">
              <span className="font-mono">Whisper</span>
              <span aria-hidden>·</span>
              <span className="font-mono">Groq</span>
              <span aria-hidden>·</span>
              <span className="font-mono">ElevenLabs</span>
              <span aria-hidden>·</span>
              <span className="font-mono">RAG</span>
            </div>
          </motion.div>

          {/* Hero waveform mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <div className="glass-strong relative overflow-hidden p-5 shadow-lift">
              <div className="flex items-center justify-between gap-3">
                <Pill tone="purple">Narrating</Pill>
                <span className="font-mono text-[0.7rem] text-ink-faint">chunk 04 / 18</span>
              </div>
              <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr_auto]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-cyan/15 text-accent-cyan-soft ring-1 ring-accent-cyan/20">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1v22M5 8v8M19 8v8M2 11v2M22 11v2" />
                  </svg>
                </span>
                <FloatingWaveform accent="cyan" bars={48} />
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Stop"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors hover:text-ink"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* TWO MODES */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-caption text-ink-muted">two modes</span>
          <h2 className="mt-3 text-balance font-display text-title text-ink">
            One document. Two ways to learn it.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-ink-muted">
            Sometimes you want a focused read-through. Sometimes you want to hear it explained like a podcast on
            your commute. EchoVerse does both from the same upload.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <ModeCard
            tone="purple"
            label="Narration"
            title="Clean, structured read-aloud — interrupt anytime."
            description="EchoVerse breaks your notes into chunks, narrates them in a natural voice, and pauses the moment you start speaking so it can answer with context from the document."
            lines={[
              { speaker: 'Narrator', tone: 'purple', text: 'Mitochondria are responsible for producing most of a cell\'s ATP through oxidative phosphorylation.' },
              { speaker: 'You', tone: 'cyan', text: 'Wait — what does ATP actually do?' },
              { speaker: 'Assistant', tone: 'green', text: 'ATP is the molecule cells use to store and move energy. Think of it as a rechargeable battery.' },
            ]}
            accent="purple"
          />
          <ModeCard
            tone="cyan"
            label="Podcast"
            title="A host and a co-host explain it like an episode."
            description="A two-voice educational discussion generated from your material — analogies, examples, and back-and-forth that turns dense material into something you actually want to listen to."
            lines={[
              { speaker: 'Host', tone: 'purple', text: 'So — why does the citric acid cycle matter for organisms that don\'t need oxygen?' },
              { speaker: 'Guest', tone: 'cyan', text: 'Great question. Most of the energy actually comes from the cycle\'s electron carriers, which then feed the chain.' },
              { speaker: 'Host', tone: 'purple', text: 'Got it — so the cycle is the input stage, the chain is where the energy is harvested.' },
            ]}
            voices={[
              'from-accent-purple to-accent-cyan',
              'from-accent-cyan to-accent-green',
            ]}
            accent="cyan"
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-caption text-ink-muted">how it works</span>
          <h2 className="mt-3 text-balance font-display text-title text-ink">Three steps. Five seconds.</h2>
        </div>
        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          <StepCard
            index={0}
            title="Upload your material"
            description="Drop a PDF or paste in your notes. We extract, chunk, and embed it so it's ready to be retrieved."
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12" />
              </svg>
            }
          />
          <StepCard
            index={1}
            title="Pick a mode"
            description="Narration for focused reading, or generate a podcast-style discussion to learn passively."
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="9" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            }
          />
          <StepCard
            index={2}
            title="Speak naturally"
            description="Interrupt the narrator any time. EchoVerse answers from your own notes, then resumes where it paused."
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10a7 7 0 01-14 0M12 19v4" />
              </svg>
            }
          />
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="glass-strong relative overflow-hidden p-10 text-center sm:p-14"
        >
          <div className="pointer-events-none absolute inset-0 bg-grad-aurora opacity-80" aria-hidden />
          <div className="relative">
            <LogoMark size={36} className="mx-auto mb-5" />
            <h3 className="text-balance font-display text-title text-ink">
              Bring your hardest material. Listen your way through it.
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-ink-muted">
              Free to start. No card. Your notes stay yours.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button as={Link} to="/signup" size="lg" variant="primary">
                Create your account
              </Button>
              <Button as={Link} to="/login" size="lg" variant="ghost">
                I already have one
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/[0.05] px-5 py-8 text-xs text-ink-faint sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <LogoMark size={18} />
            <span>EchoVerse</span>
          </span>
          <span className="font-mono">v0.1 · Phase 1</span>
        </div>
      </footer>
    </div>
  )
}
