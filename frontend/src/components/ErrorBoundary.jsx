import { Component } from 'react'

/**
 * Top-level error catcher. If anything in the React tree throws, we display
 * the error inline rather than collapsing to a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // eslint-disable-next-line no-console
    console.error('[NoorAI] React tree crashed:', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-page p-8 text-ink">
        <div className="mx-auto max-w-3xl">
          <div className="font-serif text-[1.5rem] font-medium text-accent">Something broke.</div>
          <p className="mt-2 text-[0.95rem] text-ink-muted">
            The React tree threw an error. Open DevTools → Console for the full stack.
          </p>
          <pre className="mt-4 overflow-auto rounded-md border border-rule bg-elevated p-4 font-mono text-[0.78rem] text-ink-muted">
{String(this.state.error?.stack || this.state.error)}
          </pre>
          {this.state.info?.componentStack && (
            <details className="mt-3 text-[0.78rem] text-ink-dim">
              <summary className="cursor-pointer text-ink-muted">component stack</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono">
{this.state.info.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center rounded-md border border-rule bg-elevated px-3 py-1.5 text-[0.8125rem] text-ink hover:bg-float"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
