import React from 'react'
import type { Binding, DesignTokens, EditorPage, ResponsiveMode, StudioNode } from '@platform/contracts'
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

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 11 }
const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const sectionStyle: React.CSSProperties = { padding: '12px 12px', borderBottom: '1px solid var(--border)' }

const STYLE_GROUPS: { title: string; props: string[] }[] = [
  { title: 'Layout', props: ['display', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'margin', 'padding', 'boxSizing', 'overflow', 'aspectRatio'] },
  { title: 'Flexbox', props: ['flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'gap', 'rowGap', 'columnGap', 'flexGrow', 'flexShrink', 'flexBasis', 'order'] },
  { title: 'Grid', props: ['gridTemplateColumns', 'gridTemplateRows', 'gridAutoFlow', 'gridColumn', 'gridRow', 'placeItems', 'placeContent'] },
  { title: 'Position', props: ['position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex'] },
  { title: 'Typography', props: ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'color', 'textDecoration', 'textTransform', 'textShadow', 'WebkitTextStroke'] },
  { title: 'Background', props: ['background', 'backgroundColor', 'backgroundImage', 'backgroundPosition', 'backgroundSize', 'backgroundRepeat', 'backgroundAttachment', 'backgroundBlendMode'] },
  { title: 'Borders & Effects', props: ['border', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius', 'boxShadow', 'opacity', 'outline'] },
  { title: 'Media', props: ['objectFit', 'objectPosition', 'imageRendering'] },
  { title: 'Transform / 3D', props: ['transform', 'transformOrigin', 'transformStyle', 'perspective', 'perspectiveOrigin', 'backfaceVisibility'] },
  { title: 'Filters', props: ['filter', 'backdropFilter', 'mixBlendMode'] },
  { title: 'Advanced', props: ['clipPath', 'maskImage', 'offsetPath', 'transition', 'willChange', 'contain', 'contentVisibility', 'scrollSnapType', 'scrollSnapAlign', 'cursor', 'pointerEvents'] },
]

type UpdateNode = (u: (n: StudioNode) => StudioNode) => void

export function Inspector({ node, mode, page, pages, onUpdateNode, onSetNodeLocked, onUpdatePage, onUpdateTokens, designTokens, mediaOptions, bindingSuggestions }: {
  node: StudioNode | null
  mode: ResponsiveMode
  page: EditorPage
  pages: EditorPage[]
  onUpdateNode: UpdateNode
  onSetNodeLocked: (locked: boolean) => void
  onUpdatePage: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void
  onUpdateTokens: (tokens: DesignTokens) => void
  designTokens: DesignTokens
  mediaOptions: StudioMediaOption[]
  bindingSuggestions: string[]
}) {
  const [tab, setTab] = React.useState<'style' | 'content' | 'props' | 'animation' | 'scroll' | 'page' | 'tokens'>('style')
  React.useEffect(() => { if (!node && ['style', 'content', 'props', 'animation', 'scroll'].includes(tab)) setTab('page') }, [node, tab])
  const tabs = [['style', 'Style'], ['content', 'Content'], ['props', 'Props'], ['animation', 'Animation'], ['scroll', 'Scroll'], ['page', 'Page'], ['tokens', 'Tokens']] as const
  const locked = Boolean(node?.meta?.locked)
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} disabled={!node && ['style', 'content', 'props', 'animation', 'scroll'].includes(key)} style={{ padding: '8px 3px', fontSize: 10, border: 0, borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', background: 'transparent', color: tab === key ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer' }}>{label}</button>)}
    </div>
    {locked && node && tab !== 'props' && <div style={{ padding: '8px 12px', fontSize: 10, color: 'var(--warning)', borderBottom: '1px solid var(--border)' }}>This layer is locked. Unlock it in Props to edit it.</div>}
    <div style={{ flex: 1, overflow: 'auto' }}>
      {tab === 'style' && node && <StyleTab node={node} mode={mode} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'content' && node && <ContentTab node={node} page={page} onUpdate={onUpdateNode} disabled={locked} mediaOptions={mediaOptions} bindingSuggestions={bindingSuggestions} />}
      {tab === 'props' && node && <PropsTab node={node} onUpdate={onUpdateNode} onSetLocked={onSetNodeLocked} disabled={locked} />}
      {tab === 'animation' && node && <AnimationTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'scroll' && node && <ScrollTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'page' && <PageTab page={page} pages={pages} onUpdate={onUpdatePage} />}
      {tab === 'tokens' && <TokensTab tokens={designTokens} onUpdate={onUpdateTokens} />}
    </div>
  </div>
}

