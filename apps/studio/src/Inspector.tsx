import React from 'react'
import { DEFAULT_PREVIEW_WIDTHS, DEFAULT_RESPONSIVE_THRESHOLDS, isSafeCssCustomPropertyName, isSafeRuntimeStyleProperty, resolveResponsiveLayout, resolveReducedMotionScrollFallback, resolveResponsiveScrollMode, type Binding, type CollectionBinding, type PaginationPagesBinding, type CssPropertyRegistration, type DesignTokens, type EditorPage, type KeyframeDefinition, type NodeLayoutOverride, type ResponsiveMode, type RuntimeCondition, type RuntimeFieldScope, type ScrollBehaviorMode, type StudioNode, type StyleMap } from '@platform/contracts'
import { ANIMATION_CATEGORIES, ANIMATION_PRESETS, CUSTOM_KEYFRAME_ANIMATION_TYPE, getAllowedAnimationTriggers, normalizeRoutePattern, routePatternsConflict } from '@platform/builder-core'
import { STYLE_PROPERTY_GROUPS, STYLE_PROPERTY_KEYS, stylePropertyPlaceholder, type StudioStylePropertyDefinition } from './style-properties'
import { CollectionQueryControls, RuntimeInteractionsEditor } from './RuntimeQueryControls'

export interface StudioMediaOption {
  id: string
  filename: string
  public_url?: string | null
  url?: string | null
  mime_type?: string | null
  kind?: string | null
  alt_text?: string | null
}

export interface StudioCollectionFieldOption {
  key: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  itemFields?: StudioCollectionFieldOption[]
  itemLabelField?: string
}

export interface StudioCollectionOption {
  id: string
  label: string
  builtin?: boolean
  fields?: StudioCollectionFieldOption[]
}

function flattenCollectionFieldKeys(fields: StudioCollectionFieldOption[] | undefined, prefix = ''): string[] {
  const values = new Set<string>()
  const visit = (items: StudioCollectionFieldOption[] | undefined, pathPrefix: string) => {
    for (const field of items || []) {
      const key = pathPrefix ? `${pathPrefix}.${field.key}` : field.key
      values.add(key)
      if (field.type !== 'array' && field.itemFields?.length) visit(field.itemFields, key)
    }
  }
  visit(fields, prefix)
  return [...values].sort()
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 11 }
const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const sectionStyle: React.CSSProperties = { padding: '12px 12px', borderBottom: '1px solid var(--border)' }

type UpdateNode = (u: (n: StudioNode) => StudioNode) => void

export function Inspector({ node, mode, page, pages, onUpdateNode, onSetNodeLocked, onUpdatePage, onUpdatePageState, onUpdatePageCollectionName, onWireProjectsQuery, onUpdateTokens, designTokens, mediaOptions, collectionOptions, bindingSuggestions }: {
  node: StudioNode | null
  mode: ResponsiveMode
  page: EditorPage
  pages: EditorPage[]
  onUpdateNode: UpdateNode
  onSetNodeLocked: (locked: boolean) => void
  onUpdatePage: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void
  onUpdatePageState: (initialState: Record<string, unknown>) => void
  onUpdatePageCollectionName: (collectionName: string | undefined) => void
  onWireProjectsQuery: () => { changed: boolean; message: string }
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
      {tab === 'props' && node && <PropsTab node={node} mode={mode} onUpdate={onUpdateNode} onSetLocked={onSetNodeLocked} disabled={locked} mediaOptions={mediaOptions} />}
      {tab === 'animation' && node && <AnimationTab node={node} designTokens={designTokens} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'scroll' && node && <ScrollTab node={node} mode={mode} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'logic' && node && <LogicTab node={node} onUpdate={onUpdateNode} disabled={locked} />}
      {tab === 'page' && <PageTab page={page} pages={pages} collectionOptions={collectionOptions} onUpdate={onUpdatePage} onUpdatePageState={onUpdatePageState} onUpdatePageCollectionName={onUpdatePageCollectionName} onWireProjectsQuery={onWireProjectsQuery} />}
      {tab === 'tokens' && <TokensTab tokens={designTokens} onUpdate={onUpdateTokens} />}
    </div>
  </div>
}

function StylePropertyControl({ definition, value, onChange, disabled }: { definition: StudioStylePropertyDefinition; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const label = definition.label || pretty(definition.key)
  const fieldStyle: React.CSSProperties | undefined = definition.wide ? { gridColumn: '1 / -1' } : undefined
  return <label style={fieldStyle}>
    <span style={labelStyle}>{label}</span>
    {definition.control === 'select'
      ? <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
          <option value="">Inherit / unset</option>
          {(definition.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      : <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={definition.placeholder || stylePropertyPlaceholder(definition.key)} style={inputStyle} />}
    {definition.description ? <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{definition.description}</span> : null}
  </label>
}

function StyleTab({ node, mode, onUpdate, disabled }: { node: StudioNode; mode: ResponsiveMode; onUpdate: UpdateNode; disabled: boolean }) {
  const styles = { ...(node.styles?.[mode] || {}) } as Record<string, unknown>
  const [newVariableName, setNewVariableName] = React.useState('')
  const [newVariableValue, setNewVariableValue] = React.useState('')
  const [newVariableError, setNewVariableError] = React.useState('')
  const [advancedPropertyName, setAdvancedPropertyName] = React.useState('')
  const [advancedPropertyValue, setAdvancedPropertyValue] = React.useState('')
  const [advancedPropertyError, setAdvancedPropertyError] = React.useState('')
  React.useEffect(() => {
    setNewVariableName(''); setNewVariableValue(''); setNewVariableError('')
    setAdvancedPropertyName(''); setAdvancedPropertyValue(''); setAdvancedPropertyError('')
  }, [node.id, mode])
  const set = (key: string, value: string) => onUpdate((n) => {
    if (!isSafeRuntimeStyleProperty(key)) return n
    const breakpointStyles = { ...(n.styles[mode] || {}) }
    if (value === '') delete breakpointStyles[key]
    else breakpointStyles[key] = value
    return { ...n, styles: { ...n.styles, [mode]: breakpointStyles } }
  })
  const customVariables = Object.entries(styles)
    .filter(([key]) => key.startsWith('--') && isSafeCssCustomPropertyName(key))
    .sort(([a], [b]) => a.localeCompare(b))
  const advancedProperties = Object.entries(styles)
    .filter(([key]) => !key.startsWith('--') && key !== 'display' && !STYLE_PROPERTY_KEYS.has(key) && isSafeRuntimeStyleProperty(key))
    .sort(([a], [b]) => a.localeCompare(b))
  const addCustomProperty = () => {
    const rawName = advancedPropertyName.trim()
    if (!rawName) { setAdvancedPropertyError('Enter a CSS property name.'); return }
    const normalizedName = rawName.startsWith('--') ? rawName : rawName.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase())
    if (!isSafeRuntimeStyleProperty(normalizedName)) {
      setAdvancedPropertyError('Use a safe React CSS property in camelCase.')
      return
    }
    if (normalizedName.startsWith('--')) { setAdvancedPropertyError('Add CSS variables in the CSS Variables section.'); return }
    if (!advancedPropertyValue.trim()) { setAdvancedPropertyError('Enter a value before adding the property.'); return }
    set(normalizedName, advancedPropertyValue)
    setAdvancedPropertyName('')
    setAdvancedPropertyValue('')
    setAdvancedPropertyError('')
  }
  return <>
    <div style={sectionStyle}>
      <strong style={{ fontSize: 11 }}>Responsive styles</strong>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Editing {mode}. Tablet and Mobile inherit from larger breakpoints. Clearing a value restores inheritance.</div>
      <label style={{ display: 'block', marginTop: 10 }}><span style={labelStyle}>Breakpoint display / visibility</span><select disabled={disabled} value={String(styles.display ?? '')} onChange={(event) => set('display', event.target.value)} style={inputStyle}><option value="">Inherit from larger breakpoint</option><option value="none">Hidden — display: none</option><option value="block">Block</option><option value="flex">Flex</option><option value="grid">Grid</option><option value="inline">Inline</option><option value="inline-block">Inline block</option><option value="inline-flex">Inline flex</option></select></label>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 5 }}>Use Hidden to remove the element only at this breakpoint without deleting the node.</div>
    </div>
    {STYLE_PROPERTY_GROUPS.map((group) => <details key={group.title} open={Boolean(group.openByDefault)} style={sectionStyle}>
      <summary style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>{group.title}</summary>
      {group.description ? <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 9px' }}>{group.description}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {group.properties.map((definition) => <StylePropertyControl key={definition.key} definition={definition} disabled={disabled} value={String(styles[definition.key] ?? '')} onChange={(value) => set(definition.key, value)} />)}
      </div>
    </details>)}
    <details style={sectionStyle}>
      <summary style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>CSS Variables</summary>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 9 }}>Variables are stored on the selected {mode} breakpoint and can be used with <code>var(--name)</code> in any style value.</div>
      {customVariables.length ? <div style={{ display: 'grid', gap: 7, marginBottom: 10 }}>{customVariables.map(([key, value]) => <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,.8fr) 1.3fr auto', gap: 6, alignItems: 'end' }}><label><span style={labelStyle}>Variable</span><input disabled value={key} style={inputStyle} /></label><label><span style={labelStyle}>Value</span><input disabled={disabled} value={String(value ?? '')} onChange={(event) => set(key, event.target.value)} style={inputStyle} /></label><button disabled={disabled} type="button" onClick={() => set(key, '')} style={{ ...dangerMini, height: 31 }} aria-label={`Remove ${key}`}>×</button></div>)}</div> : <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 9 }}>No node-level variables at this breakpoint.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,.8fr) 1.3fr', gap: 7 }}><label><span style={labelStyle}>Variable name</span><input disabled={disabled} value={newVariableName} onChange={(event) => { setNewVariableName(event.target.value); setNewVariableError('') }} placeholder="--glow-color" style={inputStyle} /></label><label><span style={labelStyle}>Value</span><input disabled={disabled} value={newVariableValue} onChange={(event) => { setNewVariableValue(event.target.value); setNewVariableError('') }} placeholder="rgba(124,58,237,.8)" style={inputStyle} /></label></div>
      <button disabled={disabled} type="button" onClick={() => { const raw = newVariableName.trim(); const name = raw.startsWith('--') ? raw : `--${raw.replace(/[^A-Za-z0-9_-]+/g, '-')}`; if (!isSafeCssCustomPropertyName(name)) { setNewVariableError('CSS variable names must start with -- and contain letters, numbers, _ or -.'); return } if (!newVariableValue.trim()) { setNewVariableError('Enter a value before adding the variable.'); return } set(name, newVariableValue); setNewVariableName(''); setNewVariableValue(''); setNewVariableError('') }} style={{ ...primaryMini, marginTop: 8 }}>Add variable</button>
      {newVariableError ? <div style={{ color: 'var(--danger)', fontSize: 9, marginTop: 6 }}>{newVariableError}</div> : null}
    </details>
    <details style={sectionStyle}>
      <summary style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>Advanced CSS Property</summary>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 9 }}>Escape hatch for safe React CSS properties not yet listed above. Use camelCase, for example <code>paintOrder</code>. Existing unknown safe properties remain editable here.</div>
      {advancedProperties.length ? <div style={{ display: 'grid', gap: 7, marginBottom: 10 }}>{advancedProperties.map(([key, value]) => <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,.8fr) 1.3fr auto', gap: 6, alignItems: 'end' }}><label><span style={labelStyle}>Property</span><input disabled value={key} style={inputStyle} /></label><label><span style={labelStyle}>Value</span><input disabled={disabled} value={String(value ?? '')} onChange={(event) => set(key, event.target.value)} style={inputStyle} /></label><button disabled={disabled} type="button" onClick={() => set(key, '')} style={{ ...dangerMini, height: 31 }} aria-label={`Remove ${key}`}>×</button></div>)}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,.8fr) 1.3fr', gap: 7 }}><label><span style={labelStyle}>Property</span><input disabled={disabled} value={advancedPropertyName} onChange={(event) => { setAdvancedPropertyName(event.target.value); setAdvancedPropertyError('') }} placeholder="paintOrder" style={inputStyle} /></label><label><span style={labelStyle}>Value</span><input disabled={disabled} value={advancedPropertyValue} onChange={(event) => { setAdvancedPropertyValue(event.target.value); setAdvancedPropertyError('') }} placeholder="stroke fill" style={inputStyle} /></label></div>
      <button disabled={disabled} type="button" onClick={addCustomProperty} style={{ ...primaryMini, marginTop: 8 }}>Add CSS property</button>
      {advancedPropertyError ? <div style={{ color: 'var(--danger)', fontSize: 9, marginTop: 6 }}>{advancedPropertyError}</div> : null}
    </details>
  </>
}

