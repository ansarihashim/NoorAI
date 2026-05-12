import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Procedural notebook-sound engine. Every sound is synthesised on demand
 * using the Web Audio API — there are no .mp3/.wav assets, nothing to
 * download, nothing to preload. The whole system is < 4 kB of code.
 *
 * Design principles, distilled from the brief:
 *   - "extremely subtle" → all gain envelopes peak at ≤ 0.05.
 *   - "premium · scholarly · tactile" → gentle low-pass filtered noise
 *     bursts (paper, page-turn) and one soft sine pip (annotation chime).
 *   - "respect autoplay rules" → the AudioContext is constructed lazily,
 *     on the first explicit `play()`. That call is reached only via a
 *     user-driven event handler (button click, mode switch, etc.).
 *   - "have mute toggle / be optional" → state is persisted in
 *     localStorage and exposed through React context.
 *
 * Adding a new sound = adding one private method on `SoundEngine`. Don't
 * import audio files; keep the pipeline asset-free.
 */

const STORAGE_KEY = 'echoverse.muted'

class SoundEngine {
  constructor() {
    this.ctx = null
    this.enabled = true
    // Master gain — we cap everything at ~5% so two simultaneous sounds
    // never clip and the system never feels loud. Tuneable in one place.
    this.master = 0.05
  }

  _ensureCtx() {
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined') return null
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    this.ctx = new Ctx()
    return this.ctx
  }

  /** Public entry point — name selects the sound, no-ops if muted. */
  play(name) {
    if (!this.enabled) return
    const ctx = this._ensureCtx()
    if (!ctx) return
    // Some browsers suspend the context until a user gesture happens
    // again — resume cheaply.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const t = ctx.currentTime
    switch (name) {
      case 'tap':       return this._tap(t)
      case 'page':      return this._page(t)
      case 'chime':     return this._chime(t)
      case 'pencil':    return this._pencil(t)
      default:          return
    }
  }

  // ---------- internal: each method builds a tiny audio graph ----------

  /** Soft notebook tap — short low-passed noise, ~60 ms. UI taps / toggles. */
  _tap(t) {
    const ctx = this.ctx
    const noise = ctx.createBufferSource()
    noise.buffer = this._noise(0.06)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(this.master * 0.9, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    noise.connect(lp).connect(gain).connect(ctx.destination)
    noise.start(t)
    noise.stop(t + 0.08)
  }

  /** Page turn — band-pass-swept noise, ~300 ms. Mode switches. */
  _page(t) {
    const ctx = this.ctx
    const noise = ctx.createBufferSource()
    noise.buffer = this._noise(0.35)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(2400, t)
    bp.frequency.exponentialRampToValueAtTime(800, t + 0.3)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(this.master * 0.85, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    noise.connect(bp).connect(gain).connect(ctx.destination)
    noise.start(t)
    noise.stop(t + 0.4)
  }

  /** Annotation chime — single soft sine pip, ~250 ms. AI annotation appears. */
  _chime(t) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, t)
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.2)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(this.master * 0.8, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  /** Pencil scratch — very short high-passed noise, ~120 ms. Annotations / writes. */
  _pencil(t) {
    const ctx = this.ctx
    const noise = ctx.createBufferSource()
    noise.buffer = this._noise(0.14)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2200
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(this.master * 0.7, t + 0.01)
    gain.gain.linearRampToValueAtTime(this.master * 0.5, t + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    noise.connect(hp).connect(gain).connect(ctx.destination)
    noise.start(t)
    noise.stop(t + 0.15)
  }

  /** Pink-ish noise buffer with a linear decay envelope baked in. */
  _noise(seconds) {
    const ctx = this.ctx
    const sr = ctx.sampleRate
    const len = Math.max(1, Math.floor(sr * seconds))
    const buf = ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      // White noise * decay — softens the tail, no harsh cut-off.
      data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    }
    return buf
  }
}

// ---------- React glue ----------------------------------------------------

const SoundCtx = createContext(null)

export function SoundProvider({ children }) {
  // Engine is a singleton ref — never re-created across renders.
  const engineRef = useRef(null)
  if (!engineRef.current) engineRef.current = new SoundEngine()

  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  // Initialize the engine flag from the persisted muted state on mount.
  useEffect(() => {
    engineRef.current.enabled = !muted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const play = useCallback((name) => {
    engineRef.current.play(name)
  }, [])

  // Flip the engine flag and persist synchronously inside the setter so that
  // a `play()` call dispatched on the same tick as a toggle picks up the new
  // state. (Otherwise the un-mute click is silent until the next render.)
  const toggleMuted = useCallback(() => {
    setMuted((v) => {
      const next = !v
      engineRef.current.enabled = !next
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* no-op */ }
      return next
    })
  }, [])

  // External callers that pass an explicit value get the same atomic update.
  const setMutedAtomic = useCallback((value) => {
    setMuted(() => {
      const next = Boolean(value)
      engineRef.current.enabled = !next
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* no-op */ }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ play, muted, setMuted: setMutedAtomic, toggleMuted }),
    [play, muted, setMutedAtomic, toggleMuted],
  )

  return <SoundCtx.Provider value={value}>{children}</SoundCtx.Provider>
}

export function useSound() {
  const ctx = useContext(SoundCtx)
  if (!ctx) {
    // Fail soft — components that mount outside the provider (e.g. tests)
    // get a noop API instead of a hard crash.
    return { play: () => {}, muted: true, setMuted: () => {}, toggleMuted: () => {} }
  }
  return ctx
}
