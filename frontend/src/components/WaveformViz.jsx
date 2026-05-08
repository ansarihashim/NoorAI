import { useEffect, useRef } from 'react'

const BARS = 40

export default function WaveformViz({ level = 0 }) {
  const historyRef = useRef(new Array(BARS).fill(0))

  useEffect(() => {
    const h = historyRef.current
    h.shift()
    h.push(Math.min(1, level * 4))
  }, [level])

  return (
    <div className="flex items-end gap-[2px] h-12 w-full">
      {historyRef.current.map((v, i) => (
        <div
          key={i}
          style={{ height: `${Math.max(8, v * 100)}%` }}
          className="flex-1 rounded-sm bg-accent-cyan/60"
        />
      ))}
    </div>
  )
}
