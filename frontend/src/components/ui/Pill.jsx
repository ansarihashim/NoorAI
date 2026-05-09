const TONES = {
  neutral: { dot: 'bg-ink-dim', wash: 'bg-white/[0.04] text-ink-muted', pulse: false },
  purple:  { dot: 'bg-accent-purple', wash: 'bg-accent-purple/10 text-accent-purple-soft', pulse: true },
  cyan:    { dot: 'bg-accent-cyan',   wash: 'bg-accent-cyan/10 text-accent-cyan-soft',   pulse: true },
  green:   { dot: 'bg-accent-green',  wash: 'bg-accent-green/10 text-accent-green',       pulse: true },
  amber:   { dot: 'bg-accent-amber',  wash: 'bg-accent-amber/10 text-accent-amber',       pulse: true },
  rose:    { dot: 'bg-accent-rose',   wash: 'bg-accent-rose/10 text-accent-rose',         pulse: false },
}

const SIZES = {
  sm: 'h-6 px-2.5 text-[0.6875rem] gap-1.5',
  md: 'h-7 px-3 text-xs gap-2',
}

export default function Pill({ tone = 'neutral', size = 'md', dot = true, children, className = '' }) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <span
      className={[
        'inline-flex items-center rounded-pill font-medium uppercase tracking-[0.08em]',
        'border border-white/[0.06]',
        SIZES[size],
        t.wash,
        className,
      ].join(' ')}
    >
      {dot && (
        <span className="relative inline-flex">
          <span className={['inline-block h-1.5 w-1.5 rounded-full', t.dot].join(' ')} />
          {t.pulse && (
            <span
              className={['absolute inset-0 inline-block h-1.5 w-1.5 rounded-full opacity-75 animate-ping', t.dot].join(' ')}
            />
          )}
        </span>
      )}
      {children}
    </span>
  )
}
