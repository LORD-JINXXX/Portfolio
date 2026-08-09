import { useCallback, useMemo, useState } from 'react'
import {
  DEFAULT_DESIGN_TOKENS,
  LAYOUT_SCHEMA_VERSION,
  type DesignTokens,
  type EditorDocument,
  type EditorPage,
  type LayoutPageSchema,
  type LayoutVersionStatus,
  type PageType,
  type ResponsiveStyles,
  type ResponsiveMode,
  type StyleMap,
  type StudioNode,
} from '@platform/contracts'

export type { StudioNode, LayoutPageSchema, ResponsiveMode, EditorPage, EditorDocument } from '@platform/contracts'

export type EditorTool =
  | 'select' | 'pan' | 'text' | 'div' | 'section' | 'container' | 'image' | 'button' | 'collection'
  | 'navbar' | 'footer' | 'heading' | 'hero' | 'card' | 'form' | 'video' | 'map' | 'social'
  | 'header' | 'main' | 'aside' | 'article' | 'nav' | 'details' | 'summary'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'pre' | 'blockquote'
  | 'ul' | 'ol' | 'li' | 'a' | 'input' | 'textarea' | 'img' | 'figure' | 'figcaption'
  | 'audio' | 'iframe' | 'hr' | 'br' | 'table' | 'label' | 'select' | 'option'
  | 'progress' | 'meter' | 'dialog' | 'mark' | 'code'

export interface EditorState {
  layoutId: string | null
  layoutName: string
  layoutSlug: string
  layoutDescription: string
  versionId: string | null
  versionNumber: number
  versionStatus: LayoutVersionStatus
  designTokens: DesignTokens
  pageId: string
  pageName: string
  schema: LayoutPageSchema
  pages: EditorPage[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
  tool: EditorTool
  mode: ResponsiveMode
  zoom: number
  history: LayoutPageSchema[]
  historyIndex: number
  clipboard: StudioNode | null
  isDragging: boolean
  dragOverId: string | null
  dragPosition: 'before' | 'inside' | 'after' | null
  dirty: boolean
}

function randomUuidFallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = Math.floor(Math.random() * 16)
    const v = char === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function genId(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  return cryptoObj?.randomUUID ? cryptoObj.randomUUID() : randomUuidFallback()
}

export function slugify(value: string): string {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'page'
}

export function defaultRouteForPage(slug: string, pageType: PageType): string {
  if (pageType === 'home' || slug === 'home') return '/'
  if (pageType === 'system') return `__${slug}`
  return `/${slug}`
}

export const CONTAINER_NODE_TYPES: ReadonlySet<string> = new Set([
  'section', 'container', 'div', 'collection', 'navbar', 'footer', 'hero', 'card', 'form',
  'header', 'main', 'aside', 'article', 'nav', 'details', 'ul', 'ol', 'li', 'figure',
  'table', 'dialog', 'blockquote',
])

export function canNodeTypeContainChildren(type: string): boolean {
  return CONTAINER_NODE_TYPES.has(type)
}

export function canNodeContainChildren(node: StudioNode): boolean {
  return canNodeTypeContainChildren(node.type)
}

export class EditorDocumentHydrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EditorDocumentHydrationError'
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parsePersistedJson(value: unknown, label: string): unknown {
  let parsed = value
  for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      throw new EditorDocumentHydrationError(`${label} contains invalid JSON.`)
    }
  }
  return parsed
}

function normalizedStyles(value: unknown): ResponsiveStyles {
  const source = objectRecord(value)
  const styleMap = (candidate: unknown): StyleMap | null => {
    const record = objectRecord(candidate)
    if (!record) return null
    return Object.fromEntries(Object.entries(record).filter(([, styleValue]) => styleValue === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof styleValue))) as StyleMap
  }
  const desktop = styleMap(source?.desktop)
  const tablet = styleMap(source?.tablet)
  const mobile = styleMap(source?.mobile)
  if (!desktop && !tablet && !mobile) return { desktop: {} }
  return {
    ...(desktop ? { desktop } : {}),
    ...(tablet ? { tablet } : {}),
    ...(mobile ? { mobile } : {}),
  }
}

