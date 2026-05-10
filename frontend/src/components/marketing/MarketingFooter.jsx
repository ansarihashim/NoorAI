import { Link } from 'react-router-dom'
import NoorMark from '../ui/NoorMark.jsx'

const COLS = [
  {
    title: 'Modes',
    links: [
      { label: 'Preparation', href: '#study-modes' },
      { label: 'Revision', href: '#study-modes' },
      { label: 'Podcast', href: '#study-modes' },
      { label: 'Narration', href: '#study-modes' },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'Workspace', href: '#demo' },
      { label: 'Knowledge graph', href: '#demo' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Press kit', href: '#' },
    ],
  },
]

export default function MarketingFooter() {
  return (
    <footer className="relative border-t border-echo-border bg-echo-bg/95">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_3fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <NoorMark size={36} animated />
              <span className="font-serif text-[1.2rem] font-medium tracking-tight text-echo-text">
                Noor<span className="text-echo-accent-soft">AI</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-[0.92rem] leading-relaxed text-echo-muted">
              Your notes, illuminated by AI. A calmer way to study — conversation by conversation, ember by ember.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {['twitter', 'github', 'linkedin'].map((s) => (
                <a
                  key={s}
                  href="#"
                  aria-label={s}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-echo-border text-echo-muted transition-colors duration-300 hover:border-echo-accent/40 hover:text-echo-text"
                >
                  <SocialIcon name={s} />
                </a>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLS.map((col) => (
              <div key={col.title}>
                <div className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-echo-muted">
                  {col.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-[0.92rem] text-echo-text/80 transition-colors duration-200 hover:text-echo-accent-soft"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-echo-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[0.78rem] text-echo-muted">
            © {new Date().getFullYear()} NoorAI · A calmer way to study.
          </p>
          <div className="flex items-center gap-6 text-[0.78rem] text-echo-muted">
            <Link to="/login" className="hover:text-echo-text">Sign in</Link>
            <a href="#" className="hover:text-echo-text">Privacy</a>
            <a href="#" className="hover:text-echo-text">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialIcon({ name }) {
  if (name === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  if (name === 'github') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.18c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.17a10.96 10.96 0 015.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.57.23 2.73.11 3.02.74.8 1.18 1.82 1.18 3.07 0 4.4-2.68 5.36-5.24 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.37V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}
