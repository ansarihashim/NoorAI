/**
 * Subtle research-notebook backdrop for the landing page.
 *  - faint horizontal ruled lines (paper feel, low opacity)
 *  - a wider drafting grid masked toward the top (research-lab feel)
 *  - one yellow "margin" line at the left, also masked at top/bottom
 *
 * Pure decoration, pointer-events: none, sits behind everything (-z-10).
 * Each layer's opacity is intentionally tiny — the page should _feel_ like
 * a luxury notebook, not look like graph paper.
 */
export default function NotebookBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* solid black floor */}
      <div className="absolute inset-0 bg-echo-bg" />
      {/* drafting grid (very faint, masked vignette) */}
      <div className="notebook-grid" />
      {/* horizontal ruled lines */}
      <div className="notebook-rule" />
      {/* yellow margin line */}
      <div className="notebook-margin" />
    </div>
  )
}
