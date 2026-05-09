import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import AppShell from './components/layout/AppShell.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Library from './pages/Library.jsx'
import Settings from './pages/Settings.jsx'
import Session from './pages/Session.jsx'
import NotFound from './pages/NotFound.jsx'

function PublicOnly({ children }) {
  const { user, hydrating } = useAuth()
  if (hydrating) return null
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell variant="marketing">
            <Landing />
          </AppShell>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <AppShell variant="marketing">
              <Login />
            </AppShell>
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <AppShell variant="marketing">
              <Signup />
            </AppShell>
          </PublicOnly>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell variant="app">
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/library"
        element={
          <ProtectedRoute>
            <AppShell variant="app">
              <Library />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppShell variant="app">
              <Settings />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/session/:docId"
        element={
          <ProtectedRoute>
            <AppShell variant="app">
              <Session />
            </AppShell>
          </ProtectedRoute>
        }
      />
      {/* Backwards-compat redirect for old links */}
      <Route path="/session/:docId" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<AppShell variant="marketing"><NotFound /></AppShell>} />
    </Routes>
  )
}
