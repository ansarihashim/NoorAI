/**
 * Web Speech API wrapper for demo audio.
 *
 * Used in demo mode where we don't bundle TTS MP3s. Browsers ship the
 * SpeechSynthesis API for free (Chrome, Edge, Safari, modern Firefox);
 * latency is sub-second and voice quality is good enough for a portfolio
 * demo of narration / podcast / ask-a-doubt.
 *
 * The API mimics what the real audio pipeline needs:
 *   speak(text, opts) → Promise<void> resolved when audio finishes
 *   stop() → halts any in-flight utterance
 */

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

let _voicesReady = null

/** Wait until the voice list is populated. Chrome loads voices asynchronously. */
function whenVoicesReady() {
  if (!supported) return Promise.resolve([])
  if (_voicesReady) return _voicesReady
  _voicesReady = new Promise((resolve) => {
    const initial = window.speechSynthesis.getVoices()
    if (initial && initial.length) return resolve(initial)
    const onChange = () => {
      const v = window.speechSynthesis.getVoices()
      if (v && v.length) {
        window.speechSynthesis.removeEventListener('voiceschanged', onChange)
        resolve(v)
      }
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    // Safety net for Firefox where 'voiceschanged' may not fire.
    setTimeout(() => resolve(window.speechSynthesis.getVoices() || []), 1500)
  })
  return _voicesReady
}

function pickVoice(voices, preferRole) {
  if (!voices.length) return null
  // Try to find an English voice that matches the role hint.
  const en = voices.filter((v) => /^en/i.test(v.lang))
  const pool = en.length ? en : voices
  if (preferRole === 'host') {
    return pool.find((v) => /female|woman|samantha|aria|jenny|emma|nancy/i.test(v.name)) || pool[0]
  }
  if (preferRole === 'guest' || preferRole === 'assistant') {
    return pool.find((v) => /male|man|brian|guy|davis|christopher/i.test(v.name)) || pool[Math.min(1, pool.length - 1)]
  }
  // narrator default — pick a different voice from the host
  return pool.find((v) => /samantha|aria|jenny|emma|natural/i.test(v.name)) || pool[0]
}

const ROLE_DEFAULTS = {
  narrator:  { rate: 1.05, pitch: 1.0, role: 'narrator' },
  host:      { rate: 1.0,  pitch: 1.0, role: 'host' },
  guest:     { rate: 1.0,  pitch: 0.95, role: 'guest' },
  assistant: { rate: 1.05, pitch: 1.05, role: 'assistant' },
}

let _current = null  // active utterance, so stop() can abort

/**
 * Speak `text`. Resolves when audio finishes (or stop() is called).
 *
 *   speak('hello', { role: 'narrator', rate: 1.1 })
 */
export async function speak(text, opts = {}) {
  if (!supported || !text) return
  const role = opts.role || 'narrator'
  const defaults = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.narrator
  const voices = await whenVoicesReady()
  const voice = pickVoice(voices, role)
  return new Promise((resolve) => {
    // Cancel any pending utterance — never let two voices overlap.
    try { window.speechSynthesis.cancel() } catch { /* no-op */ }
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.rate  = opts.rate  ?? defaults.rate
    u.pitch = opts.pitch ?? defaults.pitch
    u.volume = opts.volume ?? 1
    u.onend  = () => { _current = null; resolve() }
    u.onerror = () => { _current = null; resolve() }
    _current = u
    window.speechSynthesis.speak(u)
  })
}

/** Halt whatever is currently speaking. */
export function stop() {
  if (!supported) return
  try { window.speechSynthesis.cancel() } catch { /* no-op */ }
  _current = null
}

/** True iff the browser supports the SpeechSynthesis API. */
export function isSupported() {
  return supported
}