function bindingPropsForNode(node: StudioNode): string[] {
  if (node.type === 'collection') return ['items']
  if (Object.values(node.bindings || {}).some((binding) => binding.type === 'pagination-pages')) return ['items']
  if (node.type === 'cinematic-sequence') return ['bridgeText', 'style.background', 'style.backgroundColor']
  if (node.type === 'intro-sequence') return ['nameText', 'loadingText', 'upcomingEyebrow', 'upcomingTitle', 'src', 'poster', 'style.background', 'style.backgroundColor']
  const tag = node.tag || node.type
  const visual = ['style.background', 'style.backgroundColor', 'style.backgroundImage']
  if (tag === 'img' || node.type === 'image' || tag === 'video' || tag === 'audio') return ['src', 'alt', ...visual]
  if (tag === 'a') return ['text', 'href', ...visual]
  if (tag === 'button') return ['text', 'disabled', ...visual]
  if (tag === 'input' || tag === 'textarea') return ['placeholder', ...visual]
  return ['text', ...visual]
}

function collectionBindingForNode(node: StudioNode): CollectionBinding | undefined {
  return Object.values(node.bindings || {}).find((binding): binding is CollectionBinding => binding.type === 'collection')
}

function paginationPagesBindingForNode(node: StudioNode): PaginationPagesBinding | undefined {
  return Object.values(node.bindings || {}).find((binding): binding is PaginationPagesBinding => binding.type === 'pagination-pages')
}

const PAGINATION_PAGE_FIELDS: StudioCollectionFieldOption[] = [
  { key: 'label', label: 'Page label', type: 'text' },
  { key: 'pageNumber', label: 'Page number', type: 'number' },
  { key: 'isActive', label: 'Is active page', type: 'boolean' },
  { key: 'isEllipsis', label: 'Is ellipsis', type: 'boolean' },
  { key: 'disabled', label: 'Disabled', type: 'boolean' },
]

function fieldsForScope(stack: StudioCollectionFieldOption[][], scope: RuntimeFieldScope | undefined = 'current'): StudioCollectionFieldOption[] | undefined {
  if (!stack.length) return undefined
  if (scope === 'root') return stack[0]
  if (scope === 'parent') return stack[Math.max(0, stack.length - 2)]
  return stack[stack.length - 1]
}

function fieldSchemaAtPath(fields: StudioCollectionFieldOption[] | undefined, path: string): StudioCollectionFieldOption | undefined {
  if (!fields?.length || !path) return undefined
  const parts = path.split('.').filter(Boolean)
  let current = fields
  let found: StudioCollectionFieldOption | undefined
  for (const part of parts) {
    found = current.find((field) => field.key === part)
    if (!found) return undefined
    current = found.itemFields || []
  }
  return found
}

function collectionContextFieldStack(page: EditorPage, nodeId: string, collectionOptions: StudioCollectionOption[]): StudioCollectionFieldOption[][] {
  const initialFields = page.pageType === 'collection_detail' && page.schema.collectionName ? collectionOptions.find((option) => option.id === page.schema.collectionName)?.fields : undefined
  const initialStack = initialFields?.length ? [initialFields] : []
  let resolved = initialStack
  const visit = (nodes: StudioNode[], stack: StudioCollectionFieldOption[][]): boolean => {
    for (const candidate of nodes) {
      if (candidate.id === nodeId) { resolved = stack; return true }
      let childStack = stack
      const repeat = collectionBindingForNode(candidate)
      const paginationRepeat = paginationPagesBindingForNode(candidate)
      if (repeat) {
        if ((repeat.source || 'collection') === 'current-item-array') {
          const ownerFields = fieldsForScope(stack, repeat.fieldScope)
          const arrayField = fieldSchemaAtPath(ownerFields, repeat.field || '')
          if (arrayField?.itemFields?.length) childStack = [...stack, arrayField.itemFields]
          else if (arrayField?.type === 'array') childStack = [...stack, [{ key: 'value', label: 'Value', type: 'text' }]]
        } else if (repeat.collection) {
          const fields = collectionOptions.find((option) => option.id === repeat.collection)?.fields
          if (fields?.length) childStack = [...stack, fields]
        }
      } else if (paginationRepeat) {
        childStack = [...stack, PAGINATION_PAGE_FIELDS]
      }
      if (candidate.children?.length && visit(candidate.children, childStack)) return true
    }
    return false
  }
  visit(page.schema.root, initialStack)
  return resolved
}

