const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TOKEN_KEY = 'echoverse.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
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
    setToken(null)
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
  return request('/api/auth/register', {
    method: 'POST',
    body: { email, password, display_name: displayName || null },
  })
}

export async function login({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function me() {
  return request('/api/auth/me')
}

// ---------- documents ----------
export async function uploadText({ title, text }) {
  return request('/api/upload/text', { method: 'POST', body: { title, text } })
}

export async function uploadFile({ title, file }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title || file.name)
  return request('/api/upload/file', { method: 'POST', body: fd, isForm: true })
}

export async function getDoc(docId) {
  return request(`/api/upload/${docId}`)
}

// ---------- voices ----------
export async function listVoices() {
  return request('/api/voices')
}

export function voicePreviewUrl(voiceId) {
  const token = encodeURIComponent(getToken() || '')
  return `${BASE}/api/voices/${encodeURIComponent(voiceId)}/preview.mp3?token=${token}`
}

// ---------- documents library ----------
export async function listDocuments() {
  return request('/api/documents')
}

export async function deleteDocument(docId) {
  return request(`/api/documents/${docId}`, { method: 'DELETE' })
}

// ---------- narration ----------
export async function getNarrationManifest(docId, voiceId) {
  const q = voiceId ? `?voice_id=${encodeURIComponent(voiceId)}` : ''
  return request(`/api/narration/${docId}/manifest${q}`)
}

export function narrationChunkUrl(docId, idx, voiceId) {
  const token = encodeURIComponent(getToken() || '')
  const v = voiceId ? `&voice_id=${encodeURIComponent(voiceId)}` : ''
  return `${BASE}/api/narration/${docId}/chunk/${idx}.mp3?token=${token}${v}`
}

export async function prefetchNarration(docId, indices, voiceId) {
  return request(`/api/narration/${docId}/prefetch`, {
    method: 'POST',
    body: { indices, voice_id: voiceId || null },
  })
}

// ---------- visuals (AI Visual Learning) ----------
export async function listVisuals(docId) {
  return request(`/api/visuals/${docId}`)
}

export async function generateVisual(docId, { prompt, style, force = false } = {}) {
  return request(`/api/visuals/${docId}/generate`, {
    method: 'POST',
    body: { prompt, style: style || null, force },
  })
}

export async function getVisual(docId, visualId) {
  return request(`/api/visuals/${docId}/${visualId}`)
}

export async function deleteVisual(docId, visualId) {
  return request(`/api/visuals/${docId}/${visualId}`, { method: 'DELETE' })
}

// ---------- podcast ----------
export async function getPodcast(docId) {
  return request(`/api/podcast/${docId}`)
}

export async function generatePodcast(docId) {
  return request(`/api/podcast/${docId}/generate`, { method: 'POST' })
}

export function podcastTurnUrl(docId, idx) {
  const token = encodeURIComponent(getToken() || '')
  return `${BASE}/api/podcast/${docId}/turn/${idx}.mp3?token=${token}`
}

export const apiBase = BASE
