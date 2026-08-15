import React from 'react'
import type { Binding, DesignTokens, EditorPage, ResponsiveMode, StudioNode, StyleMap } from '@platform/contracts'
import { ANIMATION_CATEGORIES, ANIMATION_PRESETS, getAllowedAnimationTriggers, normalizeRoutePattern, routePatternsConflict } from '@platform/builder-core'

export interface StudioMediaOption {
  id: string
  filename: string
  public_url?: string | null
  url?: string | null
  mime_type?: string | null
  kind?: string | null
  alt_text?: string | null
}

export interface StudioCollectionOption {
  id: string
  label: string
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 11 }
const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const sectionStyle: React.CSSProperties = { padding: '12px 12px', borderBottom: '1px solid var(--border)' }

const STYLE_GROUPS: { title: string; props: string[] }[] = [
  { title: 'Layout', props: ['display', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'margin', 'padding', 'boxSizing', 'overflow', 'aspectRatio'] },
  { title: 'Flexbox', props: ['flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gap', 'rowGap', 'columnGap', 'flexGrow', 'flexShrink', 'flexBasis', 'order'] },
  { title: 'Grid', props: ['gridTemplateColumns', 'gridTemplateRows', 'gridAutoFlow', 'gridColumn', 'gridRow', 'placeItems', 'placeContent'] },
  { title: 'Position', props: ['position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex'] },
  { title: 'Typography', props: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'whiteSpace', 'color', 'textDecoration', 'textTransform', 'textShadow', 'WebkitTextStroke'] },
  { title: 'Background', props: ['background', 'backgroundColor', 'backgroundImage', 'backgroundPosition', 'backgroundSize', 'backgroundRepeat', 'backgroundAttachment', 'backgroundBlendMode'] },
  { title: 'Borders & Effects', props: ['border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius', 'boxShadow', 'opacity', 'outline'] },
  { title: 'Media', props: ['objectFit', 'objectPosition', 'imageRendering'] },
  { title: 'Transform / 3D', props: ['transform', 'transformOrigin', 'transformStyle', 'perspective', 'perspectiveOrigin', 'backfaceVisibility'] },
  { title: 'Filters', props: ['filter', 'backdropFilter', 'mixBlendMode'] },
  { title: 'Advanced', props: ['clipPath', 'maskImage', 'offsetPath', 'transition', 'willChange', 'contain', 'contentVisibility', 'scrollSnapType', 'scrollSnapAlign', 'cursor', 'pointerEvents'] },
]

type UpdateNode = (u: (n: StudioNode) => StudioNode) => void

