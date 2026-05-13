import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from './api.js'
import { DEMO_MODE } from '../config/demo.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Hydration runs whenever there's either a real token OR demo mode is on
  // (because the demo `me()` call mints a token on the fly, so the absence
  // of a token in sessionStorage is normal at first paint after clicking
  // "Try the demo"). Without this carve-out, the demo auto-login flow
  // bails out before `me()` is called and the user lands on /login.
  const [hydrating, setHydrating] = useState(() => Boolean(api.getToken()) || DEMO_MODE)

  // On mount: if a (still valid) token exists, validate it by fetching /me.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const token = api.getToken()
      if (!token && !DEMO_MODE) {
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