function StyleTab({ node, mode, onUpdate, disabled }: { node: StudioNode; mode: ResponsiveMode; onUpdate: UpdateNode; disabled: boolean }) {
  const styles = { ...(node.styles?.[mode] || {}) } as Record<string, unknown>
  const set = (key: string, value: string) => onUpdate((n) => ({ ...n, styles: { ...n.styles, [mode]: { ...(n.styles[mode] || {}), [key]: value === '' ? undefined : value } } }))
  return <>
    <div style={sectionStyle}><strong style={{ fontSize: 11 }}>Responsive styles</strong><div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Editing {mode}. Tablet and Mobile inherit from larger breakpoints.</div></div>
    {STYLE_GROUPS.map((group) => <details key={group.title} open={['Layout', 'Typography', 'Background'].includes(group.title)} style={sectionStyle}><summary style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>{group.title}</summary><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>{group.props.map((key) => <label key={key}><span style={labelStyle}>{pretty(key)}</span><input disabled={disabled} value={String(styles[key] ?? '')} onChange={(e) => set(key, e.target.value)} placeholder={placeholder(key)} style={inputStyle} /></label>)}</div></details>)}
  </>
}

function bindingPropsForNode(node: StudioNode): string[] {
  if (node.type === 'collection') return ['items']
  const tag = node.tag || node.type
  if (tag === 'img' || node.type === 'image' || tag === 'video' || tag === 'audio') return ['src', 'alt']
  if (tag === 'a') return ['text', 'href']
  if (tag === 'button') return ['text']
  if (tag === 'input' || tag === 'textarea') return ['placeholder']
  return ['text']
}

