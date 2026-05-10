import { useCallback, useMemo, useRef, useState } from 'react'
import { formatTime } from './formatTime.js'

/**
 * Chapter-aware seek bar.
 *
 * Click anywhere to seek; chapter boundaries render as faint vertical ticks;
 * the current chapter span gets a brighter underline so the user knows where
 * the "now playing" chapter starts and ends.
 *
 *   <SeekBar
 *     globalTime={state.globalTime}
 *     globalDuration={state.globalDuration}
 *     chapters={[{ idx, startTime, duration, label, speaker }]}
 *     currentIdx={state.idx}
 *     onSeek={(t) => audio.seekGlobal(t)}
 *   />
 */
export default function SeekBar({
  globalTime,
  globalDuration,
  chapters,
  currentIdx,
  onSeek,
  disabled = false,
}) {
  const trackRef = useRef(null)
  const [hover, setHover] = useState(null) // {x, time} | null
  const [dragging, setDragging] = useState(false)

  const pct = globalDuration > 0 ? Math.min(100, (globalTime / globalDuration) * 100) : 0

  const timeForX = useCallback((clientX) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * globalDuration
  }, [globalDuration])

  const onPointerMove = useCallback((e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = timeForX(e.clientX)
    setHover({ x: Math.max(0, Math.min(rect.width, x)), time: t })
    if (dragging) onSeek?.(t)
  }, [dragging, onSeek, timeForX])

  const onPointerDown = useCallback((e) => {
    if (disabled) return
    setDragging(true)
    onSeek?.(timeForX(e.clientX))
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }, [disabled, onSeek, timeForX])

  const onPointerUp = useCallback(() => setDragging(false), [])

  const ticks = useMemo(() => {
    if (!chapters || globalDuration <= 0) return []
    return chapters.map((c) => ({
      idx: c.idx,
      pct: Math.min(100, (c.startTime / globalDuration) * 100),
      isHost: c.speaker === 'host',
      isGuest: c.speaker === 'guest',
    }))
  }, [chapters, globalDuration])

  const currentChapter = chapters?.find((c) => c.idx === currentIdx)
  const currentSpan = currentChapter && globalDuration > 0
    ? {
        left: (currentChapter.startTime / globalDuration) * 100,
        width: (currentChapter.duration / globalDuration) * 100,
      }
    : null

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(globalDuration))}
        aria-valuenow={Math.round(globalTime)}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        className={[
          'relative h-2 cursor-pointer rounded-full bg-elevated transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-float',
        ].join(' ')}
      >
        {/* current chapter span (faint underline behind progress fill) */}
        {currentSpan && (
          <span
            className="pointer-events-none absolute top-0 bottom-0 rounded-full bg-rule"
            style={{ left: `${currentSpan.left}%`, width: `${currentSpan.width}%` }}
            aria-hidden
          />
        )}
        {/* progress fill */}
        <span
          className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full bg-accent"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        {/* chapter ticks */}
        {ticks.map((t) =>
          t.idx === 0 ? null : (
            <span
              key={t.idx}
              className={[
                'pointer-events-none absolute top-0 bottom-0 w-px',
                t.isHost ? 'bg-dusk/50' : t.isGuest ? 'bg-sage/50' : 'bg-rule-strong',
              ].join(' ')}
              style={{ left: `${t.pct}%` }}
              aria-hidden
            />
          ),
        )}
        {/* playhead thumb */}
        <span
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-accent shadow-soft"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
        {/* hover time tooltip */}
        {hover && globalDuration > 0 && (
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-sm border border-rule bg-float px-1.5 py-0.5 font-mono text-[0.65rem] text-ink"
            style={{ left: `${hover.x}px` }}
            aria-hidden
          >
            {formatTime(hover.time)}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[0.7rem] text-ink-dim">
        <span>{formatTime(globalTime)}</span>
        <span>{formatTime(globalDuration)}</span>
      </div>
    </div>
  )
}
