import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin progress indicator pinned to the top of the viewport.
 * Width tracks the document's scroll progress (0 → 1) and is smoothed via
 * a spring so it doesn't twitch on small wheel deltas.
 *
 * Implementation note: we animate `scaleX` with `transform-origin: left`
 * rather than `width: %`. Transforms don't trigger layout; widths do.
 * That keeps the bar at 60fps even when other elements are mid-reveal.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    mass: 0.4,
    restDelta: 0.001,
  })
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left bg-echo-accent"
      aria-hidden="true"
    />
  )
}