export function normalizeStudioNode(value: unknown, path = 'root[0]'): StudioNode {
  const source = objectRecord(value)
  if (!source) throw new EditorDocumentHydrationError(`${path} must be a node object.`)
  if (typeof source.id !== 'string' || !source.id) throw new EditorDocumentHydrationError(`${path} is missing a node ID.`)
  if (typeof source.type !== 'string' || !source.type) throw new EditorDocumentHydrationError(`${path} is missing a node type.`)

  const childValue = source.children
  if (childValue !== undefined && childValue !== null && !Array.isArray(childValue)) {
    throw new EditorDocumentHydrationError(`${path}.children must be an array when present.`)
  }
  const children = Array.isArray(childValue)
    ? childValue.map((child, index) => normalizeStudioNode(child, `${path}.children[${index}]`))
    : canNodeTypeContainChildren(source.type) ? [] : undefined

  const { children: _children, styles: _styles, ...rest } = source
  return {
    ...rest,
    id: source.id,
    type: source.type,
    styles: normalizedStyles(source.styles),
    ...(children !== undefined ? { children } : {}),
  } as StudioNode
}

export function normalizeLayoutPageSchema(value: unknown, pageId: string): LayoutPageSchema {
  const parsed = parsePersistedJson(value, `Page ${pageId} layout tree`)
  const source = objectRecord(parsed)
  const rootValue = Array.isArray(parsed) ? parsed : source?.root ?? source?.nodes
  if (!Array.isArray(rootValue)) {
    throw new EditorDocumentHydrationError(`Page ${pageId} layout tree must contain a root node array.`)
  }

  return {
    schemaVersion: typeof source?.schemaVersion === 'number' && source.schemaVersion > 0 ? source.schemaVersion : LAYOUT_SCHEMA_VERSION,
    pageId,
    ...(typeof source?.collectionName === 'string' ? { collectionName: source.collectionName as LayoutPageSchema['collectionName'] } : {}),
    root: rootValue.map((node, index) => normalizeStudioNode(node, `Page ${pageId} root[${index}]`)),
  }
}

export function normalizeEditorDocument(document: EditorDocument): EditorDocument {
  if (!document || !Array.isArray(document.pages) || document.pages.length === 0) {
    throw new EditorDocumentHydrationError('Layout document must contain at least one page.')
  }
  return {
    ...document,
    pages: document.pages.map((page, index) => {
      if (!page || typeof page.id !== 'string' || !page.id) {
        throw new EditorDocumentHydrationError(`Layout page at index ${index} is missing its ID.`)
      }
      return { ...page, schema: normalizeLayoutPageSchema(page.schema, page.id) }
    }),
  }
}

export function walkStudioNodes(nodes: readonly StudioNode[], visitor: (node: StudioNode) => void): void {
  if (!Array.isArray(nodes)) throw new EditorDocumentHydrationError('Studio node root must be an array.')
  nodes.forEach((node) => {
    visitor(node)
    if (node.children) walkStudioNodes(node.children, visitor)
  })
}

