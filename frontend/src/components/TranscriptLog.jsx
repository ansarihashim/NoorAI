import { useEffect, useRef } from 'react'

const ROLE_STYLES = {
  user:      'bg-accent-purple/15 border-accent-purple/30 text-slate-100',
  assistant: 'bg-accent-cyan/15 border-accent-cyan/30 text-slate-100',
  narrator:  'bg-white/5 border-white/10 text-slate-300',
}

const ROLE_LABEL = {
  user: 'You',
  assistant: 'EchoVerse',
  narrator: 'Narration',
}

export default function TranscriptLog({ messages }) {
  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="h-72 overflow-y-auto space-y-2 pr-1">
      {messages.length === 0 && (
        <div className="text-sm text-slate-500 italic">
          Transcript will appear here as narration plays and you ask questions.
        </div>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`px-3 py-2 rounded-lg border text-sm ${ROLE_STYLES[m.role] || ROLE_STYLES.narrator}`}
        >
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            {ROLE_LABEL[m.role] || m.role}
          </div>
          <div>{m.text}</div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
