import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { useMicStream } from '../hooks/useMicStream.js'
import { useAudioPlayer } from '../hooks/useAudioPlayer.js'
import StatusPill from '../components/StatusPill.jsx'
import WaveformViz from '../components/WaveformViz.jsx'
import TranscriptLog from '../components/TranscriptLog.jsx'
import MicButton from '../components/MicButton.jsx'

export default function Session() {
  const { docId } = useParams()
  const [serverState, setServerState] = useState('idle')
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [warn, setWarn] = useState('')
  const [started, setStarted] = useState(false)
  const [busy, setBusy] = useState(false)

  const player = useAudioPlayer()

  const onJson = useCallback((msg) => {
    if (msg.type === 'state') {
      setServerState(msg.value)
    } else if (msg.type === 'transcript') {
      setMessages((m) => [...m, { role: msg.role, text: msg.text }])
    } else if (msg.type === 'flush_audio') {
      player.flush()
    } else if (msg.type === 'error') {
      setError(msg.message || 'unknown error')
    }
  }, [player])

  const onBytes = useCallback((buf) => {
    player.push(buf)
  }, [player])

  const { status, sendJson, sendBytes } = useWebSocket({ onJson, onBytes })

  const onMicFrame = useCallback((buf) => {
    sendBytes(buf)
  }, [sendBytes])

  const mic = useMicStream({ onFrame: onMicFrame })

  // Display state: prefer server state when active, else WS status
  const displayState = useMemo(() => {
    if (serverState !== 'idle') return serverState
    if (status !== 'open') return status
    return 'idle'
  }, [serverState, status])

  async function handleStart() {
    setError('')
    setWarn('')
    setBusy(true)
    try {
      // 1. Unlock the audio element from this user gesture so MediaSource can play.
      try {
        await player.unlock()
      } catch (err) {
        console.error('[session] player.unlock failed', err)
        setError(`audio init failed: ${err?.message || err}`)
        return
      }

      // 2. Try to enable the mic. Failure is non-fatal — narration still works
      //    without it, you just can't interrupt by speaking.
      try {
        await mic.start()
      } catch (err) {
        console.warn('[session] mic.start failed', err)
        const name = err?.name || 'Error'
        if (name === 'NotAllowedError') {
          setWarn('Microphone permission denied. Narration will play, but you cannot interrupt by speaking.')
        } else if (name === 'NotFoundError') {
          setWarn('No microphone found. Narration will play, but you cannot interrupt by speaking.')
        } else {
          setWarn(`Mic unavailable (${name}). Narration will play without interruption support.`)
        }
      }

      // 3. Tell the server to start narrating — this is what the user actually
      //    came here for, so it runs even if the mic failed above.
      if (status !== 'open') {
        setError(`Cannot start: WebSocket is "${status}". Try refreshing.`)
        return
      }
      sendJson({ type: 'start_narration', doc_id: docId })
      setStarted(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    try { sendJson({ type: 'stop' }) } catch {}
    try { await mic.stop() } catch {}
    setStarted(false)
  }

  // Stop everything on unmount
  const startedRef = useRef(false)
  useEffect(() => { startedRef.current = started }, [started])
  useEffect(() => () => {
    if (startedRef.current) {
      try { sendJson({ type: 'stop' }) } catch {}
    }
    mic.stop()
  }, [])

  const startDisabled = status !== 'open' || busy

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass p-6 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">Document</div>
          <div className="font-mono text-sm">{docId}</div>
        </div>
        <StatusPill state={displayState} />
      </div>

      <div className="glass p-6 space-y-4">
        <div className="flex items-center gap-6">
          <MicButton
            active={mic.active}
            disabled={!started}
            onClick={() => (mic.active ? mic.stop() : mic.start().catch((e) => setWarn(`mic: ${e?.message || e}`)))}
          />
          <div className="flex-1">
            <WaveformViz level={mic.level} />
          </div>
          {!started ? (
            <button
              onClick={handleStart}
              className="btn-primary"
              disabled={startDisabled}
              title={status !== 'open' ? `Waiting for connection (${status})` : 'Begin narration'}
            >
              {busy ? 'Starting…' : 'Start'}
            </button>
          ) : (
            <button onClick={handleStop} className="btn-ghost">
              Stop
            </button>
          )}
        </div>

        {status !== 'open' && (
          <div className="text-xs text-amber-400">
            WebSocket status: <span className="font-mono">{status}</span> — waiting for backend at{' '}
            <span className="font-mono">{import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/audio'}</span>
          </div>
        )}
        {warn && <div className="text-sm text-amber-400">{warn}</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}

        <p className="text-xs text-slate-500">
          Tip: speak naturally during narration to interrupt and ask a question. Narration resumes after the answer.
        </p>
      </div>

      <div className="glass p-6">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Transcript</div>
        <TranscriptLog messages={messages} />
      </div>
    </div>
  )
}
