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
  | 'audio' | 'hr' | 'br' | 'table' | 'label' | 'select' | 'option'
  | 'progress' | 'meter' | 'dialog' | 'mark' | 'code' | 'particle-field' | 'ambient-field' | 'code-stream'
  | 'intro-sequence' | 'cinematic-sequence' | 'scene-frame' | 'decoration'

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


export function normalizeRoutePattern(value: string, pageType: PageType = 'standard'): string {
  if (pageType === 'home') return '/'
  if (pageType === 'system') return value.trim() || '__system'
  const raw = String(value || '').trim().split(/[?#]/, 1)[0]
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const segments = withSlash.split('/').filter(Boolean).map((segment) => {
    if (segment.startsWith(':')) {
      const name = segment.slice(1).replace(/[^A-Za-z0-9_]/g, '') || 'param'
      return `:${name}`
    }
    return segment.toLowerCase().replace(/[^a-z0-9._~-]+/g, '-').replace(/^-+|-+$/g, '') || 'page'
  })
  return `/${segments.join('/')}`
}

export function routePatternShape(value: string): string {
  const normalized = normalizeRoutePattern(value)
  if (normalized === '/') return '/'
  return normalized.split('/').map((segment) => segment.startsWith(':') ? ':' : segment).join('/')
}

export function routePatternsConflict(left: string, right: string): boolean {
  return routePatternShape(left) === routePatternShape(right)
}


export function uniquePageSlug(baseValue: string, pages: readonly EditorPage[], excludePageId?: string): string {
  const base = slugify(baseValue)
  const used = new Set(pages.filter((page) => page.id !== excludePageId).map((page) => page.slug))
  if (!used.has(base)) return base
  for (let suffix = 2; suffix < 10000; suffix += 1) if (!used.has(`${base}-${suffix}`)) return `${base}-${suffix}`
  return `${base}-${genId().slice(0, 8)}`
}

export function uniqueRoutePattern(baseValue: string, pages: readonly EditorPage[], pageType: PageType = 'standard', excludePageId?: string): string {
  const base = normalizeRoutePattern(baseValue, pageType)
  if (pageType === 'home' || pageType === 'system') return base
  const others = pages.filter((page) => page.id !== excludePageId && page.pageType !== 'system')
  if (!others.some((page) => routePatternsConflict(page.routePattern, base))) return base
  const segments = base.split('/').filter(Boolean)
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidateSegments = [...segments]
    const staticIndex = candidateSegments.findIndex((segment) => !segment.startsWith(':'))
    if (staticIndex >= 0) candidateSegments[staticIndex] = `${candidateSegments[staticIndex]}-${suffix}`
    else candidateSegments.unshift(`page-${suffix}`)
    const candidate = `/${candidateSegments.join('/')}`
    if (!others.some((page) => routePatternsConflict(page.routePattern, candidate))) return candidate
  }
  return `/page-${genId().slice(0, 8)}`
}

export const CONTAINER_NODE_TYPES: ReadonlySet<string> = new Set([
  'section', 'container', 'div', 'collection', 'navbar', 'footer', 'hero', 'card', 'form',
  'header', 'main', 'aside', 'article', 'nav', 'details', 'ul', 'ol', 'li', 'figure',
  'table', 'dialog', 'blockquote', 'cinematic-sequence', 'scene-frame',
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
    ...(objectRecord(source?.initialState) ? { initialState: source?.initialState as Record<string, unknown> } : {}),
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
    textarea: 'textarea', img: 'img', figure: 'figure', figcaption: 'figcaption', audio: 'audio', hr: 'hr',
    br: 'br', table: 'table', label: 'label', select: 'select', option: 'option', progress: 'progress', meter: 'meter',
    dialog: 'dialog', mark: 'mark', code: 'code', 'particle-field': 'div', 'ambient-field': 'div', 'code-stream': 'div',
    'intro-sequence': 'div', 'cinematic-sequence': 'section', 'scene-frame': 'section', decoration: 'div',
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
  if (type === 'decoration') {
    node.styles.desktop = {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      borderRadius: 'inherit',
      transformOrigin: 'center',
    }
    node.meta = { ...node.meta, label: 'Decoration' }
    node.accessibility = { ...(node.accessibility || {}), role: 'presentation' }
  }
  if (type === 'particle-field') {
    node.props = {
      count: 20, minSize: 2, maxSize: 5, speed: 0.25, drift: 30, opacity: 0.5, glow: 0.6,
      direction: 'random', colors: '#dce8ff, #91afff, #646eff', seed: 1, motion: 'continuous',
    }
    node.styles.desktop = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }
    node.meta = { ...node.meta, label: 'Particle Field' }
  }
  if (type === 'ambient-field') {
    node.props = {
      contentMode: 'text', items: '<div>\n</>\nconst\nfunction()\nReact\nTypeScript', mediaIds: [], count: 18,
      sameSize: false, size: 34, minSize: 22, maxSize: 48, speed: 0.35, drift: 44, opacity: 0.42, glow: 0.25,
      direction: 'random', distribution: 'random', motion: 'float', seed: 1, randomRotation: true,
      randomColors: false, colors: '#dce8ff, #91afff, #7c8cff, #8b5cf6, #67e8f9',
    }
    node.styles.desktop = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }
    node.meta = { ...node.meta, label: 'Ambient Field' }
  }
  if (type === 'code-stream') {
    node.props = {
      lines: 'const developer = "Mustafa";\nawait buildSomethingNew();\ngit commit -m "keep-building";\nnpm run dev;',
      direction: 'up', speed: 1, gap: 18, edgeFade: 32,
    }
    node.styles.desktop = { position: 'relative', width: '100%', height: '220px', overflow: 'hidden', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.6', opacity: 0.55, pointerEvents: 'none' }
    node.meta = { ...node.meta, label: 'Code Stream' }
  }
  if (type === 'intro-sequence') {
    node.props = {
      nameText: 'MUSTAFA', loadingText: 'LOADING', upcomingEyebrow: 'COMING UP NEXT', upcomingTitle: 'HERO',
      src: '', poster: '', duration: 2600, bridgeDuration: 480, exitDuration: 700, exitDirection: 'right',
    }
    node.styles.desktop = { position: 'fixed', inset: 0, width: '100%', height: '100dvh', overflow: 'hidden', background: '#050505', color: '#ffffff', zIndex: 60000 }
    node.styles.mobile = { minHeight: '420px' }
    node.meta = { ...node.meta, label: 'Intro Sequence', sectionLabel: 'Intro' }
  }
  if (type === 'cinematic-sequence') {
    node.props = {
      bridgeText: 'COMING UP NEXT', entryDistanceVh: 86, exitDistanceVh: 86,
      topHoldVh: 30, bottomHoldVh: 34, bridgeHoldVh: 30,
    }
    node.styles.desktop = { position: 'relative', minHeight: '720px', background: '#050505', overflow: 'clip' }
    node.styles.mobile = { minHeight: 'auto', overflow: 'visible' }
    node.meta = { ...node.meta, label: 'Cinematic Sequence', sectionLabel: 'Cinematic Sequence' }
  }
  if (type === 'scene-frame') {
    node.styles.desktop = { position: 'relative', minHeight: '260vh', background: '#050505', overflow: 'clip' }
    node.styles.mobile = { minHeight: 'auto', overflow: 'visible' }
    node.meta = { ...node.meta, label: 'Scene Frame', sectionLabel: 'Scene' }
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


export function nodeHasLockedAncestor(root: StudioNode[], nodeId: string): boolean {
  let currentId: string | null = nodeId
  while (currentId) {
    const location = findParentById(root, currentId)
    const parent = location.parent
    if (!parent) return false
    if (parent.meta?.locked) return true
    currentId = parent.id
  }
  return false
}

export function canEditNode(root: StudioNode[], nodeId: string): boolean {
  const node = findNodeById(root, nodeId)
  return Boolean(node && !node.meta?.locked && !nodeHasLockedAncestor(root, nodeId))
}

export function canChangeNodeLock(root: StudioNode[], nodeId: string): boolean {
  return Boolean(findNodeById(root, nodeId) && !nodeHasLockedAncestor(root, nodeId))
}

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

export function updateNodeInArray(nodes: StudioNode[], nodeId: string, updater: (node: StudioNode) => StudioNode): StudioNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node)
    return node.children ? { ...node, children: updateNodeInArray(node.children, nodeId, updater) } : node
  })
}
