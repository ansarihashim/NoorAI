import { motion } from 'framer-motion'

/**
 * Decorative right-rail art for the auth pages — concentric, animated rings of
 * "voice" with a subtle floating waveform. Pure SVG / Framer, no assets.
 */
export default function AuthArt() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden border-l border-white/[0.05] bg-gradient-to-br from-[#10142a] via-[#0c1024] to-[#0a0d1a]">
      <div className="pointer-events-none absolute inset-0 bg-grad-aurora opacity-80" aria-hidden />

      {/* concentric rings */}
      <div className="relative" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.06]"
            style={{
              width: 180 + i * 90,
              height: 180 + i * 90,
              marginLeft: -(180 + i * 90) / 2,
              marginTop: -(180 + i * 90) / 2,
            }}
            animate={{
              scale: [1, 1.04, 1],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 6 + i * 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.4,
            }}
          />
        ))}
        {/* center disc */}
        <motion.div
          className="relative h-32 w-32 rounded-full bg-gradient-to-br from-accent-purple via-[#7c4ce9] to-accent-cyan shadow-[0_30px_80px_-20px_rgba(139,92,246,0.7)]"
          animate={{ scale: [1, 1.025, 1] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 grid place-items-center text-white">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="6" y1="14" x2="6" y2="10" />
              <line x1="10" y1="16" x2="10" y2="8" />
              <line x1="14" y1="14" x2="14" y2="10" />
              <line x1="18" y1="17" x2="18" y2="7" />
            </svg>
          </div>
        </motion.div>
      </div>

      {/* floating quote */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-10 left-10 right-10 max-w-md"
      >
        <p className="text-balance text-[1.05rem] leading-relaxed text-ink/80">
          “It feels like having a study partner who's already read everything I have, and is patient enough to
          explain it again.”
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <span className="inline-block h-6 w-6 rounded-full bg-gradient-to-br from-accent-cyan to-accent-green" />
          <span>Early user · biology, year 2</span>
        </div>
      </motion.div>
    </div>
  )
}
