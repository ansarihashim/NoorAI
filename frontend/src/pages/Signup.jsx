import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import { LogoMark } from '../components/ui/Logo.jsx'
import { AuthLayout } from './Login.jsx'

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
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Create your space</h1>
          <p className="mt-2 text-sm text-ink-muted">It takes a minute. No card.</p>
        </motion.div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input
            label="Name"
            placeholder="What should we call you?"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            hint="Optional."
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          <Button type="submit" size="lg" loading={busy} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          Already with us?{' '}
          <Link to="/login" className="text-accent-purple-soft hover:text-accent-cyan-soft">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