export function Inspector({ node, mode, page, pages, onUpdateNode, onSetNodeLocked, onUpdatePage, onUpdatePageState, onUpdateTokens, designTokens, mediaOptions, collectionOptions, bindingSuggestions }: {
  node: StudioNode | null
  mode: ResponsiveMode
  page: EditorPage
  pages: EditorPage[]
  onUpdateNode: UpdateNode
  onSetNodeLocked: (locked: boolean) => void
  onUpdatePage: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void
  onUpdatePageState: (initialState: Record<string, unknown>) => void
  onUpdateTokens: (tokens: DesignTokens) => void
  designTokens: DesignTokens
  mediaOptions: StudioMediaOption[]
  collectionOptions: StudioCollectionOption[]
  bindingSuggestions: string[]
}) {
  const [tab, setTab] = React.useState<'style' | 'content' | 'props' | 'animation' | 'scroll' | 'logic' | 'page' | 'tokens'>('style')
  React.useEffect(() => { if (!node && ['style', 'content', 'props', 'animation', 'scroll', 'logic'].includes(tab)) setTab('page') }, [node, tab])
  const tabs = [['style', 'Style'], ['content', 'Content'], ['props', 'Props'], ['animation', 'Animation'], ['scroll', 'Scroll'], ['logic', 'Logic'], ['page', 'Page'], ['tokens', 'Tokens']] as const
  const locked = Boolean(node?.meta?.locked)
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} disabled={!node && ['style', 'content', 'props', 'animation', 'scroll', 'logic'].includes(key)} style={{ padding: '8px 3px', fontSize: 10, border: 0, borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: tab === key ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer' }}>{label}</button>)}
    </div>
    {locked && node && tab !== 'props' && <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--warning)', borderBottom: '1px solid var(--border)' }}>This layer is locked. Unlock it in Props to edit it.</div>}
    <div style={{ flex: 1, overflow: 'auto' }}>
      {tab === 'style' && node && <StyleTab node={node} mode={mode} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'content' && node && <ContentTab node={node} page={page} onUpdate={onUpdateNode} disabled={locked} mediaOptions={mediaOptions} collectionOptions={collectionOptions} bindingSuggestions={bindingSuggestions} />}
      {tab === 'props' && node && <PropsTab node={node} onUpdate={onUpdateNode} onSetLocked={onSetNodeLocked} disabled={locked} mediaOptions={mediaOptions} />}
      {tab === 'animation' && node && <AnimationTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'scroll' && node && <ScrollTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'logic' && node && <LogicTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'page' && <PageTab page={page} pages={pages} onUpdate={onUpdatePage} onUpdatePageState={onUpdatePageState} />}
      {tab === 'tokens' && <TokensTab tokens={designTokens} onUpdate={onUpdateTokens} />}
    </div>
  </div>
}

function StyleTab({ node, mode, onUpdate, disabled }: { node: StudioNode; mode: ResponsiveMode; onUpdate: UpdateNode; disabled: boolean }) {
  const styles = { ...(node.styles?.[mode] || {}) } as Record<string, unknown>
  const set = (key: string, value: string) => onUpdate((n) => ({ ...n, styles: { ...n.styles, [mode]: { ...(n.styles[mode] || {}), [key]: value === '' ? undefined : value } } }))
  return <>
    <div style={sectionStyle}><strong style={{ fontSize: 11 }}>Responsive styles</strong><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Editing {mode}. Tablet and Mobile inherit from larger breakpoints.</div><label style={{display:'block',marginTop:10}}><span style={labelStyle}>Breakpoint display / visibility</span><select disabled={disabled} value={String(styles.display??'')} onChange={event=>set('display',event.target.value)} style={inputStyle}><option value="">Inherit from larger breakpoint</option><option value="none">Hidden — display: none</option><option value="block">Block</option><option value="flex">Flex</option><option value="grid">Grid</option><option value="inline">Inline</option><option value="inline-block">Inline block</option><option value="inline-flex">Inline flex</option></select></label><div style={{fontSize:9,color:'var(--text-muted)',marginTop:5}}>Use Hidden to remove the element only at this breakpoint without deleting the node.</div></div>
    {STYLE_GROUPS.map((group) => <details key={group.title} open={['Layout', 'Typography', 'Background'].includes(group.title)} style={sectionStyle}><summary style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>{group.title}</summary><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>{group.props.map((key) => <label key={key}><span style={labelStyle}>{pretty(key)}</span><input disabled={disabled} value={String(styles[key] ?? '')} onChange={(e) => set(key, e.target.value)} placeholder={placeholder(key)} style={inputStyle} /></label>)}</div></details>)}
  </>
}

function bindingPropsForNode(node: StudioNode): string[] {
  if (node.type === 'collection') return ['items']
  if (node.type === 'cinematic-sequence') return ['bridgeText', 'style.background', 'style.backgroundColor']
  if (node.type === 'intro-sequence') return ['nameText', 'loadingText', 'upcomingEyebrow', 'upcomingTitle', 'src', 'poster', 'style.background', 'style.backgroundColor']
  const tag = node.tag || node.type
  const visual = ['style.background', 'style.backgroundColor', 'style.backgroundImage']
  if (tag === 'img' || node.type === 'image' || tag === 'video' || tag === 'audio') return ['src', 'alt', ...visual]
  if (tag === 'a') return ['text', 'href', ...visual]
  if (tag === 'button') return ['text', ...visual]
  if (tag === 'input' || tag === 'textarea') return ['placeholder', ...visual]
  return ['text', ...visual]
}

function ContentTab({ node, page, onUpdate, disabled, mediaOptions, collectionOptions, bindingSuggestions }: { node: StudioNode; page: EditorPage; onUpdate: UpdateNode; disabled: boolean; mediaOptions: StudioMediaOption[]; collectionOptions: StudioCollectionOption[]; bindingSuggestions: string[] }) {
  const props = bindingPropsForNode(node)
  const [property, setProperty] = React.useState(props[0])
  React.useEffect(() => { if (!props.includes(property)) setProperty(props[0]) }, [node.id, property, props])
  const binding = node.bindings?.[property]
  const source = binding?.type || (node.type === 'collection' ? 'collection' : 'static')
  const setBinding = (next: Binding | undefined) => onUpdate((n) => { const bindings = { ...(n.bindings || {}) }; if (next) bindings[property] = next; else delete bindings[property]; return { ...n, bindings } })
  const setStatic = (value: unknown) => onUpdate((n) => {
    const shouldPreserveLineBreaks = property === 'text' && String(value ?? '').includes('\n')
    const desktopStyles: StyleMap = { ...(n.styles?.desktop || {}) }
    if (shouldPreserveLineBreaks && !desktopStyles.whiteSpace) desktopStyles.whiteSpace = 'pre-line'
    if (property.startsWith('style.')) {
      const styleValue: StyleMap[string] = value == null || ['string', 'number', 'boolean'].includes(typeof value)
        ? value as StyleMap[string]
        : String(value)
      desktopStyles[property.slice(6)] = styleValue
    }
    return {
      ...n,
      props: property.startsWith('style.') ? n.props : { ...(n.props || {}), [property]: value },
      bindings: { ...(n.bindings || {}), [property]: { type: 'static', value } },
      styles: property.startsWith('style.') || shouldPreserveLineBreaks ? { ...(n.styles || {}), desktop: desktopStyles } : n.styles,
    }
  })
  const changeSource = (value: string) => {
    const styleKey = property.startsWith('style.') ? property.slice(6) : ''
    const existing = styleKey ? node.styles?.desktop?.[styleKey] ?? '' : node.props?.[property] ?? ''
    if (value === 'static') setStatic(existing)
    if (value === 'content') { const part = String(node.meta?.sectionLabel || node.meta?.adminLabel || node.meta?.label || node.type).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); setBinding({ type: 'content', key: `${page.slug}.${part}.${property}`.replace(/\.+/g, '.'), label: node.meta?.adminLabel || node.meta?.label || pretty(property), contentType: property === 'src' || property === 'style.backgroundImage' ? 'media' : property === 'href' ? 'url' : 'text', sample: existing }) }
    if (value === 'setting') setBinding({ type: 'setting', key: '', label: pretty(property), sample: existing })
    if (value === 'media') setBinding({ type: 'media', sampleUrl: String(existing || '') })
    if (value === 'field') setBinding({ type: 'field', field: property === 'text' ? 'title' : property })
    if (value === 'state') setBinding({ type: 'state', key: '' })
    if (value === 'context') setBinding({ type: 'context', key: property === 'text' ? 'collectionPosition' : 'collectionIndex' })
    if (value === 'template') setBinding({ type: 'template', template: String(existing || '') })
    if (value === 'collection') setBinding({ type: 'collection', collection: String(node.props?.collection || 'projects'), limit: 6 })
  }
  const patch = (data: Record<string, unknown>) => setBinding({ ...binding, ...data } as Binding)
  const keyListId = `binding-keys-${node.id}-${property}`
  const mediaBinding = binding?.type === 'media' ? binding : null
  const staticValue = property.startsWith('style.') ? node.styles?.desktop?.[property.slice(6)] ?? '' : node.props?.[property] ?? ''
  return <div style={sectionStyle}>
    <div style={{ marginBottom: 10 }}><label style={labelStyle}>Bindable property</label><select disabled={disabled} value={property} onChange={(e) => setProperty(e.target.value)} style={inputStyle}>{props.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}</select></div>
    <div style={{ marginBottom: 12 }}><label style={labelStyle}>Content source</label><select disabled={disabled} value={source} onChange={(e) => changeSource(e.target.value)} style={inputStyle}>{node.type === 'collection' ? <option value="collection">Collection</option> : <><option value="static">Static / design content</option><option value="content">Editable Content</option><option value="setting">Site Setting</option><option value="media">Media Reference</option><option value="field">Collection Field</option><option value="state">Runtime State</option><option value="context">Collection Context</option><option value="template">Runtime Template</option></>}</select></div>
    {source === 'static' && (property === 'text'
      ? <MultilineField disabled={disabled} label="Static value" value={binding?.type === 'static' ? binding.value : staticValue} onChange={setStatic} rows={5} />
      : <Field disabled={disabled} label="Static value" value={binding?.type === 'static' ? binding.value : staticValue} onChange={setStatic} />)}
    {binding?.type === 'content' && <>
      <Field disabled={disabled} label="Admin label" value={binding.label || ''} onChange={(v) => patch({ label: String(v) })} />
      <Field disabled={disabled} list={keyListId} label="Content key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="home.hero.heading" />
      <datalist id={keyListId}>{bindingSuggestions.map((key) => <option key={key} value={key} />)}</datalist>
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Content type</span><select disabled={disabled} value={binding.contentType || 'text'} onChange={(e) => patch({ contentType: e.target.value })} style={inputStyle}>{['text', 'richtext', 'url', 'number', 'boolean', 'media', 'button', 'json'].map((v) => <option key={v}>{v}</option>)}</select></label>
      {(binding.contentType === 'text' || binding.contentType === 'richtext' || !binding.contentType)
        ? <><MultilineField disabled={disabled} label="Sample / dummy value" value={binding.sample ?? ''} onChange={(v) => patch({ sample: v })} rows={4} /><MultilineField disabled={disabled} label="Fallback" value={binding.fallback ?? ''} onChange={(v) => patch({ fallback: v })} rows={3} /></>
        : <><Field disabled={disabled} label="Sample / dummy value" value={binding.sample ?? ''} onChange={(v) => patch({ sample: v })} /><Field disabled={disabled} label="Fallback" value={binding.fallback ?? ''} onChange={(v) => patch({ fallback: v })} /></>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, margin: '10px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(binding.required)} onChange={(e) => patch({ required: e.target.checked })} /> Required before release activation</label>
      <Field disabled={disabled} label="Description" value={binding.description || ''} onChange={(v) => patch({ description: String(v) })} />
    </>}
    {binding?.type === 'setting' && <><Field disabled={disabled} list={keyListId} label="Setting key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="site.social.github" /><datalist id={keyListId}>{bindingSuggestions.map((key) => <option key={key} value={key} />)}</datalist><Field disabled={disabled} label="Sample value" value={binding.sample ?? ''} onChange={(v) => patch({ sample: v })} /></>}
    {mediaBinding && <>
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Choose media</span><select disabled={disabled} value={mediaBinding.mediaId || ''} onChange={(event) => { const selected = mediaOptions.find((item) => item.id === event.target.value); patch({ mediaId: selected?.id || undefined, sampleUrl: selected?.public_url || selected?.url || mediaBinding.sampleUrl || '' }) }} style={inputStyle}><option value="">No canonical media selected</option>{mediaOptions.map((item) => <option key={item.id} value={item.id}>{item.filename} · {item.kind || item.mime_type || 'file'}</option>)}</select></label>
      <Field disabled={disabled} label="Media ID" value={mediaBinding.mediaId || ''} onChange={(v) => patch({ mediaId: String(v) })} /><Field disabled={disabled} label="Sample URL" value={mediaBinding.sampleUrl || ''} onChange={(v) => patch({ sampleUrl: String(v) })} />
    </>}
    {binding?.type === 'field' && <Field disabled={disabled} label="Collection field" value={binding.field} onChange={(v) => patch({ field: String(v) })} placeholder="title" />}
    {binding?.type === 'state' && <><Field disabled={disabled} label="State key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="tech.category" /><JsonField disabled={disabled} label="Fallback value" value={binding.fallback ?? null} onChange={(value) => patch({ fallback: value })} /></>}
    {binding?.type === 'context' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Collection context</span><select disabled={disabled} value={binding.key} onChange={(e) => patch({ key: e.target.value })} style={inputStyle}>{['collectionIndex', 'collectionPosition', 'collectionCount', 'collectionKey'].map((v) => <option key={v}>{v}</option>)}</select></label><JsonField disabled={disabled} label="Fallback value" value={binding.fallback ?? null} onChange={(value) => patch({ fallback: value })} /></>}
    {binding?.type === 'template' && <><MultilineField disabled={disabled} label="Runtime template" value={binding.template} onChange={(v) => patch({ template: String(v) })} rows={4} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -4, marginBottom: 8 }}>Tokens: {'{{state:tech.category}}'}, {'{{field:name}}'}, {'{{context:collectionPosition}}'}, {'{{context:collectionCount}}'}, {'{{content:key}}'}, {'{{setting:key}}'}</div></>}
    {binding?.type === 'collection' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Collection</span><select disabled={disabled} value={binding.collection} onChange={(e) => patch({ collection: e.target.value })} style={inputStyle}>{collectionOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label><Field disabled={disabled} label="Limit" value={binding.limit || 6} type="number" onChange={(v) => patch({ limit: Number(v) })} /><Field disabled={disabled} label="Filtered count → state key" value={binding.countStateKey || ''} onChange={(v) => patch({ countStateKey: String(v) || undefined })} placeholder="tech.visibleCount" /><JsonField disabled={disabled} label="Filters JSON" value={binding.filters || []} onChange={(value) => patch({ filters: value })} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, margin: '-4px 0 8px' }}>Dynamic filter example: {'[{"field":"category","operator":"eq","value":{"source":"state","key":"tech.category"}}]'}</div><JsonField disabled={disabled} label="Sort JSON" value={binding.sort || []} onChange={(value) => patch({ sort: value })} /></>}
  </div>
}

