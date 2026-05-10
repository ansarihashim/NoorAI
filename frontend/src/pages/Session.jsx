import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket.js'
import { getDoc } from '../lib/api.js'
import { useToast } from '../components/ui/Toast.jsx'
import { useWorkspace } from '../components/workspace/WorkspaceContext.jsx'
import ModeRail from '../components/workspace/ModeRail.jsx'
import NarrationView from '../components/session/NarrationView.jsx'
import PodcastPlayback from '../components/session/PodcastPlayback.jsx'
import PreparationView from '../components/preparation/PreparationView.jsx'
import RevisionView from '../components/revision/RevisionView.jsx'

/**
 * Session = the center column when a document is open.
 * Owns the narration WebSocket. Podcast state lives in PodcastSessionContext
 * (mounted at WorkspaceShell level) so center playback and the right-rail
 * transcript share one source of truth.
 */

function loadPosition(docId) {
  try {
    const all = JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}')
    return all[docId] || {}
  } catch { return {} }
}

function savePosition(docId, partial) {
  try {
    const all = JSON.parse(localStorage.getItem('echoverse.lastPosition') || '{}')
    all[docId] = { ...(all[docId] || {}), ...partial, updatedAt: Date.now() }
    localStorage.setItem('echoverse.lastPosition', JSON.stringify(all))
  } catch { /* ignore quota errors */ }
}

export default function Session() {
  const { docId } = useParams()
  const { state: routeState } = useLocation()
  const toast = useToast()
  const { activeMode, setActiveMode } = useWorkspace()

  // ---- doc metadata ----
  const [doc, setDoc] = useState(routeState?.doc || null)
  const [, setDocTitle] = useState(routeState?.doc?.title || 'Loading…')

  // ---- narration WS state ----
  const [serverState, setServerState] = useState('idle')
  const [messages, setMessages] = useState([])
  const [interruption, setInterruption] = useState(null)

  // Restore last mode on first load of this doc; default to preparation.
  useEffect(() => {
    const saved = loadPosition(docId)
    if (saved.mode && ['preparation', 'revision', 'podcast', 'narration'].includes(saved.mode)) {
      setActiveMode(saved.mode)
    } else {
      setActiveMode('preparation')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

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

  // -------- WebSocket for narration interruption + Q&A --------
  const onJson = useCallback(
    (msg) => {
      switch (msg.type) {
        case 'state':
          setServerState(msg.value)
          break
        case 'transcript':
          if (msg.role === 'user' || msg.role === 'assistant') {
            setMessages((m) => [...m, { role: msg.role, text: msg.text }])
          }
          break
        case 'interruption_dismissed':
          setInterruption({ reason: msg.reason, message: msg.message })
          setTimeout(() => {
            setInterruption((cur) => (cur && cur.reason === msg.reason ? null : cur))
          }, 6000)
          break
        case 'flush_audio':
          window.dispatchEvent(new CustomEvent('echoverse:flush_audio'))
          break
        case 'error':
          toast.error('Server error', msg.message || 'unknown')
          break
        default:
          break
      }
    },
    [toast],
  )

  const onBytes = useCallback((buf) => {
    const qa = window.__echoverse_qa_player
    if (qa) qa.push(buf)
  }, [])

  const { status: wsStatus, sendJson, sendBytes } = useWebSocket({ onJson, onBytes })

  // When mode switches, stop any in-flight playback so the new mode starts clean.
  useEffect(() => {
    try { sendJson({ type: 'stop' }) } catch { /* no-op */ }
    savePosition(docId, { mode: activeMode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, docId])

  const persistNarrationPosition = useCallback(
    (idx, time) => savePosition(docId, { mode: 'narration', narrationIdx: idx, narrationTime: time }),
    [docId],
  )

  return (
    <div className="flex h-full flex-col">
      <ModeRail />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeMode === 'preparation' && (
          <div className="h-full overflow-y-auto">
            <PreparationView activeDocId={docId} />
          </div>
        )}

        {activeMode === 'revision' && (
          <div className="h-full">
            <RevisionView docId={docId} />
          </div>
        )}

        {activeMode === 'narration' && (
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

        {activeMode === 'podcast' && (
          <div className="h-full">
            <PodcastPlayback />
          </div>
        )}
      </div>
    </div>
  )
}
