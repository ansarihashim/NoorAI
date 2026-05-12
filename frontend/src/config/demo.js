/**
 * Demo Mode central config.
 *
 * When `VITE_DEMO_MODE === "true"` the frontend pulls all AI answers,
 * narrations, podcasts, visuals and revision sets from local cached data
 * under `src/demo/`. No requests hit Groq / ElevenLabs / Whisper / the
 * RAG service. The UI behaves identically to the real product — same
 * loading stages, same streaming feel — so a recruiter or interviewer
 * cannot tell the experience apart from the live system.
 *
 * Toggling:
 *   - Production (Vercel): set VITE_DEMO_MODE=true in the Vercel env panel.
 *   - Local dev against the real backend: leave it `false` / unset.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

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