function ContentTab({ node, page, onUpdate, disabled, mediaOptions, bindingSuggestions }: { node: StudioNode; page: EditorPage; onUpdate: UpdateNode; disabled: boolean; mediaOptions: StudioMediaOption[]; bindingSuggestions: string[] }) {
  const props = bindingPropsForNode(node)
  const [property, setProperty] = React.useState(props[0])
  React.useEffect(() => { if (!props.includes(property)) setProperty(props[0]) }, [node.id, property, props])
  const binding = node.bindings?.[property]
  const source = binding?.type || (node.type === 'collection' ? 'collection' : 'static')
  const setBinding = (next: Binding | undefined) => onUpdate((n) => { const bindings = { ...(n.bindings || {}) }; if (next) bindings[property] = next; else delete bindings[property]; return { ...n, bindings } })
  const setStatic = (value: unknown) => onUpdate((n) => ({ ...n, props: { ...(n.props || {}), [property]: value }, bindings: { ...(n.bindings || {}), [property]: { type: 'static', value } } }))
  const changeSource = (value: string) => {
    const existing = node.props?.[property] ?? ''
    if (value === 'static') setStatic(existing)
    if (value === 'content') { const part = String(node.meta?.sectionLabel || node.meta?.adminLabel || node.meta?.label || node.type).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); setBinding({ type: 'content', key: `${page.slug}.${part}.${property}`.replace(/\.+/g, '.'), label: node.meta?.adminLabel || node.meta?.label || pretty(property), contentType: property === 'src' ? 'media' : property === 'href' ? 'url' : 'text', sample: existing }) }
    if (value === 'setting') setBinding({ type: 'setting', key: '', label: pretty(property), sample: existing })
    if (value === 'media') setBinding({ type: 'media', sampleUrl: String(existing || '') })
    if (value === 'field') setBinding({ type: 'field', field: property === 'text' ? 'title' : property })
    if (value === 'collection') setBinding({ type: 'collection', collection: String(node.props?.collection || 'projects'), limit: 6 })
  }
  const patch = (data: Record<string, unknown>) => setBinding({ ...binding, ...data } as Binding)
  const keyListId = `binding-keys-${node.id}-${property}`
  const mediaBinding = binding?.type === 'media' ? binding : null
  return <div style={sectionStyle}>
    <div style={{ marginBottom: 10 }}><label style={labelStyle}>Bindable property</label><select disabled={disabled} value={property} onChange={(e) => setProperty(e.target.value)} style={inputStyle}>{props.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}</select></div>
    <div style={{ marginBottom: 12 }}><label style={labelStyle}>Content source</label><select disabled={disabled} value={source} onChange={(e) => changeSource(e.target.value)} style={inputStyle}>{node.type === 'collection' ? <option value="collection">Collection</option> : <><option value="static">Static / design content</option><option value="content">Editable Content</option><option value="setting">Site Setting</option><option value="media">Media Reference</option><option value="field">Collection Field</option></>}</select></div>
    {source === 'static' && <Field disabled={disabled} label="Static value" value={binding?.type === 'static' ? binding.value : node.props?.[property] ?? ''} onChange={setStatic} />}
    {binding?.type === 'content' && <>
      <Field disabled={disabled} label="Admin label" value={binding.label || ''} onChange={(v) => patch({ label: String(v) })} />
      <Field disabled={disabled} list={keyListId} label="Content key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="home.hero.heading" />
      <datalist id={keyListId}>{bindingSuggestions.map((key) => <option key={key} value={key} />)}</datalist>
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Content type</span><select disabled={disabled} value={binding.contentType || 'text'} onChange={(e) => patch({ contentType: e.target.value })} style={inputStyle}>{['text', 'richtext', 'url', 'number', 'boolean', 'media', 'button', 'json'].map((v) => <option key={v}>{v}</option>)}</select></label>
      <Field disabled={disabled} label="Sample / dummy value" value={binding.sample ?? ''} onChange={(v) => patch({ sample: v })} /><Field disabled={disabled} label="Fallback" value={binding.fallback ?? ''} onChange={(v) => patch({ fallback: v })} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, margin: '10px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(binding.required)} onChange={(e) => patch({ required: e.target.checked })} /> Required before release activation</label>
      <Field disabled={disabled} label="Description" value={binding.description || ''} onChange={(v) => patch({ description: String(v) })} />
    </>}
    {binding?.type === 'setting' && <><Field disabled={disabled} list={keyListId} label="Setting key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="site.social.github" /><datalist id={keyListId}>{bindingSuggestions.map((key) => <option key={key} value={key} />)}</datalist><Field disabled={disabled} label="Sample value" value={binding.sample ?? ''} onChange={(v) => patch({ sample: v })} /></>}
    {mediaBinding && <>
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Choose media</span><select disabled={disabled} value={mediaBinding.mediaId || ''} onChange={(event) => { const selected = mediaOptions.find((item) => item.id === event.target.value); patch({ mediaId: selected?.id || undefined, sampleUrl: selected?.public_url || selected?.url || mediaBinding.sampleUrl || '' }) }} style={inputStyle}><option value="">No canonical media selected</option>{mediaOptions.map((item) => <option key={item.id} value={item.id}>{item.filename} · {item.kind || item.mime_type || 'file'}</option>)}</select></label>
      <Field disabled={disabled} label="Media ID" value={mediaBinding.mediaId || ''} onChange={(v) => patch({ mediaId: String(v) })} /><Field disabled={disabled} label="Sample URL" value={mediaBinding.sampleUrl || ''} onChange={(v) => patch({ sampleUrl: String(v) })} />
    </>}
    {binding?.type === 'field' && <Field disabled={disabled} label="Collection field" value={binding.field} onChange={(v) => patch({ field: String(v) })} placeholder="title" />}
    {binding?.type === 'collection' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Collection</span><select disabled={disabled} value={binding.collection} onChange={(e) => patch({ collection: e.target.value })} style={inputStyle}>{['projects', 'notes', 'experience', 'apps'].map((v) => <option key={v}>{v}</option>)}</select></label><Field disabled={disabled} label="Limit" value={binding.limit || 6} type="number" onChange={(v) => patch({ limit: Number(v) })} /><JsonField disabled={disabled} label="Filters JSON" value={binding.filters || []} onChange={(value) => patch({ filters: value })} /><JsonField disabled={disabled} label="Sort JSON" value={binding.sort || []} onChange={(value) => patch({ sort: value })} /></>}
  </div>
}

