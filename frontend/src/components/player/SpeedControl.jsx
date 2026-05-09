import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function SpeedControl({ rate, onChange }) {
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

  const label = `${rate.toFixed(rate % 1 === 0 ? 0 : 2)}×`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-pill border border-white/[0.06] bg-white/[0.03] px-2.5 font-mono text-[0.7rem] font-medium tabular-nums text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
      >
        {label}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full right-0 z-30 mb-2 w-24 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-raised/95 shadow-lift backdrop-blur-2xl"
          >
            {SPEEDS.map((s) => {
              const active = Math.abs(s - rate) < 0.01
              return (
                <li key={s}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => { onChange(s); setOpen(false) }}
                    className={[
                      'flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[0.75rem] transition-colors',
                      active ? 'bg-white/[0.06] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                    ].join(' ')}
                  >
                    <span>{s.toFixed(s % 1 === 0 ? 0 : 2)}×</span>
                    {active && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4 4 10-11" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
