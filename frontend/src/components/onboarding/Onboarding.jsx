import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '../ui/Button.jsx'
import { LogoMark } from '../ui/Logo.jsx'

const STEPS = [
  {
    title: 'Welcome to EchoVerse',
    body: 'Drop in any document — notes, a chapter, a transcript — and EchoVerse turns it into something you can listen to. Two modes, one upload.',
    art: 'logo',
    cta: "Show me",
  },
  {
    title: 'Speak to interrupt',
    body: 'In Narration mode, just start talking. EchoVerse pauses, answers from your notes, then picks up exactly where it stopped. You can deny mic access — narration still plays, you just can\'t interrupt by voice.',
    art: 'mic',
    cta: 'Got it',
  },
  {
    title: 'Generate a podcast',
    body: 'Want it explained instead of read? Switch to Podcast mode and EchoVerse writes a host + co-host episode about your document. Great for revision or a passive listen.',
    art: 'podcast',
    cta: "Let's start",
  },
]

function Art({ kind }) {
  if (kind === 'logo') {
    return (
      <div className="grid place-items-center">
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="rounded-full p-6"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)' }}
        >
          <LogoMark size={72} />
        </motion.div>
      </div>
    )
  }
  if (kind === 'mic') {
    return (
      <div className="grid place-items-center">
        <div className="relative">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-accent-cyan/30"
              animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.5, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: i * 0.6 }}
              style={{ width: 96, height: 96, marginLeft: -48, marginTop: -48, left: '50%', top: '50%' }}
            />
          ))}
          <div className="relative grid h-24 w-24 place-items-center rounded-full bg-accent-cyan text-bg shadow-glow-cyan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-9 w-9">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0014 0M12 19v3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    )
  }
  // podcast
  return (
    <div className="flex items-center justify-center gap-4">
      {['from-accent-purple to-accent-cyan', 'from-accent-cyan to-accent-green'].map((g, i) => (
        <motion.div
          key={i}
          animate={{ scale: i === 0 ? [1, 1.06, 1] : [1, 1.04, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
          className={['grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br shadow-lift', g].join(' ')}
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="6" y1="14" x2="6" y2="10" />
            <line x1="10" y1="16" x2="10" y2="8" />
            <line x1="14" y1="14" x2="14" y2="10" />
            <line x1="18" y1="17" x2="18" y2="7" />
          </svg>
        </motion.div>
      ))}
    </div>
  )
}

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding"
        className="fixed inset-0 z-[80] flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="glass-strong relative w-full max-w-md overflow-hidden p-8 shadow-lift"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-xs text-ink-faint hover:text-ink"
          >
            Skip
          </button>
          <div className="h-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <Art kind={s.art} />
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${step}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="mt-6 text-center"
            >
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{s.title}</h2>
              <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-7 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  'h-1.5 rounded-pill transition-all duration-300',
                  i === step ? 'w-6 bg-gradient-to-r from-accent-purple to-accent-cyan' : 'w-1.5 bg-white/[0.10]',
                ].join(' ')}
              />
            ))}
          </div>
          <div className="mt-7 flex justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => (last ? onClose() : setStep((s) => s + 1))}
            >
              {s.cta}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