export function createNode(type: EditorTool, overrides: Partial<StudioNode> = {}): StudioNode {
  const tagMap: Record<string, string> = {
    text: 'p', heading: 'h2', div: 'div', section: 'section', container: 'div', image: 'img', button: 'button',
    collection: 'div', navbar: 'nav', footer: 'footer', hero: 'section', card: 'article', form: 'form', video: 'video',
    map: 'div', social: 'div', header: 'header', main: 'main', aside: 'aside', article: 'article', nav: 'nav',
    details: 'details', summary: 'summary', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
    p: 'p', span: 'span', pre: 'pre', blockquote: 'blockquote', ul: 'ul', ol: 'ol', li: 'li', a: 'a', input: 'input',
    textarea: 'textarea', img: 'img', figure: 'figure', figcaption: 'figcaption', audio: 'audio', iframe: 'iframe', hr: 'hr',
    br: 'br', table: 'table', label: 'label', select: 'select', option: 'option', progress: 'progress', meter: 'meter',
    dialog: 'dialog', mark: 'mark', code: 'code',
  }
  const textTypes = new Set(['text', 'heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'a', 'button', 'li', 'summary', 'mark', 'code', 'figcaption'])
  const defaultText: Record<string, string> = {
    heading: 'Heading', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6',
    p: 'Paragraph text', text: 'Text', span: 'Text', button: 'Button', a: 'Link', label: 'Label', li: 'List item', summary: 'Summary', mark: 'Highlighted text', code: 'const value = true', figcaption: 'Figure caption',
  }
  const node: StudioNode = {
    id: genId(),
    type,
    tag: tagMap[type] || 'div',
    props: textTypes.has(type) ? { text: defaultText[type] || 'Text' } : {},
    styles: { desktop: {} },
    layout: { mode: 'flow' },
    meta: { label: defaultText[type] || type.charAt(0).toUpperCase() + type.slice(1) },
    children: canNodeTypeContainChildren(type) ? [] : undefined,
  }
  if (type === 'section' || type === 'hero') {
    node.styles.desktop = { minHeight: type === 'hero' ? '70vh' : '160px', padding: '64px 32px', position: 'relative' }
    node.meta = { ...node.meta, sectionLabel: type === 'hero' ? 'Hero' : 'Section' }
  }
  if (type === 'container') node.styles.desktop = { width: 'min(1120px, 100%)', margin: '0 auto', padding: '0 24px' }
  if (type === 'img' || type === 'image') node.props = { src: '', alt: 'Image' }
  if (type === 'button') node.styles.desktop = { padding: '12px 22px', borderRadius: '10px', border: '0', cursor: 'pointer' }
  if (type === 'collection') {
    node.props = { collection: 'projects', emptyText: 'No items' }
    node.bindings = { items: { type: 'collection', collection: 'projects', limit: 6 } }
    node.styles.desktop = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' }
  }
  return mergeNode(node, overrides)
}

function mergeNode(base: StudioNode, overrides: Partial<StudioNode>): StudioNode {
  return {
    ...base,
    ...overrides,
    props: { ...(base.props || {}), ...(overrides.props || {}) },
    styles: {
      desktop: { ...(base.styles.desktop || {}), ...(overrides.styles?.desktop || {}) },
      tablet: { ...(base.styles.tablet || {}), ...(overrides.styles?.tablet || {}) },
      mobile: { ...(base.styles.mobile || {}), ...(overrides.styles?.mobile || {}) },
    },
    layout: overrides.layout ? { ...(base.layout || { mode: 'flow' }), ...overrides.layout } : base.layout,
    meta: { ...(base.meta || {}), ...(overrides.meta || {}) },
    children: overrides.children === undefined ? base.children : overrides.children,
  }
}

export function createEmptyPage(name = 'Home', pageType: PageType = 'home'): EditorPage {
  const id = genId()
  const slug = pageType === 'home' ? 'home' : slugify(name)
  return {
    id,
    name,
    slug,
    pageType,
    routePattern: defaultRouteForPage(slug, pageType),
    seoDefaults: { title: name, description: '' },
    sortOrder: pageType === 'system' ? -1 : 0,
    schema: { schemaVersion: LAYOUT_SCHEMA_VERSION, pageId: id, root: [] },
  }
}

export function createBlankDocument(name = 'Untitled Layout'): EditorDocument {
  const header = createEmptyPage('Header', 'system')
  header.slug = '_header'; header.routePattern = '__header'; header.sortOrder = -100
  header.schema.root = [createNode('header', {
    styles: { desktop: { width: '100%', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--site-surface)', color: 'var(--site-text)' } },
    children: [
      createNode('span', { props: { text: 'Brand' }, styles: { desktop: { fontSize: '18px', fontWeight: 700 } } }),
      createNode('nav', { styles: { desktop: { display: 'flex', gap: '20px' } }, children: [
        createNode('a', { props: { text: 'Home', href: '/' } }),
        createNode('a', { props: { text: 'Projects', href: '/projects' } }),
        createNode('a', { props: { text: 'About', href: '/about' } }),
      ] }),
    ],
  })]

  const home = createEmptyPage('Home', 'home')
  home.sortOrder = 0
  home.schema.root = [createNode('section', {
    meta: { label: 'Hero', sectionLabel: 'Hero', adminLabel: 'Hero' },
    styles: { desktop: { minHeight: '70vh', padding: '96px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--site-bg)', color: 'var(--site-text)' } },
    children: [
      createNode('h1', { props: { text: 'Hero Heading' }, bindings: { text: { type: 'content', key: 'home.hero.heading', label: 'Hero Heading', contentType: 'text', sample: 'Hero Heading', required: true } }, styles: { desktop: { fontSize: 'clamp(44px, 7vw, 88px)', lineHeight: 1, margin: 0 } } }),
      createNode('p', { props: { text: 'Hero description' }, bindings: { text: { type: 'content', key: 'home.hero.description', label: 'Hero Description', contentType: 'text', sample: 'A short introduction goes here.' } }, styles: { desktop: { fontSize: '18px', maxWidth: '680px', color: 'var(--site-muted)', marginTop: '24px' } } }),
    ],
  })]

  const footer = createEmptyPage('Footer', 'system')
  footer.slug = '_footer'; footer.routePattern = '__footer'; footer.sortOrder = 10000
  footer.schema.root = [createNode('footer', {
    styles: { desktop: { padding: '36px 28px', background: 'var(--site-surface)', color: 'var(--site-muted)', textAlign: 'center' } },
    children: [createNode('p', { props: { text: '© 2026 Portfolio' }, bindings: { text: { type: 'content', key: 'footer.copyright', label: 'Footer Copyright', contentType: 'text', sample: '© 2026 Portfolio' } } })],
  })]

  return {
    layoutId: null,
    layoutName: name,
    layoutSlug: slugify(name),
    layoutDescription: '',
    versionId: null,
    versionNumber: 1,
    versionStatus: 'draft',
    designTokens: JSON.parse(JSON.stringify(DEFAULT_DESIGN_TOKENS)),
    pages: [header, home, footer],
  }
}

export function findNodeById(root: StudioNode[], id: string): StudioNode | null {
  for (const node of root) {
    if (node.id === id) return node
    const found = node.children ? findNodeById(node.children, id) : null
    if (found) return found
  }
  return null
}

export function findParentById(root: StudioNode[], id: string, parent: StudioNode | null = null): { parent: StudioNode | null; index: number } {
  for (let i = 0; i < root.length; i += 1) {
    const node = root[i]
    if (node.id === id) return { parent, index: i }
    if (node.children?.length) {
      const found = findParentById(node.children, id, node)
      if (found.index >= 0) return found
    }
  }
  return { parent: null, index: -1 }
}

export function isDescendant(root: StudioNode[], ancestorId: string, candidateId: string): boolean {
  const ancestor = findNodeById(root, ancestorId)
  return Boolean(ancestor?.children && findNodeById(ancestor.children, candidateId))
}

export type NodeDropPosition = 'before' | 'inside' | 'after'
export type NodeMoveRejection = 'source-not-found' | 'source-locked' | 'source-parent-locked' | 'parent-not-found' | 'parent-locked' | 'parent-cannot-contain' | 'self-drop' | 'descendant-cycle' | 'no-change'

export interface NodeDropDestination {
  parentId: string | null
  index: number
}

export interface NodeMoveResult {
  root: StudioNode[]
  moved: boolean
  movedNodeId: string | null
  rejection?: NodeMoveRejection
}

interface NodeMovePlan extends NodeDropDestination {
  node: StudioNode
}

function planNodeMove(root: StudioNode[], nodeId: string, targetParentId: string | null, targetIndex: number): NodeMovePlan | NodeMoveRejection {
  const node = findNodeById(root, nodeId)
  if (!node) return 'source-not-found'
  if (node.meta?.locked) return 'source-locked'
  if (targetParentId === nodeId) return 'self-drop'
  if (targetParentId && isDescendant(root, nodeId, targetParentId)) return 'descendant-cycle'

  const source = findParentById(root, nodeId)
  if (source.index < 0) return 'source-not-found'
  if (source.parent?.meta?.locked) return 'source-parent-locked'

  const targetParent = targetParentId ? findNodeById(root, targetParentId) : null
  if (targetParentId && !targetParent) return 'parent-not-found'
  if (targetParent?.meta?.locked) return 'parent-locked'
  if (targetParent && !canNodeContainChildren(targetParent)) return 'parent-cannot-contain'

  const sourceParentId = source.parent?.id || null
  const targetLength = targetParent ? (targetParent.children?.length || 0) : root.length
  let index = Number.isFinite(targetIndex) ? Math.trunc(targetIndex) : targetLength
  index = Math.max(0, Math.min(targetLength, index))
  if (sourceParentId === targetParentId && source.index < index) index -= 1
  const availableLength = targetLength - (sourceParentId === targetParentId ? 1 : 0)
  index = Math.max(0, Math.min(availableLength, index))
  if (sourceParentId === targetParentId && source.index === index) return 'no-change'
  return { node, parentId: targetParentId, index }
}

export function canMoveNode(root: StudioNode[], nodeId: string, targetParentId: string | null, targetIndex: number): boolean {
  return typeof planNodeMove(root, nodeId, targetParentId, targetIndex) !== 'string'
}

export function resolveNodeDropTarget(root: StudioNode[], targetId: string, position: NodeDropPosition): NodeDropDestination | null {
  const target = findNodeById(root, targetId)
  if (!target) return null
  if (position === 'inside') return canNodeContainChildren(target) && !target.meta?.locked ? { parentId: target.id, index: target.children?.length || 0 } : null
  const location = findParentById(root, targetId)
  if (location.index < 0) return null
  return { parentId: location.parent?.id || null, index: position === 'before' ? location.index : location.index + 1 }
}

export function removeNodeById(root: StudioNode[], id: string): StudioNode[] {
  return root.filter((node) => node.id !== id).map((node) => ({ ...node, children: node.children ? removeNodeById(node.children, id) : node.children }))
}

export function insertNode(root: StudioNode[], parentId: string | null, node: StudioNode, index?: number): StudioNode[] {
  if (parentId === null) {
    const copy = [...root]
    const normalized = typeof index === 'number' && Number.isFinite(index) ? Math.max(0, Math.min(copy.length, index)) : copy.length
    copy.splice(normalized, 0, node)
    return copy
  }
  return root.map((item) => {
    if (item.id === parentId) {
      const children = [...(item.children || [])]
      const normalized = typeof index === 'number' && Number.isFinite(index) ? Math.max(0, Math.min(children.length, index)) : children.length
      children.splice(normalized, 0, node)
      return { ...item, children }
    }
    return item.children ? { ...item, children: insertNode(item.children, parentId, node, index) } : item
  })
}

export function moveNodeInTree(root: StudioNode[], nodeId: string, targetParentId: string | null, targetIndex: number): NodeMoveResult {
  const plan = planNodeMove(root, nodeId, targetParentId, targetIndex)
  if (typeof plan === 'string') return { root, moved: false, movedNodeId: null, rejection: plan }
  const removed = removeNodeById(root, nodeId)
  return { root: insertNode(removed, plan.parentId, plan.node, plan.index), moved: true, movedNodeId: nodeId }
}

export function commitNodeMove(schema: LayoutPageSchema, history: LayoutPageSchema[], historyIndex: number, nodeId: string, targetParentId: string | null, targetIndex: number) {
  const result = moveNodeInTree(schema.root, nodeId, targetParentId, targetIndex)
  if (!result.moved) return { schema, history, historyIndex, moved: false, movedNodeId: null, rejection: result.rejection }
  const nextSchema = { ...schema, root: result.root }
  const nextHistory = [...history.slice(0, historyIndex + 1), cloneNode(nextSchema)]
  return { schema: nextSchema, history: nextHistory, historyIndex: nextHistory.length - 1, moved: true, movedNodeId: nodeId }
}

export function cloneNode<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }
export function cloneNodeWithFreshIds(node: StudioNode): StudioNode {
  const cloned = cloneNode(node)
  const refresh = (current: StudioNode): StudioNode => ({ ...current, id: genId(), children: current.children?.map(refresh) })
  return refresh(cloned)
}
export function deepCloneSchema(schema: LayoutPageSchema): LayoutPageSchema { return cloneNode(schema) }

function updateNodeInArray(nodes: StudioNode[], nodeId: string, updater: (node: StudioNode) => StudioNode): StudioNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node)
    return node.children ? { ...node, children: updateNodeInArray(node.children, nodeId, updater) } : node
  })
}

