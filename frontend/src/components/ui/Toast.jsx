import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const ToastCtx = createContext(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4 4 10-11" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v4h1" />
    </svg>
  ),
}

const TONES = {
  success: 'text-accent-green',
  error: 'text-accent-rose',
  info: 'text-accent-cyan-soft',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const handle = timers.current.get(id)
    if (handle) {
      clearTimeout(handle)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    ({ title, description, tone = 'info', duration = 4500 }) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((list) => [...list, { id, title, description, tone }])
      const handle = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, handle)
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="pointer-events-auto w-full max-w-sm"
            >
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="glass-strong group flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left shadow-lift"
              >
                <span className={['mt-0.5', TONES[t.tone]].join(' ')}>{ICONS[t.tone]}</span>
                <span className="flex-1">
                  {t.title && <span className="block text-sm font-medium text-ink">{t.title}</span>}
                  {t.description && (
                    <span className="block text-xs text-ink-muted">{t.description}</span>
                  )}
                </span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