function PropsTab({ node, onUpdate, onSetLocked, disabled, mediaOptions }: { node: StudioNode; onUpdate: UpdateNode; onSetLocked: (locked: boolean) => void; disabled: boolean; mediaOptions: StudioMediaOption[] }) {
  const setMeta = (key: string, value: unknown) => onUpdate((n) => ({ ...n, meta: { ...(n.meta || {}), [key]: value } }))
  const setProp = (key: string, value: unknown) => onUpdate((n) => ({ ...n, props: { ...(n.props || {}), [key]: value } }))
  const setLayoutMode = (mode: 'flow' | 'absolute') => onUpdate((n) => ({ ...n, layout: mode === 'absolute' ? { mode, x: n.layout?.x ?? 0, y: n.layout?.y ?? 0, width: n.layout?.width ?? 240, height: n.layout?.height ?? 120, rotation: n.layout?.rotation, zIndex: n.layout?.zIndex } : { mode: 'flow', rotation: n.layout?.rotation, zIndex: n.layout?.zIndex } }))
  return <div style={sectionStyle}>
    <label style={{ display: 'flex', gap: 8, fontSize: 11, margin: '2px 0 12px', fontWeight: 700 }}><input type="checkbox" checked={Boolean(node.meta?.locked)} onChange={(e) => onSetLocked(e.target.checked)} /> Lock in Studio</label>
    <Field disabled={disabled} label="Layer label" value={node.meta?.label || ''} onChange={(v) => setMeta('label', String(v))} /><Field disabled={disabled} label="Admin label" value={node.meta?.adminLabel || ''} onChange={(v) => setMeta('adminLabel', String(v))} /><Field disabled={disabled} label="Section label" value={node.meta?.sectionLabel || ''} onChange={(v) => setMeta('sectionLabel', String(v))} /><Field disabled={disabled} label="HTML tag" value={node.tag || ''} onChange={(v) => onUpdate((n) => ({ ...n, tag: String(v) }))} />
    <label style={{ display: 'flex', gap: 8, fontSize: 11, margin: '10px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(node.meta?.hidden)} onChange={(e) => setMeta('hidden', e.target.checked)} /> Hide in runtime</label>
    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Layout mode</div>
    <select disabled={disabled} value={node.layout?.mode || 'flow'} onChange={(e) => setLayoutMode(e.target.value as 'flow' | 'absolute')} style={inputStyle}><option value="flow">Flow</option><option value="absolute">Absolute / free position</option></select>
    {node.layout?.mode === 'absolute' && <><p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>Drag the blue handle on the canvas to move this element and the corner handle to resize it.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>{['x', 'y', 'width', 'height', 'rotation', 'zIndex'].map((key) => <Field disabled={disabled} key={key} label={pretty(key)} value={(node.layout as any)?.[key] ?? ''} type="number" onChange={(v) => onUpdate((n) => ({ ...n, layout: { ...(n.layout || { mode: 'absolute' }), [key]: Number(v) } }))} />)}</div></>}
    {node.type === 'intro-sequence' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Intro Sequence</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>Editable full-screen loader, optional background video, Coming Up Next bridge, and pixel-wipe reveal. It runs only in Preview/runtime; Studio shows a static editable frame.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Loading duration ms" type="number" value={Number(node.props?.duration ?? 2600)} onChange={(v) => setProp('duration', Math.max(800, Math.min(12000, Number(v) || 2600)))} /><Field disabled={disabled} label="Bridge duration ms" type="number" value={Number(node.props?.bridgeDuration ?? 480)} onChange={(v) => setProp('bridgeDuration', Math.max(100, Math.min(3000, Number(v) || 480)))} /><Field disabled={disabled} label="Exit duration ms" type="number" value={Number(node.props?.exitDuration ?? 700)} onChange={(v) => setProp('exitDuration', Math.max(200, Math.min(3000, Number(v) || 700)))} /></div><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Pixel-wipe direction</span><select disabled={disabled} value={String(node.props?.exitDirection ?? 'right')} onChange={(e) => setProp('exitDirection', e.target.value)} style={inputStyle}><option value="right">Left to right</option><option value="left">Right to left</option></select></label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.directionNeutralBridge)} onChange={(e) => setProp('directionNeutralBridge', e.target.checked)} />Show only direction-neutral “Coming Up Next” text</label><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45 }}>Bind the name, labels, video and poster in Content. An empty video source keeps the graphic background.</div></>}
    {node.type === 'cinematic-sequence' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Cinematic Sequence</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>One scroll owner, one sticky viewport stage and one persistent bridge. Content is fully revealed before each directional exit, and reverse scrolling retraces the same timeline.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Entry travel (vh %)" type="number" value={Number(node.props?.entryDistanceVh ?? 86)} onChange={(v) => setProp('entryDistanceVh', Math.max(40, Math.min(180, Number(v) || 86)))} /><Field disabled={disabled} label="Exit travel (vh %)" type="number" value={Number(node.props?.exitDistanceVh ?? 86)} onChange={(v) => setProp('exitDistanceVh', Math.max(40, Math.min(180, Number(v) || 86)))} /><Field disabled={disabled} label="Top hold (vh %)" type="number" value={Number(node.props?.topHoldVh ?? 30)} onChange={(v) => setProp('topHoldVh', Math.max(10, Math.min(120, Number(v) || 30)))} /><Field disabled={disabled} label="Bottom hold (vh %)" type="number" value={Number(node.props?.bottomHoldVh ?? 34)} onChange={(v) => setProp('bottomHoldVh', Math.max(10, Math.min(120, Number(v) || 34)))} /><Field disabled={disabled} label="Bridge hold (vh %)" type="number" value={Number(node.props?.bridgeHoldVh ?? 30)} onChange={(v) => setProp('bridgeHoldVh', Math.max(10, Math.min(120, Number(v) || 30)))} /></div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45 }}>Edit the neutral bridge copy in Content. Reorder Scene Frame children in Layers to change the film order.</div></>}
    {node.type === 'scene-frame' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Shared-stage Scene</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>When this frame is inside a Cinematic Sequence, these directions are measured by the parent timeline. Existing legacy Scene Transition scroll settings remain supported.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><label><span style={labelStyle}>Enter from</span><select disabled={disabled} value={String(node.props?.enterFrom ?? 'bottom')} onChange={(e) => setProp('enterFrom', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((value) => <option key={value}>{value}</option>)}</select></label><label><span style={labelStyle}>Exit to</span><select disabled={disabled} value={String(node.props?.exitTo ?? 'top')} onChange={(e) => setProp('exitTo', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((value) => <option key={value}>{value}</option>)}</select></label></div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', margin: '8px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.skipEntry)} onChange={(e) => setProp('skipEntry', e.target.checked)} />Start visible behind the intro</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.finalScene)} onChange={(e) => setProp('finalScene', e.target.checked)} />Final scene: stay visible until the sequence releases</label></>}
    {node.type === 'particle-field' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Particle Field</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>One lightweight background layer generates the full particle group. Values are clamped again by the production runtime.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Count (1–200)" type="number" value={Number(node.props?.count ?? 20)} onChange={(v) => setProp('count', Math.max(1, Math.min(200, Number(v) || 1)))} /><Field disabled={disabled} label="Speed" type="number" value={Number(node.props?.speed ?? .25)} onChange={(v) => setProp('speed', Math.max(.05, Math.min(3, Number(v) || .05)))} /><Field disabled={disabled} label="Min Size px" type="number" value={Number(node.props?.minSize ?? 2)} onChange={(v) => setProp('minSize', Math.max(1, Math.min(20, Number(v) || 1)))} /><Field disabled={disabled} label="Max Size px" type="number" value={Number(node.props?.maxSize ?? 5)} onChange={(v) => setProp('maxSize', Math.max(1, Math.min(24, Number(v) || 1)))} /><Field disabled={disabled} label="Drift px" type="number" value={Number(node.props?.drift ?? 30)} onChange={(v) => setProp('drift', Math.max(0, Math.min(300, Number(v) || 0)))} /><Field disabled={disabled} label="Opacity 0–1" type="number" value={Number(node.props?.opacity ?? .5)} onChange={(v) => setProp('opacity', Math.max(0, Math.min(1, Number(v) || 0)))} /><Field disabled={disabled} label="Glow 0–1" type="number" value={Number(node.props?.glow ?? .6)} onChange={(v) => setProp('glow', Math.max(0, Math.min(1, Number(v) || 0)))} /><Field disabled={disabled} label="Seed" type="number" value={Number(node.props?.seed ?? 1)} onChange={(v) => setProp('seed', Math.trunc(Number(v) || 1))} /></div><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Direction</span><select disabled={disabled} value={String(node.props?.direction ?? 'random')} onChange={(e) => setProp('direction', e.target.value)} style={inputStyle}>{['random','up','down','left','right'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><Field disabled={disabled} label="Colors" value={String(node.props?.colors ?? '#dce8ff, #91afff, #646eff')} onChange={(v) => setProp('colors', String(v))} placeholder="#dce8ff, #91afff, #646eff" /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '-4px 0 8px' }}>Use comma-separated hex colors. The field is deterministic: changing Seed gives another stable distribution.</div><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Animation</span><select disabled={disabled} value={String(node.props?.motion ?? 'continuous')} onChange={(e) => setProp('motion', e.target.value)} style={inputStyle}><option value="continuous">Continuous</option><option value="static">Static</option></select></label></>}
    {node.type === 'ambient-field' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Ambient Field</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>Seeded decorative field for floating code tags, Media-library icons, or both. It does not create per-frame React state.</div><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Content mode</span><select disabled={disabled} value={String(node.props?.contentMode ?? 'text')} onChange={(e) => setProp('contentMode', e.target.value)} style={inputStyle}>{['text','icons','mixed'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><MultilineField disabled={disabled} label="Code tags / labels — one per line" value={String(node.props?.items ?? '')} onChange={(v) => setProp('items', String(v))} placeholder={'<div>\n</>\nconst\nReact\nTypeScript'} rows={6} /><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Media icons — Ctrl/Cmd-click for multiple</span><select multiple disabled={disabled} value={Array.isArray(node.props?.mediaIds) ? node.props?.mediaIds as string[] : []} onChange={(event) => setProp('mediaIds', Array.from(event.currentTarget.selectedOptions).map((option) => option.value))} size={Math.min(7, Math.max(3, mediaOptions.length || 3))} style={{ ...inputStyle, minHeight: 82 }}>{mediaOptions.filter((item) => String(item.kind || item.mime_type || '').toLowerCase().includes('image')).map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}</select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Count (1–120)" type="number" value={Number(node.props?.count ?? 18)} onChange={(v) => setProp('count', Math.max(1, Math.min(120, Number(v) || 1)))} /><Field disabled={disabled} label="Speed" type="number" value={Number(node.props?.speed ?? .35)} onChange={(v) => setProp('speed', Math.max(.05, Math.min(3, Number(v) || .05)))} /><Field disabled={disabled} label="Min Size px" type="number" value={Number(node.props?.minSize ?? 22)} onChange={(v) => setProp('minSize', Math.max(8, Math.min(160, Number(v) || 8)))} /><Field disabled={disabled} label="Max Size px" type="number" value={Number(node.props?.maxSize ?? 48)} onChange={(v) => setProp('maxSize', Math.max(8, Math.min(180, Number(v) || 8)))} /><Field disabled={disabled} label="Same Size px" type="number" value={Number(node.props?.size ?? 34)} onChange={(v) => setProp('size', Math.max(8, Math.min(160, Number(v) || 8)))} /><Field disabled={disabled} label="Drift px" type="number" value={Number(node.props?.drift ?? 44)} onChange={(v) => setProp('drift', Math.max(0, Math.min(400, Number(v) || 0)))} /><Field disabled={disabled} label="Opacity 0–1" type="number" value={Number(node.props?.opacity ?? .42)} onChange={(v) => setProp('opacity', Math.max(0, Math.min(1, Number(v) || 0)))} /><Field disabled={disabled} label="Glow 0–1" type="number" value={Number(node.props?.glow ?? .25)} onChange={(v) => setProp('glow', Math.max(0, Math.min(1, Number(v) || 0)))} /><Field disabled={disabled} label="Seed" type="number" value={Number(node.props?.seed ?? 1)} onChange={(v) => setProp('seed', Math.trunc(Number(v) || 1))} /></div><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.sameSize)} onChange={(e) => setProp('sameSize', e.target.checked)} />Use the same size for every tag/icon</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.randomRotation ?? true)} onChange={(e) => setProp('randomRotation', e.target.checked)} />Random starting rotation</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.randomColors)} onChange={(e) => setProp('randomColors', e.target.checked)} />Random colors from palette</label><Field disabled={disabled} label="Color palette" value={String(node.props?.colors ?? '#dce8ff, #91afff, #7c8cff, #8b5cf6, #67e8f9')} onChange={(v) => setProp('colors', String(v))} placeholder="#dce8ff, #91afff, #7c8cff, #8b5cf6, #67e8f9" /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '-4px 0 8px' }}>Comma-separated hex colors. Used when Random colors is enabled. Seed keeps each item&apos;s color assignment stable without changing its position or motion.</div><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Motion</span><select disabled={disabled} value={String(node.props?.motion ?? 'float')} onChange={(e) => setProp('motion', e.target.value)} style={inputStyle}>{['float','drift','orbit','spin','pulse','flicker','static'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Direction</span><select disabled={disabled} value={String(node.props?.direction ?? 'random')} onChange={(e) => setProp('direction', e.target.value)} style={inputStyle}>{['random','up','down','left','right'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Distribution</span><select disabled={disabled} value={String(node.props?.distribution ?? 'random')} onChange={(e) => setProp('distribution', e.target.value)} style={inputStyle}>{['random','even','edges','center'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label></>}
    {node.type === 'code-stream' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Code Stream</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>Seamless infinite code-line stream. Typography, color and size come from the normal Style tab.</div><MultilineField disabled={disabled} label="Code lines — one per line" value={String(node.props?.lines ?? '')} onChange={(v) => setProp('lines', String(v))} rows={8} /><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Direction</span><select disabled={disabled} value={String(node.props?.direction ?? 'up')} onChange={(e) => setProp('direction', e.target.value)} style={inputStyle}>{['up','down','left','right'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Speed 0.1–10" type="number" value={Number(node.props?.speed ?? 1)} onChange={(v) => setProp('speed', Math.max(.1, Math.min(10, Number(v) || .1)))} /><Field disabled={disabled} label="Gap px" type="number" value={Number(node.props?.gap ?? 18)} onChange={(v) => setProp('gap', Math.max(0, Math.min(200, Number(v) || 0)))} /><Field disabled={disabled} label="Edge fade px" type="number" value={Number(node.props?.edgeFade ?? 32)} onChange={(v) => setProp('edgeFade', Math.max(0, Math.min(200, Number(v) || 0)))} /></div></>}

    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>HTML props</div>{['text', 'href', 'src', 'alt', 'placeholder', 'target', 'rel', 'type'].map((key) => key === 'text' ? <MultilineField disabled={disabled} key={key} label={pretty(key)} value={node.props?.[key] ?? ''} onChange={(v) => setProp(key, v)} rows={4} /> : <Field disabled={disabled} key={key} label={pretty(key)} value={node.props?.[key] ?? ''} onChange={(v) => setProp(key, v)} />)}
  </div>
}

const ANIMATION_TRIGGER_LABELS: Record<string, string> = {
  load: 'Page load',
  scroll: 'Enter viewport',
  state: 'State change only',
  hover: 'Hover',
  tap: 'Press / tap',
  focus: 'Keyboard focus',
  continuous: 'Continuous',
}

function AnimationTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  const anim = node.animation
  const patch = (data: Record<string, unknown>) => onUpdate((n) => ({
    ...n,
    animation: {
      type: anim?.type || 'fade',
      trigger: anim?.trigger || 'scroll',
      duration: anim?.duration || 700,
      easing: anim?.easing || 'ease-out',
      ...anim,
      ...data,
    } as any,
  }))
  const stateKeys = anim?.replayOnState || []
  const combinedViewportState = anim?.trigger === 'scroll' && stateKeys.length > 0

  return <div>
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 11 }}>Animation</strong>
        {anim && <button disabled={disabled} onClick={() => onUpdate((n) => { const next = { ...n }; delete next.animation; return next })} style={dangerMini}>Remove</button>}
      </div>
      {anim ? <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
          <Field disabled={disabled} label="Duration ms" type="number" value={anim.duration || 700} onChange={(v) => patch({ duration: Math.max(0, Number(v) || 0) })} />
          <Field disabled={disabled} label="Delay ms" type="number" value={anim.delay || 0} onChange={(v) => patch({ delay: Math.max(0, Number(v) || 0) })} />
          <label>
            <span style={labelStyle}>Primary trigger</span>
            <select disabled={disabled} value={anim.trigger} onChange={(e) => patch({ trigger: e.target.value })} style={inputStyle}>
              {getAllowedAnimationTriggers(anim.type).map((v) => <option key={v} value={v}>{ANIMATION_TRIGGER_LABELS[v] || v}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>Easing</span>
            <select disabled={disabled} value={anim.easing || 'ease-out'} onChange={(e) => patch({ easing: e.target.value })} style={inputStyle}>
              {['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'spring'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 2 }}>
          <Field disabled={disabled} label="Stagger ms" type="number" value={anim.stagger || 0} onChange={(v) => patch({ stagger: Math.max(0, Number(v) || 0) })} />
          {anim.trigger === 'scroll' ? <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 14, fontSize: 10, color: 'var(--text-muted)' }}>
            <input disabled={disabled} type="checkbox" checked={Boolean(anim.repeat)} onChange={(e) => patch({ repeat: e.target.checked })} />Replay on re-entry
          </label> : <div />}
        </div>

        {anim.trigger === 'scroll' && <Field disabled={disabled} label="Viewport threshold (0–1)" type="number" value={Number(anim.params?.threshold ?? .14)} onChange={(v) => patch({ params: { ...(anim.params || {}), threshold: Math.max(0, Math.min(1, Number(v) || 0)) } })} />}

        <Field disabled={disabled} label="State-change keys (replay)" value={stateKeys.join(', ')} onChange={(v) => patch({ replayOnState: String(v).split(',').map((key) => key.trim()).filter(Boolean) })} placeholder="tech.category" />
        <div style={{ marginTop: -4, marginBottom: 10, padding: '8px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: 9, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          {combinedViewportState
            ? 'Combined playback is active: this animation plays when it enters the viewport and replays whenever the listed runtime state changes.'
            : anim.trigger === 'state'
              ? (stateKeys.length ? 'State-only playback: the element waits for one of these state keys to change before it plays.' : 'Add at least one state-change key for a State change only trigger.')
              : 'Optional: add state keys to replay this animation after its primary trigger, for example when a Tech Stack tab changes.'}
        </div>

        {anim.type === 'page-turn' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Page turn direction</span><select disabled={disabled} value={String(anim.params?.direction ?? 'left')} onChange={(e) => patch({ params: { ...(anim.params || {}), direction: e.target.value } })} style={inputStyle}><option value="left">Turn from left spine</option><option value="right">Turn from right spine</option></select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Perspective px" type="number" value={Number(anim.params?.perspective ?? 1200)} onChange={(v) => patch({ params: { ...(anim.params || {}), perspective: Math.max(300, Math.min(3000, Number(v) || 1200)) } })} /><Field disabled={disabled} label="Turn angle deg" type="number" value={Number(anim.params?.angle ?? 92)} onChange={(v) => patch({ params: { ...(anim.params || {}), angle: Math.max(20, Math.min(160, Number(v) || 92)) } })} /><Field disabled={disabled} label="Page shadow 0–1" type="number" value={Number(anim.params?.shadow ?? .35)} onChange={(v) => patch({ params: { ...(anim.params || {}), shadow: Math.max(0, Math.min(1, Number(v) || 0)) } })} /></div></>}
        {anim.type === 'text-steps' && <>
          <Field disabled={disabled} label="Step 1" value={String((anim.params?.steps as unknown[] | undefined)?.[0] ?? '0%')} onChange={(v) => patch({ params: { ...(anim.params || {}), steps: [String(v), String((anim.params?.steps as unknown[] | undefined)?.[1] ?? '50%'), String((anim.params?.steps as unknown[] | undefined)?.[2] ?? '100%')] } })} />
          <Field disabled={disabled} label="Step 2" value={String((anim.params?.steps as unknown[] | undefined)?.[1] ?? '50%')} onChange={(v) => patch({ params: { ...(anim.params || {}), steps: [String((anim.params?.steps as unknown[] | undefined)?.[0] ?? '0%'), String(v), String((anim.params?.steps as unknown[] | undefined)?.[2] ?? '100%')] } })} />
          <Field disabled={disabled} label="Step 3" value={String((anim.params?.steps as unknown[] | undefined)?.[2] ?? '100%')} onChange={(v) => patch({ params: { ...(anim.params || {}), steps: [String((anim.params?.steps as unknown[] | undefined)?.[0] ?? '0%'), String((anim.params?.steps as unknown[] | undefined)?.[1] ?? '50%'), String(v)] } })} />
        </>}
      </> : <button disabled={disabled} onClick={() => patch({ type: 'fade-up', trigger: 'scroll', duration: 700, easing: 'ease-out' })} style={primaryMini}>Add animation</button>}
    </div>

    {ANIMATION_CATEGORIES.map((cat) => <div key={cat} style={sectionStyle}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>{cat}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
        {ANIMATION_PRESETS.filter((preset) => preset.category === cat).map((preset) => <button disabled={disabled} key={preset.type} onClick={() => onUpdate((n) => ({ ...n, animation: { type: preset.type, trigger: preset.trigger, duration: preset.defaultDuration, easing: preset.easing, params: preset.defaultParams } }))} title={preset.description} style={{ padding: '8px', border: `1px solid ${anim?.type === preset.type ? 'var(--primary)' : 'var(--border)'}`, background: anim?.type === preset.type ? 'var(--primary)' : 'var(--surface-alt)', color: anim?.type === preset.type ? 'var(--primary-text)' : 'var(--text)', borderRadius: 6, fontSize: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>{preset.icon} {preset.label}</button>)}
      </div>
    </div>)}
  </div>
}

function ScrollTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  const scroll = node.scrollBehavior || { mode: 'normal' as const }
  const patch = (data: Record<string, unknown>) => onUpdate((n) => ({ ...n, scrollBehavior: { ...scroll, ...data } as any }))
  const modes = ['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition']
  const sceneParams = scroll.params || {}
  const setSceneParam = (key: string, value: unknown) => patch({ params: { ...sceneParams, [key]: value } })
  return <div style={sectionStyle}>
    <label><span style={labelStyle}>Behavior</span><select disabled={disabled} value={scroll.mode} onChange={(e) => patch({ mode: e.target.value })} style={inputStyle}>{modes.map((v) => <option key={v}>{v}</option>)}</select></label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}><Field disabled={disabled} label="Sticky top" type="number" value={scroll.stickyTop ?? 0} onChange={(v) => patch({ stickyTop: Number(v) })} /><Field disabled={disabled} label="Stack order" type="number" value={scroll.stackOrder ?? 1} onChange={(v) => patch({ stackOrder: Number(v) })} /><Field disabled={disabled} label="Pin distance" type="number" value={scroll.pinDistance ?? 0} onChange={(v) => patch({ pinDistance: Number(v) })} /><Field disabled={disabled} label="Parallax speed" type="number" value={(scroll.params?.speed as number) ?? .25} onChange={(v) => patch({ params: { ...(scroll.params || {}), speed: Number(v) } })} /></div>
    {scroll.mode === 'section-cover' && <><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Cover entrance direction</span><select disabled={disabled} value={String(scroll.params?.direction ?? 'bottom')} onChange={(e) => patch({ params: { ...(scroll.params || {}), direction: e.target.value } })} style={inputStyle}>{['top','right','bottom','left'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Travel % viewport" type="number" value={Number(scroll.params?.distance ?? 100)} onChange={(v) => patch({ params: { ...(scroll.params || {}), distance: Math.max(10, Math.min(200, Number(v) || 100)) } })} /><Field disabled={disabled} label="Transition span %" type="number" value={Number(scroll.params?.span ?? 100)} onChange={(v) => patch({ params: { ...(scroll.params || {}), span: Math.max(20, Math.min(200, Number(v) || 100)) } })} /></div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>The section stays in normal document flow, then visually covers the previous sticky section from this edge as scroll progresses. Give successive sections increasing Stack order values.</div></>}
    {scroll.mode === 'scene-transition' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><strong style={{ fontSize: 11 }}>Scene choreography</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Put this panel directly inside a Scene Frame. Progress is derived from that frame, so forward and reverse scrolling stay pixel-perfect without React render loops.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><label><span style={labelStyle}>Enter from</span><select disabled={disabled} value={String(sceneParams.enterFrom ?? 'bottom')} onChange={(e) => setSceneParam('enterFrom', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((v) => <option key={v}>{v}</option>)}</select></label><label><span style={labelStyle}>Exit to</span><select disabled={disabled} value={String(sceneParams.exitTo ?? 'top')} onChange={(e) => setSceneParam('exitTo', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((v) => <option key={v}>{v}</option>)}</select></label><label><span style={labelStyle}>Entry effect</span><select disabled={disabled} value={String(sceneParams.entryEffect ?? 'slide')} onChange={(e) => setSceneParam('entryEffect', e.target.value)} style={inputStyle}><option value="slide">Slide</option><option value="wipe">Pixel wipe</option></select></label><Field disabled={disabled} label="Travel % viewport" type="number" value={Number(sceneParams.distance ?? 100)} onChange={(v) => setSceneParam('distance', Math.max(50, Math.min(160, Number(v) || 100)))} /><Field disabled={disabled} label="Bridge ends %" type="number" value={Number(sceneParams.bridgeEnd ?? 10)} onChange={(v) => setSceneParam('bridgeEnd', Math.max(0, Math.min(40, Number(v) || 0)))} /><Field disabled={disabled} label="Entry ends %" type="number" value={Number(sceneParams.enterEnd ?? 30)} onChange={(v) => setSceneParam('enterEnd', Math.max(5, Math.min(70, Number(v) || 30)))} /><Field disabled={disabled} label="Exit starts %" type="number" value={Number(sceneParams.exitStart ?? 68)} onChange={(v) => setSceneParam('exitStart', Math.max(30, Math.min(95, Number(v) || 68)))} /><Field disabled={disabled} label="Exit ends %" type="number" value={Number(sceneParams.exitEnd ?? 100)} onChange={(v) => setSceneParam('exitEnd', Math.max(60, Math.min(100, Number(v) || 100)))} /></div><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 8px' }}><input disabled={disabled} type="checkbox" checked={Boolean(sceneParams.skipEntry)} onChange={(e) => setSceneParam('skipEntry', e.target.checked)} />Start visible (use for the first scene behind Intro)</label><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(sceneParams.finalScene)} onChange={(e) => setSceneParam('finalScene', e.target.checked)} />Final scene: remain visible and release naturally</label></>}
    <label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Mobile fallback</span><select disabled={disabled} value={scroll.mobileFallback || 'normal'} onChange={(e) => patch({ mobileFallback: e.target.value })} style={inputStyle}>{modes.map((v) => <option key={v}>{v}</option>)}</select></label><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Reduced motion</span><select disabled={disabled} value={scroll.reducedMotionFallback || 'reduce'} onChange={(e) => patch({ reducedMotionFallback: e.target.value })} style={inputStyle}><option>none</option><option>skip</option><option>reduce</option></select></label><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><strong style={{ fontSize: 11 }}>Active scroll state</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Useful for Journey progress. When this node crosses the activation line, the runtime writes the configured value to state.</p><Field disabled={disabled} label="State key" value={scroll.activeStateKey || ''} onChange={(v) => patch({ activeStateKey: String(v) || undefined })} placeholder="journey.active" /><Field disabled={disabled} label="Viewport activation ratio" type="number" value={scroll.activeThreshold ?? .45} onChange={(v) => patch({ activeThreshold: Math.max(0, Math.min(1, Number(v))) })} /><JsonField disabled={disabled} label="Active value source" value={scroll.activeStateValue || { source: 'context', key: 'collectionPosition' }} onChange={(value) => patch({ activeStateValue: value })} />
  </div>
}

function LogicTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  return <div style={sectionStyle}><strong style={{ fontSize: 11 }}>Runtime interactions</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Actions run only in runtime/Preview, not while Admin is in editable-content mode. Use state to drive tabs, filters, toggles and active styles.</p><JsonField disabled={disabled} label="Interactions JSON" value={node.interactions || []} onChange={(value) => onUpdate((n) => ({ ...n, interactions: Array.isArray(value) ? value as any : [] }))} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>Click example: {'[{"event":"click","actions":[{"type":"set-state","key":"tech.category","value":{"source":"literal","value":"backend"}}]}]'}</div><JsonField disabled={disabled} label="Conditional styles JSON" value={node.conditionalStyles || []} onChange={(value) => onUpdate((n) => ({ ...n, conditionalStyles: Array.isArray(value) ? value as any : [] }))} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Active-style example: {'[{"when":{"left":{"source":"state","key":"tech.category"},"operator":"eq","right":{"source":"literal","value":"backend"}},"styles":{"desktop":{"background":"var(--site-primary)","color":"#fff"}}}]'}</div></div>
}

function PageTab({ page, pages, onUpdate, onUpdatePageState }: { page: EditorPage; pages: EditorPage[]; onUpdate: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void; onUpdatePageState: (initialState: Record<string, unknown>) => void }) {
  const routeConflict = page.pageType !== 'system' && pages.some((candidate) => candidate.id !== page.id && candidate.pageType !== 'system' && routePatternsConflict(candidate.routePattern, page.routePattern))
  const normalize = () => onUpdate({ routePattern: normalizeRoutePattern(page.routePattern, page.pageType) })
  return <div style={sectionStyle}><Field label="Page name" value={page.name} onChange={(v) => onUpdate({ name: String(v) })} /><Field label="Slug" value={page.slug} onChange={(v) => onUpdate({ slug: String(v).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} /><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Route pattern</span><input disabled={page.pageType === 'home' || page.pageType === 'system'} value={page.routePattern} onChange={(event) => onUpdate({ routePattern: event.target.value })} onBlur={normalize} placeholder="/projects/:slug" style={{ ...inputStyle, borderColor: routeConflict ? 'var(--danger)' : 'var(--border)' }} />{routeConflict && <small style={{ color: 'var(--danger)' }}>This route conflicts with another static/dynamic route shape.</small>}</label><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Page type</span><select value={page.pageType} onChange={(e) => { const pageType = e.target.value as EditorPage['pageType']; onUpdate({ pageType, routePattern: normalizeRoutePattern(page.routePattern, pageType) }) }} style={inputStyle}>{['standard', 'home', 'collection_index', 'collection_detail', 'system'].map((v) => <option key={v}>{v}</option>)}</select></label><JsonField label="Initial runtime state" value={page.schema.initialState || {}} onChange={(value) => onUpdatePageState(value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})} /><Field label="SEO title" value={String(page.seoDefaults?.title || '')} placeholder="Page title shown in search results" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), title: v } })} /><Field label="SEO description" value={String(page.seoDefaults?.description || '')} placeholder="Concise search/social description" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), description: v } })} /><Field label="Canonical URL" value={String(page.seoDefaults?.canonical || '')} placeholder="Optional; normally leave blank" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), canonical: v } })} /><Field label="Open Graph image URL" value={String(page.seoDefaults?.ogImage || '')} placeholder="Optional https://… image" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), ogImage: v } })} /><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}><input type="checkbox" checked={Boolean(page.seoDefaults?.noindex)} onChange={(e) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), noindex: e.target.checked } })} />Exclude this route from search indexing / sitemap</label></div>
}

