import React from 'react'

export type DataStateKind = 'loading' | 'empty' | 'error'

export interface DataStatePanelProps {
  kind: DataStateKind
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
  skeletonRows?: number
}

function Skeleton({ rows }: { rows: number }) {
  return <div aria-hidden="true" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
    {Array.from({ length: Math.max(1, rows) }, (_, index) => <div key={index} style={{ height: index === 0 ? 11 : 9, width: index === rows - 1 ? '62%' : index % 2 ? '82%' : '94%', borderRadius: 999, background: 'var(--surface-alt)', opacity: .8 }} />)}
  </div>
}

export function DataStatePanel({ kind, title, message, actionLabel = 'Retry', onAction, compact = false, skeletonRows = 3 }: DataStatePanelProps) {
  const isError = kind === 'error'
  const isLoading = kind === 'loading'
  return <div
    role={isError ? 'alert' : 'status'}
    aria-live={isError ? 'assertive' : 'polite'}
    aria-busy={isLoading || undefined}
    data-data-state={kind}
    style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      background: 'var(--surface)',
      color: 'var(--text)',
      padding: compact ? 14 : 20,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
        <strong style={{ display: 'block', color: isError ? 'var(--danger)' : 'var(--text)', fontSize: compact ? 12 : 14 }}>{title}</strong>
        {message && <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>{message}</div>}
      </div>
      {onAction && !isLoading && <button type="button" onClick={onAction} style={{ border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', fontSize: 12 }}>{actionLabel}</button>}
    </div>
    {isLoading && <Skeleton rows={skeletonRows} />}
  </div>
}

export function DataRefreshStatus({ active, label = 'Updating results…' }: { active: boolean; label?: string }) {
  if (!active) return null
  return <span role="status" aria-live="polite" data-data-refresh="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12 }}>
    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--primary)', opacity: .8 }} />
    {label}
  </span>
}
