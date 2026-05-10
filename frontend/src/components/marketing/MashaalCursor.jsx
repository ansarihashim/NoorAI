import { useEffect, useRef } from 'react'

/**
 * Mashaal cursor — a subtle warm flame aura that follows the pointer on the
 * landing page only. Built on a single canvas with a tiny particle system:
 * each frame we drop one small ember at the cursor location, fade existing
 * embers, and redraw with `globalCompositeOperation = 'lighter'` so multiple
 * embers stack into a soft yellow glow without ever burning out into white.
 *
 * Performance notes:
 *  - One canvas, sized to viewport (DPR-aware).
 *  - Capped to ~24 live embers; older ones drop off.
 *  - rAF-driven; pointer events only update target coords, never trigger work.
 *  - Disabled on coarse pointers (touch) and when `prefers-reduced-motion` is set.
 */
export default function MashaalCursor() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches
    if (reduce || coarse) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const cursor = { x: -1000, y: -1000, last: 0 }
    const embers = []
    const MAX_EMBERS = 24

    function onMove(e) {
      cursor.x = e.clientX
      cursor.y = e.clientY
      const t = performance.now()
      // Throttle ember spawn to ~60/sec — enough for a continuous trail,
      // not enough to thrash the GPU.
      if (t - cursor.last > 14) {
        cursor.last = t
        embers.push({
          x: cursor.x + (Math.random() - 0.5) * 4,
          y: cursor.y + (Math.random() - 0.5) * 4,
          // Tiny upward drift — like heat rising from a flame.
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.3 - Math.random() * 0.5,
          r: 14 + Math.random() * 10,
          life: 1,
        })
        if (embers.length > MAX_EMBERS) embers.shift()
      }
    }
    function onLeave() {
      cursor.x = -1000
      cursor.y = -1000
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('resize', resize)

    let rafId = 0
    function frame() {
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.x += e.vx
        e.y += e.vy
        e.life -= 0.045
        if (e.life <= 0) {
          embers.splice(i, 1)
          continue
        }
        const alpha = Math.max(0, e.life) * 0.32
        // Two stacked radial gradients — one warm core, one wider halo.
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r)
        grad.addColorStop(0, `rgba(255, 230, 90, ${alpha})`)
        grad.addColorStop(0.45, `rgba(255, 200, 30, ${alpha * 0.55})`)
        grad.addColorStop(1, 'rgba(255, 200, 30, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Bright pinpoint core at the cursor itself — the flame's heart.
      if (cursor.x > -500) {
        const core = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 9)
        core.addColorStop(0, 'rgba(255, 240, 140, 0.55)')
        core.addColorStop(1, 'rgba(255, 214, 10, 0)')
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(cursor.x, cursor.y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
