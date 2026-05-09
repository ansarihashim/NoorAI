import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Renders a Mermaid diagram. The `mermaid` package is large (~2.8MB), so we
 * lazy-import it on first mount — the main bundle stays thin until the user
 * actually opens the Visualize tab.
 *
 *   <MermaidRenderer code={visual.mermaid} title={visual.title} onSvg={(svg) => ...} />
 *
 * The host page can fetch the rendered SVG via the `onSvg` callback to wire a
 * download button without re-rendering.
 */
let mermaidPromise = null
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default || m
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        themeVariables: {
          // Match EchoVerse's palette so diagrams feel native
          background: '#0a0d1a',
          primaryColor: '#1c2148',
          primaryBorderColor: '#8b5cf6',
          primaryTextColor: '#e8ecf8',
          lineColor: '#9aa3c2',
          secondaryColor: '#10142a',
          tertiaryColor: '#161a36',
          edgeLabelBackground: '#10142a',
          mainBkg: '#1c2148',
          nodeBorder: '#8b5cf6',
          clusterBkg: 'rgba(139,92,246,0.06)',
          clusterBorder: 'rgba(139,92,246,0.25)',
        },
      })
      return mermaid
    })
  }
  return mermaidPromise
}

export default function MermaidRenderer({ code, title, onSvg, className = '' }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSvg('')
    if (!code) {
      setLoading(false)
      return
    }
    loadMermaid()
      .then(async (mermaid) => {
        try {
          // mermaid.render() resolves with { svg, bindFunctions? }
          const { svg: rendered } = await mermaid.render(idRef.current, code)
          if (!cancelled) {
            setSvg(rendered)
            setLoading(false)
            onSvg?.(rendered)
          }
        } catch (e) {
          if (!cancelled) {
            setError(e?.message || String(e))
            setLoading(false)
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(`Mermaid failed to load: ${e?.message || e}`)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [code, onSvg])

  if (loading) {
    return (
      <div
        role="status"
        className={['relative grid min-h-[360px] place-items-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]', className].join(' ')}
      >
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span className="text-xs uppercase tracking-[0.16em] text-ink-faint">Drawing diagram…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={['rounded-xl border border-accent-rose/30 bg-accent-rose/[0.04] p-5', className].join(' ')}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-accent-rose">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16v.01" />
          </svg>
          Couldn't render this diagram
        </div>
        <p className="mt-2 text-xs text-ink-muted">{error}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-muted">
            Show raw Mermaid source
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-bg-panel/60 p-3 font-mono text-[0.7rem] text-ink-muted">{code}</pre>
        </details>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={[
        'mermaid-host relative w-full overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.015] p-6',
        '[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full',
        className,
      ].join(' ')}
      title={title || ''}
      // The mermaid output is a static SVG produced server-side-style; safe to inject.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
