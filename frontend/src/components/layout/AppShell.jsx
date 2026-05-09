import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import TopNav from './TopNav.jsx'

export default function AppShell({ children, variant = 'app' }) {
  const location = useLocation()
  return (
    <div className="relative isolate min-h-screen">
      <TopNav variant={variant} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
