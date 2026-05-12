import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader, FadeUp } from './primitives.jsx'
import Waveform from './Waveform.jsx'

/**
 * A "screenshot-of-the-app" composition. Three connected panels:
 *   1. Source PDF (left)
 *   2. AI summary + narration (center)
 *   3. Chat reply + concept extraction (right)
 * Plus a study timeline along the bottom.
 *
 * Not interactive — but laid out and animated to feel like a live screen
 * the user is hovering across.
 */
export default function InteractiveDemo() {
  const reduce = useReducedMotion()

  return (
    <section id="demo" className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Inside the workspace"
          title={
            <>
              One upload becomes <span className="echo-text-warm">a study session.</span>
            </>
          }
          subtitle="Drop a PDF — within seconds, NoorAI extracts concepts, generates an explanation, and lights the narration. You can interrupt at any time."
        />

        <FadeUp className="mt-12" duration={0.8} y={32}>
          <div className="relative">
            <div className="relative overflow-hidden rounded-xl border border-echo-border bg-echo-surface">
              {/* window chrome */}
              <div className="flex items-center justify-between border-b border-echo-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-echo-text/[0.10]" />
                  <span className="h-3 w-3 rounded-full bg-echo-text/[0.10]" />
                  <span className="h-3 w-3 rounded-full bg-echo-text/[0.10]" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-echo-border bg-echo-bg/60 px-3 py-1 text-[0.7rem] font-mono text-echo-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-echo-accent" />
                  noor.ai / session / <span className="text-echo-text">will-ai-replace-humans.pdf</span>
                </div>
                <div className="flex items-center gap-2 text-[0.7rem] text-echo-muted">
                  <span>Hashim's space</span>
                </div>
              </div>

              {/* 3-pane layout — each pane fades up on scroll with a small
                  cascade so the screenshot reveals itself, not pops. */}
              <div className="grid grid-cols-1 gap-px bg-echo-border/60 lg:grid-cols-[1.1fr_1.4fr_1.1fr]">
                <FadeUp delay={0.10} y={14} duration={0.55}><SourcePane /></FadeUp>
                <FadeUp delay={0.22} y={14} duration={0.55}><NarrationPane /></FadeUp>
                <FadeUp delay={0.34} y={14} duration={0.55}><ReplyPane /></FadeUp>
              </div>

              {/* timeline */}
              <Timeline />
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

function SourcePane() {
  return (
    <div className="bg-echo-bg/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          Sources
        </span>
        <span className="rounded-full border border-echo-border px-2 py-0.5 text-[0.65rem] text-echo-muted">
          1 uploaded
        </span>
      </div>

      <div className="rounded-xl border border-echo-accent bg-echo-bg p-3.5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-echo-accent text-echo-bg">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
              <path d="M14 3v5h5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.85rem] font-medium text-echo-text">
              Will AI Replace Humans? · Essay 03
            </div>
            <div className="text-[0.7rem] text-echo-muted">PDF · 18 pages · 1.2 MB</div>
          </div>
        </div>
        <div className="mt-3 h-1 w-full rounded-full bg-echo-bg">
          <div className="h-full w-full rounded-full bg-echo-accent" />
        </div>
        <div className="mt-2 flex items-center justify-between text-[0.65rem] text-echo-muted">
          <span>Indexed · 132 passages</span>
          <span className="font-semibold text-echo-accent">Ready</span>
        </div>
      </div>

      {/* concept chips */}
      <div className="mt-5">
        <div className="mb-2.5 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          Concepts found
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            'AGI', 'Automation', 'Intelligence Explosion', 'Human–AI Collaboration',
            'Copilots', 'Reasoning', 'Future of Work', 'Alignment',
          ].map((c, i) => (
            <span
              key={c}
              className={[
                'rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold',
                i % 3 === 0
                  ? 'border-echo-accent bg-echo-accent text-echo-bg'
                  : 'border-echo-border bg-echo-bg text-echo-muted',
              ].join(' ')}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function NarrationPane() {
  return (
    <div className="bg-echo-bg/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-echo-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-echo-accent" />
          </span>
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-accent-soft">
            Narrating
          </span>
        </div>
        <span className="font-mono text-[0.68rem] text-echo-muted">04 / 18</span>
      </div>

      {/* Reading paragraph with highlight */}
      <div className="rounded-xl border border-echo-border bg-echo-surface/60 p-4">
        <p className="font-serif text-[0.95rem] leading-relaxed text-echo-text">
          AGI does not simply{' '}
          <span className="rounded bg-echo-accent px-1 font-semibold text-echo-bg">automate tasks</span>
          {' '}— it recursively improves the{' '}
          <span className="rounded bg-echo-accent px-1 font-semibold text-echo-bg">systems</span>
          {' '}that automate tasks. The output of each generation becomes the{' '}
          <span className="text-echo-muted">infrastructure</span>
          {' '}of the next.
        </p>
      </div>

      {/* AI summary card */}
      <div className="mt-4 rounded-xl border border-echo-border bg-echo-text/[0.02] p-4">
        <div className="mb-2 flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          <span className="text-echo-accent">✦</span> AI Summary
        </div>
        <ul className="space-y-1.5 text-[0.82rem] leading-relaxed text-echo-muted">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-echo-accent" />
            Narrow AI optimises a task; AGI optimises the optimisers.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-echo-accent" />
            Each capability tier compounds the next — tools build tools.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-echo-accent" />
            Human leverage shifts from doing to directing.
          </li>
        </ul>
      </div>

      {/* Waveform footer */}
      <div className="mt-4 rounded-xl border border-echo-border bg-echo-bg/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-echo-accent text-echo-bg">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
          <div className="flex-1">
            <Waveform bars={36} height={28} width={2} gap={3} tone="accent" />
          </div>
          <span className="font-mono text-[0.7rem] text-echo-muted">1.0×</span>
        </div>
      </div>
    </div>
  )
}

function ReplyPane() {
  return (
    <div className="bg-echo-bg/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          Conversation
        </span>
        <span className="inline-flex items-center gap-1.5 text-[0.65rem] text-echo-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-echo-sage" />
          live
        </span>
      </div>

      {/* User question */}
      <div className="ml-auto max-w-[260px] rounded-2xl rounded-br-sm border border-echo-border bg-echo-text/[0.04] px-3.5 py-2.5">
        <div className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-echo-muted">
          You
        </div>
        <div className="mt-1 text-[0.85rem] leading-relaxed text-echo-text">
          Would humans still matter in an AGI-driven economy?
        </div>
      </div>

      {/* AI response */}
      <div className="mt-3 rounded-2xl rounded-bl-sm border border-echo-accent bg-echo-bg px-3.5 py-3">
        <div className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-echo-accent">
          <span>✦</span> NoorAI
        </div>
        <p className="mt-1.5 font-serif text-[0.88rem] leading-relaxed text-echo-text">
          Humans may shift from execution toward direction, judgement, and creativity. AGI is excellent at solving stated problems — picking the right problem to solve is still a deeply human act.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full border border-echo-border bg-echo-bg/60 px-2 py-0.5 text-[0.65rem] font-medium text-echo-muted">
            Page 4
          </span>
          <span className="rounded-full border border-echo-border bg-echo-bg/60 px-2 py-0.5 text-[0.65rem] font-medium text-echo-muted">
            Page 7
          </span>
        </div>
      </div>

      {/* Concept relationship */}
      <div className="mt-5 rounded-xl border border-echo-border bg-echo-text/[0.02] p-4">
        <div className="mb-3 text-[0.62rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          Concept link
        </div>
        <div className="flex items-center gap-2 text-[0.82rem]">
          <span className="rounded-md bg-echo-accent px-2 py-1 font-semibold text-echo-bg">AGI</span>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-echo-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="rounded-md border border-echo-border bg-echo-bg px-2 py-1 font-medium text-echo-text">Recursive Self-Improvement</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[0.82rem]">
          <span className="rounded-md border border-echo-border bg-echo-bg px-2 py-1 font-medium text-echo-text">Copilots</span>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-echo-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="rounded-md border border-echo-border bg-echo-bg px-2 py-1 font-medium text-echo-text">Human Direction</span>
        </div>
      </div>
    </div>
  )
}

function Timeline() {
  return (
    <div className="border-t border-echo-border bg-echo-bg/80 px-5 py-3">
      <div className="flex items-center gap-3 text-[0.7rem] text-echo-muted">
        <span className="font-medium uppercase tracking-[0.2em] text-echo-muted">Session</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-echo-bg">
          <div className="absolute inset-y-0 left-0 w-[42%] rounded-full bg-echo-accent" />
          <div className="absolute inset-y-0 left-[42%] w-[2px] bg-echo-text" />
          {/* event markers */}
          {[10, 22, 38, 55, 70, 84].map((p, i) => (
            <span
              key={i}
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 rounded-full border border-echo-bg bg-echo-accent"
              style={{ left: `${p}%` }}
            />
          ))}
        </div>
        <span className="font-mono text-echo-muted">12:48</span>
        <span className="text-echo-text/40">/</span>
        <span className="font-mono text-echo-muted">18:30</span>
      </div>
    </div>
  )
}