function PropsTab({ node, onUpdate, onSetLocked, disabled }: { node: StudioNode; onUpdate: UpdateNode; onSetLocked: (locked: boolean) => void; disabled: boolean }) {
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
    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>HTML props</div>{['text', 'href', 'src', 'alt', 'placeholder', 'target', 'rel', 'type'].map((key) => <Field disabled={disabled} key={key} label={pretty(key)} value={node.props?.[key] ?? ''} onChange={(v) => setProp(key, v)} />)}
  </div>
}

function AnimationTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  const anim = node.animation
  const patch = (data: Record<string, unknown>) => onUpdate((n) => ({ ...n, animation: { type: anim?.type || 'fade', trigger: anim?.trigger || 'scroll', duration: anim?.duration || 700, easing: anim?.easing || 'ease-out', ...anim, ...data } as any }))
  return <div><div style={sectionStyle}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 11 }}>Animation</strong>{anim && <button disabled={disabled} onClick={() => onUpdate((n) => { const next = { ...n }; delete next.animation; return next })} style={dangerMini}>Remove</button>}</div>{anim ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}><Field disabled={disabled} label="Duration ms" type="number" value={anim.duration || 700} onChange={(v) => patch({ duration: Number(v) })} /><Field disabled={disabled} label="Delay ms" type="number" value={anim.delay || 0} onChange={(v) => patch({ delay: Number(v) })} /><label><span style={labelStyle}>Trigger</span><select disabled={disabled} value={anim.trigger} onChange={(e) => patch({ trigger: e.target.value })} style={inputStyle}>{getAllowedAnimationTriggers(anim.type).map((v) => <option key={v}>{v}</option>)}</select></label><label><span style={labelStyle}>Easing</span><select disabled={disabled} value={anim.easing || 'ease-out'} onChange={(e) => patch({ easing: e.target.value })} style={inputStyle}>{['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'spring'].map((v) => <option key={v}>{v}</option>)}</select></label></div> : <button disabled={disabled} onClick={() => patch({ type: 'fade-up', trigger: 'scroll', duration: 700, easing: 'ease-out' })} style={primaryMini}>Add animation</button>}</div>{ANIMATION_CATEGORIES.map((cat) => <div key={cat} style={sectionStyle}><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>{cat}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>{ANIMATION_PRESETS.filter((preset) => preset.category === cat).map((preset) => <button disabled={disabled} key={preset.type} onClick={() => onUpdate((n) => ({ ...n, animation: { type: preset.type, trigger: preset.trigger, duration: preset.defaultDuration, easing: preset.easing, params: preset.defaultParams } }))} title={preset.description} style={{ padding: '8px', border: `1px solid ${anim?.type === preset.type ? 'var(--primary)' : 'var(--border)'}`, background: anim?.type === preset.type ? 'var(--primary)' : 'var(--surface-alt)', color: anim?.type === preset.type ? 'var(--primary-text)' : 'var(--text)', borderRadius: 6, fontSize: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>{preset.icon} {preset.label}</button>)}</div></div>)}</div>
}

function ScrollTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  const scroll = node.scrollBehavior || { mode: 'normal' as const }
  const patch = (data: Record<string, unknown>) => onUpdate((n) => ({ ...n, scrollBehavior: { ...scroll, ...data } as any }))
  return <div style={sectionStyle}><label><span style={labelStyle}>Behavior</span><select disabled={disabled} value={scroll.mode} onChange={(e) => patch({ mode: e.target.value })} style={inputStyle}>{['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal'].map((v) => <option key={v}>{v}</option>)}</select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}><Field disabled={disabled} label="Sticky top" type="number" value={scroll.stickyTop ?? 0} onChange={(v) => patch({ stickyTop: Number(v) })} /><Field disabled={disabled} label="Stack order" type="number" value={scroll.stackOrder ?? 1} onChange={(v) => patch({ stackOrder: Number(v) })} /><Field disabled={disabled} label="Pin distance" type="number" value={scroll.pinDistance ?? 0} onChange={(v) => patch({ pinDistance: Number(v) })} /><Field disabled={disabled} label="Parallax speed" type="number" value={(scroll.params?.speed as number) ?? .25} onChange={(v) => patch({ params: { ...(scroll.params || {}), speed: Number(v) } })} /></div><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Mobile fallback</span><select disabled={disabled} value={scroll.mobileFallback || 'normal'} onChange={(e) => patch({ mobileFallback: e.target.value })} style={inputStyle}>{['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal'].map((v) => <option key={v}>{v}</option>)}</select></label><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Reduced motion</span><select disabled={disabled} value={scroll.reducedMotionFallback || 'reduce'} onChange={(e) => patch({ reducedMotionFallback: e.target.value })} style={inputStyle}><option>none</option><option>skip</option><option>reduce</option></select></label></div>
}

