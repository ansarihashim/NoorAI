/**
 * Demo Mode central config.
 *
 * When demo mode is on, the frontend pulls all AI answers, narrations,
 * podcasts, visuals and revision sets from local cached data under
 * `src/demo/`. No requests hit Groq / ElevenLabs / the RAG service.
 * The UI behaves identically to the real product so a recruiter or
 * interviewer cannot tell the experience apart from the live system.
 *
 * Toggle priority (checked in order):
 *   1. localStorage key `noorai.demoMode` ("true" / "false")
 *        Set by the "Try the demo" button on the landing page (runtime,
 *        per-visitor — no redeploy needed).
 *   2. Build-time `VITE_DEMO_MODE=true` (fallback for portfolio deploys
 *        where every visitor should see demo by default).
 *
 * The constant is captured at module load — toggling requires a full
 * page reload so every importer sees the fresh value. The helper
 * functions below trigger that reload for you.
 */
const DEMO_MODE_LS_KEY = 'noorai.demoMode'

function _readDemoMode() {
  try {
    const ls = typeof localStorage !== 'undefined'
      ? localStorage.getItem(DEMO_MODE_LS_KEY)
      : null
    if (ls === 'true') return true
    if (ls === 'false') return false
  } catch { /* localStorage unavailable (SSR, private mode quotas) — fall through */ }
  return import.meta.env.VITE_DEMO_MODE === 'true'
}

export const DEMO_MODE = _readDemoMode()

/** Flip demo mode ON for this visitor and reload so every module re-reads
 *  the flag. Also clears any real-session token so demo doesn't piggyback
 *  on a previous backend login. */
export function enableDemoMode({ redirectTo = '/app' } = {}) {
  try {
    localStorage.setItem(DEMO_MODE_LS_KEY, 'true')
    localStorage.removeItem('echoverse.token')
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    window.location.assign(redirectTo)
  }
}

/** Flip demo mode OFF for this visitor and reload.
 *
 *  Important: we write the explicit string `'false'` (rather than removing
 *  the key) so it overrides any `VITE_DEMO_MODE=true` build-time env var.
 *  If we just removed it, the next `_readDemoMode()` call would fall back
 *  to the env var and re-enable demo automatically — which is exactly the
 *  bug that prevented real sign-up after clicking "Exit demo".
 */
export function disableDemoMode({ redirectTo = '/' } = {}) {
  try {
    localStorage.setItem(DEMO_MODE_LS_KEY, 'false')
    localStorage.removeItem('echoverse.token')
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    window.location.assign(redirectTo)
  }
}

/** True iff the visitor currently has demo mode active in localStorage —
 *  used by the marketing nav / hero to decide whether the "Sign in" click
 *  needs a full reload (to flush in-memory `DEMO_MODE`) or can use SPA
 *  navigation. */
export function isDemoModeActiveNow() {
  try {
    return localStorage.getItem(DEMO_MODE_LS_KEY) === 'true' ||
      (localStorage.getItem(DEMO_MODE_LS_KEY) === null &&
       import.meta.env.VITE_DEMO_MODE === 'true')
  } catch {
    return import.meta.env.VITE_DEMO_MODE === 'true'
  }
}

/** Stable email/password we accept in demo mode. */
export const DEMO_CREDENTIALS = Object.freeze({
  email: 'demo@noorai.ai',
  password: 'demo123',
})

/** User shape returned to the auth provider for the demo account. */
export const DEMO_USER = Object.freeze({
  id: 'demo0000000000000000000000000000',  // 32 hex chars — matches our id regex
  email: DEMO_CREDENTIALS.email,
  display_name: 'Demo',
})

/**
 * Realistic latency ranges (ms). All async demo operations sleep within
 * these windows so the experience never feels "instant fake" — it mirrors
 * the cadence of a real Groq / TTS round-trip.
 */
export const DEMO_LATENCY = Object.freeze({
  authLogin:      [600, 1100],     // login → dashboard
  documentsList:  [220, 480],
  uploadIndex:    [1400, 2400],    // chunking + embedding feel
  citations:      [120, 260],
  // Generations (preparation + revision + visuals + podcast script)
  overviewGen:    [3600, 5400],
  questionsGen:   [3200, 4800],
  explanationGen: [2400, 3600],
  flashcardsGen:  [2800, 4200],
  quizGen:        [3000, 4400],
  recallGen:      [2600, 3800],
  quickGen:       [2600, 3800],
  nightGen:       [2600, 3800],
  vivaGen:        [2800, 4200],
  visualGen:      [2600, 4000],
  podcastGen:     [5400, 7800],
  // Ask-a-doubt round-trip simulation
  askTranscribe:  [900, 1400],
  askThinking:    [800, 1400],
})

/** Pick a random integer in [lo, hi] (inclusive). */
export function pickLatency([lo, hi]) {
  return Math.floor(lo + Math.random() * (hi - lo + 1))
}

/** Promise-based sleep. */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Convenience: sleep within a latency window from DEMO_LATENCY. */
export function sleepFor(key) {
  const win = DEMO_LATENCY[key]
  if (!win) return Promise.resolve()
  return sleep(pickLatency(win))
}
