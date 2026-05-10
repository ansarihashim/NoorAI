import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // We start in `hydrating=true` only when a non-expired token is present.
  // `api.getToken()` already drops expired tokens, so this stays correct
  // across PC restarts: an expired token => no hydration, straight to logged-out.
  const [hydrating, setHydrating] = useState(() => Boolean(api.getToken()))

  // On mount: if a (still valid) token exists, validate it by fetching /me.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const token = api.getToken()
      if (!token) {
        setHydrating(false)
        return
      }
      try {
        const u = await api.me()
        if (!cancelled) setUser(u)
      } catch (err) {
        // 401 already cleared local storage via the ApiError handler.
        if (!cancelled) {
          setUser(null)
          // Surface for debugging — silent failures are exactly what the user
          // complained about. Console only; no toast at boot.
          // eslint-disable-next-line no-console
          console.warn('[auth] hydrate failed:', err?.message || err)
        }
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  // React to ambient 401s from any API call.
  useEffect(() => {
    const handler = () => {
      setUser(null)
      api.clearAuthStorage()
    }
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [])

  // Periodic exp check — if the JWT silently expires while the tab is open,
  // catch it and bounce the user out instead of leaving a ghost session.
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      if (!api.getToken()) {
        // getToken() returns null AND clears storage when the token is past exp.
        setUser(null)
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [user])

  const login = useCallback(async ({ email, password }) => {
    const { access_token, user } = await api.login({ email, password })
    api.setToken(access_token)
    setUser(user)
    return user
  }, [])

  const signup = useCallback(async ({ email, password, displayName }) => {
    const { access_token, user } = await api.register({ email, password, displayName })
    api.setToken(access_token)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    // Tell the server first (best-effort), then nuke local state so a stale
    // user never shows on the next render.
    try { await api.logout() } catch { /* no-op */ }
    api.clearAuthStorage()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, hydrating, login, signup, logout, isAuthed: Boolean(user) }),
    [user, hydrating, login, signup, logout],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
