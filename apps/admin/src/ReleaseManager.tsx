import React from 'react'
import type { Media, RuntimeManifest, SiteRelease, ValidationResult } from '@platform/contracts'
import { RuntimeSitePreview } from '@platform/runtime-renderer'
import { ActionFeedback, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'
import { AdminModal } from './AdminModal'

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

type CandidateResponse = {
  data: ReleaseRow
  releaseCreated: true
  mediaCertification: {
    status: 'certified' | 'incomplete' | 'failed'
    certified: boolean
    complete: boolean
    mediaIds: string[]
    issues: Array<{ source: string; value: unknown; reason: string }>
    error?: string
  }
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
  const [mediaRelease, setMediaRelease] = React.useState<ReleaseRow | null>(null)
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
      success: (response: CandidateResponse) => response.mediaCertification.certified
        ? `Release #${response.data.release_number} created with certified media. Validate it before activation.`
        : `Release #${response.data.release_number} was created as Draft, but media certification ${response.mediaCertification.status === 'incomplete' ? 'is incomplete' : 'could not complete'}.`,
      action: () => apiFetch<CandidateResponse>('/api/admin/releases', {
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
          <span style={{ fontSize: 11, color: release.media_snapshot_version === 1 ? 'var(--success)' : 'var(--warning)' }}>{release.media_snapshot_version === 1 ? 'Media certified' : 'Media uncertified'}</span>
          <button style={button} onClick={() => setMediaRelease(release)}>Media Audit</button>
          <button style={button} disabled={actions.isPending(`preview-${release.id}`)} aria-busy={actions.isPending(`preview-${release.id}`)} onClick={() => openPreview(release)}>{actions.isPending(`preview-${release.id}`) ? 'Loading Preview...' : 'Preview'}</button>
          {release.status === 'draft' && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`validate-${release.id}`)} onClick={() => validate(release)}>{actions.isPending(`validate-${release.id}`) ? 'Validating...' : 'Validate'}</button>}
          {release.status === 'ready' && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`activate-${release.id}`)} onClick={() => activate(release)}>{actions.isPending(`activate-${release.id}`) ? 'Activating...' : 'Activate'}</button>}
          {release.status === 'superseded' && completeSnapshot && <button style={primary} disabled={mutationPending} aria-busy={actions.isPending(`rollback-${release.id}`)} onClick={() => rollback(release)}>{actions.isPending(`rollback-${release.id}`) ? 'Rolling back...' : 'Rollback'}</button>}
        </div>
      })}
    </div>

    {preview && <ReleasePreview payload={preview} onClose={() => setPreview(null)} />}
    {mediaRelease && <LegacyMediaPanel release={mediaRelease} onClose={() => setMediaRelease(null)} onChanged={load} />}
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
  return <AdminModal wide title={`Release #${payload.release.release_number} Preview - ${payload.validation.valid ? 'valid snapshot' : `${payload.validation.errors.length} blocking errors`}`} onClose={onClose}>
    <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
      {payload.manifest.routes.map((route, index) => <button type="button" key={route.pageId} style={{ ...button, background: index === routeIndex ? 'var(--primary)' : 'var(--surface)', color: index === routeIndex ? 'var(--primary-text)' : 'var(--text)' }} onClick={() => setRouteIndex(index)}>{route.name}</button>)}
      <div style={{ flex: 1 }} />
      {(['desktop', 'tablet', 'mobile'] as const).map((value) => <button type="button" key={value} style={{ ...button, background: value === mode ? 'var(--primary)' : 'var(--surface)' }} onClick={() => setMode(value)}>{value}</button>)}
    </div>
    {current && <div data-runtime-scroll-root="true" style={{ height: '70vh', overflow: 'auto', background: 'var(--workspace)' }}>
      <div style={{ width: mode === 'desktop' ? '100%' : mode === 'tablet' ? 768 : 375, maxWidth: '100%', margin: '0 auto' }}>
        <RuntimeSitePreview key={`${current.pageId}:${mode}`} manifest={payload.manifest} route={current} mode={mode} />
      </div>
    </div>}
  </AdminModal>
}


type LegacyMediaIssue = { source: string; value: unknown; reason: string }
type LegacyMediaCollection = {
  complete: boolean
  mediaIds: string[]
  unresolved: LegacyMediaIssue[]
  external?: Array<{ source: string; value: unknown }>
}
type LegacyMediaAudit = {
  release: ReleaseRow
  certified: boolean
  references?: Array<{ media_id: string; storage_path: string; mime_type?: string | null; size?: number | null }>
  collection?: LegacyMediaCollection
  storageIssues?: Array<{ severity: string; code: string; message: string }>
}

