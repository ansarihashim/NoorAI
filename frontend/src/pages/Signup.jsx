import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

function FormField({ label, type = 'text', value, onChange, placeholder, error, hint, autoComplete, required }) {
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
      {hint && !error && (
        <span className="mt-1.5 block text-[0.74rem] text-ink-dim">{hint}</span>
      )}
    </label>
  )
}

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { play } = useSound()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!email.trim()) e.email = 'Email is required.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = 'Please enter a valid email.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    play('tap')
    try {
      const user = await signup({ email: email.trim(), password, displayName: displayName.trim() })
      try { localStorage.setItem('echoverse.firstRun', '1') } catch {}
      play('page')
      toast.success(`Welcome, ${user.display_name || user.email.split('@')[0]}`, 'Your notebook is ready.')
      navigate('/app', { replace: true })
    } catch (err) {
      const msg = err?.message || 'Sign up failed'
      if (msg.toLowerCase().includes('already')) {
        setErrors({ email: 'That email is already registered.' })
      } else {
        toast.error('Sign up failed', msg)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-page text-ink">
      <span aria-hidden className="notebook-grid pointer-events-none absolute inset-0 -z-10" />
      <span aria-hidden className="notebook-rule pointer-events-none absolute inset-0 -z-10" />

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
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:pt-12"
        >
          <NotebookEyebrow accent>Volume i · begin</NotebookEyebrow>
          <NotebookDisplay className="mt-4 break-words text-[clamp(1.7rem,7vw,3.4rem)]">
            Begin a{' '}
            <span className="text-accent">new notebook.</span>
          </NotebookDisplay>
          <p className="mt-4 max-w-md text-[clamp(0.95rem,2.6vw,1rem)] leading-[1.6] text-ink-muted sm:mt-5 sm:leading-[1.65]">
            One blank notebook, your private RAG index, and an AI scholar in
            the margin. No card needed; setup takes under a minute.
          </p>

          <ol className="mt-8 hidden max-w-sm space-y-3 sm:mt-10 md:block">
            {[
              { n: '01', t: 'Bring a source.',         d: 'Drop a PDF or paste your notes — chunked + embedded locally.' },
              { n: '02', t: 'Open a study mode.',      d: 'Preparation, Revision, Narration, or a Podcast discussion.' },
              { n: '03', t: 'Annotate by asking.',     d: 'Every answer cites the chunks it drew from. Always traceable.' },
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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <NotebookPage margin className="px-5 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8">
            <NotebookEyebrow>page · 01</NotebookEyebrow>
            <h2 className="mt-3 font-serif text-[clamp(1.4rem,4.5vw,1.6rem)] font-semibold leading-tight tracking-tight text-ink">
              Create your study space.
            </h2>
            <p className="mt-1.5 text-[0.9rem] text-ink-muted">
              Sixty seconds. Bring a PDF and start listening.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <FormField
                label="Name"
                autoComplete="name"
                placeholder="What should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                hint="Optional."
              />
              <FormField
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
              />
              <FormField
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
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
                    <span>Open the notebook</span>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-rule pt-5 text-center text-[0.84rem] text-ink-muted">
              Already have a notebook?{' '}
              <Link
                to="/login"
                className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 transition-colors duration-150 hover:text-accent"
              >
                Sign in
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
