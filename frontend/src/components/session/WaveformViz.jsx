import { useEffect, useRef, useState } from 'react'

const BARS = 56

export default function WaveformViz({ level = 0, active = false, accent = 'cyan' }) {
  // We keep history in a ref + force re-render via a tick state, so we don't
  // mutate state in render and stay React-strict-mode happy.
  const ref = useRef(new Array(BARS).fill(0))
  const [, tick] = useState(0)

  useEffect(() => {
    const h = ref.current
    h.shift()
    h.push(Math.min(1, level * 5))
    tick((n) => (n + 1) % 1024)
  }, [level])

  const colorClass = accent === 'purple' ? 'bg-accent-purple/70' : accent === 'green' ? 'bg-accent-green/70' : 'bg-accent-cyan/70'
  const glow = active ? 'mix-blend-screen' : ''

  return (
    <div className={['flex h-12 w-full items-center gap-[2px]', glow].join(' ')} aria-hidden>
      {ref.current.map((v, i) => {
        // mirror around center for symmetry
        const dist = Math.abs(i - BARS / 2) / (BARS / 2)
        const taper = 1 - dist * 0.3
        const h = Math.max(active ? 12 : 6, v * 100 * taper)
        return (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={['inline-block flex-1 rounded-sm transition-[height] duration-100', colorClass].join(' ')}
          />
        )
      })}
    </div>
  )
}