export function useEditorState(initialDocument?: EditorDocument) {
  const initial = normalizeEditorDocument(initialDocument || createBlankDocument())
  const initialPage = initial.pages.find((page) => page.pageType === 'home') || initial.pages[0]
  const [state, setState] = useState<EditorState>(() => ({
    ...initial,
    layoutSlug: initial.layoutSlug || slugify(initial.layoutName),
    layoutDescription: initial.layoutDescription || '',
    pageId: initialPage.id,
    pageName: initialPage.name,
    schema: cloneNode(initialPage.schema),
    selectedNodeId: null,
    hoveredNodeId: null,
    tool: 'select',
    mode: 'desktop',
    zoom: 1,
    history: [cloneNode(initialPage.schema)],
    historyIndex: 0,
    clipboard: null,
    isDragging: false,
    dragOverId: null,
    dragPosition: null,
    dirty: false,
  }))

  const currentPage = useMemo(() => state.pages.find((page) => page.id === state.pageId), [state.pages, state.pageId])

  const syncCurrentSchema = useCallback((prev: EditorState, newSchema: LayoutPageSchema, pushHistory = true): EditorState => {
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema: newSchema } : page)
    const history = pushHistory ? [...prev.history.slice(0, prev.historyIndex + 1), cloneNode(newSchema)] : prev.history
    return { ...prev, pages, schema: newSchema, history, historyIndex: pushHistory ? history.length - 1 : prev.historyIndex, dirty: true }
  }, [])

  const loadDocument = useCallback((document: EditorDocument, preferredPageId?: string) => {
    const normalized = normalizeEditorDocument(document)
    const page = normalized.pages.find((item) => item.id === preferredPageId) || normalized.pages.find((item) => item.pageType === 'home') || normalized.pages[0]
    setState((prev) => ({
      ...prev,
      ...cloneNode(normalized),
      layoutSlug: normalized.layoutSlug || slugify(normalized.layoutName),
      layoutDescription: normalized.layoutDescription || '',
      pageId: page.id,
      pageName: page.name,
      schema: cloneNode(page.schema),
      selectedNodeId: null,
      hoveredNodeId: null,
      history: [cloneNode(page.schema)],
      historyIndex: 0,
      dirty: false,
    }))
  }, [])

  const setDocumentMeta = useCallback((patch: Partial<Pick<EditorState, 'layoutName' | 'layoutSlug' | 'layoutDescription' | 'designTokens'>>) => {
    setState((prev) => ({ ...prev, ...patch, dirty: true }))
  }, [])

  const updateSchema = useCallback((updater: (schema: LayoutPageSchema) => LayoutPageSchema) => {
    setState((prev) => syncCurrentSchema(prev, updater(prev.schema)))
  }, [syncCurrentSchema])

  const updateNode = useCallback((nodeId: string, updater: (node: StudioNode) => StudioNode) => {
    updateSchema((schema) => ({ ...schema, root: updateNodeInArray(schema.root, nodeId, updater) }))
  }, [updateSchema])

  const addNode = useCallback((type: EditorTool, parentId: string | null = null, index?: number) => {
    const node = createNode(type)
    setState((prev) => {
      const next = { ...prev.schema, root: insertNode(prev.schema.root, parentId, node, index) }
      return { ...syncCurrentSchema(prev, next), selectedNodeId: node.id }
    })
    return node.id
  }, [syncCurrentSchema])

  const deleteNode = useCallback((nodeId: string) => {
    setState((prev) => {
      if (!findNodeById(prev.schema.root, nodeId)) return prev
      const next = { ...prev.schema, root: removeNodeById(prev.schema.root, nodeId) }
      const selectedGone = prev.selectedNodeId === nodeId || Boolean(prev.selectedNodeId && isDescendant(prev.schema.root, nodeId, prev.selectedNodeId))
      return { ...syncCurrentSchema(prev, next), selectedNodeId: selectedGone ? null : prev.selectedNodeId }
    })
  }, [syncCurrentSchema])

  const deleteSelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId) return prev
    const next = { ...prev.schema, root: removeNodeById(prev.schema.root, prev.selectedNodeId) }
    return { ...syncCurrentSchema(prev, next), selectedNodeId: null }
  }), [syncCurrentSchema])

  const copySelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId) return prev
    const node = findNodeById(prev.schema.root, prev.selectedNodeId)
    return node ? { ...prev, clipboard: cloneNode(node) } : prev
  }), [])

  const pasteClipboard = useCallback(() => setState((prev) => {
    if (!prev.clipboard) return prev
    const cloned = cloneNodeWithFreshIds(prev.clipboard)
    const parentId = prev.selectedNodeId && findNodeById(prev.schema.root, prev.selectedNodeId)?.children !== undefined ? prev.selectedNodeId : null
    const nextRoot = insertNode(prev.schema.root, parentId, cloned)
    return { ...syncCurrentSchema(prev, { ...prev.schema, root: nextRoot }), selectedNodeId: cloned.id }
  }), [syncCurrentSchema])

  const duplicateSelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId) return prev
    const node = findNodeById(prev.schema.root, prev.selectedNodeId)
    if (!node) return prev
    const cloned = cloneNodeWithFreshIds(node)
    const location = findParentById(prev.schema.root, node.id)
    const nextRoot = insertNode(prev.schema.root, location.parent?.id || null, cloned, location.index + 1)
    return { ...syncCurrentSchema(prev, { ...prev.schema, root: nextRoot }), selectedNodeId: cloned.id }
  }), [syncCurrentSchema])

  const moveNode = useCallback((nodeId: string, targetParentId: string | null, targetIndex: number) => {
    setState((prev) => {
      const committed = commitNodeMove(prev.schema, prev.history, prev.historyIndex, nodeId, targetParentId, targetIndex)
      if (!committed.moved) return prev
      const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema: committed.schema } : page)
      return { ...prev, pages, schema: committed.schema, history: committed.history, historyIndex: committed.historyIndex, selectedNodeId: nodeId, dirty: true }
    })
  }, [])

  const undo = useCallback(() => setState((prev) => {
    if (prev.historyIndex <= 0) return prev
    const index = prev.historyIndex - 1
    const schema = cloneNode(prev.history[index])
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema } : page)
    return { ...prev, schema, pages, historyIndex: index, selectedNodeId: null, dirty: true }
  }), [])

  const redo = useCallback(() => setState((prev) => {
    if (prev.historyIndex >= prev.history.length - 1) return prev
    const index = prev.historyIndex + 1
    const schema = cloneNode(prev.history[index])
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema } : page)
    return { ...prev, schema, pages, historyIndex: index, selectedNodeId: null, dirty: true }
  }), [])

  const switchPage = useCallback((pageId: string) => setState((prev) => {
    const page = prev.pages.find((item) => item.id === pageId)
    if (!page) return prev
    return { ...prev, pageId, pageName: page.name, schema: cloneNode(page.schema), history: [cloneNode(page.schema)], historyIndex: 0, selectedNodeId: null }
  }), [])

  const addPage = useCallback((name: string, pageType: PageType = 'standard') => {
    const page = createEmptyPage(name, pageType)
    setState((prev) => {
      page.sortOrder = Math.max(0, ...prev.pages.filter((item) => item.pageType !== 'system').map((item) => item.sortOrder)) + 1
      return { ...prev, pages: [...prev.pages, page], pageId: page.id, pageName: page.name, schema: cloneNode(page.schema), history: [cloneNode(page.schema)], historyIndex: 0, selectedNodeId: null, dirty: true }
    })
    return page.id
  }, [])

  const duplicatePage = useCallback((pageId: string) => setState((prev) => {
    const source = prev.pages.find((page) => page.id === pageId)
    if (!source || source.pageType === 'system') return prev
    const id = genId()
    const clonedSchema = cloneNode(source.schema)
    const refreshTree = (node: StudioNode): StudioNode => ({ ...node, id: genId(), children: node.children?.map(refreshTree) })
    clonedSchema.pageId = id
    clonedSchema.root = clonedSchema.root.map(refreshTree)
    const page: EditorPage = { ...cloneNode(source), id, name: `${source.name} Copy`, slug: `${source.slug}-copy`, routePattern: `${source.routePattern}-copy`, sortOrder: source.sortOrder + 1, schema: clonedSchema }
    const shifted = prev.pages.map((item) => item.pageType !== 'system' && item.sortOrder > source.sortOrder ? { ...item, sortOrder: item.sortOrder + 1 } : item)
    return { ...prev, pages: [...shifted, page], pageId: id, pageName: page.name, schema: clonedSchema, history: [clonedSchema], historyIndex: 0, selectedNodeId: null, dirty: true }
  }), [])

  const deletePage = useCallback((pageId: string) => setState((prev) => {
    const target = prev.pages.find((page) => page.id === pageId)
    if (!target || target.pageType === 'system') return prev
    const nonSystem = prev.pages.filter((page) => page.pageType !== 'system')
    if (nonSystem.length <= 1) return prev
    const pages = prev.pages.filter((page) => page.id !== pageId)
    const nextPage = pages.find((page) => page.pageType === 'home') || pages.find((page) => page.pageType !== 'system') || pages[0]
    return { ...prev, pages, pageId: nextPage.id, pageName: nextPage.name, schema: cloneNode(nextPage.schema), history: [cloneNode(nextPage.schema)], historyIndex: 0, selectedNodeId: null, dirty: true }
  }), [])

  const updatePage = useCallback((pageId: string, patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => setState((prev) => {
    const pages = prev.pages.map((page) => page.id === pageId ? { ...page, ...patch } : page)
    const current = pages.find((page) => page.id === prev.pageId)
    return { ...prev, pages, pageName: current?.name || prev.pageName, dirty: true }
  }), [])

  const updatePageName = useCallback((pageId: string, name: string) => {
    updatePage(pageId, { name, slug: slugify(name), routePattern: defaultRouteForPage(slugify(name), state.pages.find((p) => p.id === pageId)?.pageType || 'standard') })
  }, [state.pages, updatePage])

  const reorderPage = useCallback((pageId: string, direction: -1 | 1) => setState((prev) => {
    const ordinary = prev.pages.filter((page) => page.pageType !== 'system').sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordinary.findIndex((page) => page.id === pageId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordinary.length) return prev
    const a = ordinary[index]
    const b = ordinary[target]
    const pages = prev.pages.map((page) => page.id === a.id ? { ...page, sortOrder: b.sortOrder } : page.id === b.id ? { ...page, sortOrder: a.sortOrder } : page)
    return { ...prev, pages, dirty: true }
  }), [])

  const exportDocument = useCallback((): EditorDocument => ({
    layoutId: state.layoutId,
    layoutName: state.layoutName,
    layoutSlug: state.layoutSlug,
    layoutDescription: state.layoutDescription,
    versionId: state.versionId,
    versionNumber: state.versionNumber,
    versionStatus: state.versionStatus,
    designTokens: cloneNode(state.designTokens),
    pages: cloneNode(state.pages),
  }), [state])

  const markSaved = useCallback((ids?: { layoutId?: string; versionId?: string; versionNumber?: number; versionStatus?: LayoutVersionStatus }) => {
    setState((prev) => ({ ...prev, ...ids, dirty: false }))
  }, [])

  return {
    state,
    setState,
    currentPage,
    loadDocument,
    exportDocument,
    markSaved,
    setDocumentMeta,
    selectNode: (id: string | null) => setState((prev) => ({ ...prev, selectedNodeId: id })),
    updateSchema,
    updateNode,
    addNode,
    deleteSelected,
    deleteNode,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    moveNode,
    undo,
    redo,
    setTool: (tool: EditorTool) => setState((prev) => ({ ...prev, tool })),
    setMode: (mode: ResponsiveMode) => setState((prev) => ({ ...prev, mode })),
    setZoom: (zoom: number) => setState((prev) => ({ ...prev, zoom: Math.max(0.25, Math.min(2, zoom)) })),
    pushHistory: (schema: LayoutPageSchema) => setState((prev) => syncCurrentSchema(prev, schema)),
    addPage,
    duplicatePage,
    switchPage,
    deletePage,
    updatePage,
    updatePageName,
    reorderPage,
  }
}
