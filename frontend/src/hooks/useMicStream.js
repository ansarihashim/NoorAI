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

    // CRITICAL: create the AudioContext SYNCHRONOUSLY inside the gesture
    // tick. Doing it after `await getUserMedia` puts us outside the user-
    // gesture window, browsers leave the context "suspended", and the
    // worklet's process() is never pulled → mic delivers zero frames to
    // the WebSocket. We also explicitly resume() below in case the context
    // still started suspended (Safari, some Chrome flag combos).
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    ctxRef.current = ctx

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
    } catch (err) {
      try { await ctx.close() } catch { /* no-op */ }
      ctxRef.current = null
      throw err
    }
    streamRef.current = stream

    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch (err) { console.warn('[mic] ctx.resume failed', err) }
    }

    await ctx.audioWorklet.addModule('/pcm-capture.js')

    const source = ctx.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(ctx, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,                 // 1 output so the graph pulls the node
      outputChannelCount: [1],
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
    // Connect node → destination so the audio graph "pulls" the processor.
    // We don't actually want to hear the mic, so route through a silent
    // gain node. With numberOfOutputs:0 the graph wouldn't pull the worklet
    // reliably and process() could be skipped, especially on Chrome.
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0
    node.connect(silentGain).connect(ctx.destination)

    setActive(true)
  }, [active])

  useEffect(() => () => { stop() }, [stop])

  return { start, stop, active, level }
}
