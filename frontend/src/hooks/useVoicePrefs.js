import { useCallback, useEffect, useState } from 'react'

const KEY = 'echoverse.voices'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* quota — ignore */
  }
}

/**
 * Hook backing the voice-picker UI and consumed by NarrationView/PodcastView
 * for per-user voice overrides. Reads/writes localStorage and broadcasts
 * changes to other tabs via the `storage` event.
 *
 *   const { host, guest, setHost, setGuest, reset } = useVoicePrefs()
 *
 * `host` and `guest` are voice IDs (strings) or undefined when the user
 * hasn't picked yet (in which case the backend's .env defaults apply).
 */
export function useVoicePrefs() {
  const [prefs, setPrefs] = useState(read)

  useEffect(() => {
    function onStorage(e) {
      if (e.key === KEY) setPrefs(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((patch) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch }
      write(next)
      return next
    })
  }, [])

  return {
    host: prefs.host,
    guest: prefs.guest,
    setHost: (id) => update({ host: id || undefined }),
    setGuest: (id) => update({ guest: id || undefined }),
    reset: () => { write({}); setPrefs({}) },
  }
}

/** Standalone read for non-React callers (e.g. URL builders). */
export function readVoicePrefs() {
  return read()
}
