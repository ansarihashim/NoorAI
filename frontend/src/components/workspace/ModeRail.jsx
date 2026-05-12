import { motion } from 'framer-motion'
import { useWorkspace } from './WorkspaceContext.jsx'
import { useSound } from '../../lib/sound.jsx'

/**
 * Slim in-center rail that lets the user switch cognitive mode without
 * navigating to a different page. Modes (in display order):
 *   Preparation → Revision → Podcast → Narration
 * Visualize is intentionally absent — visual generation is now a contextual
 * action inside Preparation and Revision via the AI Studio rail.
 */

const MODES = [
  { id: 'preparation', label: 'Preparation', glyph: PreparationGlyph },
  { id: 'revision',    label: 'Revision',    glyph: RevisionGlyph },
  { id: 'podcast',     label: 'Podcast',     glyph: PodcastGlyph },
  { id: 'narration',   label: 'Narration',   glyph: NarrationGlyph },
]

export default function ModeRail() {
  const { activeMode, setActiveMode } = useWorkspace()
  const { play } = useSound()
  return (
    <nav className="flex items-center gap-6 border-b border-rule px-5 py-2">
      {MODES.map((m) => {
        const active = m.id === activeMode
        const Glyph = m.glyph
        return (
          <button
            key={m.id}
            onClick={() => {
              if (m.id !== activeMode) play('page')
              setActiveMode(m.id)
            }}
            className="relative flex items-center gap-2 py-1.5 text-[0.875rem] font-medium transition-colors"
          >
            <Glyph active={active} />
            <span className={active ? 'text-ink' : 'text-ink-muted hover:text-ink'}>
              {m.label}
            </span>
            {active && (
              <motion.span
                layoutId="moderail-underline"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-x-0 -bottom-[9px] h-[2px] bg-accent"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

/* ---------- Mode glyphs (small serif-styled icons, switch to amber on active) ---------- */

function PreparationGlyph({ active }) {
  return (
    <svg viewBox="0 0 24 24" className={['h-4 w-4 transition-colors', active ? 'text-accent' : 'text-ink-dim'].join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16M4 12h10M4 19h16" />
      <circle cx="18" cy="12" r="2.4" />
    </svg>
  )
}

function RevisionGlyph({ active }) {
  return (
    <svg viewBox="0 0 24 24" className={['h-4 w-4 transition-colors', active ? 'text-accent' : 'text-ink-dim'].join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="13" height="16" rx="1.5" />
      <path d="M3 7v13a1.5 1.5 0 001.5 1.5H17" />
    </svg>
  )
}

function PodcastGlyph({ active }) {
  return (
    <svg viewBox="0 0 24 24" className={['h-4 w-4 transition-colors', active ? 'text-accent' : 'text-ink-dim'].join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="2.5" />
      <circle cx="16" cy="12" r="2.5" />
      <path d="M5 17c1.4-1.7 3.2-2.5 5-2.5M19 17c-1.4-1.7-3.2-2.5-5-2.5" />
    </svg>
  )
}

function NarrationGlyph({ active }) {
  return (
    <svg viewBox="0 0 24 24" className={['h-4 w-4 transition-colors', active ? 'text-accent' : 'text-ink-dim'].join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M16 4v3h3" />
      <path d="M8 12h7M8 16h5" />
    </svg>
  )
}
