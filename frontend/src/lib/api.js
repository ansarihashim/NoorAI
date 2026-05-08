const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function jsonOrThrow(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

export async function uploadText({ title, text }) {
  const res = await fetch(`${BASE}/api/upload/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  })
  return jsonOrThrow(res)
}

export async function uploadFile({ title, file }) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title || file.name)
  const res = await fetch(`${BASE}/api/upload/file`, { method: 'POST', body: fd })
  return jsonOrThrow(res)
}

export async function getDoc(docId) {
  const res = await fetch(`${BASE}/api/upload/${docId}`)
  return jsonOrThrow(res)
}
