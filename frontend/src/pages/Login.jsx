import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import { LogoMark } from '../components/ui/Logo.jsx'
import AuthArt from '../components/auth/AuthArt.jsx'

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
    <AuthLayout>
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <LogoMark size={22} />
          <span>EchoVerse</span>
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-muted">Sign in to keep listening to your notes.</p>
        </motion.div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          New here?{' '}
          <Link to="/signup" className="text-accent-purple-soft hover:text-accent-cyan-soft">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export function AuthLayout({ children }) {
  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1fr_minmax(0,1.05fr)]">
      <div className="flex items-center justify-center px-6 py-16 sm:px-10">{children}</div>
      <div className="relative hidden overflow-hidden lg:block">
        <AuthArt />
      </div>
    </div>
  )
}