function ContentTab({ node, page, onUpdate, disabled, mediaOptions, collectionOptions, bindingSuggestions }: { node: StudioNode; page: EditorPage; onUpdate: UpdateNode; disabled: boolean; mediaOptions: StudioMediaOption[]; collectionOptions: StudioCollectionOption[]; bindingSuggestions: string[] }) {
  const props = bindingPropsForNode(node)
  const [property, setProperty] = React.useState(props[0])
  React.useEffect(() => { if (!props.includes(property)) setProperty(props[0]) }, [node.id, property, props])
  const binding = node.bindings?.[property]
  const source = binding?.type || (node.type === 'collection' ? 'collection' : 'static')
  const fieldContextStack = React.useMemo(() => collectionContextFieldStack(page, node.id, collectionOptions), [page, node.id, collectionOptions])
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
    if (value === 'field') setBinding({ type: 'field', field: property === 'text' ? 'title' : property, scope: 'current' })
    if (value === 'state') setBinding({ type: 'state', key: '' })
    if (value === 'context') setBinding({ type: 'context', key: property === 'text' ? 'collectionPosition' : 'collectionIndex' })
    if (value === 'template') setBinding({ type: 'template', template: String(existing || '') })
    if (value === 'collection') setBinding({ type: 'collection', source: 'collection', collection: String(node.props?.collection || page.schema.collectionName || 'projects'), limit: 6 })
    if (value === 'pagination-pages') {
      const prefix = page.schema.collectionName || 'collection'
      setBinding({ type: 'pagination-pages', pageStateKey: `${prefix}.page`, pageCountStateKey: `${prefix}.pageCount`, maxVisiblePages: 7, showFirstLast: true, showEllipsis: true })
    }
  }
  const patch = (data: Record<string, unknown>) => setBinding({ ...binding, ...data } as Binding)
  const keyListId = `binding-keys-${node.id}-${property}`
  const fieldListId = `collection-fields-${node.id}-${property}`
  const fieldScope: RuntimeFieldScope = binding?.type === 'field' ? (binding.scope || 'current') : 'current'
  const currentFieldSchemas = fieldsForScope(fieldContextStack, fieldScope)
  const collectionFieldSuggestions = React.useMemo(() => {
    const values = new Set<string>()
    const visit = (fields: StudioCollectionFieldOption[] | undefined, prefix = '') => {
      for (const field of fields || []) {
        const key = prefix ? `${prefix}.${field.key}` : field.key
        values.add(key)
        if (field.type !== 'array' && field.itemFields?.length) visit(field.itemFields, key)
      }
    }
    if (currentFieldSchemas?.length) visit(currentFieldSchemas)
    else collectionOptions.forEach((collection) => visit(collection.fields))
    return [...values].sort()
  }, [currentFieldSchemas, collectionOptions])
  const repeatSource = binding?.type === 'collection' ? (binding.source || 'collection') : 'collection'
  const repeatFieldScope: RuntimeFieldScope = binding?.type === 'collection' ? (binding.fieldScope || 'current') : 'current'
  const repeatOwnerFields = fieldsForScope(fieldContextStack, repeatFieldScope)
  const arrayFieldSuggestions = (repeatOwnerFields || []).filter((field) => field.type === 'array').map((field) => field.key).sort()
  const selectedCollection = binding?.type === 'collection' && repeatSource === 'collection' ? collectionOptions.find((option) => option.id === binding.collection) : undefined
  const repeatedArraySchema = binding?.type === 'collection' && repeatSource === 'current-item-array' ? repeatOwnerFields?.find((field) => field.key === binding.field) : undefined
  const collectionQueryFieldOptions = repeatSource === 'collection' ? flattenCollectionFieldKeys(selectedCollection?.fields) : (repeatedArraySchema?.itemFields?.length ? flattenCollectionFieldKeys(repeatedArraySchema.itemFields) : ['value'])
  const mediaBinding = binding?.type === 'media' ? binding : null
  const staticValue = property.startsWith('style.') ? node.styles?.desktop?.[property.slice(6)] ?? '' : node.props?.[property] ?? ''
  return <div style={sectionStyle}>
    <div style={{ marginBottom: 10 }}><label style={labelStyle}>Bindable property</label><select disabled={disabled} value={property} onChange={(e) => setProperty(e.target.value)} style={inputStyle}>{props.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}</select></div>
    <div style={{ marginBottom: 12 }}><label style={labelStyle}>Content source</label><select disabled={disabled} value={source} onChange={(e) => changeSource(e.target.value)} style={inputStyle}>{node.type === 'collection' ? <option value="collection">Collection</option> : <><option value="static">Static / design content</option><option value="content">Editable Content</option><option value="setting">Site Setting</option><option value="media">Media Reference</option><option value="field">Collection Field</option><option value="state">Runtime State</option><option value="context">Collection Context</option><option value="template">Runtime Template</option><option value="pagination-pages">Pagination Pages</option></>}</select></div>
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
    {binding?.type === 'field' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Field context</span><select disabled={disabled} value={binding.scope || 'current'} onChange={(e) => patch({ scope: e.target.value })} style={inputStyle}><option value="current">Current item</option><option value="parent">Parent item</option><option value="root">Root detail/item</option></select></label><Field disabled={disabled} list={fieldListId} label="Collection field" value={binding.field} onChange={(v) => patch({ field: String(v) })} placeholder="title" /><datalist id={fieldListId}>{collectionFieldSuggestions.map((key) => <option key={key} value={key} />)}</datalist>{collectionFieldSuggestions.length > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '-4px 0 8px' }}>Suggestions follow the selected current / parent / root item context.</div>}</>}
    {binding?.type === 'state' && <><Field disabled={disabled} label="State key" value={binding.key} onChange={(v) => patch({ key: String(v) })} placeholder="tech.category" /><JsonField disabled={disabled} label="Fallback value" value={binding.fallback ?? null} onChange={(value) => patch({ fallback: value })} /></>}
    {binding?.type === 'context' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Collection context</span><select disabled={disabled} value={binding.key} onChange={(e) => patch({ key: e.target.value })} style={inputStyle}>{['collectionIndex', 'collectionPosition', 'collectionCount', 'collectionKey'].map((v) => <option key={v}>{v}</option>)}</select></label><JsonField disabled={disabled} label="Fallback value" value={binding.fallback ?? null} onChange={(value) => patch({ fallback: value })} /></>}
    {binding?.type === 'template' && <><MultilineField disabled={disabled} label="Runtime template" value={binding.template} onChange={(v) => patch({ template: String(v) })} rows={4} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -4, marginBottom: 8 }}>Tokens: {'{{state:tech.category}}'}, {'{{field:name}}'}, {'{{parentField:title}}'}, {'{{rootField:slug}}'}, {'{{context:collectionPosition}}'}, {'{{context:collectionCount}}'}, {'{{content:key}}'}, {'{{setting:key}}'}</div></>}
    {binding?.type === 'pagination-pages' && <>
      <div style={{ margin: '0 0 9px', padding: '8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-alt)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Repeats this node's child template from the calculated page count. Child fields: <code>label</code>, <code>pageNumber</code>, <code>isActive</code>, <code>isEllipsis</code>, <code>disabled</code>.</div>
      <Field disabled={disabled} label="Current page state key" value={binding.pageStateKey} onChange={(v) => patch({ pageStateKey: String(v).trim() || 'collection.page' })} placeholder="projects.page" />
      <Field disabled={disabled} label="Page count state key" value={binding.pageCountStateKey} onChange={(v) => patch({ pageCountStateKey: String(v).trim() || 'collection.pageCount' })} placeholder="projects.pageCount" />
      <Field disabled={disabled} label="Maximum visible entries" type="number" value={binding.maxVisiblePages ?? 7} onChange={(v) => patch({ maxVisiblePages: Math.max(5, Math.min(15, Math.round(Number(v) || 7))) })} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', margin: '8px 0' }}><input disabled={disabled} type="checkbox" checked={binding.showFirstLast !== false} onChange={(e) => patch({ showFirstLast: e.target.checked })} />Always show first / last page</label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', margin: '8px 0' }}><input disabled={disabled} type="checkbox" checked={binding.showEllipsis !== false} onChange={(e) => patch({ showEllipsis: e.target.checked })} />Show ellipsis for skipped ranges</label>
    </>}
    {binding?.type === 'collection' && <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Repeat source</span><select disabled={disabled} value={repeatSource} onChange={(e) => { const nextSource = e.target.value as 'collection' | 'current-item-array'; if (nextSource === 'collection') patch({ source: 'collection', collection: binding.collection || page.schema.collectionName || collectionOptions[0]?.id || 'projects', field: undefined, fieldScope: undefined }); else patch({ source: 'current-item-array', collection: undefined, field: binding.field || arrayFieldSuggestions[0] || '', fieldScope: binding.fieldScope || 'current' }) }} style={inputStyle}><option value="collection">Named Collection</option><option value="current-item-array">Current Item Array</option></select></label>{repeatSource === 'collection' ? <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Collection</span><select disabled={disabled} value={binding.collection || ''} onChange={(e) => patch({ collection: e.target.value })} style={inputStyle}>{collectionOptions.map((v) => <option key={v.id} value={v.id}>{v.label}{v.builtin ? ' · built-in' : ''}</option>)}</select></label>{selectedCollection?.fields?.length ? <div style={{ margin: '-2px 0 9px', padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface-alt)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}><strong style={{ color: 'var(--text)' }}>Available fields:</strong> {selectedCollection.fields.map((field) => field.key).join(', ')}</div> : null}</> : <><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Array owner context</span><select disabled={disabled} value={repeatFieldScope} onChange={(e) => patch({ fieldScope: e.target.value })} style={inputStyle}><option value="current">Current item</option><option value="parent">Parent item</option><option value="root">Root detail/item</option></select></label><Field disabled={disabled} list={`${fieldListId}-arrays`} label="Array field" value={binding.field || ''} onChange={(v) => patch({ field: String(v) })} placeholder="blocks" /><datalist id={`${fieldListId}-arrays`}>{arrayFieldSuggestions.map((key) => <option key={key} value={key} />)}</datalist><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '-4px 0 8px' }}>Repeats each item in an array on the selected current / parent / root context. Object arrays expose their item fields; primitive arrays expose a <code>value</code> field.</div></>}<CollectionQueryControls binding={binding} disabled={disabled} fieldOptions={collectionQueryFieldOptions} onPatch={patch} /></>}
  </div>
}

