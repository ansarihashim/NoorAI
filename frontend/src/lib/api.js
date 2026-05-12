// Backend HTTP base. `VITE_API_URL` is the production env on Vercel/Render;
// `VITE_API_BASE` is honored as a legacy alias so existing local .env files
// don't break after the rename. Fallback is localhost for `npm run dev`.
const BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TOKEN_KEY = 'echoverse.token'

// ---------------------------------------------------------------------
// Demo Mode — every exported function checks this flag and dispatches to
// local fixtures under src/demo/ when on. The UI never sees a network
// failure or quota error in demo mode; recruiters get a realistic
// experience without burning API budget.
// ---------------------------------------------------------------------
import { DEMO_MODE, sleepFor, DEMO_USER } from '../config/demo.js'
import { demoLoginResponse, isDemoCreds, mintDemoJwt } from './demoAuth.js'
import { DEMO_DOCS, findDoc } from '../demo/topics/index.js'
import { getOverview as demoOverview }       from '../demo/preparation/overviews.js'
import { getQuestions as demoQuestions }     from '../demo/preparation/questions.js'
import { getExplanation as demoExplanation } from '../demo/preparation/explanations.js'
import {
  getFlashcards as demoFlash, getQuiz as demoQuiz, getRecall as demoRecall,
  getQuick as demoQuick, getNight as demoNight, getViva as demoViva,
} from '../demo/revision/index.js'
import {
  listVisuals as demoListVisuals, getVisual as demoGetVisual,
  generateVisual as demoGenerateVisual,
} from '../demo/visuals/index.js'
import { getPodcast as demoPodcast }     from '../demo/podcast/index.js'
import { getManifest as demoManifest, getCitations as demoCitations } from '../demo/narration/index.js'

// Keys we persist in localStorage that are tied to the signed-in user. Cleared
// on logout / forced sign-out so the next user (or the same user after token
// expiry) starts from a clean slate.
const USER_SCOPED_KEYS = [
  TOKEN_KEY,
  'echoverse.activeSources',
  'echoverse.lastPosition',
  'echoverse.bookmarks',
]

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    // base64url → base64
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')
    const json = atob(b64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Fail-closed expiry check. A token is treated as expired when:
 *   - it can't be decoded at all (malformed), OR
 *   - it has no `exp` claim (never-expiring is not a valid policy here), OR
 *   - its `exp` is in the past.
 *
 * Previously we returned `false` for tokens missing `exp`, which meant any
 * server quirk that emitted a non-exp token would keep the user logged in
 * "forever". Now: no exp ⇒ expired.
 */
export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token)
  if (!payload) return true
  if (typeof payload.exp !== 'number') return true
  // 10s skew so we don't fight clock drift.
  return payload.exp * 1000 < Date.now() - 10_000
}

export function getToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    if (isTokenExpired(raw)) {
      // Token has aged out client-side — drop it before returning.
      clearAuthStorage()
      return null
    }
    return raw
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* no-op */
  }
}

/** Wipe every per-user key. Called on logout and on 401. */
export function clearAuthStorage() {
  try {
    for (const key of USER_SCOPED_KEYS) localStorage.removeItem(key)
    // Wipe any per-doc bookmark namespaces too (echoverse.bookmarks.*).
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith('echoverse.bookmarks.')) localStorage.removeItem(k)
    }
  } catch {
    /* no-op */
  }
}

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, headers, isForm = false } = {}) {
  const token = getToken()
  const finalHeaders = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    // Notify the auth provider to clear state.
    clearAuthStorage()
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }
  const text = await res.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  if (!res.ok) {
    const detail = (payload && (payload.detail || payload.message)) || res.statusText
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail), payload)
  }
  return payload
}

