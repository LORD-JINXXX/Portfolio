import React from 'react'

interface StudioErrorBoundaryProps {
  children: React.ReactNode
  onBackToLayouts: () => void
}

interface StudioErrorBoundaryState {
  error: Error | null
}

export class StudioErrorBoundary extends React.Component<StudioErrorBoundaryProps, StudioErrorBoundaryState> {
  state: StudioErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): StudioErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Studio editor render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div role="alert" style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui' }}>
      <div style={{ width: 'min(520px,100%)', padding: 24, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Studio could not render this layout.</h1>
        <p style={{ margin: '0 0 18px', color: 'var(--text-muted)' }}>The document was not discarded. Retry the editor or return to the Layout Library.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => this.setState({ error: null })} style={button}>Retry</button>
          <button type="button" onClick={this.props.onBackToLayouts} style={button}>Back to Layouts</button>
        </div>
      </div>
    </div>
  }
}

const button: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--surface-alt)',
  color: 'var(--text)',
  cursor: 'pointer',
}
