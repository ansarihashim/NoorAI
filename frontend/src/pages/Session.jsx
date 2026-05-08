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
  const [started, setStarted] = useState(false)

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
    await player.unlock()       // user gesture → audio context unlocked
    await mic.start()           // mic permission
    sendJson({ type: 'start_narration', doc_id: docId })
    setStarted(true)
  }

  async function handleStop() {
    sendJson({ type: 'stop' })
    await mic.stop()
    setStarted(false)
  }

  // Stop everything on unmount
  useEffect(() => () => {
    try { sendJson({ type: 'stop' }) } catch {}
    mic.stop()
  }, [])

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
            disabled={status !== 'open' || !started}
            onClick={() => (mic.active ? mic.stop() : mic.start())}
          />
          <div className="flex-1">
            <WaveformViz level={mic.level} />
          </div>
          {!started ? (
            <button onClick={handleStart} className="btn-primary" disabled={status !== 'open'}>
              Start
            </button>
          ) : (
            <button onClick={handleStop} className="btn-ghost">
              Stop
            </button>
          )}
        </div>
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
