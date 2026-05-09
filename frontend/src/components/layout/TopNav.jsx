import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/auth.jsx'
import Logo from '../ui/Logo.jsx'
import Avatar from '../ui/Avatar.jsx'
import Button from '../ui/Button.jsx'

const APP_NAV = [
  { to: '/app', label: 'Upload' },
  { to: '/app/library', label: 'Library' },
]

export default function TopNav({ variant = 'app' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [hidden, setHidden] = useState(false)
  const lastScroll = useRef(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const delta = y - lastScroll.current
      if (y < 80) setHidden(false)
      else if (delta > 6) setHidden(true)
      else if (delta < -6) setHidden(false)
      lastScroll.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (!e.target.closest('[data-user-menu]')) setMenuOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [menuOpen])

  return (
    <motion.header
      initial={false}
      animate={{ y: hidden ? -80 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="sticky top-0 z-40 backdrop-blur-xl"
    >
      <div className="border-b border-white/[0.05] bg-bg/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <Link to={user ? '/app' : '/'} className="group flex items-center gap-2">
              <Logo size={26} />
            </Link>
            {user && variant === 'app' && (
              <nav className="hidden items-center gap-1 rounded-pill border border-white/[0.06] bg-white/[0.02] p-1 sm:inline-flex">
                {APP_NAV.map((n) => {
                  const active = location.pathname === n.to || (n.to === '/app/library' && location.pathname.startsWith('/app/library'))
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={[
                        'rounded-pill px-3 py-1 text-xs font-medium transition-colors',
                        active ? 'bg-white/[0.08] text-ink' : 'text-ink-muted hover:text-ink',
                      ].join(' ')}
                    >
                      {n.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {variant === 'marketing' && !user && (
              <>
                <Link to="/login" className="hidden text-sm text-ink-muted hover:text-ink sm:inline">
                  Sign in
                </Link>
                <Button as={Link} to="/signup" size="sm" variant="primary">
                  Get started
                </Button>
              </>
            )}
            {user && (
              <div className="relative" data-user-menu>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-pill border border-white/[0.06] bg-white/[0.03] py-1 pl-1 pr-3 text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  <Avatar name={user.display_name} email={user.email} size={28} />
                  <span className="hidden sm:inline">{user.display_name || user.email.split('@')[0]}</span>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-raised/95 shadow-lift backdrop-blur-2xl"
                    >
                      <div className="px-3.5 py-3">
                        <div className="text-sm font-medium text-ink">{user.display_name || 'You'}</div>
                        <div className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</div>
                      </div>
                      <div className="border-t border-white/[0.05]" />
                      <button
                        onClick={() => { setMenuOpen(false); navigate('/app') }}
                        className="block w-full px-3.5 py-2 text-left text-sm text-ink-muted hover:bg-white/[0.04] hover:text-ink"
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); navigate('/app/library') }}
                        className="block w-full px-3.5 py-2 text-left text-sm text-ink-muted hover:bg-white/[0.04] hover:text-ink"
                      >
                        Library
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); navigate('/app/settings') }}
                        className="block w-full px-3.5 py-2 text-left text-sm text-ink-muted hover:bg-white/[0.04] hover:text-ink"
                      >
                        Settings
                      </button>
                      <div className="my-1 border-t border-white/[0.05]" />
                      <button
                        onClick={() => { setMenuOpen(false); logout(); navigate('/') }}
                        className="block w-full px-3.5 py-2 text-left text-sm text-accent-rose/90 hover:bg-accent-rose/10"
                      >
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  )
}
