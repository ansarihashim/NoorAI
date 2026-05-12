import { DEMO_MODE } from '../../config/demo.js'

/**
 * Subtle pill rendered in the workspace top bar when running in demo mode.
 * Per spec — we don't call this "mock" or "fake"; the language is
 * "Demo Workspace" / "Interactive Preview".
 *
 * The badge is mainly a tell for the user (and recruiters) that this is
 * the cached experience; it also doubles as a hover-tooltip pointer toward
 * the demo credentials.
 */
export default function DemoBadge() {
  if (!DEMO_MODE) return null
  return (
    <span
      title="Cached AI responses · demo credentials are demo@noorai.ai / demo123"
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[0.66rem] font-medium uppercase tracking-[0.14em] text-accent"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-breathe" />
      Demo workspace
    </span>
  )
}
