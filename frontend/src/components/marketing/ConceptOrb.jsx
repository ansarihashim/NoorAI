import { motion, useReducedMotion } from 'framer-motion'

/**
 * The "AI narration orb" — a layered radial gradient sphere that breathes.
 * Used in hero + auth pages as the centerpiece "knowledge becoming alive" visual.
 */
export default function ConceptOrb({ size = 220, label = 'Listening', className = '' }) {
  const reduce = useReducedMotion()
  return (
    <div
      className={['relative inline-flex items-center justify-center', className].join(' ')}
      style={{ width: size, height: size }}
    >
      {/* Outer halo */}
      <motion.span
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 1.6,
          height: size * 1.6,
          background:
            'radial-gradient(circle at 50% 50%, rgba(217,160,102,0.22), rgba(217,160,102,0.06) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Mid ring */}
      <motion.span
        aria-hidden
        className="absolute rounded-full border border-echo-accent/30"
        style={{ width: size * 1.18, height: size * 1.18 }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
      >
        <span
          className="absolute h-1.5 w-1.5 rounded-full bg-echo-accent shadow-[0_0_14px_rgba(217,160,102,0.9)]"
          style={{ top: '-3px', left: '50%', transform: 'translateX(-50%)' }}
        />
      </motion.span>

      {/* Thin orbit */}
      <motion.span
        aria-hidden
        className="absolute rounded-full border border-echo-accent/15"
        style={{ width: size * 0.92, height: size * 0.92 }}
        animate={reduce ? undefined : { rotate: -360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      >
        <span className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-echo-text/70" />
      </motion.span>

      {/* Core sphere */}
      <motion.span
        aria-hidden
        className="relative rounded-full"
        style={{
          width: size * 0.66,
          height: size * 0.66,
          background:
            'radial-gradient(circle at 35% 30%, #F5D4A6 0%, #D9A066 35%, #8C5A2B 70%, #2A1A10 100%)',
          boxShadow:
            '0 0 60px rgba(217,160,102,0.5), inset 0 -20px 40px rgba(0,0,0,0.55), inset 0 20px 30px rgba(245,235,221,0.18)',
        }}
        animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span
          aria-hidden
          className="absolute left-[18%] top-[16%] h-[28%] w-[34%] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(255,245,225,0.7) 0%, rgba(255,245,225,0) 65%)',
            filter: 'blur(2px)',
          }}
        />
      </motion.span>

      {label && (
        <span className="pointer-events-none absolute bottom-[-30px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.68rem] font-medium uppercase tracking-[0.22em] text-echo-muted">
          {label}
        </span>
      )}
    </div>
  )
}
