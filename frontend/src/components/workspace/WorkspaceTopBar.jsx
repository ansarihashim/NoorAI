import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/auth.jsx'
import { LogoMark } from '../ui/Logo.jsx'
import Avatar from '../ui/Avatar.jsx'
import { useWorkspace } from './WorkspaceContext.jsx'

/**
 * Single 48px-tall bar across the top of the workspace shell. Holds: brand
 * mark, current document title (when in a session), the two rail toggles
 * (Sources / AI Studio), and the user menu. Intentionally spartan — the
 * navigation lives inside the rails, not up here.
 */
export default function WorkspaceTopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { docs, sourcesCollapsed, setSourcesCollapsed, studioCollapsed, setStudioCollapsed } = useWorkspace()
  const [menuOpen, setMenuOpen] = useState(false)

  const docId = params.docId
  const activeDoc = docId && docs ? docs.find((d) => d.id === docId) : null
  const inSession = location.pathname.startsWith('/app/session/')

  useEffect(() => {
    if (!menuOpen) return
    function onDocPointer(e) {
      if (!e.target.closest('[data-user-menu]')) setMenuOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    // mousedown beats click — closes the menu before any nested click resolves,
    // which avoids the "menu is open but the underlying button stole the event"
    // race we saw on the Sign out button.
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function onSignOut() {
    setMenuOpen(false)
    try {
      await logout()
    } finally {
      // Always leave the protected area, even if the server logout failed.
      navigate('/', { replace: true })
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-rule bg-raised px-3">
      {/* Left cluster — rail toggle + brand + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <RailToggle
          side="left"
          collapsed={sourcesCollapsed}
          onClick={() => setSourcesCollapsed((v) => !v)}
          label="Sources"
        />
        <Link to="/app" className="ml-1 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-elevated">
          <LogoMark size={24} />
          <span className="font-serif text-[1.05rem] font-semibold tracking-tight text-ink">
            Noor<span className="text-accent">AI</span>
          </span>
        </Link>
        {inSession && activeDoc && (
          <>
            <span className="mx-1.5 text-ink-faint">/</span>
            <span className="truncate font-serif text-[0.92rem] font-medium text-ink-muted" title={activeDoc.title}>
              {activeDoc.title}
            </span>
          </>
        )}
      </div>

      {/* Right cluster — studio toggle + user */}
      <div className="flex items-center gap-2">
        <RailToggle
          side="right"
          collapsed={studioCollapsed}
          onClick={() => setStudioCollapsed((v) => !v)}
          label="AI Studio"
        />
        {user && (
          <div className="relative" data-user-menu>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-rule bg-elevated py-1 pl-1.5 pr-3 text-[0.84rem] font-medium text-ink-muted transition-colors duration-150 hover:border-rule-strong hover:bg-float hover:text-ink"
            >
              <Avatar name={user.display_name} email={user.email} size={22} />
              <span className="hidden sm:inline">{user.display_name || user.email.split('@')[0]}</span>
              <svg viewBox="0 0 24 24" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="surface-floating absolute right-0 mt-1.5 w-56 overflow-hidden p-1.5"
                >
                  <div className="px-2.5 py-2">
                    <div className="text-[0.85rem] font-medium text-ink">{user.display_name || 'You'}</div>
                    <div className="mt-0.5 truncate text-[0.75rem] text-ink-dim">{user.email}</div>
                  </div>
                  <div className="divider-soft my-1" />
                  <MenuItem onClick={() => { setMenuOpen(false); navigate('/app') }}>Workspace</MenuItem>
                  <MenuItem onClick={() => { setMenuOpen(false); navigate('/app/settings') }}>Settings</MenuItem>
                  <div className="divider-soft my-1" />
                  <MenuItem tone="accent" onClick={onSignOut}>
                    Sign out
                  </MenuItem>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  )
}

function RailToggle({ side, collapsed, onClick, label }) {
  return (
    <button
      onClick={onClick}
      title={`${collapsed ? 'Open' : 'Collapse'} ${label}`}
      aria-label={`${collapsed ? 'Open' : 'Collapse'} ${label} panel`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {side === 'left' ? (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="15" y1="4" x2="15" y2="20" />
          </>
        )}
      </svg>
    </button>
  )
}

function MenuItem({ children, onClick, tone = 'default' }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[0.85rem] transition-colors',
        tone === 'accent'
          ? 'text-accent hover:bg-accent-soft'
          : 'text-ink-muted hover:bg-elevated hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
