/**
 * Map (askArmed, serverState) → a user-facing stage object for Ask-a-Doubt.
 *
 * Backend sends WebSocket `state` events with one of:
 *   narrating | interrupted | thinking | speaking
 *   attending | podcast_generating | podcast_playing | idle
 *
 * While the user is in the ask-doubt loop we surface a clear stage so they
 * know whether we're listening, transcribing, drafting, or speaking back.
 *
 * Returns: { key, label, dot } where `dot` is one of:
 *   'live'    — pulsing red (mic open, capturing)
 *   'work'    — pulsing accent (server is processing)
 *   'voice'   — pulsing accent green (AI is talking)
 *   null      — no dot (post-flow)
 */
export function askStage(askArmed, serverState) {
  if (!askArmed) return { key: 'idle', label: '', dot: null }

  // Server has marked the session "attending" — we're listening to the mic.
  if (serverState === 'attending' || serverState === 'idle') {
    return { key: 'listening', label: 'Listening — speak your question', dot: 'live' }
  }
  // Server says VAD has detected speech start → it's capturing the utterance.
  if (serverState === 'interrupted') {
    return { key: 'capturing', label: 'Got it — transcribing…', dot: 'work' }
  }
  // Server is running Whisper + RAG + Groq before any audio comes back.
  if (serverState === 'thinking') {
    return { key: 'thinking', label: 'Thinking…', dot: 'work' }
  }
  // TTS streaming back to the client.
  if (serverState === 'speaking') {
    return { key: 'responding', label: 'Responding…', dot: 'voice' }
  }
  // Fallback — unknown state, but armed: keep the listening copy so we don't
  // flash a confusing label.
  return { key: 'listening', label: 'Listening — speak your question', dot: 'live' }
}
