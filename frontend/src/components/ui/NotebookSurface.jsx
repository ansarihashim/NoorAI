/**
 * Reusable notebook-surface primitives. Compose these instead of hand-rolling
 * paper-rule chrome on every screen.
 *
 *   <NotebookPage>          a full notebook page (ruled, optional margin gutter)
 *   <NotebookCard>          a smaller annotated card (ruled, no gutter)
 *   <NotebookMarginNote>    paper-yellow tinted side note (AI annotations)
 *   <NotebookEyebrow>       mono small-caps label that opens a section
 *   <NotebookDisplay>       serif display heading
 *   <NotebookChip>          TOC-style mono chip (citations, concepts)
 *
 * They are intentionally thin — most of the styling lives in `index.css`
 * under the `.nb-*` classes so non-React surfaces (e.g. login/signup that
 * don't import this file) can opt in via className alone.
 */

export function NotebookPage({ as: As = 'div', margin = false, ruleStrong = false, className = '', children, ...rest }) {
  const cls = [
    'nb-page',
    margin ? 'nb-page--margin' : '',
    ruleStrong ? 'nb-page--ruled-strong' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <As className={cls} {...rest}>
      {children}
    </As>
  )
}

export function NotebookCard({ as: As = 'div', className = '', children, ...rest }) {
  return (
    <As className={['nb-card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </As>
  )
}

export function NotebookMarginNote({ as: As = 'aside', className = '', children, ...rest }) {
  return (
    <As className={['nb-margin', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </As>
  )
}

export function NotebookEyebrow({ accent = false, className = '', children, ...rest }) {
  return (
    <span
      className={['nb-eyebrow', accent ? 'nb-eyebrow--accent' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}

/** Serif display heading. Pass an explicit size class via `className`. */
export function NotebookDisplay({ as: As = 'h1', className = '', children, ...rest }) {
  return (
    <As className={['nb-display', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </As>
  )
}

export function NotebookChip({ children, title, className = '' }) {
  return (
    <span title={title} className={['nb-chip', className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
