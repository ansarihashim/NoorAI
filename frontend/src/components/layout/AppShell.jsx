import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import TopNav from './TopNav.jsx'

/**
 * Public shell. Used by Landing / Login / Signup / NotFound.
 * - variant="marketing": premium full-bleed surface, page-owned nav, page scroll.
 * - variant="app" / default: legacy TopNav + warm-dark page.
 */
export default function AppShell({ children, variant = 'app' }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const isMarketing = variant === 'marketing'

  // Marketing pages need page scroll; the workspace pins body to 100vh.
  useEffect(() => {
    if (!isMarketing) return
    document.documentElement.classList.add('echo-marketing')
    return () => document.documentElement.classList.remove('echo-marketing')
  }, [isMarketing])

  if (isMarketing) {
    return (
      <div className="relative min-h-screen w-full bg-echo-bg text-echo-text antialiased">
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-page text-ink">
      <TopNav variant={variant} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -2 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
