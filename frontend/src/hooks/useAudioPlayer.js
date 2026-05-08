import { useCallback, useEffect, useRef } from 'react'

/**
 * Streaming MP3 player using MediaSource Extensions.
 *
 * push(arrayBuffer)  — append a chunk to the playback queue
 * flush()            — drop everything currently buffered (used on interruption)
 * unlock()           — must be called from a user gesture so autoplay works
 */
export function useAudioPlayer() {
  const audioElRef = useRef(null)
  const mediaSourceRef = useRef(null)
  const sourceBufferRef = useRef(null)
  const queueRef = useRef([])
  const readyRef = useRef(false)

  // Initialize an <audio> element + MediaSource once, on mount.
  useEffect(() => {
    const audio = new Audio()
    audio.autoplay = true
    audioElRef.current = audio
    setupMediaSource()
    return () => {
      try { audio.pause() } catch {}
      audioElRef.current = null
      mediaSourceRef.current = null
      sourceBufferRef.current = null
      queueRef.current = []
      readyRef.current = false
    }
  }, [])

  function setupMediaSource() {
    const audio = audioElRef.current
    if (!audio) return
    const ms = new MediaSource()
    mediaSourceRef.current = ms
    audio.src = URL.createObjectURL(ms)
    ms.addEventListener('sourceopen', () => {
      const sb = ms.addSourceBuffer('audio/mpeg')
      sb.mode = 'sequence'
      sourceBufferRef.current = sb
      readyRef.current = true
      sb.addEventListener('updateend', drain)
      drain()
    })
  }

  function drain() {
    const sb = sourceBufferRef.current
    if (!sb || sb.updating) return
    const next = queueRef.current.shift()
    if (next) {
      try { sb.appendBuffer(next) } catch (e) { console.warn('appendBuffer failed', e) }
    }
  }

  const push = useCallback((arrayBuffer) => {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return
    queueRef.current.push(new Uint8Array(arrayBuffer))
    if (readyRef.current) drain()
  }, [])

  const flush = useCallback(() => {
    queueRef.current = []
    const sb = sourceBufferRef.current
    const audio = audioElRef.current
    if (sb && !sb.updating) {
      try { sb.abort() } catch {}
      try {
        if (sb.buffered.length > 0) {
          sb.remove(0, sb.buffered.end(sb.buffered.length - 1))
        }
      } catch {}
    }
    // Snap playhead forward to dodge stale buffer
    if (audio && audio.duration && Number.isFinite(audio.duration)) {
      try { audio.currentTime = audio.duration } catch {}
    }
  }, [])

  const unlock = useCallback(async () => {
    const audio = audioElRef.current
    if (!audio) return
    try { await audio.play() } catch {}
  }, [])

  return { push, flush, unlock }
}
