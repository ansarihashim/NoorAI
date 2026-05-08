import { useEffect, useRef, useState, useCallback } from 'react'

const URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/audio'

/**
 * Persistent WebSocket with exponential-backoff reconnect.
 *
 * @param {object} handlers
 * @param {(msg: object) => void} handlers.onJson    JSON control frames from server
 * @param {(buf: ArrayBuffer) => void} handlers.onBytes  binary audio frames from server
 */
export function useWebSocket({ onJson, onBytes } = {}) {
  const wsRef = useRef(null)
  const handlersRef = useRef({ onJson, onBytes })
  const [status, setStatus] = useState('connecting')
  const backoffRef = useRef(500)
  const closedManuallyRef = useRef(false)

  // keep latest handlers without re-subscribing
  useEffect(() => {
    handlersRef.current = { onJson, onBytes }
  }, [onJson, onBytes])

  useEffect(() => {
    closedManuallyRef.current = false

    function connect() {
      const ws = new WebSocket(URL)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws
      setStatus('connecting')

      ws.onopen = () => {
        backoffRef.current = 500
        setStatus('open')
      }
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const obj = JSON.parse(ev.data)
            handlersRef.current.onJson?.(obj)
          } catch (e) {
            console.warn('bad json from server', e)
          }
        } else {
          handlersRef.current.onBytes?.(ev.data)
        }
      }
      ws.onerror = () => {
        // closes follow; let onclose handle reconnect
      }
      ws.onclose = () => {
        setStatus('closed')
        if (closedManuallyRef.current) return
        const delay = Math.min(backoffRef.current, 8000)
        backoffRef.current = Math.min(backoffRef.current * 2, 8000)
        setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      closedManuallyRef.current = true
      try { wsRef.current?.close() } catch {}
    }
  }, [])

  const sendJson = useCallback((obj) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
  }, [])

  const sendBytes = useCallback((buf) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf)
  }, [])

  return { status, sendJson, sendBytes }
}