function LegacyMediaPanel({ release, onClose, onChanged }: { release: ReleaseRow; onClose: () => void; onChanged: () => Promise<void> }) {
  const [audit, setAudit] = React.useState<LegacyMediaAudit | null>(null)
  const [media, setMedia] = React.useState<Media[]>([])
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setError('')
    const [auditResponse, mediaResponse] = await Promise.all([
      apiFetch<{ data: LegacyMediaAudit }>(`/api/admin/releases/${release.id}/media-certification`),
      apiFetch<{ data: Media[] }>('/api/admin/media'),
    ])
    setAudit(auditResponse.data)
    setMedia(mediaResponse.data || [])
  }, [release.id])

  React.useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Media audit could not be loaded.')) }, [load])

  const unresolved = React.useMemo(() => {
    const seen = new Map<string, LegacyMediaIssue>()
    for (const issue of audit?.collection?.unresolved || []) {
      const value = typeof issue.value === 'string' ? issue.value.trim() : String(issue.value ?? '').trim()
      if (value && !seen.has(value)) seen.set(value, { ...issue, value })
    }
    return [...seen.values()]
  }, [audit])

  const mapValue = async (legacyValue: string) => {
    const mediaId = mapping[legacyValue]
    if (!mediaId) return
    setBusy(`map:${legacyValue}`)
    setError('')
    try {
      await apiFetch(`/api/admin/releases/${release.id}/media-resolutions`, { method: 'POST', body: JSON.stringify({ legacy_value: legacyValue, media_id: mediaId }) })
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Legacy media mapping failed.') }
    finally { setBusy('') }
  }

  const certify = async () => {
    setBusy('certify')
    setError('')
    try {
      await apiFetch(`/api/admin/releases/${release.id}/media-certification`, { method: 'POST' })
      await Promise.all([load(), onChanged()])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Release media certification failed.') }
    finally { setBusy('') }
  }

  return <AdminModal title={`Release #${release.release_number} Media Audit`} width="min(920px,96vw)" onClose={onClose}>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>Historical certification records exact canonical media references without changing release status, snapshots, or activation.</p>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {!audit && !error && <p style={{ color: 'var(--text-muted)' }}>Auditing frozen release media...</p>}
      {audit?.certified && <>
        <p style={{ color: 'var(--success)', fontWeight: 700 }}>Certified — authoritative media snapshot version 1.</p>
        <div style={{ display: 'grid', gap: 7 }}>
          {(audit.references || []).length === 0 && <div style={{ color: 'var(--text-muted)' }}>Certified zero-media release.</div>}
          {(audit.references || []).map((ref) => <div key={ref.media_id} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}><code>{ref.media_id}</code><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ref.storage_path}</div></div>)}
        </div>
      </>}
      {audit && !audit.certified && <>
        <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <strong>{audit.collection?.complete ? 'Collection complete' : `${unresolved.length} unresolved managed media value${unresolved.length === 1 ? '' : 's'}`}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Resolved canonical IDs: {audit.collection?.mediaIds?.length || 0}. External unmanaged URLs do not require certification references.</div>
        </div>
        {(audit.storageIssues || []).length > 0 && <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--danger)', borderRadius: 8 }}><strong style={{ color: 'var(--danger)' }}>Storage verification blocked certification</strong>{(audit.storageIssues || []).map((issue, index) => <div key={`${issue.code}-${index}`} style={{ marginTop: 5, fontSize: 12, color: 'var(--text-muted)' }}>{issue.message}</div>)}</div>}
        {unresolved.length > 0 && <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {unresolved.map((issue) => {
            const legacyValue = String(issue.value)
            return <div key={legacyValue} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--warning)', overflowWrap: 'anywhere' }}>{legacyValue}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 8px' }}>{issue.source}: {issue.reason}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select aria-label={`Canonical media for ${legacyValue}`} style={{ ...select, flex: '1 1 360px' }} value={mapping[legacyValue] || ''} onChange={(event) => setMapping((current) => ({ ...current, [legacyValue]: event.target.value }))}>
                  <option value="">Choose canonical Media Library item...</option>
                  {media.map((item) => <option key={item.id} value={item.id}>{item.filename} — {item.mime_type} — {item.storage_path}</option>)}
                </select>
                <button style={button} disabled={!mapping[legacyValue] || Boolean(busy)} aria-busy={busy === `map:${legacyValue}`} onClick={() => void mapValue(legacyValue)}>{busy === `map:${legacyValue}` ? 'Mapping...' : 'Map Exact Value'}</button>
              </div>
            </div>
          })}
        </div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={primary} disabled={!audit.collection?.complete || unresolved.length > 0 || (audit.storageIssues || []).some((issue) => issue.severity === 'error') || Boolean(busy)} aria-busy={busy === 'certify'} onClick={() => void certify()}>{busy === 'certify' ? 'Certifying...' : 'Certify Frozen Media'}</button>
        </div>
        {!audit.collection?.complete && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Certification remains blocked until every managed legacy value is deterministically resolved. No release status transition occurs here.</p>}
      </>}
  </AdminModal>
}
