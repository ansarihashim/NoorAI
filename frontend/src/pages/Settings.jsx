import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import VoicePicker from '../components/settings/VoicePicker.jsx'

const PREFS_KEY = 'echoverse.prefs'

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch {}
}

function Section({ title, description, children }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <Card className="p-0">
        {children}
      </Card>
    </section>
  )
}

function Row({ children, last = false }) {
  return (
    <div className={['flex items-center justify-between gap-4 px-5 py-4', last ? '' : 'border-b border-white/[0.05]'].join(' ')}>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 items-center rounded-pill border transition-colors',
        checked ? 'border-accent-purple/40 bg-accent-purple/40' : 'border-white/[0.10] bg-white/[0.04]',
      ].join(' ')}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={[
          'inline-block h-4 w-4 rounded-full bg-white shadow',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [prefs, setPrefs] = useState(() => ({
    reducedMotion: false,
    autoStart: false,
    speed: 1.0,
    ...loadPrefs(),
  }))

  useEffect(() => savePrefs(prefs), [prefs])

  function update(patch) {
    setPrefs((p) => ({ ...p, ...patch }))
  }

  function onSignOut() {
    logout()
    toast.info('Signed out', 'See you soon.')
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="font-caption text-ink-muted">settings</span>
        <h1 className="mt-2 font-display text-title text-ink">Make NoorAI yours.</h1>
        <p className="mt-2 text-sm text-ink-muted">Preferences are saved on this device.</p>
      </motion.div>

      <div className="mt-10 space-y-8">
        <Section title="Account" description="The address you signed in with.">
          <Row>
            <div className="flex items-center gap-3">
              <Avatar name={user?.display_name} email={user?.email} size={40} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{user?.display_name || 'You'}</div>
                <div className="truncate text-xs text-ink-muted">{user?.email}</div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </Row>
        </Section>

        <Section
          title="Voices"
          description="Pick the voices used for narration and the podcast host / guest. Press Hear it to sample."
        >
          <VoicePicker />
        </Section>

        <Section title="Playback" description="How the player behaves on this device.">
          <Row last>
            <div>
              <div className="text-sm font-medium text-ink">Default speed</div>
              <div className="mt-0.5 text-xs text-ink-muted">Each session starts at this speed; tweak per-session in the player.</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={prefs.speed}
                onChange={(e) => update({ speed: parseFloat(e.target.value) })}
                className="w-32 accent-accent-purple"
              />
              <span className="font-mono text-xs text-ink-muted w-10 text-right">{prefs.speed.toFixed(2)}x</span>
            </div>
          </Row>
        </Section>

        <Section title="Accessibility" description="Honor your system preferences.">
          <Row last>
            <div>
              <div className="text-sm font-medium text-ink">Reduce motion</div>
              <div className="mt-0.5 text-xs text-ink-muted">Disable decorative animations across the app.</div>
            </div>
            <Toggle checked={prefs.reducedMotion} onChange={(v) => update({ reducedMotion: v })} label="reduce motion" />
          </Row>
        </Section>

        <Section title="About" description="What you're running.">
          <Row last>
            <div className="text-xs text-ink-muted">NoorAI</div>
            <div className="font-mono text-xs text-ink-faint">v0.1 · Phase 1+2+3</div>
          </Row>
        </Section>
      </div>
    </div>
  )
}
