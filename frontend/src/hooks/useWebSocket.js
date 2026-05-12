import { useEffect, useRef, useState, useCallback } from 'react'
import { getToken } from '../lib/api.js'
import { DEMO_MODE } from '../config/demo.js'

// Resolve the WS endpoint at module load. Runtime safety net: if the page
// is served over HTTPS (Vercel always is) and the env left us with a plain
// ws:// scheme, browsers reject the upgrade as mixed-content. Force wss://
// in that case so a misconfigured env can never produce a silently broken
// build.
function resolveWsUrl() {
  let raw = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/audio'
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && raw.startsWith('ws://')) {
    raw = 'wss://' + raw.slice('ws://'.length)
  }
  return raw
}

const URL = resolveWsUrl()
const HEARTBEAT_MS = 25_000
const MAX_BACKOFF_MS = 8_000
const INITIAL_BACKOFF_MS = 500

function buildUrl() {
  const token = getToken()
  if (!token) return URL
  const sep = URL.includes('?') ? '&' : '?'
  return `${URL}${sep}token=${encodeURIComponent(token)}`
}

/**
 * Persistent WebSocket with exponential-backoff reconnect, heartbeat, and
 * StrictMode-safe cleanup.
 *
 * @param {object} handlers
 * @param {(msg: object) => void} handlers.onJson    JSON control frames from server
 * @param {(buf: ArrayBuffer) => void} handlers.onBytes  binary audio frames from server
 */
export function useWebSocket({ onJson, onBytes } = {}) {
  const wsRef = useRef(null)
  const handlersRef = useRef({ onJson, onBytes })
  const [status, setStatus] = useState(DEMO_MODE ? 'closed' : 'connecting')
  const backoffRef = useRef(INITIAL_BACKOFF_MS)

  useEffect(() => {
    handlersRef.current = { onJson, onBytes }
  }, [onJson, onBytes])

  useEffect(() => {
    // Demo mode: no backend, no WebSocket. Audio (narration / podcast) is
    // rendered entirely client-side via the Web Speech API. Skipping the
    // connection avoids the noisy `wss://localhost:8000` reconnect loop
    // that would otherwise flood the console.
    if (DEMO_MODE) return undefined

    let cancelled = false
    let currentWs = null
    let currentAbandon = null
    let reconnectTimer = null

    const connect = () => {
      const url = buildUrl()
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws
      currentWs = ws
      setStatus('connecting')
      console.info('[ws] connecting →', URL)

      let abandoned = false
      let heartbeatTimer = null

      const abandon = () => {
        abandoned = true
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
      }
      currentAbandon = abandon

      const startHeartbeat = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        heartbeatTimer = setInterval(() => {
          if (abandoned || ws.readyState !== WebSocket.OPEN) return
          try {
            ws.send(JSON.stringify({ type: 'ping' }))
          } catch (err) {
            console.warn('[ws] heartbeat send failed', err)
          }
        }, HEARTBEAT_MS)
      }

      ws.onopen = () => {
        if (abandoned) {
          try { ws.close(1000, 'abandoned') } catch {}
          return
        }
        backoffRef.current = INITIAL_BACKOFF_MS
        setStatus('open')
        startHeartbeat()
        console.info('[ws] open')
      }

      ws.onmessage = (ev) => {
        if (abandoned) return
        if (typeof ev.data === 'string') {
          let obj
          try {
            obj = JSON.parse(ev.data)
          } catch (err) {
            console.warn('[ws] bad json from server', err, ev.data)
            return
          }
          if (obj.type === 'pong') return
          handlersRef.current.onJson?.(obj)
        } else {
          handlersRef.current.onBytes?.(ev.data)
        }
      }

      ws.onerror = (ev) => {
        if (abandoned) return
        console.error('[ws] error event (close will follow)', ev)
      }

      ws.onclose = (ev) => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (abandoned) return
        setStatus('closed')
        if (cancelled) return
        const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
        console.warn(`[ws] closed code=${ev.code} clean=${ev.wasClean} reason="${ev.reason || ''}". reconnect in ${delay}ms`)
        reconnectTimer = setTimeout(() => {
          if (!cancelled) connect()
        }, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (currentAbandon) currentAbandon()
      const ws = currentWs
      if (!ws) return
      // Defer close until after the WS opens to avoid the
      // "WebSocket is closed before the connection is established" warning
      // that React 18 StrictMode triggers via its double-invoke of effects.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener(
          'open',
          () => { try { ws.close(1000, 'unmount') } catch {} },
          { once: true },
        )
      } else if (ws.readyState === WebSocket.OPEN) {
        try { ws.close(1000, 'unmount') } catch {}
      }
    }
  }, [])

  const sendJson = useCallback((obj) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }, [])

  const sendBytes = useCallback((buf) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buf)
    }
  }, [])

  return { status, sendJson, sendBytes }
}
