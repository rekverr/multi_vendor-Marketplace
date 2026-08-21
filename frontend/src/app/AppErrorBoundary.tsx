import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application render failed', error, info.componentStack)
  }
  render() {
    if (this.state.failed) return (
      <main className="status-page"><span className="eyebrow">Application error</span>
        <h1>We could not render this view.</h1><p>Reload the page. If the problem continues, try again later.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>Reload application</button>
      </main>
    )
    return this.props.children
  }
}
