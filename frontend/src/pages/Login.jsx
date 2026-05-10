import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import NoorMark from '../components/ui/NoorMark.jsx'

function FormField({ label, type = 'text', value, onChange, placeholder, error, autoComplete, required }) {
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
      {error && (
        <span className="mt-1.5 block text-[0.78rem] text-red-300/90">
          {error}
        </span>
      )}
    </label>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
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
    try {
      const user = await login({ email: email.trim(), password })
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
    <div className="min-h-screen w-full bg-echo-bg">
      {/* Slim header */}
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

      {/* Centered auth card */}
      <main className="flex min-h-[calc(100vh-65px)] items-start justify-center px-5 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-[420px]">
          <div className="rounded-xl border border-echo-border bg-echo-surface">
            <div className="border-b border-echo-border px-7 py-5 text-center">
              <h1 className="font-serif text-[1.4rem] font-semibold tracking-tight text-echo-text">
                Log in
              </h1>
            </div>

            <div className="px-7 py-6">
              <h2 className="font-serif text-[1.5rem] font-semibold leading-snug tracking-tight text-echo-text">
                Welcome back to NoorAI
              </h2>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-echo-muted">
                Sign in to keep narrating your notes.
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
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

                <label className="inline-flex items-center gap-2 pt-1 text-[0.84rem] text-echo-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-echo-border bg-echo-bg accent-echo-accent"
                  />
                  Stay signed in
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-echo-accent text-[0.95rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright disabled:opacity-70 active:scale-[0.985]"
                >
                  {busy ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-echo-bg/60 border-r-transparent" />
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
            </div>

            <div className="border-t border-echo-border px-7 py-4 text-center text-[0.86rem] text-echo-muted">
              New to NoorAI?{' '}
              <Link
                to="/signup"
                className="font-semibold text-echo-text underline decoration-echo-accent decoration-2 underline-offset-4 transition-colors duration-150 hover:text-echo-accent"
              >
                Create an account
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

// Kept exported so legacy imports (Signup -> AuthLayout) still resolve.
export function AuthLayout({ children }) {
  return <div className="min-h-screen w-full bg-echo-bg text-echo-text">{children}</div>
}
