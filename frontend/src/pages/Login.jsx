import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useSound } from '../lib/sound.jsx'
import NoorMark from '../components/ui/NoorMark.jsx'
import {
  NotebookPage,
  NotebookEyebrow,
  NotebookDisplay,
} from '../components/ui/NotebookSurface.jsx'
import { DEMO_MODE, DEMO_CREDENTIALS, disableDemoMode } from '../config/demo.js'

/**
 * Login is rendered as a notebook spread:
 *   left "title page"  → brand mark, illuminated heading, three TOC items
 *                         that hint at what's behind the login.
 *   right "sign-in page" → ruled NotebookPage with an academic margin gutter,
 *                         eyebrow + serif heading + form. Yellow draws the
 *                         eye to the call-to-action button only.
 *
 * No gradients, no glow, no fog. Pure black + ruled paper + vivid yellow.
 */

function FormField({ label, type = 'text', value, onChange, placeholder, error, autoComplete, required }) {
  const [focused, setFocused] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="nb-eyebrow">{label}</span>
        {error && <span className="text-[0.7rem] text-red-300/90">{error}</span>}
      </span>
      <span
        className={[
          'flex items-center rounded-lg border bg-page transition-colors duration-150',
          error
            ? 'border-red-400/60'
            : focused
              ? 'border-accent shadow-[0_0_0_3px_rgba(255,214,10,0.18)]'
              : 'border-rule hover:border-rule-strong',
        ].join(' ')}
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-transparent px-4 py-3 font-serif text-[1rem] text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </span>
    </label>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { play } = useSound()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function nextPath() {
    const sp = new URLSearchParams(location.search)
    return sp.get('next') || '/app'
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    play('tap')
    try {
      const user = await login({ email: email.trim(), password })
      play('page')
      toast.success(`Welcome back, ${user.display_name || user.email.split('@')[0]}`)
      navigate(nextPath(), { replace: true })
    } catch (err) {
      const msg = err?.message || 'Sign in failed'
      setError(msg.toLowerCase().includes('invalid') ? 'Invalid email or password.' : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-page text-ink">
      {/* Page-wide drafting grid + ruled lines, low opacity */}
      <span aria-hidden className="notebook-grid pointer-events-none absolute inset-0 -z-10" />
      <span aria-hidden className="notebook-rule pointer-events-none absolute inset-0 -z-10" />

      {/* Slim top bar — keeps the page reading like editorial chrome */}
      <header className="flex items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:py-5 lg:px-10">
        <Link to="/" className="inline-flex min-w-0 items-center gap-2.5">
          <NoorMark size={28} />
          <span className="truncate font-serif text-[1.05rem] font-semibold tracking-tight text-ink">
            Noor<span className="text-accent">AI</span>
          </span>
        </Link>
        <Link
          to="/"
          className="shrink-0 text-[0.82rem] font-medium text-ink-muted transition-colors duration-150 hover:text-ink sm:text-[0.84rem]"
        >
          ← <span className="hidden sm:inline">Back to the cover</span>
          <span className="sm:hidden">Cover</span>
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-8 px-4 pb-16 pt-4 sm:px-8 sm:pb-20 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:px-10 lg:pt-14">
        {/* === Left "title page" =========================================== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:pt-12"
        >
          <NotebookEyebrow accent>Volume i · sign in</NotebookEyebrow>
          <NotebookDisplay className="mt-4 break-words text-[clamp(1.7rem,7vw,3.4rem)]">
            Open your{' '}
            <span className="text-accent">illuminated notebook.</span>
          </NotebookDisplay>
          <p className="mt-4 max-w-md text-[clamp(0.95rem,2.6vw,1rem)] leading-[1.6] text-ink-muted sm:mt-5 sm:leading-[1.65]">
            Pick up where you left off — your sources, annotations, and study
            scope are exactly where you left them.
          </p>

          {/* Three "table of contents" items — hint at what's behind the door.
              Hidden on mobile to keep the auth card above the fold. */}
          <ol className="mt-8 hidden max-w-sm space-y-3 sm:mt-10 md:block">
            {[
              { n: '01', t: 'Your sources, indexed.', d: 'Every PDF chunked, embedded, ready for retrieval.' },
              { n: '02', t: 'Annotations restored.',  d: 'Bookmarks, last-read positions, and study scope persist.' },
              { n: '03', t: 'AI margin notes ready.', d: 'Generate, ask, narrate — citations always traceable.' },
            ].map((row) => (
              <li key={row.n} className="flex items-start gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rule bg-raised font-mono text-[0.7rem] font-semibold tabular-nums text-accent">
                  {row.n}
                </span>
                <div>
                  <div className="font-serif text-[0.98rem] font-medium text-ink">{row.t}</div>
                  <div className="mt-0.5 text-[0.84rem] text-ink-dim">{row.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* === Right "sign-in page" ======================================== */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <NotebookPage margin className="px-5 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8">
            <NotebookEyebrow>page · 01</NotebookEyebrow>
            <h2 className="mt-3 font-serif text-[clamp(1.4rem,4.5vw,1.6rem)] font-semibold leading-tight tracking-tight text-ink">
              Welcome back.
            </h2>
            <p className="mt-1.5 text-[0.9rem] text-ink-muted">
              Sign in to keep illuminating your notes.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <FormField
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FormField
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
                required
              />

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[0.95rem] font-semibold text-page transition-colors duration-150 hover:bg-accent-bright disabled:opacity-70 active:scale-[0.985]"
              >
                {busy ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-page/60 border-r-transparent" />
                ) : (
                  <>
                    <span>Continue</span>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </>
                )}
              </button>

              <DemoHint onUse={(e, p) => { setEmail(e); setPassword(p) }} />
            </form>

            <div className="mt-7 border-t border-rule pt-5 text-center text-[0.84rem] text-ink-muted">
              New to NoorAI?{' '}
              <Link
                to="/signup"
                className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-150 hover:text-accent"
              >
                Begin a notebook
              </Link>
            </div>
          </NotebookPage>

          <p className="mt-6 text-center text-[0.74rem] text-ink-faint">
            By continuing you agree to our{' '}
            <a href="#" className="underline underline-offset-2 hover:text-ink">Terms</a>{' '}and{' '}
            <a href="#" className="underline underline-offset-2 hover:text-ink">Privacy</a>.
          </p>
        </motion.div>
      </main>
    </div>
  )
}

// Kept exported so legacy imports (Signup -> AuthLayout) still resolve.
export function AuthLayout({ children }) {
  return <div className="min-h-screen w-full bg-page text-ink">{children}</div>
}

/**
 * In demo mode (the public Vercel build), surface the canonical demo
 * credentials right next to the form. One click prefills both fields so a
 * recruiter doesn't have to type — the experience starts faster than the
 * "what's the password again?" friction of a sandbox login.
 *
 * Renders nothing when VITE_DEMO_MODE is off.
 */
function DemoHint({ onUse }) {
  if (!DEMO_MODE) return null
  return (
    <div className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/30 px-3.5 py-3 text-[0.78rem] leading-snug text-ink-muted">
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-breathe" />
        <span className="font-medium uppercase tracking-[0.14em] text-[0.66rem] text-accent">
          Demo workspace
        </span>
      </div>
      <p className="mt-1.5 text-ink-muted">
        Public preview · sign in with{' '}
        <code className="rounded bg-page/60 px-1 font-mono text-ink">{DEMO_CREDENTIALS.email}</code>{' '}
        and{' '}
        <code className="rounded bg-page/60 px-1 font-mono text-ink">{DEMO_CREDENTIALS.password}</code>.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onUse?.(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password)}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-page/40 px-2.5 py-1 text-[0.76rem] font-medium text-ink transition-colors hover:bg-page/70"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
          Prefill demo credentials
        </button>
        <button
          type="button"
          onClick={() => disableDemoMode({ redirectTo: '/login' })}
          className="inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1 text-[0.76rem] font-medium text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
        >
          Use my own credentials →
        </button>
      </div>
      <p className="mt-2 text-[0.7rem] leading-snug text-ink-faint">
        Real signups require demo mode to be off. Click <span className="text-ink-muted">Use my own credentials</span> to exit demo and unlock real sign-up.
      </p>
    </div>
  )
}
