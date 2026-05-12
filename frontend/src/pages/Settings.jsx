import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { useSound } from '../lib/sound.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Button from '../components/ui/Button.jsx'
import VoicePicker from '../components/settings/VoicePicker.jsx'
import { NotebookEyebrow } from '../components/ui/NotebookSurface.jsx'

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

function Section({ idx, title, description, children }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[0.66rem] font-semibold tabular-nums tracking-[0.16em] text-ink-faint">
          §{String(idx).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-[1.05rem] font-semibold tracking-tight text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[0.82rem] text-ink-muted">{description}</p>}
        </div>
        <span aria-hidden className="ml-auto h-px flex-1 translate-y-[1px] bg-rule" />
      </div>
      <div className="nb-card p-0">
        {children}
      </div>
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
        checked ? 'border-accent/50 bg-accent/30' : 'border-rule bg-white/[0.04]',
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
  const { play, muted, toggleMuted } = useSound()
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

  async function onSignOut() {
    play('page')
    try { await logout() } catch { /* no-op */ }
    toast.info('Signed out', 'See you soon.')
    navigate('/')
  }

  return (
    <div className="relative mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8">
      <span aria-hidden className="notebook-rule pointer-events-none absolute inset-0 -z-10" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <NotebookEyebrow accent>colophon · preferences</NotebookEyebrow>
        <h1 className="mt-2 font-serif text-[clamp(1.7rem,3.2vw,2.2rem)] font-semibold leading-tight tracking-tight text-ink">
          Make this notebook yours.
        </h1>
        <p className="mt-2 text-[0.92rem] text-ink-muted">
          Preferences are saved on this device only — they don't sync.
        </p>
      </motion.div>

      <div className="mt-10 space-y-8">
        <Section idx={1} title="Account" description="The address bound to this notebook.">
          <Row>
            <div className="flex items-center gap-3">
              <Avatar name={user?.display_name} email={user?.email} size={40} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[0.95rem] font-medium text-ink">{user?.display_name || 'You'}</div>
                <div className="truncate text-[0.78rem] text-ink-muted">{user?.email}</div>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </Row>
        </Section>

        <Section
          idx={2}
          title="Voices"
          description="Pick the voices used for narration and the podcast host / guest. Press Hear it to sample."
        >
          <VoicePicker />
        </Section>

        <Section idx={3} title="Playback" description="How the player behaves on this device.">
          <Row last>
            <div>
              <div className="font-serif text-[0.95rem] font-medium text-ink">Default speed</div>
              <div className="mt-0.5 text-[0.78rem] text-ink-muted">
                Each session starts at this speed; tweak per-session in the player.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={prefs.speed}
                onChange={(e) => update({ speed: parseFloat(e.target.value) })}
                className="w-32 accent-accent"
              />
              <span className="w-10 text-right font-mono text-[0.78rem] tabular-nums text-ink-muted">
                {prefs.speed.toFixed(2)}x
              </span>
            </div>
          </Row>
        </Section>

        <Section idx={4} title="Atmosphere" description="Subtle interface sounds and motion.">
          <Row>
            <div>
              <div className="font-serif text-[0.95rem] font-medium text-ink">Notebook sounds</div>
              <div className="mt-0.5 text-[0.78rem] text-ink-muted">
                Soft taps and page-turns on key interactions. Off by default if you've muted.
              </div>
            </div>
            <Toggle checked={!muted} onChange={() => toggleMuted()} label="notebook sounds" />
          </Row>
          <Row last>
            <div>
              <div className="font-serif text-[0.95rem] font-medium text-ink">Reduce motion</div>
              <div className="mt-0.5 text-[0.78rem] text-ink-muted">
                Disable decorative animations across the app.
              </div>
            </div>
            <Toggle checked={prefs.reducedMotion} onChange={(v) => update({ reducedMotion: v })} label="reduce motion" />
          </Row>
        </Section>

        <Section idx={5} title="About" description="What you're running.">
          <Row last>
            <div className="font-serif text-[0.85rem] text-ink-muted">NoorAI</div>
            <div className="font-mono text-[0.74rem] tabular-nums text-ink-faint">noor · v0.1</div>
          </Row>
        </Section>
      </div>
    </div>
  )
}
