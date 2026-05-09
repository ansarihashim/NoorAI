import { motion } from 'framer-motion'

export default function MicButton({ active, onClick, disabled, level = 0, size = 56 }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={[
        'relative grid place-items-center rounded-full transition-colors',
        active
          ? 'bg-accent-cyan text-bg shadow-glow-cyan'
          : 'bg-white/[0.06] text-ink hover:bg-white/[0.10]',
        'border border-white/[0.08]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      ].join(' ')}
      style={{ width: size, height: size }}
      aria-pressed={active}
      aria-label={active ? 'Stop mic' : 'Start mic'}
    >
      {active && (
        <>
          <span
            className="absolute inset-0 rounded-full bg-accent-cyan/30 animate-ping"
            style={{ animationDuration: '2s' }}
            aria-hidden
          />
          <span
            className="absolute inset-[-6px] rounded-full ring-1 ring-accent-cyan/30"
            style={{ transform: `scale(${1 + Math.min(level * 1.5, 0.4)})`, transition: 'transform 80ms ease-out' }}
            aria-hidden
          />
        </>
      )}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="relative h-6 w-6">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 19v3" strokeLinecap="round" />
      </svg>
    </motion.button>
  )
}
