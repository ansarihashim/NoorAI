import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import Logo from '../ui/Logo.jsx'
import Button from '../ui/Button.jsx'

/**
 * Marketing-only top nav. The /app surface uses WorkspaceTopBar instead.
 * Quiet hairline header on warm-dark page; no blur, no glow.
 */
export default function TopNav({ variant = 'marketing' }) {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-page">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to={user ? '/app' : '/'} className="flex items-center gap-2">
          <Logo size={22} />
        </Link>
        <div className="flex items-center gap-2">
          {variant === 'marketing' && !user && (
            <>
              <Link to="/login" className="hidden text-[0.85rem] text-ink-muted transition-colors hover:text-ink sm:inline">
                Sign in
              </Link>
              <Button as={Link} to="/signup" size="sm" variant="primary">
                Get started
              </Button>
            </>
          )}
          {user && (
            <Button as={Link} to="/app" size="sm" variant="secondary">
              Open workspace
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