// ---------- auth ----------
export async function register({ email, password, displayName }) {
  if (DEMO_MODE) {
    // In demo mode, registration becomes a friendly redirect to the demo
    // credentials — recruiters shouldn't create accounts in a public sandbox.
    await sleepFor('authLogin')
    if (isDemoCreds({ email, password })) return demoLoginResponse()
    throw new ApiError(400, 'Demo Workspace: please sign in with the demo credentials shown on the login page.')
  }
  return request('/api/auth/register', {
    method: 'POST',
    body: { email, password, display_name: displayName || null },
  })
}

export async function login({ email, password }) {
  if (DEMO_MODE) {
    await sleepFor('authLogin')
    if (!isDemoCreds({ email, password })) {
      throw new ApiError(401, 'Invalid email or password.')
    }
    return demoLoginResponse()
  }
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function me() {
  if (DEMO_MODE) {
    // If the in-memory token has expired (shouldn't normally), mint a fresh
    // one and keep the demo user signed in. This is the "no flicker" path
    // for refresh-on-mount in AuthProvider.
    const tok = getToken()
    if (!tok) setToken(mintDemoJwt())
    return DEMO_USER
  }
  return request('/api/auth/me')
}

export async function logout() {
  if (DEMO_MODE) {
    clearAuthStorage()
    return
  }
  // Best-effort — we still clear local state even if the server is unreachable.
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } catch {
    /* swallow; the client is the source of truth for "logged out" */
  }
}

// ---------- documents ----------
export async function uploadText({ title, text }) {
  if (DEMO_MODE) {
    await sleepFor('uploadIndex')
    throw new ApiError(403, 'Demo Workspace is read-only — upload disabled. Open any seeded topic on the left.')
  }
  return request('/api/upload/text', { method: 'POST', body: { title, text } })
}

export async function uploadFile({ title, file }) {
  if (DEMO_MODE) {
    await sleepFor('uploadIndex')
    throw new ApiError(403, 'Demo Workspace is read-only — upload disabled. Open any seeded topic on the left.')
  }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title || file.name)
  return request('/api/upload/file', { method: 'POST', body: fd, isForm: true })
}

export async function getDoc(docId) {
  if (DEMO_MODE) {
    await sleepFor('citations')
    const d = findDoc(docId)
    if (!d) throw new ApiError(404, 'doc not found')
    return {
      doc_id: d.id, title: d.title,
      n_rag: d.n_chunks, n_narration: d.n_chunks,
      total_pages: d.total_pages,
    }
  }
  return request(`/api/upload/${docId}`)
}

// ---------- voices ----------
export async function listVoices() {
  if (DEMO_MODE) {
    return [
      { id: 'demo-host',     name: 'Aria',  tone: 'warm',     gender: 'female', suggested_role: 'host' },
      { id: 'demo-guest',    name: 'Atlas', tone: 'measured', gender: 'male',   suggested_role: 'guest' },
      { id: 'demo-narrator', name: 'Lyra',  tone: 'clear',    gender: 'female', suggested_role: 'narrator' },
    ]
  }
  return request('/api/voices')
}

export function voicePreviewUrl(voiceId) {
  const token = encodeURIComponent(getToken() || '')
  return `${BASE}/api/voices/${encodeURIComponent(voiceId)}/preview.mp3?token=${token}`
}

// ---------- documents library ----------
export async function listDocuments() {
  if (DEMO_MODE) { await sleepFor('documentsList'); return DEMO_DOCS }
  return request('/api/documents')
}

export async function deleteDocument(docId) {
  if (DEMO_MODE) throw new ApiError(403, 'Demo Workspace is read-only.')
  return request(`/api/documents/${docId}`, { method: 'DELETE' })
}

// Per-chunk page-number array, used to render "Page N" citations.
// Returns { pages: [int|null], total_pages: int|null, is_paged: bool }
export async function getDocumentCitations(docId) {
  if (DEMO_MODE) {
    await sleepFor('citations')
    return demoCitations(docId) || { pages: [], total_pages: null, is_paged: false }
  }
  return request(`/api/documents/${docId}/citations`)
}

