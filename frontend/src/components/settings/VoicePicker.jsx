import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { listVoices, voicePreviewUrl } from '../../lib/api.js'
import { useVoicePrefs } from '../../hooks/useVoicePrefs.js'
import Skeleton from '../ui/Skeleton.jsx'

function PreviewButton({ voiceId, playing, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'inline-flex h-7 items-center gap-1.5 rounded-pill border border-white/[0.08] bg-white/[0.04] px-2.5 text-[0.7rem] font-medium transition-colors',
        playing
          ? 'text-accent-purple-soft border-accent-purple/40 bg-accent-purple/[0.10]'
          : 'text-ink-muted hover:text-ink hover:bg-white/[0.07]',
      ].join(' ')}
      aria-label={playing ? 'Stop preview' : 'Hear sample'}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
      )}
      {playing ? 'Stop' : 'Hear it'}
    </button>
  )
}

function VoiceRow({ voice, selectedHost, selectedGuest, onPickHost, onPickGuest, playing, onPreview }) {
  const isHost = selectedHost === voice.id
  const isGuest = selectedGuest === voice.id
  return (
    <li
      className={[
        'flex items-center justify-between gap-3 px-5 py-3 transition-colors',
        isHost || isGuest ? 'bg-white/[0.02]' : '',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-ink">{voice.name}</div>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-ink-faint">
            {voice.gender}
          </span>
          {voice.suggested_role === 'host' ? (
            <span className="rounded-pill bg-accent-purple/[0.10] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-accent-purple-soft">
              Host pick
            </span>
          ) : (
            <span className="rounded-pill bg-accent-cyan/[0.10] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-accent-cyan-soft">
              Guest pick
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-ink-muted">{voice.tone}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <PreviewButton voiceId={voice.id} playing={playing} onToggle={() => onPreview(voice.id)} />
        <button
          onClick={() => onPickHost(voice.id)}
          aria-pressed={isHost}
          className={[
            'h-7 rounded-pill border px-2.5 text-[0.7rem] font-medium transition-colors',
            isHost
              ? 'border-accent-purple/40 bg-accent-purple/[0.16] text-accent-purple-soft'
              : 'border-white/[0.08] bg-white/[0.03] text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {isHost ? 'Host ✓' : 'Use as host'}
        </button>
        <button
          onClick={() => onPickGuest(voice.id)}
          aria-pressed={isGuest}
          className={[
            'h-7 rounded-pill border px-2.5 text-[0.7rem] font-medium transition-colors',
            isGuest
              ? 'border-accent-cyan/40 bg-accent-cyan/[0.16] text-accent-cyan-soft'
              : 'border-white/[0.08] bg-white/[0.03] text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {isGuest ? 'Guest ✓' : 'Use as guest'}
        </button>
      </div>
    </li>
  )
}

export default function VoicePicker() {
  const [voices, setVoices] = useState(null)
  const [previewing, setPreviewing] = useState(null) // voiceId currently playing
  const audioRef = useRef(null)
  const { host, guest, setHost, setGuest, reset } = useVoicePrefs()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const v = await listVoices()
        if (!cancelled) setVoices(v)
      } catch {
        if (!cancelled) setVoices([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const a = new Audio()
    audioRef.current = a
    const onEnd = () => setPreviewing(null)
    a.addEventListener('ended', onEnd)
    a.addEventListener('pause', onEnd)
    return () => {
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('pause', onEnd)
      try { a.pause() } catch {}
      a.src = ''
    }
  }, [])

  function togglePreview(voiceId) {
    const a = audioRef.current
    if (!a) return
    if (previewing === voiceId) {
      try { a.pause() } catch {}
      setPreviewing(null)
      return
    }
    try { a.pause() } catch {}
    a.src = voicePreviewUrl(voiceId)
    a.play().catch(() => {})
    setPreviewing(voiceId)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <span className="text-xs text-ink-muted">
          Picks apply to new playback. Re-enter the session to hear them.
        </span>
        {(host || guest) && (
          <button
            onClick={reset}
            className="text-[0.7rem] text-ink-faint hover:text-accent-rose"
          >
            Reset to defaults
          </button>
        )}
      </div>
      <div className="border-t border-white/[0.05]" />
      {voices === null ? (
        <ul className="divide-y divide-white/[0.05]">
          {[0, 1, 2].map((i) => (
            <li key={i} className="space-y-2 px-5 py-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-1/2" />
            </li>
          ))}
        </ul>
      ) : voices.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-ink-muted">
          No voices available. Check your ElevenLabs key.
        </p>
      ) : (
        <motion.ul layout className="divide-y divide-white/[0.05]">
          {voices.map((v) => (
            <VoiceRow
              key={v.id}
              voice={v}
              selectedHost={host}
              selectedGuest={guest}
              onPickHost={setHost}
              onPickGuest={setGuest}
              playing={previewing === v.id}
              onPreview={togglePreview}
            />
          ))}
        </motion.ul>
      )}
    </div>
  )
}
