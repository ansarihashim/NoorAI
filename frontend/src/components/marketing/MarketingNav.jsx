import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import NoorMark from '../ui/NoorMark.jsx'
import { disableDemoMode, isDemoModeActiveNow } from '../../config/demo.js'

/** Click handler for "Sign in" / "Get started" in the marketing nav.
 *  If demo mode is active, force-exits demo on the way to the auth page
 *  so real credentials are accepted on the other side. */
function goToRealAuth(destination, navigate) {
  if (isDemoModeActiveNow()) {
    disableDemoMode({ redirectTo: destination })
  } else {
    navigate(destination)
  }
}

const links = [
  { label: 'Features', href: '#study-modes' },
  { label: 'Modes', href: '#demo' },
]

function NoorLogo({ size = 30 }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <NoorMark size={size} animated />
      <span className="font-serif text-[1.1rem] font-medium tracking-tight text-echo-text">
        Noor<span className="text-echo-accent-soft">AI</span>
      </span>
    </span>
  )
}

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={[
          'fixed inset-x-0 top-0 z-50 transition-all duration-200 ease-out',
          scrolled
            ? 'border-b border-echo-border bg-echo-bg'
            : 'border-b border-transparent bg-transparent',
        ].join(' ')}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link to="/" className="group flex min-w-0 items-center">
            <NoorLogo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative rounded-full px-4 py-2 text-[0.88rem] font-medium text-echo-text/85 transition-colors hover:text-echo-accent-soft"
              >
                <span className="relative z-10">{l.label}</span>
                <span className="absolute inset-0 rounded-full bg-echo-accent/0 ring-0 transition-all duration-300 group-hover:bg-echo-accent/[0.10] group-hover:ring-1 group-hover:ring-echo-accent/30" />
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => goToRealAuth('/login', navigate)}
              className="hidden rounded-full px-3 py-2 text-[0.88rem] font-medium text-echo-text/85 transition-colors hover:text-echo-accent-soft sm:inline-block"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => goToRealAuth('/signup', navigate)}
              className="group inline-flex h-9 items-center gap-1.5 rounded-md bg-echo-accent px-3 text-[0.84rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright active:scale-[0.985] sm:px-4"
            >
              <span>Get started</span>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-echo-border text-echo-text lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {open ? (
                  <>
                    <path d="M5 5l14 14" />
                    <path d="M19 5L5 19" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-16 z-40 border-b border-echo-border bg-echo-bg lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-5 sm:px-8">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-[0.95rem] font-medium text-echo-text/90 hover:bg-echo-text/[0.04]"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 h-px w-full bg-echo-border" />
              <button
                type="button"
                onClick={() => { setOpen(false); goToRealAuth('/login', navigate) }}
                className="rounded-lg px-3 py-3 text-left text-[0.95rem] font-medium text-echo-muted hover:text-echo-text"
              >
                Sign in
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
