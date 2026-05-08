import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * getUserMedia → AudioWorklet → 16kHz int16 PCM frames → onFrame(ArrayBuffer)
 *
 * The worklet posts a fresh ArrayBuffer per ~30ms frame.
 *
 * Returned API:
 *   start() / stop()     — open/close the mic
 *   level                — 0..1 instantaneous RMS level for waveform UI
 *   active               — whether the worklet is running
 */
export function useMicStream({ onFrame } = {}) {
  const onFrameRef = useRef(onFrame)
  const ctxRef = useRef(null)
  const nodeRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [level, setLevel] = useState(0)

  useEffect(() => { onFrameRef.current = onFrame }, [onFrame])

  const stop = useCallback(async () => {
    try { nodeRef.current?.port?.close() } catch {}
    try { nodeRef.current?.disconnect() } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()) } catch {}
    try { await ctxRef.current?.close() } catch {}
    nodeRef.current = null
    streamRef.current = null
    ctxRef.current = null
    setActive(false)
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    if (active) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })
    streamRef.current = stream

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    await ctx.audioWorklet.addModule('/pcm-capture.js')

    const source = ctx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(ctx, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { targetRate: 16000 },
    })
    nodeRef.current = node

    node.port.onmessage = (ev) => {
      const buf = ev.data
      onFrameRef.current?.(buf)
      // cheap RMS for UI
      const view = new Int16Array(buf)
      let sum = 0
      for (let i = 0; i < view.length; i++) sum += view[i] * view[i]
      const rms = Math.sqrt(sum / view.length) / 32768
      setLevel(rms)
    }

    source.connect(node)
    setActive(true)
  }, [active])

  useEffect(() => () => { stop() }, [stop])

  return { start, stop, active, level }
}
