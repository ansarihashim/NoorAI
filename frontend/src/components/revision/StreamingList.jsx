import { motion } from 'framer-motion'
import Button from '../ui/Button.jsx'

/**
 * Transient "generating…" view shared by all 6 revision features. Items fade in
 * one at a time as they stream, with a "Generating more…" indicator below the
 * last one; on completion the parent swaps this out for the feature's normal
 * (carousel/list) view. `renderItem(item, index)` draws the per-feature preview
 * inside each card — card visuals stay owned by the feature component.
 */
export default function StreamingList({
  label,
  items,
  isStreaming,
  isDone,
  error,
  total,
  onTryAgain,
  renderItem,
  noneLabel = 'Nothing was produced.',
}) {
  const noneYet = isDone && !error && items.length === 0
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-caption text-ink-muted">{label}</span>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            Generating…
          </h2>
        </div>
        <span className="font-mono text-[0.72rem] tabular-nums text-ink-faint">
          {items.length}{total ? ` / ${total}` : ''}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            {renderItem(it, i)}
          </motion.div>
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 px-1 py-2 text-[0.85rem] text-ink-muted">
            <Spinner />
            Generating more…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/[0.06] p-4">
            <p className="text-[0.9rem] text-ink">
              Generation failed{items.length ? ` — ${items.length} kept` : ''}.
            </p>
            <p className="mt-1 text-[0.8rem] text-ink-muted">{error}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={onTryAgain}>Try again</Button>
          </div>
        )}

        {noneYet && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[0.9rem] text-ink">{noneLabel}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={onTryAgain}>Try again</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin text-accent-purple-soft" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
