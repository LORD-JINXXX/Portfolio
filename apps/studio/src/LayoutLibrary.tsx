import React from 'react'
import { ActionFeedback, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'
import { isOutsideMenu } from './layout-library-state'

export interface LayoutLibraryVersion {
  id: string
  version_number: number
  status: string
  pageCount: number
  validationCount: number
  releaseReferenced: boolean
  workspaceReferenced: boolean
  canDiscard: boolean
  discardBlockReason: string | null
}

export interface LayoutLibraryLayout {
  id: string
  name: string
  status: string
  versions: LayoutLibraryVersion[]
  lifecycle: {
    canDeletePermanently: boolean
    deleteBlockReason: string | null
    hasPublishedHistory: boolean
    hasReleaseHistory: boolean
  }
}

interface LayoutLibraryProps {
  layouts: LayoutLibraryLayout[]
  error: string
  onCreate: (template: 'blank' | 'cosmic') => Promise<void>
  onOpen: (layoutId: string) => void
  onDuplicate: (layoutId: string) => Promise<void>
  onRefresh: () => Promise<void>
}

type Confirmation =
  | { kind: 'delete'; layout: LayoutLibraryLayout }
  | { kind: 'discard'; layout: LayoutLibraryLayout; version: LayoutLibraryVersion }
  | null

export function LayoutLibrary({ layouts, error, onCreate, onOpen, onDuplicate, onRefresh }: LayoutLibraryProps) {
  const [menuId, setMenuId] = React.useState<string | null>(null)
  const [renameLayout, setRenameLayout] = React.useState<LayoutLibraryLayout | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [confirmation, setConfirmation] = React.useState<Confirmation>(null)
  const menuRootRef = React.useRef<HTMLDivElement | null>(null)
  const actions = useMutationActions()

  React.useEffect(() => {
    if (!menuId) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (isOutsideMenu(menuRootRef.current, event.target)) setMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuId(null) }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuId])

  React.useEffect(() => {
    if (!renameLayout && !confirmation) return
    const closeDialogOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setRenameLayout(null); setConfirmation(null) }
    }
    document.addEventListener('keydown', closeDialogOnEscape)
    return () => document.removeEventListener('keydown', closeDialogOnEscape)
  }, [confirmation, renameLayout])

  const run = (options: Parameters<typeof actions.run>[0]) => {
    setMenuId(null)
    void actions.run({ ...options, onSuccess: async (value) => { await options.onSuccess?.(value); await onRefresh() } })
  }

  const submitRename = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!renameLayout || !renameValue.trim()) return
    const target = renameLayout
    setRenameLayout(null)
    run({
      key: `rename-${target.id}`,
      conflictKey: `layout-${target.id}`,
      pending: `Saving "${target.name}"...`,
      success: `Renamed layout to "${renameValue.trim()}".`,
      action: () => apiFetch(`/api/studio/layouts/${target.id}/rename`, { method: 'PATCH', body: JSON.stringify({ name: renameValue.trim() }) }),
      error: 'Layout could not be renamed. Check the name and try again.',
    })
  }

  const archive = (layout: LayoutLibraryLayout) => run({
    key: `archive-${layout.id}`,
    conflictKey: `layout-${layout.id}`,
    pending: `Archiving "${layout.name}"...`,
    success: `Archived "${layout.name}". Published and release history was preserved.`,
    action: () => apiFetch(`/api/studio/layouts/${layout.id}/archive`, { method: 'PATCH' }),
    error: 'Layout could not be archived. Try again.',
  })

  const confirmDestructiveAction = async () => {
    if (!confirmation) return
    const target = confirmation
    setConfirmation(null)
    if (target.kind === 'delete') {
      run({ key: `delete-${target.layout.id}`, conflictKey: `layout-${target.layout.id}`, pending: `Deleting "${target.layout.name}"...`, success: `Deleted "${target.layout.name}" permanently.`, action: () => apiFetch(`/api/studio/layouts/${target.layout.id}`, { method: 'DELETE' }), error: 'Layout could not be deleted. It may no longer be eligible for permanent deletion.' })
      return
    }
    run({ key: `discard-${target.version.id}`, conflictKey: `layout-${target.layout.id}`, pending: `Discarding draft v${target.version.version_number} from "${target.layout.name}"...`, success: `Discarded draft v${target.version.version_number} from "${target.layout.name}".`, action: () => apiFetch(`/api/studio/layouts/${target.layout.id}/versions/${target.version.id}`, { method: 'DELETE' }), error: 'Draft could not be discarded. It may no longer be eligible for deletion.' })
  }

  const create = (template: 'blank' | 'cosmic') => run({ key: `create-${template}`, conflictKey: 'layout-creation', pending: template === 'blank' ? 'Creating blank layout...' : 'Creating Cosmic Portfolio...', success: template === 'blank' ? 'Blank layout created successfully.' : 'Cosmic Portfolio created successfully.', action: () => onCreate(template), error: 'Layout could not be created. Try again.' })
  const duplicate = (layout: LayoutLibraryLayout) => run({ key: `duplicate-${layout.id}`, conflictKey: `layout-${layout.id}`, pending: `Duplicating "${layout.name}"...`, success: `Duplicated "${layout.name}" successfully.`, action: () => onDuplicate(layout.id), error: 'Layout could not be duplicated. A readable source version is required.' })
  const creating = actions.isConflictPending('layout-creation')

  return <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui', padding: 40 }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>UI/UX Studio</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Design complete website layouts with sample content. Published versions become available in Admin.</p>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      <ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss} />
      <div style={{ display: 'flex', gap: 12, margin: '28px 0' }}>
        <button disabled={creating} aria-busy={actions.isPending('create-cosmic')} onClick={() => create('cosmic')} style={primary}>{actions.isPending('create-cosmic') ? 'Creating...' : '+ Cosmic Portfolio starter'}</button>
        <button disabled={creating} aria-busy={actions.isPending('create-blank')} onClick={() => create('blank')} style={secondary}>{actions.isPending('create-blank') ? 'Creating...' : '+ Blank layout'}</button>
      </div>
      <h2>Layouts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {layouts.map((layout) => {
          const draftVersions = layout.versions.filter((version) => version.status === 'draft')
          const invalidDrafts = draftVersions.filter((version) => version.pageCount === 0)
          return <article key={layout.id} data-layout-card={layout.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minHeight: 112 }}>
            <button type="button" onClick={() => onOpen(layout.id)} style={{ ...cardOpen, paddingRight: 52 }}>
              <strong style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{layout.name}</strong>
              <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 6 }}>{layout.versions.length} versions - {layout.versions[0]?.status || 'new'}</span>
              {invalidDrafts.length > 0 && <span style={{ display: 'block', color: 'var(--warning)', marginTop: 6, fontSize: 12 }}>{invalidDrafts.length} empty legacy draft{invalidDrafts.length === 1 ? '' : 's'}</span>}
            </button>
            <div ref={menuId === layout.id ? menuRootRef : undefined} style={menuAnchor}>
              <button type="button" aria-label={`Actions for ${layout.name}`} aria-haspopup="menu" aria-expanded={menuId === layout.id} aria-controls={menuId === layout.id ? `layout-actions-${layout.id}` : undefined} disabled={actions.isConflictPending(`layout-${layout.id}`)} onClick={() => setMenuId((current) => current === layout.id ? null : layout.id)} style={kebab}>&#8942;</button>
              {menuId === layout.id && <div id={`layout-actions-${layout.id}`} role="menu" aria-label={`${layout.name} lifecycle actions`} style={menu}>
                <MenuAction label="Open" onClick={() => { setMenuId(null); onOpen(layout.id) }} />
                <MenuAction label="Rename" onClick={() => { setMenuId(null); setRenameValue(layout.name); setRenameLayout(layout) }} />
                <MenuAction label={actions.isPending(`duplicate-${layout.id}`) ? 'Duplicating...' : 'Duplicate'} disabled={!layout.versions.some((version) => version.pageCount > 0)} title="A readable version is required to duplicate this layout." onClick={() => duplicate(layout)} />
                <MenuAction label={actions.isPending(`archive-${layout.id}`) ? 'Archiving...' : 'Archive'} onClick={() => archive(layout)} />
                {draftVersions.map((version) => <MenuAction key={version.id} label={`Discard draft v${version.version_number}${version.pageCount === 0 ? ' (empty)' : ''}`} disabled={!version.canDiscard} title={version.discardBlockReason || undefined} onClick={() => { setMenuId(null); setConfirmation({ kind: 'discard', layout, version }) }} />)}
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                <MenuAction danger label="Delete permanently" disabled={!layout.lifecycle.canDeletePermanently} title={layout.lifecycle.deleteBlockReason || undefined} onClick={() => { setMenuId(null); setConfirmation({ kind: 'delete', layout }) }} />
                {!layout.lifecycle.canDeletePermanently && <small style={{ display: 'block', padding: '5px 9px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{layout.lifecycle.deleteBlockReason}</small>}
              </div>}
            </div>
          </article>
        })}
      </div>
    </div>

    {renameLayout && <Modal title={`Rename "${renameLayout.name}"`} onCancel={() => setRenameLayout(null)}>
      <form onSubmit={(event) => void submitRename(event)} aria-busy={actions.isPending(`rename-${renameLayout.id}`)}>
        <input autoFocus aria-label="Layout name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} style={input} />
        <ModalActions onCancel={() => setRenameLayout(null)} confirmLabel={actions.isPending(`rename-${renameLayout.id}`) ? 'Saving...' : 'Rename'} disabled={!renameValue.trim() || actions.isConflictPending(`layout-${renameLayout.id}`)} />
      </form>
    </Modal>}

    {confirmation?.kind === 'delete' && <Modal title={`Delete "${confirmation.layout.name}" permanently?`} onCancel={() => setConfirmation(null)}>
      <p style={{ color: 'var(--text-muted)' }}>This action cannot be undone.</p>
      <ModalActions danger disabled={actions.isConflictPending(`layout-${confirmation.layout.id}`)} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmDestructiveAction()} confirmLabel={actions.isPending(`delete-${confirmation.layout.id}`) ? 'Deleting...' : 'Delete permanently'} />
    </Modal>}

    {confirmation?.kind === 'discard' && <Modal title={`Discard draft v${confirmation.version.version_number}?`} onCancel={() => setConfirmation(null)}>
      <p style={{ color: 'var(--text-muted)' }}>Only this draft and its draft validation data will be removed. Published and release history remains unchanged.</p>
      <ModalActions danger disabled={actions.isConflictPending(`layout-${confirmation.layout.id}`)} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmDestructiveAction()} confirmLabel={actions.isPending(`discard-${confirmation.version.id}`) ? 'Discarding...' : 'Discard draft'} />
    </Modal>}
  </div>
}

