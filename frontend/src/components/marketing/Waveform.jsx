/**
 * Static narration waveform — deterministic varied bars in solid yellow.
 * No persistent animation; the live state is communicated by the parent's
 * status pill, not by motion.
 */
export default function Waveform({
  bars = 40,
  height = 64,
  gap = 3,
  width = 3,
  rounded = true,
  className = '',
  tone = 'accent', // kept for API compat; always yellow now
}) {
  const color = 'bg-echo-accent'

  return (
    <div
      className={['flex items-end', className].join(' ')}
      style={{ height, gap }}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i * 0.41) % (Math.PI * 2)
        const factor = 0.30 + Math.abs(Math.sin(phase + i * 0.21)) * 0.70
        const h = Math.max(6, height * factor)
        return (
          <span
            key={i}
            className={[color, rounded ? 'rounded-full' : 'rounded-sm', 'inline-block'].join(' ')}
            style={{ width, height: h }}
          />
        )
      })}
    </div>
  )
}
