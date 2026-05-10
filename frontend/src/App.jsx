import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import AppShell from './components/layout/AppShell.jsx'
import WorkspaceShell from './components/workspace/WorkspaceShell.jsx'
import WorkspaceHome from './components/workspace/WorkspaceHome.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
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
      {/* Marketing routes — keep the legacy AppShell for now (separate visual context) */}
      <Route path="/" element={<AppShell variant="marketing"><Landing /></AppShell>} />
      <Route path="/login" element={<PublicOnly><AppShell variant="marketing"><Login /></AppShell></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><AppShell variant="marketing"><Signup /></AppShell></PublicOnly>} />

      {/* App routes — single persistent WorkspaceShell, child routes swap the center column. */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WorkspaceShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkspaceHome />} />
        <Route path="library" element={<Library />} />
        <Route path="settings" element={<Settings />} />
        <Route path="session/:docId" element={<Session />} />
      </Route>

      {/* Legacy redirect */}
      <Route path="/session/:docId" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<AppShell variant="marketing"><NotFound /></AppShell>} />
    </Routes>
  )
}
