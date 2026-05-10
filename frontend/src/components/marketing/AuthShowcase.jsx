import { motion, useReducedMotion } from 'framer-motion'
import NoorMark from '../ui/NoorMark.jsx'
import Waveform from './Waveform.jsx'

/**
 * Right-side "warm study lamp" panel for auth pages. No orbs, no spheres.
 *
 * Composition:
 *   - solid #050505 floor with a tight, sharp top-down warm cone
 *   - the NoorMark mashaal as the centerpiece (animated, large, bright)
 *   - a single live "Currently explaining" card under it
 *   - sharp ember particles drifting upward
 *
 * The energy is from the mashaal + sharp amber edges, not from blurred glow.
 */
export default function AuthShowcase({
  topic = 'Ensemble Learning',
  subtopic = 'Random Forest',
}) {
  const reduce = useReducedMotion()

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-echo-bg">
      {/* sharp tungsten cone from top — no blur halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%]"
        style={{
          background:
            'radial-gradient(50% 70% at 50% 0%, rgba(255,214,10,0.10), transparent 70%)',
        }}
      />
      {/* fine grid */}
      <div className="echo-grid pointer-events-none absolute inset-0 opacity-25" />

      {/* drifting sharp embers */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }).map((_, i) => {
            const x = ((i * 41) % 100)
            const y = 30 + ((i * 73) % 70)
            const dur = 14 + ((i * 11) % 14)
            const delay = (i * 0.6) % 9
            return (
              <motion.span
                key={i}
                className="absolute h-[3px] w-[3px] rounded-full bg-echo-accent-soft"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  boxShadow: '0 0 8px rgba(255,200,87,0.95)',
                }}
                animate={{ y: [0, -70, 0], opacity: [0, 0.95, 0] }}
                transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay }}
              />
            )
          })}
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center px-8">
        {/* live eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-echo-border bg-echo-bg px-3 py-1"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-echo-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-echo-accent" />
          </span>
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-echo-accent-soft">
            Mashaal lit · narrating session 04
          </span>
        </motion.div>

        {/* Mashaal centerpiece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-10"
        >
          {/* pedestal — a sharp horizontal line under the mashaal */}
          <div
            aria-hidden
            className="absolute left-1/2 top-full mt-3 h-px w-48 -translate-x-1/2"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,200,87,0.85), transparent)',
            }}
          />
          <NoorMark size={210} animated withChrome={false} />
        </motion.div>

        {/* topic card — solid black, hairline amber, sharp top edge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="echo-top-edge mt-14 w-full rounded-xl border border-echo-border bg-echo-surface p-5"
        >
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-echo-accent-deep">
            Currently explaining
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-echo-accent px-2 py-1 font-serif text-[0.95rem] font-semibold text-echo-bg">
              {topic}
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-echo-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="rounded-md border border-echo-border bg-echo-bg px-2 py-1 font-serif text-[0.95rem] font-medium text-echo-text">
              {subtopic}
            </span>
          </div>

          <div className="mt-4">
            <Waveform bars={36} height={32} width={2} gap={3} tone="accent" />
          </div>

          <div className="mt-4 space-y-2">
            <Bubble side="ai" delay={0.6}>
              A random forest is many decision trees voting together — each tree sees a different slice of the data.
            </Bubble>
            <Bubble side="me" delay={1.4}>
              So they're like a panel of experts disagreeing politely?
            </Bubble>
            <Bubble side="ai" delay={2.2}>
              Almost. They disagree, then average the answer. Each tree is biased differently — the average is smarter.
            </Bubble>
          </div>
        </motion.div>

        {/* concept chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 grid w-full grid-cols-3 gap-2"
        >
          {['Decision Tree', 'Bagging', 'Boosting'].map((c, i) => (
            <span
              key={c}
              className={[
                'rounded-md border px-3 py-1.5 text-center text-[0.74rem] font-semibold',
                i === 0
                  ? 'border-echo-accent bg-echo-accent text-echo-bg'
                  : 'border-echo-border bg-echo-surface text-echo-text',
              ].join(' ')}
            >
              {c}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function Bubble({ side, children, delay = 0 }) {
  const isMe = side === 'me'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={['flex w-full', isMe ? 'justify-end' : 'justify-start'].join(' ')}
    >
      <span
        className={[
          'inline-block max-w-[85%] rounded-md px-3 py-2 font-serif text-[0.82rem] leading-relaxed',
          isMe
            ? 'rounded-br-sm border border-echo-border bg-echo-bg text-echo-text'
            : 'rounded-bl-sm border border-echo-accent bg-echo-bg text-echo-text',
        ].join(' ')}
      >
        {children}
      </span>
    </motion.div>
  )
}