// ---------- narration ----------
export async function getNarrationManifest(docId, voiceId) {
  if (DEMO_MODE) {
    await sleepFor('citations')
    const m = demoManifest(docId, voiceId)
    if (!m) throw new ApiError(404, 'doc not found')
    return m
  }
  const q = voiceId ? `?voice_id=${encodeURIComponent(voiceId)}` : ''
  return request(`/api/narration/${docId}/manifest${q}`)
}

export function narrationChunkUrl(docId, idx, voiceId) {
  if (DEMO_MODE) {
    // Demo narration audio is synthesised in the browser via Web Speech.
    // The chunk URL is never fetched — but we still return a stable string
    // so that audio-element src changes trigger the right React lifecycle.
    return `demo://narration/${docId}/${idx}`
  }
  const token = encodeURIComponent(getToken() || '')
  const v = voiceId ? `&voice_id=${encodeURIComponent(voiceId)}` : ''
  return `${BASE}/api/narration/${docId}/chunk/${idx}.mp3?token=${token}${v}`
}

export async function prefetchNarration(docId, indices, voiceId) {
  if (DEMO_MODE) return { ok: true, prefetched: indices.length }
  return request(`/api/narration/${docId}/prefetch`, {
    method: 'POST',
    body: { indices, voice_id: voiceId || null },
  })
}

// ---------- visuals (AI Visual Learning) ----------
export async function listVisuals(docId) {
  if (DEMO_MODE) return demoListVisuals(docId)
  return request(`/api/visuals/${docId}`)
}

export async function generateVisual(docId, { prompt, style, force = false } = {}) {
  if (DEMO_MODE) {
    await sleepFor('visualGen')
    const v = demoGenerateVisual(docId, { prompt, style })
    if (!v) throw new ApiError(404, 'doc not found')
    return v
  }
  return request(`/api/visuals/${docId}/generate`, {
    method: 'POST',
    body: { prompt, style: style || null, force },
  })
}

export async function getVisual(docId, visualId) {
  if (DEMO_MODE) {
    const v = demoGetVisual(docId, visualId)
    if (!v) throw new ApiError(404, 'visual not found')
    return v
  }
  return request(`/api/visuals/${docId}/${visualId}`)
}

export async function deleteVisual(docId, visualId) {
  if (DEMO_MODE) throw new ApiError(403, 'Demo Workspace is read-only.')
  return request(`/api/visuals/${docId}/${visualId}`, { method: 'DELETE' })
}

// ---------- podcast ----------
export async function getPodcast(docId) {
  if (DEMO_MODE) {
    await sleepFor('citations')
    const p = demoPodcast(docId)
    if (!p) throw new ApiError(404, 'podcast not found')
    return p
  }
  return request(`/api/podcast/${docId}`)
}

export async function generatePodcast(docId) {
  if (DEMO_MODE) {
    await sleepFor('podcastGen')
    const p = demoPodcast(docId)
    if (!p) throw new ApiError(404, 'podcast not found')
    return p
  }
  return request(`/api/podcast/${docId}/generate`, { method: 'POST' })
}

export function podcastTurnUrl(docId, idx) {
  if (DEMO_MODE) return `demo://podcast/${docId}/${idx}`
  const token = encodeURIComponent(getToken() || '')
  return `${BASE}/api/podcast/${docId}/turn/${idx}.mp3?token=${token}`
}

// ---------- preparation (multi-doc; all POST so doc_ids fits in body) ----------
export async function getOverview(docIds) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoOverview(docIds) }
  return request('/api/preparation/overview', { method: 'POST', body: { doc_ids: docIds } })
}
export async function generateOverview(docIds, { n_min, n_max, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('overviewGen'); return demoOverview(docIds) }
  const body = { doc_ids: docIds, force }
  if (n_min != null) body.n_min = n_min
  if (n_max != null) body.n_max = n_max
  return request('/api/preparation/overview/generate', { method: 'POST', body })
}
export async function deleteOverview(docIds) {
  if (DEMO_MODE) return { ok: true }
  return request('/api/preparation/overview/delete', { method: 'POST', body: { doc_ids: docIds } })
}