function TokensTab({ tokens, onUpdate }: { tokens: DesignTokens; onUpdate: (tokens: DesignTokens) => void }) {
  const [newKey, setNewKey] = React.useState('--site-')
  const variables = tokens.variables || {}
  const updateVariables = (next: Record<string, string>) => onUpdate({ ...tokens, variables: next })
  return <div style={sectionStyle}><p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Layout design tokens belong to the website design. They are independent from the Studio application theme.</p><strong style={{ fontSize: 11 }}>Breakpoints</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, margin: '8px 0 14px' }}>{(['desktop', 'tablet', 'mobile'] as const).map((key) => <Field key={key} type="number" label={pretty(key)} value={tokens.breakpoints?.[key] ?? (key === 'desktop' ? 1440 : key === 'tablet' ? 768 : 375)} onChange={(value) => onUpdate({ ...tokens, breakpoints: { ...(tokens.breakpoints || {}), [key]: Math.max(240, Number(value)) } })} />)}</div><strong style={{ fontSize: 11 }}>Fonts</strong><div style={{ marginTop: 8 }}><Field label="Heading font" value={tokens.fonts?.heading || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), heading: String(value) } })} /><Field label="Body font" value={tokens.fonts?.body || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), body: String(value) } })} /></div><strong style={{ fontSize: 11 }}>CSS variables</strong><div style={{ marginTop: 8 }}>{Object.entries(variables).map(([key, value]) => <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 5, marginBottom: 6 }}><input value={key} readOnly style={{ ...inputStyle, color: 'var(--text-muted)' }} /><input value={value} onChange={(e) => updateVariables({ ...variables, [key]: e.target.value })} style={inputStyle} /><button onClick={() => { const next = { ...variables }; delete next[key]; updateVariables(next) }} style={dangerMini}>×</button></div>)}</div><div style={{ display: 'flex', gap: 6, marginTop: 10 }}><input value={newKey} onChange={(e) => setNewKey(e.target.value)} style={inputStyle} /><button onClick={() => { if (newKey && !variables[newKey]) updateVariables({ ...variables, [newKey]: '#ffffff' }) }} style={primaryMini}>Add</button></div></div>
}

