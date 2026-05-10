import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import NoorMark from '../components/ui/NoorMark.jsx'

function FormField({ label, type = 'text', value, onChange, placeholder, error, hint, autoComplete, required }) {
  const [focused, setFocused] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.78rem] font-medium text-echo-muted">
        {label}
      </span>
      <span
        className={[
          'flex items-center rounded-lg border bg-echo-bg transition-colors duration-150',
          error
            ? 'border-red-400/60'
            : focused
              ? 'border-echo-accent shadow-[0_0_0_3px_rgba(245,185,66,0.18)]'
              : 'border-echo-border hover:border-echo-border-strong',
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
          className="w-full bg-transparent px-4 py-3 text-[0.95rem] text-echo-text placeholder:text-echo-muted/55 focus:outline-none"
        />
      </span>
      {(error || hint) && (
        <span className={['mt-1.5 block text-[0.78rem]', error ? 'text-red-300/90' : 'text-echo-muted'].join(' ')}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
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
    try {
      const user = await signup({ email: email.trim(), password, displayName: displayName.trim() })
      try { localStorage.setItem('echoverse.firstRun', '1') } catch {}
      toast.success(`Welcome aboard, ${user.display_name || user.email.split('@')[0]}`, 'Your space is ready.')
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
    <div className="min-h-screen w-full bg-echo-bg">
      <header className="flex items-center justify-between border-b border-echo-border px-5 py-4 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <NoorMark size={28} />
          <span className="font-serif text-[1.05rem] font-semibold tracking-tight text-echo-text">
            Noor<span className="text-echo-accent">AI</span>
          </span>
        </Link>
        <Link
          to="/"
          className="text-[0.86rem] font-medium text-echo-muted transition-colors duration-150 hover:text-echo-text"
        >
          Back home
        </Link>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-start justify-center px-5 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="rounded-xl border border-echo-border bg-echo-surface">
            <div className="border-b border-echo-border px-7 py-5 text-center">
              <h1 className="font-serif text-[1.4rem] font-semibold tracking-tight text-echo-text">
                Sign up
              </h1>
            </div>

            <div className="px-7 py-6">
              <h2 className="font-serif text-[1.5rem] font-semibold leading-snug tracking-tight text-echo-text">
                Create your study space
              </h2>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-echo-muted">
                Sixty seconds. No card. Bring a PDF and start listening.
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
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
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-echo-accent text-[0.95rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright disabled:opacity-70 active:scale-[0.985]"
                >
                  {busy ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-echo-bg/60 border-r-transparent" />
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>
            </div>

            <div className="border-t border-echo-border px-7 py-4 text-center text-[0.86rem] text-echo-muted">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-echo-text underline decoration-echo-accent decoration-2 underline-offset-4 transition-colors duration-150 hover:text-echo-accent"
              >
                Log in
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-[0.78rem] text-echo-dim">
            By continuing you agree to our{' '}
            <a href="#" className="underline underline-offset-2 hover:text-echo-text">Terms</a>{' '}and{' '}
            <a href="#" className="underline underline-offset-2 hover:text-echo-text">Privacy</a>.
          </p>
        </div>
      </main>
    </div>
  )
}
