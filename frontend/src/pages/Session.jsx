import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { generatePodcast, getDoc, getPodcast } from '../lib/api.js'
import Pill from '../components/ui/Pill.jsx'
import Tabs from '../components/ui/Tabs.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import NarrationView from '../components/session/NarrationView.jsx'
import PodcastView from '../components/session/PodcastView.jsx'
import VisualizeView from '../components/visualize/VisualizeView.jsx'

const STATE_TONE = {
  idle: 'neutral',
  attending: 'purple',
  narrating: 'purple',
  interrupted: 'cyan',
  thinking: 'cyan',
  speaking: 'green',
  podcast_generating: 'cyan',
  podcast_playing: 'purple',
  closed: 'rose',
  connecting: 'amber',
  open: 'neutral',
}

const STATE_LABEL = {
  idle: 'Idle',
  attending: 'Listening',
  narrating: 'Narrating',
  interrupted: 'Hearing you',
  thinking: 'Thinking',
  speaking: 'Speaking',
  podcast_generating: 'Generating',
  podcast_playing: 'On air',
  closed: 'Disconnected',
  connecting: 'Connecting',
  open: 'Connected',
}

function loadPosition(docId) {
  try {
    const all = JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}')
    return all[docId] || {}
  } catch {
    return {}
  }
}

function savePosition(docId, partial) {
  try {
    const all = JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}')
    all[docId] = { ...(all[docId] || {}), ...partial, updatedAt: Date.now() }
    localStorage.setItem('echoverse.lastPosition', JSON.stringify(all))
  } catch {
    /* ignore quota errors */
  }
}

