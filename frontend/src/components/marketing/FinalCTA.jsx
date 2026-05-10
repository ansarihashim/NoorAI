import { Link } from 'react-router-dom'
import { FadeUp } from './primitives.jsx'

export default function FinalCTA() {
  return (
    <section id="get-started" className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <FadeUp>
          <div className="rounded-2xl border border-echo-border bg-echo-surface px-6 py-20 sm:px-12 sm:py-24">
            <div className="mx-auto max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-echo-border bg-echo-bg px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-echo-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-echo-accent" />
                Free while in beta
              </div>

              <h2 className="mt-6 font-serif text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-tight text-echo-text">
                Stop reading notes passively.
                <br />
                <span className="text-echo-accent">Start learning conversationally.</span>
              </h2>

              <p className="mt-6 max-w-lg text-[1rem] leading-relaxed text-echo-muted">
                Bring your hardest material. Listen your way through it. Ask out loud. Revise tomorrow.
              </p>

              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-echo-accent px-6 text-[0.92rem] font-semibold text-echo-bg transition-colors duration-150 hover:bg-echo-accent-bright active:scale-[0.985]"
                >
                  Start studying smarter
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-echo-border bg-transparent px-5 text-[0.9rem] font-medium text-echo-text transition-colors duration-150 hover:border-echo-border-strong hover:bg-echo-bg"
                >
                  I already have an account
                </Link>
              </div>

              <ul className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 text-[0.82rem] text-echo-muted">
                {['No card to start', 'Your notes stay yours', 'Cancel any time'].map((c) => (
                  <li key={c} className="inline-flex items-center gap-2">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-echo-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8l3 3 7-7" />
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
