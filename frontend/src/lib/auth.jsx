import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [hydrating, setHydrating] = useState(() => Boolean(api.getToken()))

  // On mount: if a token exists, validate it by fetching /me. Show skeleton
  // state in consumers via `hydrating`.
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
      } catch {
        // 401 already cleared the token via ApiError handler.
        if (!cancelled) setUser(null)
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
    const handler = () => setUser(null)
    window.addEventListener('auth:unauthorized', handler)
    return () => window.removeEventListener('auth:unauthorized', handler)
  }, [])

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

  const logout = useCallback(() => {
    api.setToken(null)
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
