import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

function VolumeIcon({ volume, muted }) {
  if (muted || volume === 0) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M22 9l-6 6M16 9l6 6" />
      </svg>
    )
  }
  if (volume < 0.5) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 010 7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 010 7" />
      <path d="M19 5a9 9 0 010 14" />
    </svg>
  )
}

export default function VolumeControl({ volume, muted, onVolume, onMuted }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div className="inline-flex h-8 items-center gap-2 rounded-pill border border-white/[0.06] bg-white/[0.03] px-2 text-ink-muted">
        <button
          onClick={() => onMuted(!muted)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <VolumeIcon volume={volume} muted={muted} />
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="hidden font-mono text-[0.7rem] tabular-nums sm:inline"
        >
          {Math.round(muted ? 0 : volume * 100)}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full right-0 z-30 mb-2 w-44 rounded-xl border border-white/[0.08] bg-surface-raised/95 px-3 py-3 shadow-lift backdrop-blur-2xl"
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (muted && v > 0) onMuted(false)
                onVolume(v)
              }}
              className="w-full accent-accent-purple"
              aria-label="Volume"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
