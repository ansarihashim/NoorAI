import { motion } from 'framer-motion'

/**
 * Lightweight controlled tabs.
 *   <Tabs value={mode} onChange={setMode} options={[{ value: 'narration', label: 'Narration' }, ...]} />
 *
 * Uses Framer's `layoutId` so the active underline glides between tabs.
 */
export default function Tabs({ value, onChange, options, layoutId = 'tab-pill', className = '' }) {
  return (
    <div
      role="tablist"
      className={[
        'inline-flex items-center gap-1 rounded-pill border border-white/[0.06] bg-white/[0.03] p-1',
        className,
      ].join(' ')}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            title={opt.title || (opt.disabled ? 'Coming soon' : undefined)}
            onClick={() => !opt.disabled && onChange?.(opt.value)}
            className={[
              'relative inline-flex h-8 items-center gap-1.5 rounded-pill px-3.5 text-xs font-medium tracking-tight transition-colors',
              opt.disabled
                ? 'cursor-not-allowed text-ink-faint'
                : active
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-pill bg-white/[0.08] shadow-hairline"
              />
            )}
            {opt.icon && <span className="relative z-10">{opt.icon}</span>}
            <span className="relative z-10">{opt.label}</span>
            {opt.badge && (
              <span className="relative z-10 rounded-pill bg-white/[0.08] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                {opt.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
