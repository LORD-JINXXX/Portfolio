import React from 'react'
import type { RuntimeManifest, SiteRelease, ValidationResult } from '@platform/contracts'
import { RuntimeSitePreview } from '@platform/runtime-renderer'
import { ActionFeedback, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'

type ReleaseRow = SiteRelease & {
  layout_versions?: { version_number?: number; layouts?: { name?: string } }
  content_revisions?: { revision_number?: number }
  settings_revisions?: { revision_number?: number }
}

type ReleaseOptions = {
  layouts: Array<{ id: string; version_number: number; layouts?: { name?: string } }>
  content: Array<{ id: string; revision_number: number }>
  settings: Array<{ id: string; revision_number: number }>
}

type PreviewPayload = {
  manifest: RuntimeManifest
  validation: ValidationResult
  release: ReleaseRow
}

const button: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 7,
  padding: '8px 11px',
  cursor: 'pointer',
}
const primary: React.CSSProperties = {
  ...button,
  background: 'var(--primary)',
  borderColor: 'var(--primary)',
  color: 'var(--primary-text)',
  fontWeight: 700,
}
const select: React.CSSProperties = {
  padding: '8px 9px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-alt)',
  color: 'var(--text)',
}

export function ReleaseManager() {
  const [rows, setRows] = React.useState<ReleaseRow[]>([])
  const [options, setOptions] = React.useState<ReleaseOptions>({ layouts: [], content: [], settings: [] })
  const [layoutId, setLayoutId] = React.useState('')
  const [contentId, setContentId] = React.useState('')
  const [settingsId, setSettingsId] = React.useState('')
  const [preview, setPreview] = React.useState<PreviewPayload | null>(null)
  const actions = useMutationActions()

  const load = React.useCallback(async () => {
    const [releaseResponse, optionResponse] = await Promise.all([
      apiFetch<{ data: ReleaseRow[] }>('/api/admin/releases'),
      apiFetch<{ data: ReleaseOptions }>('/api/admin/releases/options'),
    ])
    const nextOptions = optionResponse.data
    setRows(releaseResponse.data || [])
    setOptions(nextOptions)
    setLayoutId((current) => current || nextOptions.layouts[0]?.id || '')
    setContentId((current) => current || nextOptions.content[0]?.id || '')
    setSettingsId((current) => current || nextOptions.settings[0]?.id || '')
  }, [])

  React.useEffect(() => {
    void load().catch((cause) => {
      void actions.run({
        key: 'initial-load-error',
        pending: 'Loading releases...',
        success: 'Releases loaded.',
        action: () => Promise.reject(cause),
      })
    })
  }, [load, actions.run])

  const createCandidate = () => {
    if (!layoutId || !contentId) return
    void actions.run({
      key: 'create',
      conflictKey: 'release-mutation',
      pending: 'Creating release candidate...',
      success: 'Release candidate created. Validate it before activation.',
      action: () => apiFetch('/api/admin/releases', {
        method: 'POST',
        body: JSON.stringify({
          layout_version_id: layoutId,
          content_revision_id: contentId,
          ...(settingsId ? { settings_revision_id: settingsId } : {}),
        }),
      }),
      onSuccess: load,
    })
  }

  const validate = (release: ReleaseRow) => {
    void actions.run({
      key: `validate-${release.id}`,
      conflictKey: 'release-mutation',
      pending: `Validating release #${release.release_number}...`,
      success: (response: { data: { validation: ValidationResult } }) => response.data.validation.valid
        ? `Release #${release.release_number} is ready.`
        : `Release #${release.release_number} has blocking validation errors.`,
      action: () => apiFetch<{ data: { release: ReleaseRow; validation: ValidationResult } }>(`/api/admin/releases/${release.id}/validate`, { method: 'POST' }),
      onSuccess: load,
    })
  }

  const openPreview = (release: ReleaseRow) => {
    void actions.run({
      key: `preview-${release.id}`,
      pending: `Loading preview for release #${release.release_number}...`,
      success: `Release #${release.release_number} preview loaded.`,
      action: () => apiFetch<{ data: PreviewPayload }>(`/api/admin/releases/${release.id}/preview`, { method: 'POST' }),
      onSuccess: (response) => setPreview(response.data),
    })
  }

  const activate = (release: ReleaseRow) => {
    void actions.run({
      key: `activate-${release.id}`,
      conflictKey: 'release-mutation',
      pending: `Activating release #${release.release_number}...`,
      success: `Release #${release.release_number} activated.`,
      action: () => apiFetch(`/api/admin/releases/${release.id}/activate`, { method: 'POST' }),
      onSuccess: load,
    })
  }

  const rollback = (release: ReleaseRow) => {
    void actions.run({
      key: `rollback-${release.id}`,
      conflictKey: 'release-mutation',
      pending: `Rolling back to release #${release.release_number}...`,
      success: `Rolled back to release #${release.release_number}.`,
      action: () => apiFetch(`/api/admin/releases/${release.id}/rollback`, { method: 'POST' }),
      onSuccess: load,
    })
  }

  const mutationPending = actions.isConflictPending('release-mutation')

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 32 }}>Releases</h1>
        <p style={{ color: 'var(--text-muted)', margin: '5px 0 0' }}>Validate immutable snapshots, activate atomically, and roll back through controlled transitions.</p>
      </div>
    </div>

    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 14, marginBottom: 16 }}>
      <strong>Create Release Candidate</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <select aria-label="Published layout version" style={select} value={layoutId} onChange={(event) => setLayoutId(event.target.value)}>
          <option value="">Select layout</option>
          {options.layouts.map((entry) => <option key={entry.id} value={entry.id}>{entry.layouts?.name || 'Layout'} v{entry.version_number}</option>)}
        </select>
        <select aria-label="Published content revision" style={select} value={contentId} onChange={(event) => setContentId(event.target.value)}>
          <option value="">Select content</option>
          {options.content.map((entry) => <option key={entry.id} value={entry.id}>Content r{entry.revision_number}</option>)}
        </select>
        <select aria-label="Published settings revision" style={select} value={settingsId} onChange={(event) => setSettingsId(event.target.value)}>
          <option value="">Snapshot current settings</option>
          {options.settings.map((entry) => <option key={entry.id} value={entry.id}>Settings r{entry.revision_number}</option>)}
        </select>
        <button style={primary} disabled={mutationPending || !layoutId || !contentId} aria-busy={actions.isPending('create')} onClick={createCandidate}>{actions.isPending('create') ? 'Creating...' : 'Create Candidate'}</button>
      </div>
    </div>

    <div style={{ display: 'grid', gap: 9 }}>
      {rows.map((release) => {
        const completeSnapshot = Boolean(release.content_revision_id && release.settings_revision_id)
        return <div key={release.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Release #{release.release_number}</strong>
          <StatusBadge status={release.status} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: '1 1 240px' }}>
            {release.layout_versions?.layouts?.name || 'Layout'} v{release.layout_versions?.version_number ?? '?'} - Content r{release.content_revisions?.revision_number ?? 'legacy'} - Settings r{release.settings_revisions?.revision_number ?? 'legacy'}
          </span>
          {!completeSnapshot && <span style={{ fontSize: 11, color: 'var(--warning)' }}>Legacy incomplete snapshot</span>}
          <button style={button} disabled={actions.isPending(`preview-${release.id}`)} aria-busy={actions.isPending(`preview-${release.id}`)} onClick={() => openPreview(release)}>{actions.isPending(`preview-${release.id}`) ? 'Loading Preview...' : 'Preview'}</button>
          {release.status === 'draft' && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`validate-${release.id}`)} onClick={() => validate(release)}>{actions.isPending(`validate-${release.id}`) ? 'Validating...' : 'Validate'}</button>}
          {release.status === 'ready' && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`activate-${release.id}`)} onClick={() => activate(release)}>{actions.isPending(`activate-${release.id}`) ? 'Activating...' : 'Activate'}</button>}
          {release.status === 'superseded' && completeSnapshot && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`rollback-${release.id}`)} onClick={() => rollback(release)}>{actions.isPending(`rollback-${release.id}`) ? 'Rolling back...' : 'Rollback'}</button>}
        </div>
      })}
    </div>

    {preview && <ReleasePreview payload={preview} onClose={() => setPreview(null)} />}
    <ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss} />
  </>
}

