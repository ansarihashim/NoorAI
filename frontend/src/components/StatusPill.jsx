const STYLES = {
  idle:       { dot: 'bg-slate-500', label: 'Idle' },
  narrating:  { dot: 'bg-accent-purple animate-pulse', label: 'Narrating' },
  interrupted:{ dot: 'bg-yellow-400 animate-pulse', label: 'Listening' },
  thinking:   { dot: 'bg-accent-cyan animate-pulse', label: 'Thinking' },
  speaking:   { dot: 'bg-accent-green animate-pulse', label: 'Speaking' },
  closed:     { dot: 'bg-red-500', label: 'Disconnected' },
  connecting: { dot: 'bg-slate-400 animate-pulse', label: 'Connecting' },
  open:       { dot: 'bg-slate-500', label: 'Connected' },
}

export default function StatusPill({ state }) {
  const s = STYLES[state] || STYLES.idle
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-sm">
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
