import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import AppShell from './components/layout/AppShell.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
// Marketing pages stay eager — they're the entry point for unauthenticated
// visitors and the first paint should not wait on a chunk fetch.
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import NotFound from './pages/NotFound.jsx'

// Authenticated workspace shell + its child views are lazy-loaded. This
// keeps the public-facing bundle small (landing/login/signup don't ship
// the workspace code) and improves first paint over the slow Render free
// tier.
const WorkspaceShell = lazy(() => import('./components/workspace/WorkspaceShell.jsx'))
const WorkspaceHome  = lazy(() => import('./components/workspace/WorkspaceHome.jsx'))
const Library        = lazy(() => import('./pages/Library.jsx'))
const Settings       = lazy(() => import('./pages/Settings.jsx'))
const Session        = lazy(() => import('./pages/Session.jsx'))

function PublicOnly({ children }) {
  const { user, hydrating } = useAuth()
  if (hydrating) return null
  if (user) return <Navigate to="/app" replace />
  return children
}

/**
 * Minimal fallback while a lazy chunk loads — a calm pulsing dot, no
 * branded splash. Most users will never see this because the chunks are
 * tiny and pre-fetched by the browser as soon as the bundle parses.
 */
function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-page text-ink-dim">
      <span className="inline-block h-2 w-2 animate-breathe rounded-full bg-accent" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Marketing routes — eager, no Suspense needed */}
      <Route path="/" element={<AppShell variant="marketing"><Landing /></AppShell>} />
      <Route path="/login"  element={<PublicOnly><AppShell variant="marketing"><Login /></AppShell></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><AppShell variant="marketing"><Signup /></AppShell></PublicOnly>} />

      {/* App routes — single persistent WorkspaceShell, child routes swap the center column. */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Suspense fallback={<RouteFallback />}>
              <WorkspaceShell />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route index           element={<Suspense fallback={<RouteFallback />}><WorkspaceHome /></Suspense>} />
        <Route path="library"  element={<Suspense fallback={<RouteFallback />}><Library /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
        <Route path="session/:docId" element={<Suspense fallback={<RouteFallback />}><Session /></Suspense>} />
      </Route>

      {/* Legacy redirect */}
      <Route path="/session/:docId" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<AppShell variant="marketing"><NotFound /></AppShell>} />
    </Routes>
  )
}
