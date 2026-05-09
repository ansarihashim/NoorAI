import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function Dialog({ open, onClose, title, description, children, maxWidth = 'max-w-md' }) {
  const lastFocused = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    lastFocused.current = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    // basic focus shift
    const t = setTimeout(() => containerRef.current?.focus(), 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      try { lastFocused.current?.focus?.() } catch {}
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={containerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className={[
              'glass-strong relative w-full p-6 shadow-lift outline-none',
              maxWidth,
            ].join(' ')}
          >
            {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            <div className={title || description ? 'mt-4' : ''}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
