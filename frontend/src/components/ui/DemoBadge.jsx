import { DEMO_MODE, disableDemoMode } from '../../config/demo.js'

/**
 * Pill rendered in the workspace top bar when running in demo mode.
 * Per spec — we don't call this "mock" or "fake"; the language is
 * "Demo Workspace".
 *
 * Clicking the pill exits demo mode: clears the demo JWT + the
 * `noorai.demoMode` localStorage flag and reloads to the landing page,
 * where the visitor can sign up for a real account.
 */
export default function DemoBadge() {
  if (!DEMO_MODE) return null
  return (
    <button
      type="button"
      onClick={() => disableDemoMode()}
      title="Click to exit demo mode and return to the landing page"
      className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[0.66rem] font-medium uppercase tracking-[0.14em] text-accent transition-colors duration-150 hover:border-accent hover:bg-accent/20"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-breathe" />
      <span>Demo workspace</span>
      <span className="text-accent/70 transition-colors duration-150 group-hover:text-accent">
        · exit
      </span>
    </button>
  )
}