function StatusBadge({ status }: { status: SiteRelease['status'] }) {
  const color = status === 'active' ? 'var(--success)' : status === 'draft' ? 'var(--warning)' : status === 'ready' ? 'var(--primary)' : 'var(--text-muted)'
  return <span style={{ padding: '4px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{status.toUpperCase()}</span>
}

function ReleasePreview({ payload, onClose }: { payload: PreviewPayload; onClose: () => void }) {
  const [routeIndex, setRouteIndex] = React.useState(0)
  const [mode, setMode] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const current = payload.manifest.routes[routeIndex] || payload.manifest.routes[0]
  return <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'grid', placeItems: 'center', padding: 24 }}>
    <div onMouseDown={(event) => event.stopPropagation()} style={{ width: 'min(1500px,96vw)', maxHeight: '94vh', overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, padding: '13px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between' }}>
        <strong>Release #{payload.release.release_number} Preview - {payload.validation.valid ? 'valid snapshot' : `${payload.validation.errors.length} blocking errors`}</strong>
        <button style={button} onClick={onClose}>Close</button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
          {payload.manifest.routes.map((route, index) => <button key={route.pageId} style={{ ...button, background: index === routeIndex ? 'var(--primary)' : 'var(--surface)', color: index === routeIndex ? 'var(--primary-text)' : 'var(--text)' }} onClick={() => setRouteIndex(index)}>{route.name}</button>)}
          <div style={{ flex: 1 }} />
          {(['desktop', 'tablet', 'mobile'] as const).map((value) => <button key={value} style={{ ...button, background: value === mode ? 'var(--primary)' : 'var(--surface)' }} onClick={() => setMode(value)}>{value}</button>)}
        </div>
        {current && <div style={{ height: '70vh', overflow: 'auto', background: 'var(--workspace)' }}>
          <div style={{ width: mode === 'desktop' ? '100%' : mode === 'tablet' ? 768 : 375, maxWidth: '100%', margin: '0 auto' }}>
            <RuntimeSitePreview manifest={payload.manifest} route={current} mode={mode} />
          </div>
        </div>}
      </div>
    </div>
  </div>
}
