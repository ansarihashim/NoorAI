import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Stage-based progress UI for long-running AI generations.
 *
 * Usage:
 *   <GenerationProgress
 *     active={status === 'generating'}
 *     stages={[
 *       { label: 'Reading your notes',       seconds: 2 },
 *       { label: 'Picking out key topics',   seconds: 4 },
 *       { label: 'Writing the discussion',   seconds: 8 },
 *       { label: 'Polishing turns',          seconds: 3 },
 *     ]}
 *     overrunLabel="Still working — almost there"
 *   />
 *
 * The component runs a client-side timer that walks through `stages` at the
 * cadence implied by their `seconds`. The total estimated time and a live
 * countdown are shown above the bar. If the real generation outlasts the
 * estimate (which often happens for big docs), the progress bar parks at
 * ~92% and shows `overrunLabel` until the parent flips `active` to false.
 *
 * Not a "fake" loader — it does not claim more progress than has elapsed.
 * The estimate is the platform's average; the surface message is honest
 * about what's happening in the pipeline.
 */
export default function GenerationProgress({
  active,
  stages = DEFAULT_STAGES,
  overrunLabel = 'Still working — this is taking a little longer than usual',
  className = '',
}) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)

  // Reset whenever `active` flips on.
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      startRef.current = null
      return undefined
    }
    startRef.current = Date.now()
    setElapsed(0)
    const t = setInterval(() => {
      if (!startRef.current) return
      setElapsed((Date.now() - startRef.current) / 1000)
    }, 200)
    return () => clearInterval(t)
  }, [active])

  if (!active) return null

  const totalSeconds = stages.reduce((s, x) => s + (x.seconds || 0), 0)

  // Walk stages by cumulative seconds.
  let cum = 0
  let currentIdx = stages.length - 1
  for (let i = 0; i < stages.length; i++) {
    const next = cum + (stages[i].seconds || 0)
    if (elapsed < next) {
      currentIdx = i
      break
    }
    cum = next
  }
  const overrun = elapsed >= totalSeconds
  // Cap the bar at 92% while overrunning so it never appears stuck at 100%.
  const pct = overrun ? 92 : Math.min(92, (elapsed / Math.max(0.001, totalSeconds)) * 92)
  const remaining = Math.max(0, totalSeconds - elapsed)
  const stageLabel = overrun ? overrunLabel : (stages[currentIdx]?.label || 'Working…')

  return (
    <div className={['mx-auto w-full max-w-md', className].join(' ')}>
      <div className="flex items-baseline justify-between text-[0.78rem] text-ink-muted">
        <AnimatePresence mode="wait">
          <motion.span
            key={stageLabel}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18 }}
            className="truncate pr-3"
          >
            {stageLabel}
          </motion.span>
        </AnimatePresence>
        <span className="font-mono tabular-nums text-ink-faint">
          {overrun ? '~done' : `${Math.ceil(remaining)}s left`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        <motion.div
          className="h-full rounded-full bg-accent"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      </div>
      {/* Stage dots — show where we are in the pipeline. */}
      <div className="mt-2 flex items-center gap-1.5">
        {stages.map((s, i) => (
          <span
            key={s.label || i}
            className={[
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i < currentIdx
                ? 'bg-accent/80'
                : i === currentIdx
                  ? 'bg-accent'
                  : 'bg-rule',
            ].join(' ')}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}

const DEFAULT_STAGES = [
  { label: 'Reading your notes',  seconds: 2 },
  { label: 'Picking key topics',  seconds: 3 },
  { label: 'Drafting content',    seconds: 6 },
  { label: 'Polishing output',    seconds: 2 },
]

/**
 * Preset stage lists per feature — keep them honest. Times are rough averages
 * for medium-sized docs (~20-40 chunks).
 */
export const PODCAST_STAGES = [
  { label: 'Reading your source',         seconds: 2 },
  { label: 'Outlining the discussion',    seconds: 3 },
  { label: 'Writing host and co-host turns', seconds: 7 },
  { label: 'Smoothing the dialogue',      seconds: 2 },
]

export const OVERVIEW_STAGES = [
  { label: 'Reading your sources',        seconds: 2 },
  { label: 'Extracting key topics',       seconds: 4 },
  { label: 'Mapping dependencies',        seconds: 3 },
  { label: 'Drawing the syllabus graph',  seconds: 3 },
]

export const QUESTIONS_STAGES = [
  { label: 'Reading your sources',        seconds: 2 },
  { label: 'Identifying exam-worthy ideas', seconds: 4 },
  { label: 'Writing questions and answers', seconds: 5 },
]

export const EXPLANATION_STAGES = [
  { label: 'Looking up the topic',        seconds: 1 },
  { label: 'Gathering context',           seconds: 2 },
  { label: 'Writing the explanation',     seconds: 3 },
]

export const VISUAL_STAGES = [
  { label: 'Reading your notes',          seconds: 2 },
  { label: 'Choosing the diagram type',   seconds: 1 },
  { label: 'Drafting the diagram',        seconds: 4 },
  { label: 'Validating the syntax',       seconds: 1 },
]

export const REVISION_STAGES = [
  { label: 'Reading your source',         seconds: 2 },
  { label: 'Picking high-yield items',    seconds: 3 },
  { label: 'Writing the set',             seconds: 5 },
]
