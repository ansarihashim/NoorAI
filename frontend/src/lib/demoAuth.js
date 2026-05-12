/**
 * Demo authentication helper.
 *
 * Mints a mock JWT that satisfies our `isTokenExpired()` check in
 * `lib/api.js`. The token is structurally valid (three base64url segments
 * joined by `.`) and carries an `exp` claim 60 minutes in the future. The
 * "signature" segment is opaque random bytes — no server ever validates
 * it because demo mode never makes real backend calls. The local app code
 * only ever decodes the payload to read `exp`.
 */
import { DEMO_CREDENTIALS, DEMO_USER } from '../config/demo.js'

function base64urlEncode(bytes) {
  let s = ''
  if (bytes instanceof Uint8Array) {
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  } else {
    s = bytes
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(n) {
  const out = new Uint8Array(n)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(out)
  } else {
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  }
  return out
}

export function isDemoCreds({ email, password }) {
  return (
    (email || '').trim().toLowerCase() === DEMO_CREDENTIALS.email &&
    (password || '') === DEMO_CREDENTIALS.password
  )
}

/** Build a mock JWT. 60-minute TTL by default. */
export function mintDemoJwt(ttlMinutes = 60) {
  const header  = { alg: 'HS256', typ: 'JWT', demo: true }
  const now     = Math.floor(Date.now() / 1000)
  const payload = {
    sub:  DEMO_USER.id,
    iat:  now,
    exp:  now + ttlMinutes * 60,
    demo: true,
  }
  const h = base64urlEncode(JSON.stringify(header))
  const p = base64urlEncode(JSON.stringify(payload))
  const s = base64urlEncode(randomBytes(24))
  return `${h}.${p}.${s}`
}

/** Convenience: the user object the auth provider stores in React state. */
export function demoLoginResponse() {
  return {
    access_token: mintDemoJwt(),
    token_type:   'bearer',
    user:         DEMO_USER,
  }
}