function PageTab({ page, pages, onUpdate }: { page: EditorPage; pages: EditorPage[]; onUpdate: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void }) {
  const routeConflict = page.pageType !== 'system' && pages.some((candidate) => candidate.id !== page.id && candidate.pageType !== 'system' && routePatternsConflict(candidate.routePattern, page.routePattern))
  const normalize = () => onUpdate({ routePattern: normalizeRoutePattern(page.routePattern, page.pageType) })
  return <div style={sectionStyle}><Field label="Page name" value={page.name} onChange={(v) => onUpdate({ name: String(v) })} /><Field label="Slug" value={page.slug} onChange={(v) => onUpdate({ slug: String(v).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} /><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Route pattern</span><input disabled={page.pageType === 'home' || page.pageType === 'system'} value={page.routePattern} onChange={(event) => onUpdate({ routePattern: event.target.value })} onBlur={normalize} placeholder="/projects/:slug" style={{ ...inputStyle, borderColor: routeConflict ? 'var(--danger)' : 'var(--border)' }} />{routeConflict && <small style={{ color: 'var(--danger)' }}>This route conflicts with another static/dynamic route shape.</small>}</label><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Page type</span><select value={page.pageType} onChange={(e) => { const pageType = e.target.value as EditorPage['pageType']; onUpdate({ pageType, routePattern: normalizeRoutePattern(page.routePattern, pageType) }) }} style={inputStyle}>{['standard', 'home', 'collection_index', 'collection_detail', 'system'].map((v) => <option key={v}>{v}</option>)}</select></label><Field label="SEO title" value={String(page.seoDefaults?.title || '')} placeholder="Page title shown in search results" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), title: v } })} /><Field label="SEO description" value={String(page.seoDefaults?.description || '')} placeholder="Concise search/social description" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), description: v } })} /><Field label="Canonical URL" value={String(page.seoDefaults?.canonical || '')} placeholder="Optional; normally leave blank" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), canonical: v } })} /><Field label="Open Graph image URL" value={String(page.seoDefaults?.ogImage || '')} placeholder="Optional https://… image" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), ogImage: v } })} /><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}><input type="checkbox" checked={Boolean(page.seoDefaults?.noindex)} onChange={(e) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), noindex: e.target.checked } })} />Exclude this route from search indexing / sitemap</label></div>
}

