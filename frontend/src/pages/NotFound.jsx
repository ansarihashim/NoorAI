import { Link } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-6 py-20 text-center">
      <div>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink-faint">404</span>
        <h1 className="mt-3 font-display text-title text-ink">We couldn't find that page.</h1>
        <p className="mt-3 text-ink-muted">It may have moved, or the link is from before the rebuild.</p>
        <Button as={Link} to="/" className="mt-6">
          Take me home
        </Button>
      </div>
    </div>
  )
}