function PropsTab({ node, mode, onUpdate, onSetLocked, disabled, mediaOptions }: { node: StudioNode; mode: ResponsiveMode; onUpdate: UpdateNode; onSetLocked: (locked: boolean) => void; disabled: boolean; mediaOptions: StudioMediaOption[] }) {
  const setMeta = (key: string, value: unknown) => onUpdate((n) => ({ ...n, meta: { ...(n.meta || {}), [key]: value } }))
  const setProp = (key: string, value: unknown) => onUpdate((n) => ({ ...n, props: { ...(n.props || {}), [key]: value } }))
  const baseLayout = node.layout || { mode: 'flow' as const }
  const effectiveLayout = resolveResponsiveLayout(baseLayout, mode) || { mode: 'flow' as const }
  const inheritedLayout = mode === 'desktop' ? undefined : resolveResponsiveLayout(baseLayout, mode === 'tablet' ? 'desktop' : 'tablet')
  const explicitLayout: NodeLayoutOverride = mode === 'desktop' ? baseLayout : (baseLayout[mode] || {})
  const setLayoutValue = (key: keyof NodeLayoutOverride, value: NodeLayoutOverride[keyof NodeLayoutOverride] | undefined) => onUpdate((n) => {
    const layout = n.layout || { mode: 'flow' as const }
    if (mode === 'desktop') {
      const next = { ...layout } as typeof layout & Record<string, unknown>
      if (value === undefined && key !== 'mode') delete (next as Record<string, unknown>)[String(key)]
      else if (value !== undefined) (next as Record<string, unknown>)[String(key)] = value
      return { ...n, layout: next }
    }
    const override = { ...(layout[mode] || {}) } as NodeLayoutOverride & Record<string, unknown>
    if (value === undefined) delete (override as Record<string, unknown>)[String(key)]
    else (override as Record<string, unknown>)[String(key)] = value
    const next = { ...layout } as typeof layout & Record<string, unknown>
    if (Object.keys(override).length) next[mode] = override
    else delete next[mode]
    return { ...n, layout: next }
  })
  const setLayoutMode = (nextMode: '' | 'flow' | 'absolute') => onUpdate((n) => {
    const layout = n.layout || { mode: 'flow' as const }
    if (mode === 'desktop') {
      const selectedMode = (nextMode || 'flow') as 'flow' | 'absolute'
      return { ...n, layout: selectedMode === 'absolute'
        ? { ...layout, mode: 'absolute', x: layout.x ?? 0, y: layout.y ?? 0, width: layout.width ?? 240, height: layout.height ?? 120 }
        : { ...layout, mode: 'flow' } }
    }
    const override = { ...(layout[mode] || {}) } as NodeLayoutOverride
    if (!nextMode) delete override.mode
    else override.mode = nextMode
    const inherited = resolveResponsiveLayout(layout, mode === 'tablet' ? 'desktop' : 'tablet')
    if (nextMode === 'absolute' && inherited?.mode !== 'absolute') {
      override.x ??= 0
      override.y ??= 0
      override.width ??= 240
      override.height ??= 120
    }
    const next = { ...layout }
    if (Object.keys(override).length) next[mode] = override
    else delete next[mode]
    return { ...n, layout: next }
  })
  const absoluteLayoutKeys: (keyof NodeLayoutOverride)[] = ['x', 'y', 'width', 'height']
  const commonLayoutKeys: (keyof NodeLayoutOverride)[] = ['rotation', 'zIndex']
  return <div style={sectionStyle}>
    <label style={{ display: 'flex', gap: 8, fontSize: 11, margin: '2px 0 12px', fontWeight: 700 }}><input type="checkbox" checked={Boolean(node.meta?.locked)} onChange={(e) => onSetLocked(e.target.checked)} /> Lock in Studio</label>
    <Field disabled={disabled} label="Layer label" value={node.meta?.label || ''} onChange={(v) => setMeta('label', String(v))} /><Field disabled={disabled} label="Admin label" value={node.meta?.adminLabel || ''} onChange={(v) => setMeta('adminLabel', String(v))} /><Field disabled={disabled} label="Section label" value={node.meta?.sectionLabel || ''} onChange={(v) => setMeta('sectionLabel', String(v))} /><Field disabled={disabled} label="HTML tag" value={node.tag || ''} onChange={(v) => onUpdate((n) => ({ ...n, tag: String(v) }))} />
    <label style={{ display: 'flex', gap: 8, fontSize: 11, margin: '10px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(node.meta?.hidden)} onChange={(e) => setMeta('hidden', e.target.checked)} /> Hide in runtime</label>
    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Layout mode · {pretty(mode)}</div>
    <select disabled={disabled} value={mode === 'desktop' ? effectiveLayout.mode : String(explicitLayout.mode || '')} onChange={(e) => setLayoutMode(e.target.value as '' | 'flow' | 'absolute')} style={inputStyle}>{mode !== 'desktop' && <option value="">Inherit — {pretty(inheritedLayout?.mode || 'flow')}</option>}<option value="flow">Flow</option><option value="absolute">Absolute / free position</option></select>
    <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{mode === 'desktop' ? 'Desktop is the base geometry.' : `${pretty(mode)} geometry inherits from ${mode === 'tablet' ? 'Desktop' : 'Tablet'} until you enter an override.`}</p>
    {effectiveLayout.mode === 'absolute' && <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>Drag the blue handle on the canvas to move this element and the corner handle to resize it at the current breakpoint.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>{[...(effectiveLayout.mode === 'absolute' ? absoluteLayoutKeys : []), ...commonLayoutKeys].map((key) => {
      const explicit = explicitLayout[key]
      const inherited = inheritedLayout?.[key]
      return <label key={key}><span style={labelStyle}>{pretty(String(key))}</span><input disabled={disabled} type="number" value={explicit ?? ''} placeholder={mode !== 'desktop' && inherited !== undefined ? `Inherited: ${inherited}` : ''} onChange={(event) => setLayoutValue(key, event.target.value === '' ? undefined : Number(event.target.value))} style={inputStyle} /></label>
    })}</div>{mode !== 'desktop' && <button type="button" disabled={disabled} style={{ ...primaryMini, marginTop: 10 }} onClick={() => onUpdate((n) => { const layout = { ...(n.layout || { mode: 'flow' as const }) }; delete layout[mode]; return { ...n, layout } })}>Clear {pretty(mode)} layout overrides</button>}
    {node.type === 'intro-sequence' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Intro Sequence</div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>Editable full-screen loader, optional background video, Coming Up Next bridge, and pixel-wipe reveal. It runs only in Preview/runtime; Studio shows a static editable frame.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Loading duration ms" type="number" value={Number(node.props?.duration ?? 2600)} onChange={(v) => setProp('duration', Math.max(800, Math.min(12000, Number(v) || 2600)))} /><Field disabled={disabled} label="Bridge duration ms" type="number" value={Number(node.props?.bridgeDuration ?? 480)} onChange={(v) => setProp('bridgeDuration', Math.max(100, Math.min(3000, Number(v) || 480)))} /><Field disabled={disabled} label="Wipe duration ms" type="number" value={Number(node.props?.wipeDuration ?? 900)} onChange={(v) => setProp('wipeDuration', Math.max(200, Math.min(4000, Number(v) || 900)))} /><Field disabled={disabled} label="Pixel columns" type="number" value={Number(node.props?.pixelColumns ?? 18)} onChange={(v) => setProp('pixelColumns', Math.max(6, Math.min(40, Math.round(Number(v) || 18))))} /></div><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, margin: '8px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.showPercent ?? true)} onChange={(e) => setProp('showPercent', e.target.checked)} /> Show 0–100% loader</label><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, margin: '8px 0' }}><input disabled={disabled} type="checkbox" checked={Boolean(node.props?.backgroundVideo)} onChange={(e) => setProp('backgroundVideo', e.target.checked)} /> Use bound video as intro background</label>{node.props?.backgroundVideo&&<Field disabled={disabled} label="Video opacity 0–1" type="number" value={Number(node.props?.videoOpacity ?? .42)} onChange={(v) => setProp('videoOpacity', Math.max(0, Math.min(1, Number(v) || 0)))} />}</>}
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

function AnimationTab({ node, designTokens, onUpdate, disabled }: { node: StudioNode; designTokens: DesignTokens; onUpdate: UpdateNode; disabled: boolean }) {
  const anim = node.animation
  const keyframes = designTokens.keyframes || []
  const isCustom = anim?.type === CUSTOM_KEYFRAME_ANIMATION_TYPE
  const selectedKeyframe = isCustom ? keyframes.find((definition) => definition.id === anim?.keyframeId) : undefined
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
  const selectKeyframe = (keyframeId: string) => onUpdate((n) => {
    if (!keyframeId) {
      if (n.animation?.type !== CUSTOM_KEYFRAME_ANIMATION_TYPE) return n
      const next = { ...n }
      delete next.animation
      return next
    }
    return {
      ...n,
      animation: {
        type: CUSTOM_KEYFRAME_ANIMATION_TYPE,
        keyframeId,
        trigger: n.animation?.trigger || 'continuous',
        duration: n.animation?.duration || 2400,
        delay: n.animation?.delay || 0,
        easing: n.animation?.easing || 'linear',
        direction: n.animation?.direction || 'normal',
        fillMode: n.animation?.fillMode || 'both',
        playState: n.animation?.playState || 'running',
        stagger: n.animation?.stagger || 0,
        replayOnState: n.animation?.replayOnState || [],
        params: n.animation?.params || {},
      },
    }
  })
  const stateKeys = anim?.replayOnState || []
  const combinedViewportState = anim?.trigger === 'scroll' && stateKeys.length > 0
  const allowedTriggers = anim ? getAllowedAnimationTriggers(anim.type) : []

  return <div>
    <div style={sectionStyle}>
      <strong style={{ fontSize: 11 }}>Reusable CSS keyframe</strong>
      <p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Keyframes are layout-level definitions managed in Tokens. The runtime compiles structured steps to collision-safe CSS names; labels are never emitted as raw stylesheet identifiers.</p>
      <label style={{ display: 'block', marginTop: 8 }}>
        <span style={labelStyle}>Keyframe</span>
        <select disabled={disabled || !keyframes.length} value={isCustom ? anim?.keyframeId || '' : ''} onChange={(event) => selectKeyframe(event.target.value)} style={inputStyle}>
          <option value="">{keyframes.length ? 'Use legacy preset / no custom keyframe' : 'Create keyframes in Tokens first'}</option>
          {keyframes.map((definition) => <option key={definition.id} value={definition.id}>{definition.label}{definition.category ? ` · ${definition.category}` : ''}</option>)}
        </select>
      </label>
      {isCustom && !selectedKeyframe ? <div style={{ color: 'var(--danger)', fontSize: 9, lineHeight: 1.5 }}>The selected keyframe no longer exists. Select another keyframe or remove the animation before publishing.</div> : null}
      {selectedKeyframe ? <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Reduced motion: <strong>{selectedKeyframe.reducedMotion || 'disable'}</strong>. {selectedKeyframe.description || 'Edit its structured steps in Tokens → Keyframe library.'}</div> : null}
    </div>

    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 11 }}>Animation</strong>
        {anim && <button disabled={disabled} onClick={() => onUpdate((n) => { const next = { ...n }; delete next.animation; return next })} style={dangerMini}>Remove</button>}
      </div>
      {anim ? <>
        {isCustom ? <div style={{ marginTop: 9, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-alt)', fontSize: 9, color: 'var(--text-muted)' }}>Custom keyframe · {selectedKeyframe?.label || anim.keyframeId || 'missing'}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
          <Field disabled={disabled} label="Duration ms" type="number" value={anim.duration || 700} onChange={(v) => patch({ duration: Math.max(0, Number(v) || 0) })} />
          <Field disabled={disabled} label="Delay ms" type="number" value={anim.delay || 0} onChange={(v) => patch({ delay: Math.max(0, Number(v) || 0) })} />
          <label>
            <span style={labelStyle}>Primary trigger</span>
            <select disabled={disabled} value={anim.trigger} onChange={(e) => patch({ trigger: e.target.value })} style={inputStyle}>
              {allowedTriggers.map((v) => <option key={v} value={v}>{ANIMATION_TRIGGER_LABELS[v] || v}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>Easing</span>
            <select disabled={disabled} value={anim.easing || 'ease-out'} onChange={(e) => patch({ easing: e.target.value })} style={inputStyle}>
              {['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'spring'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginTop: 7 }}>
          <label><span style={labelStyle}>Direction</span><select disabled={disabled} value={anim.direction || (['float','pulse','breathe'].includes(anim.type) ? 'alternate' : 'normal')} onChange={(e) => patch({ direction: e.target.value })} style={inputStyle}><option value="normal">Normal</option><option value="reverse">Reverse</option><option value="alternate">Alternate</option></select></label>
          <label><span style={labelStyle}>Fill mode</span><select disabled={disabled} value={anim.fillMode || (anim.trigger === 'continuous' ? 'none' : 'both')} onChange={(e) => patch({ fillMode: e.target.value })} style={inputStyle}><option value="none">None</option><option value="forwards">Forwards</option><option value="backwards">Backwards</option><option value="both">Both</option></select></label>
          <label><span style={labelStyle}>Play state</span><select disabled={disabled} value={anim.playState || 'running'} onChange={(e) => patch({ playState: e.target.value })} style={inputStyle}><option value="running">Running</option><option value="paused">Paused</option></select></label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 2 }}>
          <Field disabled={disabled} label="Stagger ms" type="number" value={anim.stagger || 0} onChange={(v) => patch({ stagger: Math.max(0, Number(v) || 0) })} />
          {anim.trigger === 'scroll' ? <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 14, fontSize: 10, color: 'var(--text-muted)' }}>
            <input disabled={disabled} type="checkbox" checked={anim.repeat === true} onChange={(e) => patch({ repeat: e.target.checked })} />Replay on re-entry
          </label> : isCustom ? <Field disabled={disabled} label="Iterations (0 = default)" type="number" value={typeof anim.repeat === 'number' ? anim.repeat : 0} onChange={(v) => patch({ repeat: Number(v) > 0 ? Math.max(1, Math.round(Number(v))) : undefined })} /> : <div />}
        </div>

        {anim.trigger === 'scroll' && <Field disabled={disabled} label="Viewport threshold (0–1)" type="number" value={Number(anim.params?.threshold ?? .14)} onChange={(v) => patch({ params: { ...(anim.params || {}), threshold: Math.max(0, Math.min(1, Number(v) || 0)) } })} />}

        <Field disabled={disabled} label="State-change keys (replay)" value={stateKeys.join(', ')} onChange={(v) => patch({ replayOnState: String(v).split(',').map((key) => key.trim()).filter(Boolean) })} placeholder="tech.category" />
        <div style={{ marginTop: -4, marginBottom: 10, padding: '8px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: 9, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          {combinedViewportState
            ? 'Combined playback is active: this animation plays when it enters the viewport and replays whenever the listed runtime state changes.'
            : anim.trigger === 'state'
              ? (stateKeys.length ? 'State-only playback: the element waits for one of these state keys to change before it plays.' : 'Add at least one state-change key for a State change only trigger.')
              : isCustom
                ? 'The reusable keyframe renders the effect. Runtime only coordinates this trigger/replay timing.'
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

function ScrollTab({ node, mode, onUpdate, disabled }: { node: StudioNode; mode: ResponsiveMode; onUpdate: UpdateNode; disabled: boolean }) {
  const scroll = node.scrollBehavior || { mode: 'normal' as const }
  const patch = (data: Record<string, unknown>) => onUpdate((n) => ({ ...n, scrollBehavior: { ...(n.scrollBehavior || { mode: 'normal' }), ...data } as any }))
  const modes: ScrollBehaviorMode[] = ['normal', 'sticky', 'pin', 'stack-over-previous', 'card-deck', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition']
  const overrideKey = mode === 'tablet' ? 'tabletFallback' : mode === 'mobile' ? 'mobileFallback' : 'mode'
  const authoredMode = mode === 'desktop' ? scroll.mode : (scroll[overrideKey] as ScrollBehaviorMode | undefined)
  const effectiveMode = resolveResponsiveScrollMode(scroll, mode)
  const setResponsiveMode = (value: string) => onUpdate((n) => {
    const next = { ...(n.scrollBehavior || { mode: 'normal' as const }) }
    if (mode === 'desktop') next.mode = value as ScrollBehaviorMode
    else if (value === '__inherit__') delete (next as Record<string, unknown>)[overrideKey]
    else (next as Record<string, unknown>)[overrideKey] = value as ScrollBehaviorMode
    return { ...n, scrollBehavior: next }
  })
  const sceneParams = scroll.params || {}
  const setSceneParam = (key: string, value: unknown) => patch({ params: { ...sceneParams, [key]: value } })
  return <div style={sectionStyle}>
    <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>Editing <strong>{mode}</strong> scroll behavior. Tablet inherits Desktop when unset; Mobile inherits Tablet/Desktop when unset.</div>
    <label><span style={labelStyle}>Behavior</span><select disabled={disabled} value={mode === 'desktop' ? effectiveMode : (authoredMode || '__inherit__')} onChange={(e) => setResponsiveMode(e.target.value)} style={inputStyle}>{mode !== 'desktop' && <option value="__inherit__">Inherit ({effectiveMode})</option>}{modes.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
      {['sticky', 'pin', 'stack-over-previous', 'section-cover', 'scene-transition'].includes(effectiveMode) && <Field disabled={disabled} label="Sticky top" type="number" value={scroll.stickyTop ?? 0} onChange={(v) => patch({ stickyTop: Number(v) })} />}
      {['stack-over-previous', 'section-cover', 'scene-transition'].includes(effectiveMode) && <Field disabled={disabled} label="Stack order" type="number" value={scroll.stackOrder ?? 1} onChange={(v) => patch({ stackOrder: Number(v) })} />}
      {effectiveMode === 'pin' && <Field disabled={disabled} label="Pin distance px" type="number" value={scroll.pinDistance ?? 0} onChange={(v) => patch({ pinDistance: Math.max(0, Number(v) || 0) })} />}
      {effectiveMode === 'parallax' && <Field disabled={disabled} label="Parallax speed" type="number" value={(scroll.params?.speed as number) ?? .25} onChange={(v) => patch({ params: { ...(scroll.params || {}), speed: Number(v) } })} />}
    </div>
    {effectiveMode === 'pin' && <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>Pin distance now creates real scroll space beneath the sticky element. The element releases after that distance instead of behaving like an unlimited sticky node.</div>}
    {effectiveMode === 'section-cover' && <><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Cover entrance direction</span><select disabled={disabled} value={String(scroll.params?.direction ?? 'bottom')} onChange={(e) => patch({ params: { ...(scroll.params || {}), direction: e.target.value } })} style={inputStyle}>{['top','right','bottom','left'].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Travel % viewport" type="number" value={Number(scroll.params?.distance ?? 100)} onChange={(v) => patch({ params: { ...(scroll.params || {}), distance: Math.max(10, Math.min(200, Number(v) || 100)) } })} /><Field disabled={disabled} label="Transition span %" type="number" value={Number(scroll.params?.span ?? 100)} onChange={(v) => patch({ params: { ...(scroll.params || {}), span: Math.max(20, Math.min(200, Number(v) || 100)) } })} /></div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>The section stays in normal document flow, then visually covers the previous sticky section from this edge as scroll progresses. Give successive sections increasing Stack order values.</div></>}
    {effectiveMode === 'card-deck' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><strong style={{ fontSize: 11 }}>Focus carousel card deck</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Apply Card Deck to the collection-bound container (for example Journey Chapters), not to the repeated card template. The focused card is locked to the viewport center while previous/next cards occupy dedicated side slots. Vertical document scroll remains the only scroll owner.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><Field disabled={disabled} label="Travel per card vh" type="number" value={Number(sceneParams.travelVh ?? 80)} onChange={(v) => setSceneParam('travelVh', Math.max(40, Math.min(160, Number(v) || 80)))} /><Field disabled={disabled} label="Center hold %" type="number" value={Number(sceneParams.centerHoldPercent ?? 34)} onChange={(v) => setSceneParam('centerHoldPercent', Math.max(0, Math.min(70, Number(v) || 0)))} /><Field disabled={disabled} label="Visible neighbors" type="number" value={Number(sceneParams.visibleNeighbors ?? 1)} onChange={(v) => setSceneParam('visibleNeighbors', Math.max(1, Math.min(3, Math.round(Number(v) || 1))))} /><Field disabled={disabled} label="Desktop neighbor visible %" type="number" value={Number(sceneParams.peekX ?? 24)} onChange={(v) => setSceneParam('peekX', Math.max(0, Math.min(60, Number(v) || 0)))} /><Field disabled={disabled} label="Tablet neighbor visible %" type="number" value={Number(sceneParams.tabletPeekX ?? 18)} onChange={(v) => setSceneParam('tabletPeekX', Math.max(0, Math.min(45, Number(v) || 0)))} /><Field disabled={disabled} label="Mobile neighbor visible %" type="number" value={Number(sceneParams.mobilePeekX ?? 8)} onChange={(v) => setSceneParam('mobilePeekX', Math.max(0, Math.min(35, Number(v) || 0)))} /><Field disabled={disabled} label="Neighbor Y offset px" type="number" value={Number(sceneParams.neighborY ?? 12)} onChange={(v) => setSceneParam('neighborY', Math.max(0, Math.min(80, Number(v) || 0)))} /><Field disabled={disabled} label="Neighbor scale" type="number" value={Number(sceneParams.neighborScale ?? .82)} onChange={(v) => setSceneParam('neighborScale', Math.max(.5, Math.min(1, Number(v) || .82)))} /><Field disabled={disabled} label="Neighbor opacity" type="number" value={Number(sceneParams.neighborOpacity ?? .5)} onChange={(v) => setSceneParam('neighborOpacity', Math.max(0, Math.min(1, Number(v) || 0)))} /><Field disabled={disabled} label="Neighbor rotation °" type="number" value={Number(sceneParams.rotation ?? 1)} onChange={(v) => setSceneParam('rotation', Math.max(0, Math.min(12, Number(v) || 0)))} /><Field disabled={disabled} label="Activation lead vh" type="number" value={Number(sceneParams.activationLeadVh ?? 24)} onChange={(v) => setSceneParam('activationLeadVh', Math.max(0, Math.min(60, Number(v) || 0)))} /></div><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 8 }}>Recommended for Journey: 80vh travel, 34% center hold, 1 visible neighbor, 24% desktop / 18% tablet / 8% mobile neighbor visible, 12px Y, 0.82 scale, 0.50 opacity, 1° rotation, Mobile fallback = normal. Existing V1 peek values remain compatible and are now interpreted as the visible percentage of each side card.</div></>}
    {effectiveMode === 'scene-transition' && <><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><strong style={{ fontSize: 11 }}>Scene choreography</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Put this panel directly inside a Scene Frame. Progress is derived from that frame, so forward and reverse scrolling stay pixel-perfect without React render loops.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><label><span style={labelStyle}>Enter from</span><select disabled={disabled} value={String(sceneParams.enterFrom ?? 'bottom')} onChange={(e) => setSceneParam('enterFrom', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((v) => <option key={v}>{v}</option>)}</select></label><label><span style={labelStyle}>Exit to</span><select disabled={disabled} value={String(sceneParams.exitTo ?? 'top')} onChange={(e) => setSceneParam('exitTo', e.target.value)} style={inputStyle}>{['top','right','bottom','left','none'].map((v) => <option key={v}>{v}</option>)}</select></label><label><span style={labelStyle}>Entry effect</span><select disabled={disabled} value={String(sceneParams.entryEffect ?? 'slide')} onChange={(e) => setSceneParam('entryEffect', e.target.value)} style={inputStyle}><option value="slide">Slide</option><option value="wipe">Pixel wipe</option></select></label><Field disabled={disabled} label="Travel % viewport" type="number" value={Number(sceneParams.distance ?? 100)} onChange={(v) => setSceneParam('distance', Math.max(50, Math.min(160, Number(v) || 100)))} /><Field disabled={disabled} label="Bridge ends %" type="number" value={Number(sceneParams.bridgeEnd ?? 10)} onChange={(v) => setSceneParam('bridgeEnd', Math.max(0, Math.min(40, Number(v) || 0)))} /><Field disabled={disabled} label="Entry ends %" type="number" value={Number(sceneParams.enterEnd ?? 30)} onChange={(v) => setSceneParam('enterEnd', Math.max(5, Math.min(70, Number(v) || 30)))} /><Field disabled={disabled} label="Exit starts %" type="number" value={Number(sceneParams.exitStart ?? 68)} onChange={(v) => setSceneParam('exitStart', Math.max(30, Math.min(95, Number(v) || 68)))} /><Field disabled={disabled} label="Exit ends %" type="number" value={Number(sceneParams.exitEnd ?? 100)} onChange={(v) => setSceneParam('exitEnd', Math.max(60, Math.min(100, Number(v) || 100)))} /></div><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 8px' }}><input disabled={disabled} type="checkbox" checked={Boolean(sceneParams.skipEntry)} onChange={(e) => setSceneParam('skipEntry', e.target.checked)} />Start visible (use for the first scene behind Intro)</label><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input disabled={disabled} type="checkbox" checked={Boolean(sceneParams.finalScene)} onChange={(e) => setSceneParam('finalScene', e.target.checked)} />Final scene: remain visible and release naturally</label></>}
    <label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Reduced motion fallback</span><select disabled={disabled} value={scroll.reducedMotionFallback || ''} onChange={(e) => patch({ reducedMotionFallback: e.target.value || undefined })} style={inputStyle}><option value="">Default ({resolveReducedMotionScrollFallback(scroll)})</option><option value="none">none — keep authored motion</option><option value="skip">skip — remove structural scroll motion</option><option value="reduce">reduce — accessible reduced motion</option></select></label><hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} /><strong style={{ fontSize: 11 }}>Active scroll state</strong><p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>{effectiveMode === 'card-deck' ? 'Optional for counters/dots. Card Deck writes the active collection position (1-based) whenever the centered card changes.' : 'Useful for Journey progress. When this node crosses the activation line, the runtime writes the configured value to state.'}</p><Field disabled={disabled} label="State key" value={scroll.activeStateKey || ''} onChange={(v) => patch({ activeStateKey: String(v) || undefined })} placeholder="journey.activeIndex" />{effectiveMode !== 'card-deck' && <><Field disabled={disabled} label="Viewport activation ratio" type="number" value={scroll.activeThreshold ?? .45} onChange={(v) => patch({ activeThreshold: Math.max(0, Math.min(1, Number(v))) })} /><JsonField disabled={disabled} label="Active value source" value={scroll.activeStateValue || { source: 'context', key: 'collectionPosition' }} onChange={(value) => patch({ activeStateValue: value })} /></>}
  </div>
}

function LogicTab({ node, onUpdate, disabled }: { node: StudioNode; onUpdate: UpdateNode; disabled: boolean }) {
  return <div style={sectionStyle}>
    <strong style={{ fontSize: 11 }}>Runtime interactions</strong>
    <p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Actions run only in runtime/Preview, not while Admin is in editable-content mode. Inputs/selects can write event values to state; buttons can set, toggle or increment state for filters and pagination.</p>
    <RuntimeInteractionsEditor nodeType={node.type} interactions={node.interactions || []} disabled={disabled} onChange={(interactions) => onUpdate((n) => ({ ...n, interactions: interactions.length ? interactions : undefined }))} />
    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />
    <strong style={{ fontSize: 11 }}>Runtime disabled condition</strong>
    <p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>When this condition is true, supported runtime controls receive the real HTML disabled attribute. Useful for Previous/Next pagination controls.</p>
    <JsonField disabled={disabled} label="Disabled when (JSON)" value={node.disabledWhen || null} onChange={(value) => onUpdate((n) => ({ ...n, disabledWhen: value && typeof value === 'object' && !Array.isArray(value) ? value as RuntimeCondition : undefined }))} />
    <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />
    <strong style={{ fontSize: 11 }}>Conditional styles</strong>
    <JsonField disabled={disabled} label="Conditional styles JSON" value={node.conditionalStyles || []} onChange={(value) => onUpdate((n) => ({ ...n, conditionalStyles: Array.isArray(value) ? value as any : [] }))} /><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>Active-style example: {'[{"when":{"left":{"source":"state","key":"tech.category"},"operator":"eq","right":{"source":"literal","value":"backend"}},"styles":{"desktop":{"background":"var(--site-primary)","color":"#fff"}}}]'}</div>
  </div>
}

function PageTab({ page, pages, collectionOptions, onUpdate, onUpdatePageState, onUpdatePageCollectionName, onWireProjectsQuery }: { page: EditorPage; pages: EditorPage[]; collectionOptions: StudioCollectionOption[]; onUpdate: (patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => void; onUpdatePageState: (initialState: Record<string, unknown>) => void; onUpdatePageCollectionName: (collectionName: string | undefined) => void; onWireProjectsQuery: () => { changed: boolean; message: string } }) {
  const routeConflict = page.pageType !== 'system' && pages.some((candidate) => candidate.id !== page.id && candidate.pageType !== 'system' && routePatternsConflict(candidate.routePattern, page.routePattern))
  const normalize = () => onUpdate({ routePattern: normalizeRoutePattern(page.routePattern, page.pageType) })
  const [projectsQueryMessage, setProjectsQueryMessage] = React.useState('')
  React.useEffect(() => { setProjectsQueryMessage('') }, [page.id])
  const wireProjectsQuery = () => { const result = onWireProjectsQuery(); setProjectsQueryMessage(result.message) }
  return <div style={sectionStyle}><Field label="Page name" value={page.name} onChange={(v) => onUpdate({ name: String(v) })} /><Field label="Slug" value={page.slug} onChange={(v) => onUpdate({ slug: String(v).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} /><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Route pattern</span><input disabled={page.pageType === 'home' || page.pageType === 'system'} value={page.routePattern} onChange={(event) => onUpdate({ routePattern: event.target.value })} onBlur={normalize} placeholder="/projects/:slug" style={{ ...inputStyle, borderColor: routeConflict ? 'var(--danger)' : 'var(--border)' }} />{routeConflict && <small style={{ color: 'var(--danger)' }}>This route conflicts with another static/dynamic route shape.</small>}</label><label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Page type</span><select value={page.pageType} onChange={(e) => { const pageType = e.target.value as EditorPage['pageType']; onUpdate({ pageType, routePattern: normalizeRoutePattern(page.routePattern, pageType) }) }} style={inputStyle}>{['standard', 'home', 'collection_index', 'collection_detail', 'system'].map((v) => <option key={v}>{v}</option>)}</select></label>{(page.pageType === 'collection_index' || page.pageType === 'collection_detail') && <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Page Collection</span><select value={page.schema.collectionName || ''} onChange={(e) => onUpdatePageCollectionName(e.target.value || undefined)} style={inputStyle}><option value="">Select Collection…</option>{collectionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}{option.builtin ? ' · built-in' : ''}</option>)}</select><small style={{ color: 'var(--text-muted)' }}>Collection Detail routes use this Collection to resolve the selected :slug/:id record.</small></label>}<JsonField label="Initial runtime state" value={page.schema.initialState || {}} onChange={(value) => onUpdatePageState(value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})} />{page.pageType === 'collection_index' && page.schema.collectionName === 'projects' && <div style={{ margin: '10px 0', padding: 10, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)' }}><strong style={{ fontSize: 10 }}>Projects runtime query wiring</strong><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '5px 0 8px' }}>Connect the existing Projects collection, search input and Previous/Next/page-number controls to runtime state. Existing filter/sort rules are preserved and remain editable from the Collection Logic controls.</div><button type="button" onClick={wireProjectsQuery} style={primaryMini}>Wire search + pagination</button>{projectsQueryMessage && <div style={{ marginTop: 7, fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45 }}>{projectsQueryMessage}</div>}</div>}<Field label="SEO title" value={String(page.seoDefaults?.title || '')} placeholder="Page title shown in search results" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), title: v } })} /><Field label="SEO description" value={String(page.seoDefaults?.description || '')} placeholder="Concise search/social description" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), description: v } })} /><Field label="Canonical URL" value={String(page.seoDefaults?.canonical || '')} placeholder="Optional; normally leave blank" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), canonical: v } })} /><Field label="Open Graph image URL" value={String(page.seoDefaults?.ogImage || '')} placeholder="Optional https://… image" onChange={(v) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), ogImage: v } })} /><label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}><input type="checkbox" checked={Boolean(page.seoDefaults?.noindex)} onChange={(e) => onUpdate({ seoDefaults: { ...(page.seoDefaults || {}), noindex: e.target.checked } })} />Exclude this route from search indexing / sitemap</label></div>
}

function studioAnimationId(prefix = 'kf'): string {
  const uuid = typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${uuid}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
}

type KeyframeStarter = {
  label: string
  description: string
  steps: KeyframeDefinition['steps']
  reducedMotion?: KeyframeDefinition['reducedMotion']
  registration?: CssPropertyRegistration
}

const KEYFRAME_STARTERS: KeyframeStarter[] = [
  { label: 'Float', description: 'Reusable vertical float. Apply with Continuous + Alternate.', steps: [{ offset: 0, styles: { transform: 'translateY(0px)' } }, { offset: .5, styles: { transform: 'translateY(-12px)' } }, { offset: 1, styles: { transform: 'translateY(0px)' } }] },
  { label: 'Spin 360', description: 'Continuous rotation for rings, decorations and loaders.', steps: [{ offset: 0, styles: { transform: 'rotate(0deg)' } }, { offset: 1, styles: { transform: 'rotate(360deg)' } }] },
  { label: 'Glow Pulse', description: 'Animate a generic --glow-color driven shadow.', steps: [{ offset: 0, styles: { boxShadow: '0 0 8px var(--glow-color, rgba(124,58,237,.25))', opacity: .72 } }, { offset: 1, styles: { boxShadow: '0 0 34px var(--glow-color, rgba(124,58,237,.8))', opacity: 1 } }] },
  { label: 'Background Sweep', description: 'Moves oversized gradients for shimmer, aurora and grid backgrounds.', steps: [{ offset: 0, styles: { backgroundPosition: '200% 50%' } }, { offset: 1, styles: { backgroundPosition: '-20% 50%' } }] },
  { label: 'Mask Sweep', description: 'Moves a mask across the element for reveal/scanner effects.', steps: [{ offset: 0, styles: { maskPosition: '-120% 0', WebkitMaskPosition: '-120% 0' } }, { offset: 1, styles: { maskPosition: '120% 0', WebkitMaskPosition: '120% 0' } }] },
  { label: 'Path Travel', description: 'Travels along an authored offset-path without JavaScript.', steps: [{ offset: 0, styles: { offsetDistance: '0%' } }, { offset: 1, styles: { offsetDistance: '100%' } }] },
  { label: 'Angle 360', description: 'Animates a typed --angle variable for conic-gradient borders and rotating gradient fields.', steps: [{ offset: 0, styles: { '--angle': '0deg' } }, { offset: 1, styles: { '--angle': '360deg' } }], registration: { name: '--angle', syntax: '<angle>', inherits: false, initialValue: '0deg' } },
]

function KeyframeLibraryEditor({ tokens, onUpdate }: { tokens: DesignTokens; onUpdate: (tokens: DesignTokens) => void }) {
  const keyframes = tokens.keyframes || []
  const registrations = tokens.propertyRegistrations || []
  const setKeyframes = (next: KeyframeDefinition[]) => onUpdate({ ...tokens, keyframes: next })
  const setRegistrations = (next: CssPropertyRegistration[]) => onUpdate({ ...tokens, propertyRegistrations: next })
  const addBlank = () => setKeyframes([...keyframes, {
    id: studioAnimationId('kf'),
    label: `Keyframe ${keyframes.length + 1}`,
    category: 'Custom',
    reducedMotion: 'disable',
    steps: [{ offset: 0, styles: { opacity: 0 } }, { offset: 1, styles: { opacity: 1 } }],
  }])
  const addStarter = (starter: KeyframeStarter) => {
    const definition: KeyframeDefinition = {
      id: studioAnimationId('kf'),
      label: starter.label,
      description: starter.description,
      category: 'Starter',
      reducedMotion: starter.reducedMotion || 'disable',
      steps: starter.steps.map((step) => ({ offset: step.offset, styles: { ...step.styles } })),
    }
    const nextTokens: DesignTokens = { ...tokens, keyframes: [...keyframes, definition] }
    if (starter.registration && !registrations.some((entry) => entry.name === starter.registration?.name)) {
      nextTokens.propertyRegistrations = [...registrations, starter.registration]
    }
    onUpdate(nextTokens)
  }
  const updateDefinition = (index: number, patch: Partial<KeyframeDefinition>) => {
    const next = [...keyframes]
    next[index] = { ...next[index], ...patch }
    setKeyframes(next)
  }
  const updateStep = (definitionIndex: number, stepIndex: number, patch: Partial<KeyframeDefinition['steps'][number]>) => {
    const definition = keyframes[definitionIndex]
    const steps = definition.steps.map((step, index) => index === stepIndex ? { ...step, ...patch } : step)
      .sort((left, right) => left.offset - right.offset)
    updateDefinition(definitionIndex, { steps })
  }
  const addStep = (definitionIndex: number) => {
    const definition = keyframes[definitionIndex]
    if (definition.steps.length >= 32) return
    const existing = new Set(definition.steps.map((step) => Number(step.offset.toFixed(4))))
    let offset = .5
    for (let candidate = .05; candidate < 1; candidate += .05) if (!existing.has(Number(candidate.toFixed(4)))) { offset = Number(candidate.toFixed(4)); break }
    updateDefinition(definitionIndex, { steps: [...definition.steps, { offset, styles: { opacity: 1 } }].sort((left, right) => left.offset - right.offset) })
  }
  const removeStep = (definitionIndex: number, stepIndex: number) => {
    const definition = keyframes[definitionIndex]
    if (definition.steps.length <= 2) return
    updateDefinition(definitionIndex, { steps: definition.steps.filter((_, index) => index !== stepIndex) })
  }
  const duplicateDefinition = (definition: KeyframeDefinition) => setKeyframes([...keyframes, {
    ...definition,
    id: studioAnimationId('kf'),
    label: `${definition.label} Copy`,
    steps: definition.steps.map((step) => ({ offset: step.offset, styles: { ...step.styles } })),
  }])
  const addRegistration = () => {
    let suffix = 1
    let name = '--property'
    while (registrations.some((entry) => entry.name === name)) { suffix += 1; name = `--property-${suffix}` }
    setRegistrations([...registrations, { name, syntax: '<number>', inherits: false, initialValue: '0' }])
  }

  return <>
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <strong style={{ fontSize: 11 }}>Keyframe library</strong>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }}>Reusable layout-level keyframes. Steps are structured style maps, not raw <code>@keyframes</code> text, so they pass the same runtime CSS safety boundary.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '9px 0' }}>
        <button onClick={addBlank} style={primaryMini}>+ Blank keyframe</button>
        {KEYFRAME_STARTERS.map((starter) => <button key={starter.label} onClick={() => addStarter(starter)} title={starter.description} style={{ ...primaryMini, background: 'var(--surface-alt)', color: 'var(--text)', border: '1px solid var(--border)' }}>{starter.label}</button>)}
      </div>
      <div style={{ padding: '8px 9px', borderRadius: 6, background: 'var(--surface-alt)', color: 'var(--text-muted)', fontSize: 9, lineHeight: 1.5, marginBottom: 10 }}>
        Generic recipes: <strong>Comet border</strong> = Decoration + conic-gradient + mask + Spin/Angle keyframe. <strong>Scanner</strong> = Decoration + linear-gradient + translate/mask sweep. <strong>Neon pulse</strong> = border/shadow + Glow Pulse. No dedicated runtime effect is required.
      </div>
      {!keyframes.length ? <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '8px 0' }}>No reusable keyframes yet.</div> : null}
      {keyframes.map((definition, definitionIndex) => <details key={definition.id} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: 8, marginBottom: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>{definition.label} · {definition.steps.length} steps</summary>
        <div style={{ marginTop: 10 }}>
          <Field label="Name" value={definition.label} onChange={(value) => updateDefinition(definitionIndex, { label: String(value).slice(0, 120) || 'Keyframe' })} />
          <Field label="Category" value={definition.category || ''} onChange={(value) => updateDefinition(definitionIndex, { category: String(value).slice(0, 80) || undefined })} />
          <MultilineField label="Description" value={definition.description || ''} onChange={(value) => updateDefinition(definitionIndex, { description: String(value).slice(0, 500) || undefined })} rows={2} />
          <label style={{ display: 'block', marginBottom: 9 }}><span style={labelStyle}>Reduced motion</span><select value={definition.reducedMotion || 'disable'} onChange={(event) => updateDefinition(definitionIndex, { reducedMotion: event.target.value as KeyframeDefinition['reducedMotion'] })} style={inputStyle}><option value="disable">Disable motion</option><option value="reduce">Run once instantly / final state</option><option value="allow-essential">Allow essential motion</option></select></label>

          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Steps</div>
          {definition.steps.map((step, stepIndex) => <div key={`${definition.id}-${stepIndex}-${step.offset}`} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 8, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 7, alignItems: 'start' }}>
              <Field label="Offset %" type="number" value={Number((step.offset * 100).toFixed(2))} onChange={(value) => updateStep(definitionIndex, stepIndex, { offset: Math.max(0, Math.min(1, Number(value) / 100)) })} />
              <button disabled={definition.steps.length <= 2} onClick={() => removeStep(definitionIndex, stepIndex)} title="Delete step" style={{ ...dangerMini, marginTop: 17 }}>×</button>
            </div>
            <JsonField label="Step styles" value={step.styles} onChange={(value) => updateStep(definitionIndex, stepIndex, { styles: value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string | number> : {} })} />
          </div>)}
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={definition.steps.length >= 32} onClick={() => addStep(definitionIndex)} style={primaryMini}>+ Step</button>
            <button onClick={() => duplicateDefinition(definition)} style={{ ...primaryMini, background: 'var(--surface-alt)', color: 'var(--text)', border: '1px solid var(--border)' }}>Duplicate</button>
            <button onClick={() => setKeyframes(keyframes.filter((_, index) => index !== definitionIndex))} style={dangerMini}>Delete keyframe</button>
          </div>
        </div>
      </details>)}
    </div>

    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 11 }}>Typed CSS custom properties</strong>
        <button onClick={addRegistration} style={primaryMini}>+ @property</button>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, margin: '4px 0 9px' }}>Use typed registrations when a keyframe needs smooth interpolation of variables such as <code>--angle</code>, lengths, colors or numbers. Names remain layout-scoped in data but CSS registration itself is document-global, so use distinctive variable names.</div>
      {registrations.map((registration, index) => <div key={`${registration.name}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: 8, marginBottom: 7 }}>
        <Field label="Name" value={registration.name} onChange={(value) => { const next = [...registrations]; next[index] = { ...registration, name: String(value).trim() }; setRegistrations(next) }} placeholder="--angle" />
        <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Syntax</span><select value={registration.syntax} onChange={(event) => { const next = [...registrations]; next[index] = { ...registration, syntax: event.target.value as CssPropertyRegistration['syntax'] }; setRegistrations(next) }} style={inputStyle}>{['<angle>','<length>','<number>','<percentage>','<color>','<length-percentage>'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <Field label="Initial value" value={registration.initialValue} onChange={(value) => { const next = [...registrations]; next[index] = { ...registration, initialValue: String(value) }; setRegistrations(next) }} />
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}><input type="checkbox" checked={registration.inherits} onChange={(event) => { const next = [...registrations]; next[index] = { ...registration, inherits: event.target.checked }; setRegistrations(next) }} />Inherited by descendants</label>
        <button onClick={() => setRegistrations(registrations.filter((_, itemIndex) => itemIndex !== index))} style={dangerMini}>Delete registration</button>
      </div>)}
    </div>
  </>
}

function TokensTab({ tokens, onUpdate }: { tokens: DesignTokens; onUpdate: (tokens: DesignTokens) => void }) {
  const [newKey, setNewKey] = React.useState('--site-')
  const variables = tokens.variables || {}
  const breakpoints = {
    ...DEFAULT_PREVIEW_WIDTHS,
    ...DEFAULT_RESPONSIVE_THRESHOLDS,
    ...(tokens.breakpoints || {}),
  }
  const updateVariables = (next: Record<string, string>) => onUpdate({ ...tokens, variables: next })
  const updatePreviewWidth = (key: 'desktop' | 'tablet' | 'mobile', raw: number) => {
    const value = Math.max(240, Number(raw) || DEFAULT_PREVIEW_WIDTHS[key])
    const next = { ...breakpoints }
    if (key === 'mobile') next.mobile = Math.min(value, next.tablet - 1)
    if (key === 'tablet') next.tablet = Math.max(next.mobile + 1, Math.min(value, next.desktop - 1))
    if (key === 'desktop') next.desktop = Math.max(next.tablet + 1, value)
    onUpdate({ ...tokens, breakpoints: next })
  }
  const updateThreshold = (key: 'mobileMax' | 'tabletMax', raw: number) => {
    const value = Math.max(240, Number(raw) || DEFAULT_RESPONSIVE_THRESHOLDS[key])
    const next = { ...breakpoints }
    if (key === 'mobileMax') next.mobileMax = Math.min(value, next.tabletMax - 1)
    else next.tabletMax = Math.max(next.mobileMax + 1, value)
    onUpdate({ ...tokens, breakpoints: next })
  }
  return <div style={sectionStyle}>
    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Layout design tokens belong to the website design. They are independent from the Studio application theme.</p>
    <strong style={{ fontSize: 11 }}>Preview widths</strong><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }}>These numbers size the Desktop, Tablet and Mobile frames in Studio. They do not decide which mode a real browser uses.</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, margin: '8px 0 14px' }}>{(['desktop', 'tablet', 'mobile'] as const).map((key) => <Field key={key} type="number" label={pretty(key)} value={breakpoints[key]} onChange={(value) => updatePreviewWidth(key, Number(value))} />)}</div>
    <strong style={{ fontSize: 11 }}>Runtime responsive thresholds</strong><div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 4 }}>A real viewport ≤ Mobile max uses Mobile. Above that and ≤ Tablet max uses Tablet. Larger viewports use Desktop.</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '8px 0 14px' }}><Field type="number" label="Mobile max" value={breakpoints.mobileMax} onChange={(value) => updateThreshold('mobileMax', Number(value))} /><Field type="number" label="Tablet max" value={breakpoints.tabletMax} onChange={(value) => updateThreshold('tabletMax', Number(value))} /></div>
    <strong style={{ fontSize: 11 }}>Fonts</strong><div style={{ marginTop: 8 }}><Field label="Heading font" value={tokens.fonts?.heading || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), heading: String(value) } })} /><Field label="Body font" value={tokens.fonts?.body || ''} onChange={(value) => onUpdate({ ...tokens, fonts: { ...(tokens.fonts || {}), body: String(value) } })} /></div>
    <strong style={{ fontSize: 11 }}>CSS variables</strong><div style={{ marginTop: 8 }}>{Object.entries(variables).map(([key, value]) => <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 5, marginBottom: 6 }}><input value={key} readOnly style={{ ...inputStyle, color: 'var(--text-muted)' }} /><input value={value} onChange={(e) => updateVariables({ ...variables, [key]: e.target.value })} style={inputStyle} /><button onClick={() => { const next = { ...variables }; delete next[key]; updateVariables(next) }} style={dangerMini}>×</button></div>)}</div><div style={{ display: 'flex', gap: 6, marginTop: 10 }}><input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="--glow-color" style={inputStyle} /><button onClick={() => { const candidate = newKey.trim().startsWith('--') ? newKey.trim() : `--${newKey.trim()}`; if (candidate !== '--' && isSafeCssCustomPropertyName(candidate) && !variables[candidate]) { updateVariables({ ...variables, [candidate]: '#ffffff' }); setNewKey('') } }} style={primaryMini}>Add</button></div>
    <KeyframeLibraryEditor tokens={tokens} onUpdate={onUpdate} />
  </div>
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
const primaryMini: React.CSSProperties = { padding: '6px 9px', border: 0, borderRadius: 5, background: 'var(--primary)', color: 'var(--primary-text)', fontSize: 10, cursor: 'pointer' }
const dangerMini: React.CSSProperties = { padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer' }