function TokensTab({ tokens, onUpdate }: { tokens: DesignTokens; onUpdate: (tokens: DesignTokens) => void }) {
  const [newKey, setNewKey] = React.useState('--site-')
  const variables = tokens.variables || {}
  const updateVariables = (next: Record<string, string>) => onUpdate({ ...tokens, variables: next })
  return <div style={sectionStyle}><p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Layout design tokens belong to the website design. They are independent from the Studio application theme.</p><strong style={{ fontSize: 11 }}>Breakpoints</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, margin: '8px 0 14px' }}>{(['desktop', 'tablet', 'mobile'] as const).map((key) => <Field key={key} type="number" label={pretty(key)} value={tokens.breakpoints?.[key] ?? (key === 'desktop' ? 1440 : key === 'tablet' ? 768 : 375)} onChange={(value) => onUpdate({ ...tokens, breakpoints: { ...(tokens.breakpoints || {}), [key]: Math.max(240, Number(value)) } })} />)}</div><strong style={{ fontSize: 11 }}>Fonts</strong><div style={{ marginTop: 8 }}><Field label="Heading font" value={tokens.fonts?.heading || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), heading: String(value) } })} /><Field label="Body font" value={tokens.fonts?.body || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), body: String(value) } })} /></div><strong style={{ fontSize: 11 }}>CSS variables</strong><div style={{ marginTop: 8 }}>{Object.entries(variables).map(([key, value]) => <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 5, marginBottom: 6 }}><input value={key} readOnly style={{ ...inputStyle, color: 'var(--text-muted)' }} /><input value={value} onChange={(e) => updateVariables({ ...variables, [key]: e.target.value })} style={inputStyle} /><button onClick={() => { const next = { ...variables }; delete next[key]; updateVariables(next) }} style={dangerMini}>×</button></div>)}</div><div style={{ display: 'flex', gap: 6, marginTop: 10 }}><input value={newKey} onChange={(e) => setNewKey(e.target.value)} style={inputStyle} /><button onClick={() => { if (newKey && !variables[newKey]) updateVariables({ ...variables, [newKey]: '#ffffff' }) }} style={primaryMini}>Add</button></div></div>
}

function JsonField({ label, value, onChange, disabled }: { label: string; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  const [draft, setDraft] = React.useState(() => JSON.stringify(value))
  React.useEffect(() => setDraft(JSON.stringify(value)), [value])
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><textarea disabled={disabled} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { try { onChange(JSON.parse(draft || 'null')) } catch { /* keep invalid draft visible until corrected */ } }} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled = false, list }: { label: string; value: any; onChange: (v: any) => void; placeholder?: string; type?: string; disabled?: boolean; list?: string }) {
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><input disabled={disabled} list={list} type={type} value={value as any} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} placeholder={placeholder} style={inputStyle} /></label>
}
function pretty(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()) }
function placeholder(key: string) { if (['width', 'height', 'margin', 'padding', 'gap', 'top', 'left', 'right', 'bottom', 'fontSize', 'borderRadius'].includes(key)) return 'e.g. 24px / 100%'; if (key === 'background') return 'color / gradient / image'; if (key === 'transform') return 'translate / rotate / scale'; return '' }
const primaryMini: React.CSSProperties = { padding: '6px 9px', border: 0, borderRadius: 5, background: 'var(--primary)', color: 'var(--primary-text)', fontSize: 10, cursor: 'pointer' }
const dangerMini: React.CSSProperties = { padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer' }
