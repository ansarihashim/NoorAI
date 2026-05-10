/**
 * Marketing background — pure black floor. No grid, no embers, no glow.
 * Kept as a wrapper so existing imports / API stay valid.
 */
export default function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 bg-echo-bg" aria-hidden />
  )
}
