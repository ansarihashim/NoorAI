import { useEffect } from 'react'

/**
 * Wires `navigator.mediaSession` to a useAudio() controller so OS lockscreen,
 * Bluetooth headset, and macOS "Now Playing" widgets can drive the player.
 *
 * Action handlers are best-effort — older browsers ignore handlers they don't
 * support (we wrap each set in try/catch).
 */
export function useMediaSession({
  enabled,
  title,
  artist,
  album,
  artwork,
  onPlay,
  onPause,
  onSeek,
  onPrev,
  onNext,
  onSkipBack,
  onSkipForward,
  state, // { playing, paused, globalTime, globalDuration }
}) {
  // Update metadata
  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: title || '',
        artist: artist || 'EchoVerse',
        album: album || 'EchoVerse',
        artwork: artwork || [],
      })
    } catch {
      // older browsers — ignore
    }
  }, [enabled, title, artist, album, artwork])

  // Bind action handlers
  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return
    const set = (name, fn) => {
      try {
        navigator.mediaSession.setActionHandler(name, fn)
      } catch {
        /* not supported in this browser */
      }
    }

    set('play', () => onPlay?.())
    set('pause', () => onPause?.())
    set('previoustrack', () => onPrev?.())
    set('nexttrack', () => onNext?.())
    set('seekbackward', (details) => {
      const delta = (details && details.seekOffset) || 15
      onSkipBack?.(delta)
    })
    set('seekforward', (details) => {
      const delta = (details && details.seekOffset) || 15
      onSkipForward?.(delta)
    })
    set('seekto', (details) => {
      if (details && typeof details.seekTime === 'number') {
        onSeek?.(details.seekTime)
      }
    })
    set('stop', () => onPause?.())

    return () => {
      ;['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto', 'stop'].forEach((n) => {
        try { navigator.mediaSession.setActionHandler(n, null) } catch {}
      })
    }
  }, [enabled, onPlay, onPause, onSeek, onPrev, onNext, onSkipBack, onSkipForward])

  // Keep playback state + position fresh so the OS UI reflects reality.
  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = state?.playing ? 'playing' : 'paused'
    } catch {}
    try {
      if (state && state.globalDuration > 0) {
        navigator.mediaSession.setPositionState({
          duration: state.globalDuration,
          position: Math.min(state.globalTime, state.globalDuration),
          playbackRate: state.rate || 1,
        })
      }
    } catch {}
  }, [enabled, state?.playing, state?.globalTime, state?.globalDuration, state?.rate])
}