function MenuAction({ label, onClick, disabled, title, danger = false }: { label: string; onClick: () => void; disabled?: boolean; title?: string; danger?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} title={title} onClick={onClick} style={{ ...menuAction, color: danger ? 'var(--danger)' : 'var(--text)', opacity: disabled ? .45 : 1 }}>{label}</button>
}

function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  return <div role="presentation" onMouseDown={onCancel} style={modalBackdrop}>
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()} style={modalCard}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  </div>
}

function ModalActions({ onCancel, onConfirm, confirmLabel, disabled, danger = false }: { onCancel: () => void; onConfirm?: () => void; confirmLabel: string; disabled?: boolean; danger?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
    <button type="button" onClick={onCancel} style={secondary}>Cancel</button>
    <button type={onConfirm ? 'button' : 'submit'} disabled={disabled} onClick={onConfirm} style={{ ...primary, background: danger ? 'var(--danger)' : 'var(--primary)' }}>{confirmLabel}</button>
  </div>
}

const primary: React.CSSProperties = { padding: '11px 16px', border: 0, borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-text)', fontWeight: 700, cursor: 'pointer' }
const secondary: React.CSSProperties = { padding: '11px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const cardOpen: React.CSSProperties = { width: '100%', minHeight: 110, padding: 18, border: 0, borderRadius: 10, background: 'transparent', textAlign: 'left', cursor: 'pointer' }
const menuAnchor: React.CSSProperties = { position: 'absolute', top: 10, right: 10, zIndex: 20 }
const kebab: React.CSSProperties = { width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 22, lineHeight: 1, cursor: 'pointer' }
const menu: React.CSSProperties = { position: 'absolute', top: 38, right: 0, width: 230, padding: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 14px 36px var(--shadow)' }
const menuAction: React.CSSProperties = { width: '100%', padding: '8px 9px', border: 0, borderRadius: 5, background: 'transparent', textAlign: 'left', cursor: 'pointer' }
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 5000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,.65)' }
const modalCard: React.CSSProperties = { width: 'min(480px,100%)', padding: 22, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)' }
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)', color: 'var(--text)' }
