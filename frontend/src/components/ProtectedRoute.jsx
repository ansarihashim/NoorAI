import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import Skeleton from './ui/Skeleton.jsx'

export default function ProtectedRoute({ children }) {
  const { user, hydrating } = useAuth()
  const location = useLocation()

  if (hydrating) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return children
}