export default function Session() {
  const { docId } = useParams()
  const { state: routeState } = useLocation()
  const toast = useToast()

  // ---- doc metadata ----
  const [doc, setDoc] = useState(routeState?.doc || null)
  const [docTitle, setDocTitle] = useState(routeState?.doc?.title || 'Loading…')

  // ---- top-level mode + server state mirror ----
  const [mode, setMode] = useState(() => loadPosition(docId).mode || 'narration')
  const [serverState, setServerState] = useState('idle')
  const [messages, setMessages] = useState([])
  const [interruption, setInterruption] = useState(null) // { reason, message }

  // ---- podcast state ----
  const [podcastStatus, setPodcastStatus] = useState('idle')
  const [podcastTurns, setPodcastTurns] = useState([])
  const [podcastError, setPodcastError] = useState('')
  const [podcastBusy, setPodcastBusy] = useState(false)

  // ---- continue listening seeds ----
  const lastPos = useMemo(() => loadPosition(docId), [docId])

  // -------- doc metadata fetch --------
  useEffect(() => {
    if (doc) return
    let cancelled = false
    ;(async () => {
      try {
        const meta = await getDoc(docId)
        if (!cancelled) {
          setDoc({
            doc_id: docId,
            title: meta.title || 'Untitled',
            n_narration_chunks: meta.n_narration ?? meta.n_narration_chunks ?? 0,
          })
          setDocTitle(meta.title || 'Untitled')
        }
      } catch (err) {
        if (!cancelled) toast.error("Couldn't load document", err?.message)
      }
    })()
    return () => { cancelled = true }
  }, [docId, doc, toast])

  // -------- podcast script probe (cached) --------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const script = await getPodcast(docId)
        if (!cancelled && script?.turns?.length) {
          setPodcastTurns(script.turns)
          setPodcastStatus('ready')
        }
      } catch (err) {
        if (err?.status && err.status !== 404 && !cancelled) {
          console.warn('[session] podcast probe failed:', err)
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId])

  // -------- WebSocket for narration interruption + Q&A --------
  const onJson = useCallback(
    (msg) => {
      switch (msg.type) {
        case 'state':
          setServerState(msg.value)
          if (msg.value === 'podcast_generating') setPodcastStatus('generating')
          else if (msg.value === 'podcast_playing') setPodcastStatus('playing')
          break
        case 'transcript':
          if (msg.role === 'user' || msg.role === 'assistant') {
            setMessages((m) => [...m, { role: msg.role, text: msg.text }])
          }
          // narrator transcripts in the new flow are NOT used — the client owns
          // narration text directly via the manifest.
          break
        case 'interruption_dismissed':
          setInterruption({ reason: msg.reason, message: msg.message })
          // Auto-clear after 6s so the banner doesn't linger forever.
          setTimeout(() => {
            setInterruption((cur) => (cur && cur.reason === msg.reason ? null : cur))
          }, 6000)
          break
        case 'flush_audio':
          window.dispatchEvent(new CustomEvent('echoverse:flush_audio'))
          break
        case 'podcast_done':
          setPodcastStatus('done')
          break
        case 'error': {
          const m = msg.message || 'unknown error'
          toast.error('Server error', m)
          if (mode === 'podcast') {
            setPodcastError(m)
            setPodcastStatus(podcastTurns.length ? 'ready' : 'idle')
          }
          break
        }
        default:
          break
      }
    },
    [toast, mode, podcastTurns.length],
  )

  const onBytes = useCallback((buf) => {
    // Ephemeral Q&A audio bytes — push them to the legacy MediaSource player
    // hosted inside NarrationView. We use a global ref to avoid plumbing a
    // ref all the way down through Session/Pod/Narration.
    const qa = window.__echoverse_qa_player
    if (qa) qa.push(buf)
  }, [])

  const { status: wsStatus, sendJson, sendBytes } = useWebSocket({ onJson, onBytes })

  // -------- mode switching --------
  function handleModeChange(next) {
    if (next === mode) return
    try { sendJson({ type: 'stop' }) } catch {}
    setMode(next)
    savePosition(docId, { mode: next })
  }

  // -------- podcast actions --------
  async function handlePodcastGenerate() {
    setPodcastError('')
    setPodcastBusy(true)
    setPodcastStatus('generating')
    try {
      const res = await generatePodcast(docId)
      setPodcastTurns(res.turns || [])
      setPodcastStatus('ready')
      toast.success('Episode written', `${res.n_turns} turns ready to play.`)
    } catch (err) {
      const msg = err?.message || String(err)
      setPodcastError(msg)
      setPodcastStatus('idle')
      toast.error('Generation failed', msg)
    } finally {
      setPodcastBusy(false)
    }
  }

  // -------- continue listening persistence --------
  const persistNarrationPosition = useCallback(
    (idx, time) => savePosition(docId, { mode: 'narration', narrationIdx: idx, narrationTime: time }),
    [docId],
  )
  const persistPodcastPosition = useCallback(
    (idx, time) => savePosition(docId, { mode: 'podcast', podcastIdx: idx, podcastTime: time }),
    [docId],
  )

  const displayState = useMemo(() => {
    if (serverState !== 'idle') return serverState
    if (wsStatus !== 'open') return wsStatus
    return 'idle'
  }, [serverState, wsStatus])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header strip */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-white/[0.05] bg-bg/60 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <Link to="/app" className="text-[0.7rem] text-ink-faint hover:text-ink-muted">
              ← Library
            </Link>
            <h1 className="mt-0.5 truncate text-[0.95rem] font-medium tracking-tight text-ink">
              {docTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Tabs
              value={mode}
              onChange={handleModeChange}
              options={[
                { value: 'narration', label: 'Narration' },
                { value: 'podcast', label: 'Podcast' },
                { value: 'visualize', label: 'Visualize' },
              ]}
            />
            {mode !== 'visualize' && (
              <Pill tone={STATE_TONE[displayState] || 'neutral'}>{STATE_LABEL[displayState] || displayState}</Pill>
            )}
          </div>
        </div>
      </motion.div>

      {mode === 'narration' && (
        <NarrationView
          docId={docId}
          serverState={serverState}
          wsStatus={wsStatus}
          sendJson={sendJson}
          sendBytes={sendBytes}
          messages={messages}
          interruption={interruption}
          clearInterruption={() => setInterruption(null)}
          initialChapter={lastPos.mode === 'narration' ? lastPos.narrationIdx : undefined}
          initialLocalTime={lastPos.mode === 'narration' ? lastPos.narrationTime : undefined}
          onPositionChange={persistNarrationPosition}
        />
      )}

      {mode === 'podcast' && (
        <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden p-4 sm:p-6">
          <div className="glass relative min-w-0 flex-1 overflow-hidden">
            <PodcastView
              docId={docId}
              title={docTitle}
              status={podcastStatus}
              errorMsg={podcastError}
              turns={podcastTurns}
              onGenerate={handlePodcastGenerate}
              busy={podcastBusy}
              initialChapter={lastPos.mode === 'podcast' ? lastPos.podcastIdx : undefined}
              initialLocalTime={lastPos.mode === 'podcast' ? lastPos.podcastTime : undefined}
              onPositionChange={persistPodcastPosition}
            />
          </div>
        </div>
      )}

      {mode === 'visualize' && (
        <div className="flex flex-1 overflow-hidden">
          <VisualizeView docId={docId} docTitle={docTitle} />
        </div>
      )}
    </div>
  )
}
