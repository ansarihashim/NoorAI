const STYLES = [
  { key: 'flowchart',   label: 'Flowchart',   hint: 'Steps and decisions, top-down' },
  { key: 'mindmap',     label: 'Mind map',    hint: 'Branching ideas from a central topic' },
  { key: 'roadmap',     label: 'Roadmap',     hint: 'Left-to-right journey' },
  { key: 'tree',        label: 'Tree',        hint: 'Hierarchy / taxonomy' },
  { key: 'sequence',    label: 'Sequence',    hint: 'Steps between actors over time' },
  { key: 'concept-map', label: 'Concept map', hint: 'Relationships between concepts' },
  { key: 'timeline',    label: 'Timeline',    hint: 'Events along an axis' },
]

export default function StyleChips({ value, onChange, className = '' }) {
  return (
    <div className={['flex flex-wrap gap-1.5', className].join(' ')}>
      {STYLES.map((s) => {
        const active = value === s.key
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(active ? null : s.key)}
            title={s.hint}
            aria-pressed={active}
            className={[
              'inline-flex h-7 items-center gap-1.5 rounded-pill border px-2.5 text-[0.7rem] font-medium transition-colors',
              active
                ? 'border-accent-purple/40 bg-accent-purple/[0.14] text-accent-purple-soft'
                : 'border-white/[0.07] bg-white/[0.02] text-ink-muted hover:border-white/[0.14] hover:text-ink',
            ].join(' ')}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
