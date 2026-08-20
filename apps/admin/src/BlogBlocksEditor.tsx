import React from 'react'
import { apiFetch } from './api'

export type BlogContentBlock = Record<string, any> & { id: string; block_type: string; name?: string }

type ManagedMedia = { id: string; filename: string; mime_type?: string; kind?: string; public_url?: string; url?: string }

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 9px', border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--surface-alt)', color: 'var(--text)',
}
const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 7,
  padding: '7px 10px', cursor: 'pointer',
}
const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle, background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-text)', fontWeight: 700,
}
const BLOCK_TYPES = [
  ['rich_text', 'Rich Text'],
  ['image', 'Image'],
  ['architecture', 'Architecture'],
  ['code', 'Code'],
  ['callout', 'Callout'],
] as const
const LAYOUTS = [
  ['normal', 'Normal'],
  ['wide', 'Wide'],
  ['full', 'Full Width'],
  ['split', 'Split'],
] as const

function blockId() {
  return `block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createBlock(): BlogContentBlock {
  return {
    id: blockId(),
    name: '',
    block_type: 'rich_text',
    eyebrow: '',
    heading: '',
    body: '',
    media_id: '',
    media_alt: '',
    code: '',
    language: '',
    caption: '',
    layout: 'normal',
  }
}

function label(text: string, child: React.ReactNode) {
  return <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{text}{child}</label>
}

function concise(value: unknown, max = 74) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function legacyBlockType(block: Record<string, any>) {
  if (typeof block.block_type === 'string' && block.block_type) return block.block_type
  const type = String(block.type || '')
  if (type === 'image' || type === 'video' || type === 'gallery') return 'image'
  if (type === 'code') return 'code'
  if (type === 'callout' || type === 'quote') return 'callout'
  if (type === 'architecture' || type === 'embed') return 'architecture'
  return 'rich_text'
}

function coerceBlock(block: Record<string, any>, index: number): BlogContentBlock {
  const legacyType = String(block.type || '')
  const block_type = legacyBlockType(block)
  const heading = block.heading ?? (legacyType === 'heading' ? block.text : legacyType === 'callout' ? block.title : legacyType === 'embed' ? block.title : '')
  let body = block.body ?? ''
  if (!body && ['paragraph', 'quote', 'callout'].includes(legacyType)) body = block.text || ''
  if (!body && legacyType === 'list' && Array.isArray(block.items)) body = block.items.map((item: unknown) => String(item || '')).filter(Boolean).join('\n')
  if (!body && legacyType === 'embed' && block.url) body = String(block.url)
  const media_id = block.media_id || (Array.isArray(block.media_ids) ? block.media_ids[0] || '' : '')
  const layout = block.layout || (block.full_width ? 'full' : 'normal')
  const name = block.name || heading || block.caption || block.filename || `Blog Section ${index + 1}`
  return {
    ...block,
    id: block.id || `legacy_blog_block_${index}`,
    name,
    block_type,
    eyebrow: block.eyebrow || '',
    heading,
    body,
    media_id,
    media_alt: block.media_alt || '',
    code: block.code || '',
    language: block.language || '',
    caption: block.caption || '',
    layout,
  }
}

function blockTypeLabel(type: string) {
  return BLOCK_TYPES.find(([id]) => id === type)?.[1] || type || 'Block'
}

function blockDisplayName(block: BlogContentBlock, index: number) {
  return concise(block.name) || concise(block.heading) || concise(block.eyebrow) || `Blog Section ${index + 1}`
}

function MediaSelect({ value, rows, onChange }: { value: string; rows: ManagedMedia[]; onChange: (value: string) => void }) {
  const selected = rows.find((row) => row.id === value)
  const preview = selected?.public_url || selected?.url || ''
  const mime = String(selected?.mime_type || '')
  return <div style={{ marginTop: 4 }}>
    {preview && mime.startsWith('image/') && <img src={preview} alt="Selected blog media" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)' }} />}
    {preview && mime.startsWith('video/') && <video src={preview} controls={false} muted preload="metadata" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border)', background: '#000' }} />}
    <select style={inputStyle} value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose managed media…</option>
      {rows.map((row) => <option key={row.id} value={row.id}>{row.filename}</option>)}
    </select>
  </div>
}

export function BlogBlocksEditor({ value, onChange }: { value: BlogContentBlock[]; onChange: (value: BlogContentBlock[]) => void }) {
  const blocks = (Array.isArray(value) ? value : []).map((block, index) => coerceBlock(block, index))
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [pendingFocusId, setPendingFocusId] = React.useState<string | null>(null)
  const blockRefs = React.useRef(new Map<string, HTMLDivElement>())
  const [media, setMedia] = React.useState<ManagedMedia[]>([])
  const [mediaError, setMediaError] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()
    apiFetch<any>('/api/admin/media', { signal: controller.signal })
      .then((response) => { setMedia(response.data || []); setMediaError('') })
      .catch((cause) => { if (cause?.name !== 'AbortError') setMediaError(cause instanceof Error ? cause.message : 'Managed media could not be loaded.') })
    return () => controller.abort()
  }, [])

  React.useEffect(() => {
    if (!pendingFocusId) return
    const frame = requestAnimationFrame(() => {
      const root = blockRefs.current.get(pendingFocusId)
      const target = root?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])')
      ;(target || root)?.focus({ preventScroll: true })
      setPendingFocusId(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingFocusId, expanded])

  const commit = (next: BlogContentBlock[]) => onChange(next.map((block) => ({ ...block, type: undefined })))
  const update = (index: number, patch: Record<string, unknown>) => commit(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block))
  const move = (index: number, direction: -1|1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }
  const remove = (index: number) => {
    const id = blocks[index]?.id
    commit(blocks.filter((_, blockIndex) => blockIndex !== index))
    if (id) setExpanded((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const add = () => {
    const block = createBlock()
    commit([...blocks, block])
    setExpanded((current) => ({ ...current, [block.id]: true }))
    setPendingFocusId(block.id)
  }

  return <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'color-mix(in srgb,var(--surface) 94%,var(--primary) 6%)' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: blocks.length ? 10 : 0, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Content Blocks</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{blocks.length} item{blocks.length === 1 ? '' : 's'} · each block is one complete article section · array order is display order</div>
      </div>
      <button type="button" style={primaryButtonStyle} aria-label="Add Content Blocks item" onClick={add}>+ Add Block</button>
      {mediaError && <div role="alert" style={{ flexBasis: '100%', fontSize: 10, color: 'var(--danger)' }}>{mediaError}</div>}
    </div>

    {!blocks.length && <div style={{ padding: '14px 10px', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11 }}>No content blocks yet. Add a section containing its heading, body, media and optional code together.</div>}

    <div style={{ display: 'grid', gap: 8 }}>{blocks.map((block, index) => {
      const id = block.id || `blog-block-${index}`
      const open = Boolean(expanded[id])
      const displayName = blockDisplayName(block, index)
      const panelId = `${id}-fields`
      return <div key={id} ref={(element) => { if (element) blockRefs.current.set(id, element); else blockRefs.current.delete(id) }} data-blog-block-id={id} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, flexWrap: 'wrap' }}>
          <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'Collapse' : 'Expand'} ${displayName}`} style={{ ...buttonStyle, minWidth: 34, padding: '6px 9px' }} onClick={() => setExpanded((current) => ({ ...current, [id]: !open }))}>{open ? '−' : '+'}</button>
          <div style={{ flex: 1, minWidth: 150 }}>
            <strong style={{ fontSize: 12 }}>{displayName}</strong>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{blockTypeLabel(block.block_type)}</div>
          </div>
          <button type="button" title="Move up" aria-label={`Move ${displayName} up`} style={buttonStyle} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
          <button type="button" title="Move down" aria-label={`Move ${displayName} down`} style={buttonStyle} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>↓</button>
          <button type="button" aria-label={`Delete ${displayName}`} style={{ ...buttonStyle, color: 'var(--danger)' }} onClick={() => remove(index)}>Delete</button>
        </div>

        {open && <div id={panelId} style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {label('Block Name *', <input style={{ ...inputStyle, marginTop: 4 }} placeholder="VisualBuild — Architecture" value={block.name || ''} onChange={(event) => update(index, { name: event.target.value })} />)}
          {label('Block Type *', <select style={{ ...inputStyle, marginTop: 4 }} value={block.block_type || 'rich_text'} onChange={(event) => update(index, { block_type: event.target.value })}>{BLOCK_TYPES.map(([type, text]) => <option key={type} value={type}>{text}</option>)}</select>)}

          {label('Eyebrow', <input style={{ ...inputStyle, marginTop: 4 }} placeholder="01 / THE PROBLEM" value={block.eyebrow || ''} onChange={(event) => update(index, { eyebrow: event.target.value })} />)}
          {label('Heading', <input style={{ ...inputStyle, marginTop: 4 }} value={block.heading || ''} onChange={(event) => update(index, { heading: event.target.value })} />)}

          <label style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)' }}>Body<textarea rows={7} style={{ ...inputStyle, marginTop: 4 }} value={block.body || ''} onChange={(event) => update(index, { body: event.target.value })} /></label>

          {label('Media', <MediaSelect rows={media} value={block.media_id || ''} onChange={(media_id) => update(index, { media_id })} />)}
          {label('Media Alt Text', <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Describe the visual content" value={block.media_alt || ''} onChange={(event) => update(index, { media_alt: event.target.value })} />)}

          <label style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-muted)' }}>Code / Architecture Text<textarea rows={10} spellCheck={false} style={{ ...inputStyle, marginTop: 4, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }} value={block.code || ''} onChange={(event) => update(index, { code: event.target.value })}/></label>
          {label('Code Language', <input style={{ ...inputStyle, marginTop: 4 }} placeholder="tsx / typescript / bash" value={block.language || ''} onChange={(event) => update(index, { language: event.target.value })}/>)}
          {label('Caption', <input style={{ ...inputStyle, marginTop: 4 }} value={block.caption || ''} onChange={(event) => update(index, { caption: event.target.value })} />)}
          {label('Layout', <select style={{ ...inputStyle, marginTop: 4 }} value={block.layout || 'normal'} onChange={(event) => update(index, { layout: event.target.value })}>{LAYOUTS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>)}

          <div style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            A Blog block is one complete section. Fill only the fields you need: for example Heading + Body, Heading + Body + Media, or Heading + Body + Code. Block Type controls presentation; it does not remove the other fields.
          </div>
        </div>}
      </div>
    })}</div>
  </div>
}