function JsonField({ label, value, onChange, disabled }: { label: string; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  const [draft, setDraft] = React.useState(() => JSON.stringify(value) ?? '')
  React.useEffect(() => setDraft(JSON.stringify(value) ?? ''), [value])
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><textarea disabled={disabled} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { try { onChange(JSON.parse(draft || 'null')) } catch { /* keep invalid draft visible until corrected */ } }} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
}


function MultilineField({ label, value, onChange, placeholder, disabled = false, rows = 4 }: { label: string; value: any; onChange: (v: any) => void; placeholder?: string; disabled?: boolean; rows?: number }) {
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><textarea disabled={disabled} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, minHeight: rows * 22, resize: 'vertical', lineHeight: 1.45, fontFamily: 'inherit' }} /><div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)' }}>Enter creates a new line. Line breaks are preserved in the layout.</div></label>
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled = false, list }: { label: string; value: any; onChange: (v: any) => void; placeholder?: string; type?: string; disabled?: boolean; list?: string }) {
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><input disabled={disabled} list={list} type={type} value={value as any} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={placeholder} style={inputStyle} /></label>
}
function pretty(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()) }
function placeholder(key: string) { if (['width', 'height', 'margin', 'padding', 'gap', 'top', 'left', 'right', 'bottom', 'fontSize', 'borderRadius'].includes(key)) return 'e.g. 24px / 100%'; if (['borderTop','borderRight','borderBottom','borderLeft'].includes(key)) return 'e.g. 1px solid #232329'; if (key === 'background') return 'color / gradient / image'; if (key === 'transform') return 'translate / rotate / scale'; return '' }
const primaryMini: React.CSSProperties = { padding: '6px 9px', border: 0, borderRadius: 5, background: 'var(--primary)', color: 'var(--primary-text)', fontSize: 10, cursor: 'pointer' }
const dangerMini: React.CSSProperties = { padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer' }
