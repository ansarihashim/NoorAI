import { Link } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import { NotebookEyebrow } from '../components/ui/NotebookSurface.jsx'

/**
 * 404 rendered as a torn-out page from the notebook. Keeps the editorial
 * voice — "page · 404", serif heading, single CTA back to the cover.
 */
export default function NotFound() {
  return (
    <div className="relative min-h-[70vh]">
      <span aria-hidden className="notebook-rule pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-xl place-items-center px-6 py-24 text-center">
        <div>
          <NotebookEyebrow accent>page · 404</NotebookEyebrow>
          <h1 className="mt-3 font-serif text-[clamp(1.8rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink">
            That page is missing from this notebook.
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-muted">
            It may have been torn out, renamed, or never bound.
            Try the cover, or pick something from the index.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button as={Link} to="/">
              Take me to the cover
            </Button>
            <Button as={Link} to="/app/library" variant="secondary">
              Open the index
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
