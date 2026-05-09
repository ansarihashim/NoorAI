import { useEffect } from 'react'

/**
 * Global keyboard shortcuts for the audio player. Only fires when the user
 * isn't typing into a form field.
 *
 *   Space      — toggle play/pause
 *   ←  / j     — back 15s
 *   → / l      — forward 15s
 *   shift+←   — previous chapter
 *   shift+→   — next chapter
 *   m          — mute/unmute
 *   k          — toggle play/pause (YouTube convention)
 *   ↑ / ↓     — volume up / down 5%
 */
export function useKeyboardControls({ enabled, audio }) {
  useEffect(() => {
    if (!enabled || !audio) return
    const handler = (e) => {
      const target = e.target
      // Ignore inputs and textareas / contentEditable.
      if (target && target.matches && target.matches('input, textarea, [contenteditable="true"]')) return
      // Ignore when modifier keys we don't handle are pressed.
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          audio.toggle()
          break
        case 'j':
        case 'J':
          e.preventDefault()
          audio.skip(-15)
          break
        case 'l':
        case 'L':
          e.preventDefault()
          audio.skip(15)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) audio.prevChapter()
          else audio.skip(-15)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) audio.nextChapter()
          else audio.skip(15)
          break
        case 'ArrowUp':
          e.preventDefault()
          audio.setVolume(Math.min(1, (audio.state.volume || 0) + 0.05))
          if (audio.state.muted) audio.setMuted(false)
          break
        case 'ArrowDown':
          e.preventDefault()
          audio.setVolume(Math.max(0, (audio.state.volume || 0) - 0.05))
          break
        case 'm':
        case 'M':
          e.preventDefault()
          audio.setMuted(!audio.state.muted)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, audio])
}