export async function getImportantQuestions(docIds) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoQuestions(docIds) }
  return request('/api/preparation/questions', { method: 'POST', body: { doc_ids: docIds } })
}
export async function generateImportantQuestions(docIds, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('questionsGen'); return demoQuestions(docIds) }
  const body = { doc_ids: docIds, force }
  if (n != null) body.n = n
  return request('/api/preparation/questions/generate', { method: 'POST', body })
}
export async function deleteImportantQuestions(docIds) {
  if (DEMO_MODE) return { ok: true }
  return request('/api/preparation/questions/delete', { method: 'POST', body: { doc_ids: docIds } })
}

export async function getExplanation(docIds, topic) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoExplanation(docIds, topic) }
  return request('/api/preparation/explanation', { method: 'POST', body: { doc_ids: docIds, topic } })
}
export async function generateExplanation(docIds, topic, { force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('explanationGen'); return demoExplanation(docIds, topic) }
  return request('/api/preparation/explanation/generate', {
    method: 'POST',
    body: { doc_ids: docIds, topic, force },
  })
}

// ---------- revision (per-doc) ----------
export async function getFlashcards(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoFlash(docId) }
  return request(`/api/revision/${docId}/flashcards`)
}
export async function generateFlashcards(docId, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('flashcardsGen'); return demoFlash(docId) }
  const body = { force }
  if (n != null) body.n = n
  return request(`/api/revision/${docId}/flashcards/generate`, { method: 'POST', body })
}
export async function deleteFlashcards(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/flashcards`, { method: 'DELETE' })
}

export async function getQuiz(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoQuiz(docId) }
  return request(`/api/revision/${docId}/quiz`)
}
export async function generateQuiz(docId, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('quizGen'); return demoQuiz(docId) }
  const body = { force }
  if (n != null) body.n = n
  return request(`/api/revision/${docId}/quiz/generate`, { method: 'POST', body })
}
export async function deleteQuiz(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/quiz`, { method: 'DELETE' })
}

export async function getRecall(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoRecall(docId) }
  return request(`/api/revision/${docId}/recall`)
}
export async function generateRecall(docId, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('recallGen'); return demoRecall(docId) }
  const body = { force }
  if (n != null) body.n = n
  return request(`/api/revision/${docId}/recall/generate`, { method: 'POST', body })
}
export async function deleteRecall(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/recall`, { method: 'DELETE' })
}

export async function getQuickRevision(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoQuick(docId) }
  return request(`/api/revision/${docId}/quick-revision`)
}
export async function generateQuickRevision(docId, { max_topics, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('quickGen'); return demoQuick(docId) }
  const body = { force }
  if (max_topics != null) body.max_topics = max_topics
  return request(`/api/revision/${docId}/quick-revision/generate`, { method: 'POST', body })
}
export async function deleteQuickRevision(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/quick-revision`, { method: 'DELETE' })
}

export async function getNightBefore(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoNight(docId) }
  return request(`/api/revision/${docId}/night-before`)
}
export async function generateNightBefore(docId, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('nightGen'); return demoNight(docId) }
  const body = { force }
  if (n != null) body.n = n
  return request(`/api/revision/${docId}/night-before/generate`, { method: 'POST', body })
}
export async function deleteNightBefore(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/night-before`, { method: 'DELETE' })
}

export async function getViva(docId) {
  if (DEMO_MODE) { await sleepFor('citations'); return demoViva(docId) }
  return request(`/api/revision/${docId}/viva`)
}
export async function generateViva(docId, { n, force = false } = {}) {
  if (DEMO_MODE) { await sleepFor('vivaGen'); return demoViva(docId) }
  const body = { force }
  if (n != null) body.n = n
  return request(`/api/revision/${docId}/viva/generate`, { method: 'POST', body })
}
export async function deleteViva(docId) {
  if (DEMO_MODE) return { ok: true }
  return request(`/api/revision/${docId}/viva`, { method: 'DELETE' })
}

export const apiBase = BASE
