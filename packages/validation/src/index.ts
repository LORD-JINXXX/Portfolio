import {
  EditorDocumentSchema,
  LAYOUT_SCHEMA_VERSION,
  RUNTIME_VERSION,
  type Binding,
  type ContentCompatibility,
  type ContentSlot,
  type EditorDocument,
  type EditorPage,
  type StudioNode,
  type ValidationIssue,
  type ValidationResult,
} from '@platform/contracts'
import { SUPPORTED_RUNTIME_ANIMATIONS, getAllowedAnimationTriggers } from '@platform/animation-runtime'

export const PREVIEW_SAMPLE_COLLECTIONS: Record<string, unknown[]> = {
  projects: [
    { id: 'sample-project-1', slug: 'visual-build', title: 'VisualBuild', short_description: 'A visual development framework that generates readable React/TypeScript source.', full_description: 'A production-style sample project used for layout preview.', technologies: ['React', 'TypeScript', 'Node.js'], featured: true, published: true, display_order: 1 },
    { id: 'sample-project-2', slug: 'document-platform', title: 'Document Platform', short_description: 'Secure nested document management with authentication and activity history.', full_description: 'Sample project details.', technologies: ['React', 'Express', 'MongoDB'], featured: true, published: true, display_order: 2 },
    { id: 'sample-project-3', slug: 'portfolio-studio', title: 'Portfolio Studio', short_description: 'A visual design and publishing platform for a dynamic portfolio.', full_description: 'Sample project details.', technologies: ['React', 'Supabase', 'TypeScript'], featured: true, published: true, display_order: 3 },
  ],
  notes: [
    { id: 'sample-note-1', slug: 'building-runtime-renderers', title: 'Building Runtime Renderers', summary: 'Notes on keeping editor and production rendering aligned.', content: 'Sample note content.', category: 'Engineering', tags: ['React', 'Architecture'], published: true, display_order: 1 },
    { id: 'sample-note-2', slug: 'smooth-scroll-animation', title: 'Smooth Scroll Animation', summary: 'Practical notes on performant scroll-linked UI.', content: 'Sample note content.', category: 'Frontend', tags: ['Animation'], published: true, display_order: 2 },
  ],
  experience: [
    { id: 'sample-exp-1', company: 'SpearHub', role: 'Web Developer', start_date: '2024-07-01', end_date: '2025-10-01', current: false, summary: 'Built ERP, onboarding, operator and documentation experiences.', technologies: ['React', 'Next.js', 'Node.js'], published: true, display_order: 1 },
    { id: 'sample-exp-2', company: 'Independent', role: 'Full Stack Developer', start_date: '2023-12-01', current: true, summary: 'Building full-stack products and developer tooling.', technologies: ['TypeScript', 'React', 'Supabase'], published: true, display_order: 2 },
  ],
  apps: [
    { id: 'sample-app-1', slug: 'global-job-matcher', name: 'Global Job Matcher', short_description: 'Resume-aware job matching application.', status: 'coming_soon', published: true, featured: true, display_order: 1 },
    { id: 'sample-app-2', slug: 'code-explainer', name: 'Code Explanation Agent', short_description: 'Explain code and architecture clearly.', status: 'coming_soon', published: true, featured: true, display_order: 2 },
  ],
  technologies: [
    { id: 'sample-tech-1', name: 'React', category: 'frontend', install_command: 'npm install react', icon_media_id: null, published: true, display_order: 1 },
    { id: 'sample-tech-2', name: 'TypeScript', category: 'frontend', install_command: 'npm install -D typescript', icon_media_id: null, published: true, display_order: 2 },
    { id: 'sample-tech-3', name: 'Node.js', category: 'backend', install_command: 'node --version', icon_media_id: null, published: true, display_order: 3 },
    { id: 'sample-tech-4', name: 'PostgreSQL', category: 'backend', install_command: 'psql --version', icon_media_id: null, published: true, display_order: 4 },
  ],
}

export function sampleContentForDocument(document: EditorDocument): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  collectContentSlots(document).forEach((slot) => {
    if (slot.sample !== undefined) values[slot.key] = slot.sample
    else if (slot.fallback !== undefined) values[slot.key] = slot.fallback
    else if (slot.contentType === 'boolean') values[slot.key] = false
    else if (slot.contentType === 'number') values[slot.key] = 0
    else values[slot.key] = slot.label
  })
  return values
}

export const SUPPORTED_NODE_TYPES = new Set([
  'section', 'container', 'div', 'header', 'main', 'aside', 'footer', 'article', 'nav', 'details', 'summary',
  'heading', 'text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a',
  'button', 'input', 'textarea', 'img', 'image', 'figure', 'figcaption', 'video', 'audio', 'hr', 'br', 'table',
  'form', 'label', 'select', 'option', 'progress', 'meter', 'dialog', 'mark', 'code', 'collection', 'particle-field', 'navbar', 'hero', 'card',
])

export const SAFE_RUNTIME_TAGS = new Set([
  'div', 'section', 'header', 'main', 'aside', 'footer', 'article', 'nav', 'details', 'summary',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a',
  'button', 'input', 'textarea', 'img', 'figure', 'figcaption', 'video', 'audio', 'hr', 'br', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'form', 'label', 'select', 'option', 'progress', 'meter',
  'dialog', 'mark', 'code', 'strong', 'em', 'small', 'time', 'address', 'picture', 'source',
])

export function isSafeRuntimeUrl(value: unknown, kind: 'href' | 'src' = 'href'): boolean {
  if (typeof value !== 'string' || !value.trim()) return false
  const raw = value.trim()
  if (/[\u0000-\u001F\u007F]/.test(raw)) return false
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return true
  let protocol = ''
  try { protocol = new URL(raw, 'https://runtime.invalid').protocol.toLowerCase() } catch { return false }
  if (kind === 'href') return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)
  return ['http:', 'https:', 'blob:'].includes(protocol) || (protocol === 'data:' && /^data:image\/(?:png|jpeg|jpg|gif|webp);(?:base64,|charset=)/i.test(raw))
}

function normalizedRouteShape(pattern: string): string {
  const clean = pattern.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return clean.split('/').map((segment) => segment.startsWith(':') ? ':param' : segment).join('/')
}


const BLOCKED_CSS_VALUE = /(?:javascript\s*:|vbscript\s*:|expression\s*\(|-moz-binding\s*:|behavior\s*:)/i
const CSS_URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
function runtimeStyleValueSafe(value: unknown): boolean {
  if (value === undefined || value === null || typeof value === 'number' || typeof value === 'boolean') return true
  if (typeof value !== 'string' || value.length > 8192 || BLOCKED_CSS_VALUE.test(value)) return false
  for (const match of value.matchAll(new RegExp(CSS_URL_RE.source, 'gi'))) if (!isSafeRuntimeUrl(match[2], 'src')) return false
  return true
}

export const SUPPORTED_ANIMATIONS = new Set(SUPPORTED_RUNTIME_ANIMATIONS)

export const SUPPORTED_SCROLL_BEHAVIORS = new Set(['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal'])
export const SUPPORTED_COLLECTIONS = new Set(['projects', 'notes', 'experience', 'apps', 'technologies'])

function issue(severity: ValidationIssue['severity'], code: string, message: string, extra: Partial<ValidationIssue> = {}): ValidationIssue {
  return { severity, code, message, ...extra }
}

function semverTuple(value: string): [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = value.replace(/^v/, '').split('.')
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0]
}

export function isRuntimeCompatible(minimum: string, current = RUNTIME_VERSION): boolean {
  const min = semverTuple(minimum)
  const cur = semverTuple(current)
  for (let i = 0; i < 3; i += 1) {
    if (cur[i] > min[i]) return true
    if (cur[i] < min[i]) return false
  }
  return true
}

export function walkNodes(nodes: StudioNode[], visitor: (node: StudioNode, path: string, parent?: StudioNode) => void, prefix = 'root', parent?: StudioNode): void {
  nodes.forEach((node, index) => {
    const path = `${prefix}[${index}]`
    visitor(node, path, parent)
    if (node.children?.length) walkNodes(node.children, visitor, `${path}.children`, node)
  })
}

export function findNode(nodes: StudioNode[], id: string): StudioNode | undefined {
  let found: StudioNode | undefined
  walkNodes(nodes, (node) => { if (!found && node.id === id) found = node })
  return found
}

export function collectContentSlotsFromPage(page: EditorPage): ContentSlot[] {
  const slots: ContentSlot[] = []
  walkNodes(page.schema.root, (node) => {
    Object.entries(node.bindings || {}).forEach(([property, binding]) => {
      if (binding.type !== 'content') return
      slots.push({
        key: binding.key,
        label: binding.label || node.meta?.adminLabel || node.meta?.label || binding.key,
        contentType: binding.contentType || 'text',
        sample: binding.sample,
        required: Boolean(binding.required),
        fallback: binding.fallback,
        description: binding.description,
        pageId: page.id,
        nodeId: node.id,
        property,
        sectionLabel: node.meta?.sectionLabel,
      })
    })
  })
  return slots
}

export function collectContentSlots(document: Pick<EditorDocument, 'pages'>): ContentSlot[] {
  const byKey = new Map<string, ContentSlot>()
  document.pages.forEach((page) => {
    collectContentSlotsFromPage(page).forEach((slot) => {
      const existing = byKey.get(slot.key)
      if (!existing) byKey.set(slot.key, slot)
      else if (slot.required && !existing.required) byKey.set(slot.key, { ...existing, required: true })
    })
  })
  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key))
}

export function buildContentCompatibility(document: Pick<EditorDocument, 'pages'>, values: Record<string, unknown>): ContentCompatibility {
  const slots = collectContentSlots(document)
  const resolved: string[] = []
  const missingRequired: ContentSlot[] = []
  const missingOptional: ContentSlot[] = []
  slots.forEach((slot) => {
    const value = values[slot.key]
    const missing = value === undefined || value === null || value === ''
    if (!missing) resolved.push(slot.key)
    else if (slot.required && slot.fallback === undefined) missingRequired.push(slot)
    else missingOptional.push(slot)
  })
  const used = new Set(slots.map((slot) => slot.key))
  const unusedKeys = Object.keys(values).filter((key) => !used.has(key)).sort()
  return { slots, resolved, missingRequired, missingOptional, unusedKeys }
}

function validateBinding(binding: Binding, page: EditorPage, node: StudioNode, property: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const base = { pageId: page.id, nodeId: node.id, path: `bindings.${property}` }
  if (binding.type === 'content' && !binding.key.trim()) out.push(issue('error', 'binding.content.key', `Content binding on “${property}” requires a key.`, base))
  if (binding.type === 'setting' && !binding.key.trim()) out.push(issue('error', 'binding.setting.key', `Setting binding on “${property}” requires a key.`, base))
  if (binding.type === 'field' && !binding.field.trim()) out.push(issue('error', 'binding.field.field', `Field binding on “${property}” requires a field name.`, base))
  if (binding.type === 'state' && !binding.key.trim()) out.push(issue('error', 'binding.state.key', `State binding on “${property}” requires a state key.`, base))
  if (binding.type === 'template' && binding.template.length > 8192) out.push(issue('error', 'binding.template.length', `Runtime template on “${property}” is too long.`, base))
  if (binding.type === 'collection') {
    if (binding.limit !== undefined && binding.limit <= 0) out.push(issue('error', 'binding.collection.limit', 'Collection limit must be greater than zero.', base))
  }
  if (binding.type === 'media' && !binding.mediaId && !binding.sampleUrl) out.push(issue(binding.required ? 'error' : 'warning', 'binding.media.missing', 'Media binding has neither a media ID nor a sample URL.', base))
  return out
}

export function validateEditorDocument(document: EditorDocument, options: { runtimeVersion?: string; runtimeMinVersion?: string; mediaIds?: Set<string> } = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const parsed = EditorDocumentSchema.safeParse(document)
  if (!parsed.success) {
    parsed.error.issues.forEach((zodIssue) => issues.push(issue('error', 'schema.invalid', zodIssue.message, { path: zodIssue.path.join('.') })))
    return finalize(issues)
  }

  if (document.pages.length === 0) issues.push(issue('error', 'pages.empty', 'Layout must contain at least one page.'))
  const homes = document.pages.filter((page) => page.pageType === 'home')
  if (homes.length !== 1) issues.push(issue('error', 'pages.home', `Layout must contain exactly one Home page; found ${homes.length}.`))
  const headers = document.pages.filter((page) => page.pageType === 'system' && page.slug === '_header')
  const footers = document.pages.filter((page) => page.pageType === 'system' && page.slug === '_footer')
  if (headers.length === 0) issues.push(issue('warning', 'pages.header', 'Layout has no global Header page.'))
  if (footers.length === 0) issues.push(issue('warning', 'pages.footer', 'Layout has no global Footer page.'))

  const slugs = new Map<string, string>()
  const routes = new Map<string, string>()
  const routeShapes = new Map<string, string>()
  const ids = new Set<string>()

  document.pages.forEach((page) => {
    if (page.schema.schemaVersion !== LAYOUT_SCHEMA_VERSION) issues.push(issue('error', 'schema.version', `Page “${page.name}” uses schema ${page.schema.schemaVersion}; expected ${LAYOUT_SCHEMA_VERSION}.`, { pageId: page.id }))
    if (page.schema.pageId !== page.id) issues.push(issue('error', 'page.id-mismatch', `Page “${page.name}” schema pageId does not match its page ID.`, { pageId: page.id }))
    if (page.pageType === 'collection_detail' && !page.schema.collectionName) issues.push(issue('error', 'page.collection-missing', `Collection detail page “${page.name}” must declare a collection name.`, { pageId: page.id }))
    if (slugs.has(page.slug)) issues.push(issue('error', 'page.slug-duplicate', `Duplicate page slug “${page.slug}”.`, { pageId: page.id }))
    else slugs.set(page.slug, page.id)
    if (page.pageType !== 'system') {
      if (!page.routePattern.startsWith('/')) issues.push(issue('error', 'page.route', `Route for “${page.name}” must start with /.`, { pageId: page.id }))
      if (routes.has(page.routePattern)) issues.push(issue('error', 'page.route-duplicate', `Duplicate route pattern “${page.routePattern}”.`, { pageId: page.id }))
      else routes.set(page.routePattern, page.id)
      const shape = normalizedRouteShape(page.routePattern)
      if (routeShapes.has(shape)) issues.push(issue('error', 'page.route-ambiguous', `Route “${page.routePattern}” conflicts with another route of the same dynamic shape.`, { pageId: page.id }))
      else routeShapes.set(shape, page.id)
      const parameters = [...page.routePattern.matchAll(/:([^/]+)/g)].map((match) => match[1])
      if (parameters.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) issues.push(issue('error', 'page.route-parameter', `Route “${page.routePattern}” contains an invalid parameter name.`, { pageId: page.id }))
      if (new Set(parameters).size !== parameters.length) issues.push(issue('error', 'page.route-parameter-duplicate', `Route “${page.routePattern}” repeats a dynamic parameter name.`, { pageId: page.id }))
      if (page.pageType === 'collection_detail' && parameters.length === 0) issues.push(issue('error', 'page.collection-route', `Collection detail page “${page.name}” must include a dynamic route parameter.`, { pageId: page.id }))
    }

    const ancestors = new Set<string>()
    const visit = (nodes: StudioNode[], chain: Set<string>) => {
      nodes.forEach((node) => {
        if (ids.has(node.id)) issues.push(issue('error', 'node.id-duplicate', `Duplicate node ID “${node.id}”.`, { pageId: page.id, nodeId: node.id }))
        ids.add(node.id)
        if (chain.has(node.id)) issues.push(issue('error', 'node.cycle', `Node “${node.id}” creates a cyclic tree.`, { pageId: page.id, nodeId: node.id }))
        if (!SUPPORTED_NODE_TYPES.has(node.type)) issues.push(issue('error', 'node.unsupported', `Unsupported node type “${node.type}”.`, { pageId: page.id, nodeId: node.id }))
        const runtimeTag = String(node.tag || node.type || 'div').toLowerCase()
        if (!SAFE_RUNTIME_TAGS.has(runtimeTag)) issues.push(issue('error', 'node.tag-unsafe', `Tag “${runtimeTag}” is not allowed by the production runtime.`, { pageId: page.id, nodeId: node.id }))
        const href = node.props?.href
        const src = node.props?.src ?? node.props?.poster
        if (node.props?.action !== undefined && node.props?.action !== '') issues.push(issue('error', 'node.form-action-disabled', 'Runtime forms cannot submit to an action URL.', { pageId: page.id, nodeId: node.id }))
        if (href !== undefined && !isSafeRuntimeUrl(href, 'href')) issues.push(issue('error', 'node.url-unsafe', 'Node contains an unsafe href URL protocol.', { pageId: page.id, nodeId: node.id }))
        if (src !== undefined && src !== '' && !isSafeRuntimeUrl(src, 'src')) issues.push(issue('error', 'node.source-unsafe', 'Node contains an unsafe media source URL protocol.', { pageId: page.id, nodeId: node.id }))
        if (!node.styles.desktop && !node.styles.tablet && !node.styles.mobile) issues.push(issue('warning', 'node.styles.empty', `Node “${node.meta?.label || node.type}” has no styles.`, { pageId: page.id, nodeId: node.id }))
        for (const [responsiveMode, styleMap] of Object.entries(node.styles || {})) {
          for (const [property, value] of Object.entries(styleMap || {})) if (!runtimeStyleValueSafe(value)) issues.push(issue('error', 'node.style-unsafe', `Style “${property}” contains a runtime-unsafe value.`, { pageId: page.id, nodeId: node.id, path: `styles.${responsiveMode}.${property}` }))
        }
        for (const [ruleIndex, rule] of (node.conditionalStyles || []).entries()) {
          for (const [responsiveMode, styleMap] of Object.entries(rule.styles || {})) {
            for (const [property, value] of Object.entries(styleMap || {})) if (!runtimeStyleValueSafe(value)) issues.push(issue('error', 'node.conditional-style-unsafe', `Conditional style “${property}” contains a runtime-unsafe value.`, { pageId: page.id, nodeId: node.id, path: `conditionalStyles.${ruleIndex}.styles.${responsiveMode}.${property}` }))
          }
        }
        Object.entries(node.bindings || {}).forEach(([property, binding]) => issues.push(...validateBinding(binding, page, node, property)))
        if (node.animation && !SUPPORTED_ANIMATIONS.has(node.animation.type)) issues.push(issue('error', 'animation.unsupported', `Animation “${node.animation.type}” is not supported by the runtime.`, { pageId: page.id, nodeId: node.id }))
        if (node.animation && SUPPORTED_ANIMATIONS.has(node.animation.type) && !getAllowedAnimationTriggers(node.animation.type).includes(node.animation.trigger)) issues.push(issue('error', 'animation.trigger-unsupported', `Animation “${node.animation.type}” does not support the “${node.animation.trigger}” trigger.`, { pageId: page.id, nodeId: node.id }))
        if (node.animation?.trigger === 'state' && !(node.animation.replayOnState || []).length) issues.push(issue('warning', 'animation.state-trigger-without-key', 'State-change-only animation has no replay state keys and will remain idle until a key is configured.', { pageId: page.id, nodeId: node.id }))
        if (node.scrollBehavior && !SUPPORTED_SCROLL_BEHAVIORS.has(node.scrollBehavior.mode)) issues.push(issue('error', 'scroll.unsupported', `Scroll behavior “${node.scrollBehavior.mode}” is not supported.`, { pageId: page.id, nodeId: node.id }))
        if (node.scrollBehavior?.mode === 'stack-over-previous' && !node.meta?.sectionLabel) issues.push(issue('warning', 'scroll.stack-section-label', 'Stacked sections should have a Section Label for Admin navigation.', { pageId: page.id, nodeId: node.id }))
        if (node.layout?.mode === 'absolute' && (node.layout.width === undefined || node.layout.height === undefined)) issues.push(issue('warning', 'layout.absolute-size', 'Absolutely positioned nodes should define width and height.', { pageId: page.id, nodeId: node.id }))
        if (node.type === 'particle-field') {
          const numeric = (key: string, min: number, max: number) => {
            const value = Number(node.props?.[key])
            if (!Number.isFinite(value) || value < min || value > max) issues.push(issue('error', 'particle-field.range', `Particle Field ${key} must be between ${min} and ${max}.`, { pageId: page.id, nodeId: node.id, path: `props.${key}` }))
          }
          numeric('count', 1, 200); numeric('minSize', 1, 20); numeric('maxSize', 1, 24); numeric('speed', 0.05, 3); numeric('drift', 0, 300); numeric('opacity', 0, 1); numeric('glow', 0, 1)
          const direction = String(node.props?.direction || 'random')
          if (!['random', 'up', 'down', 'left', 'right'].includes(direction)) issues.push(issue('error', 'particle-field.direction', 'Particle Field direction must be random, up, down, left, or right.', { pageId: page.id, nodeId: node.id, path: 'props.direction' }))
          const motion = String(node.props?.motion || 'continuous')
          if (!['continuous', 'static'].includes(motion)) issues.push(issue('error', 'particle-field.motion', 'Particle Field animation must be continuous or static.', { pageId: page.id, nodeId: node.id, path: 'props.motion' }))
          if (Number(node.props?.minSize) > Number(node.props?.maxSize)) issues.push(issue('error', 'particle-field.size-order', 'Particle Field Min Size cannot be greater than Max Size.', { pageId: page.id, nodeId: node.id }))
        }
        Object.values(node.bindings || {}).forEach((binding) => {
          if (binding.type === 'media' && binding.mediaId && options.mediaIds && !options.mediaIds.has(binding.mediaId)) issues.push(issue(binding.required ? 'error' : 'warning', 'media.missing', `Referenced media “${binding.mediaId}” does not exist.`, { pageId: page.id, nodeId: node.id }))
        })
        if (node.children?.length) {
          const next = new Set(chain)
          next.add(node.id)
          visit(node.children, next)
        }
      })
    }
    visit(page.schema.root, ancestors)
  })

  const minimumRuntime = options.runtimeMinVersion || '1.0.0'
  if (!isRuntimeCompatible(minimumRuntime, options.runtimeVersion || RUNTIME_VERSION)) issues.push(issue('error', 'runtime.incompatible', `Layout requires runtime ${minimumRuntime} or newer; current runtime is ${options.runtimeVersion || RUNTIME_VERSION}.`))

  // Validate content-key type consistency against every raw occurrence before slots are deduplicated.
  const slotTypes = new Map<string, string>()
  document.pages.forEach((page) => collectContentSlotsFromPage(page).forEach((slot) => {
    const existing = slotTypes.get(slot.key)
    if (existing && existing !== slot.contentType) issues.push(issue('error', 'content.type-conflict', `Content key “${slot.key}” is used with conflicting types (${existing} and ${slot.contentType}).`, { pageId: slot.pageId, nodeId: slot.nodeId }))
    else if (!existing) slotTypes.set(slot.key, slot.contentType)
  }))

  return finalize(issues)
}


function isExternalOrPathReference(value: string): boolean {
  return /^(https?:|data:|blob:|\/|#|mailto:|tel:)/i.test(value)
}

export function validateContentValue(slot: ContentSlot, value: unknown, mediaIds?: Set<string>): ValidationIssue[] {
  if (value === undefined || value === null || value === '') return []
  const extra = { pageId: slot.pageId, nodeId: slot.nodeId, path: slot.key }
  switch (slot.contentType) {
    case 'text':
    case 'richtext':
      return typeof value === 'string' ? [] : [issue('error', 'content.type', `Content “${slot.label}” must be text.`, extra)]
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? [] : [issue('error', 'content.type', `Content “${slot.label}” must be a finite number.`, extra)]
    case 'boolean':
      return typeof value === 'boolean' ? [] : [issue('error', 'content.type', `Content “${slot.label}” must be true or false.`, extra)]
    case 'url':
      return typeof value === 'string' && isSafeRuntimeUrl(value, 'href') ? [] : [issue('error', 'content.url', `Content “${slot.label}” must use a safe http(s), route, anchor, mailto, or tel URL.`, extra)]
    case 'media': {
      if (typeof value !== 'string') return [issue('error', 'content.media', `Content “${slot.label}” must reference media by ID or URL.`, extra)]
      if (!isExternalOrPathReference(value) && mediaIds && !mediaIds.has(value)) return [issue('error', 'content.media-missing', `Content “${slot.label}” references missing media “${value}”.`, extra)]
      return []
    }
    case 'button': {
      if (typeof value === 'string') return []
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        return typeof obj.label === 'string' || typeof obj.href === 'string' ? [] : [issue('error', 'content.button', `Content “${slot.label}” button value must contain a label or href.`, extra)]
      }
      return [issue('error', 'content.button', `Content “${slot.label}” must be button text or a button object.`, extra)]
    }
    case 'json':
    default:
      return []
  }
}

export function validateReleaseCandidate(document: EditorDocument, content: Record<string, unknown>, options: {
  runtimeVersion?: string
  runtimeMinVersion?: string
  mediaIds?: Set<string>
  settings?: Record<string, unknown>
  collections?: Record<string, unknown[]>
} = {}): ValidationResult {
  const base = validateEditorDocument(document, options)
  const issues = [...base.issues]
  const compatibility = buildContentCompatibility(document, content)
  compatibility.missingRequired.forEach((slot) => issues.push(issue('error', 'content.required-missing', `Required content “${slot.label}” (${slot.key}) is missing.`, { pageId: slot.pageId, nodeId: slot.nodeId })))
  compatibility.missingOptional.forEach((slot) => issues.push(issue('info', 'content.optional-missing', `Optional content “${slot.label}” (${slot.key}) is not set; sample/fallback may be used.`, { pageId: slot.pageId, nodeId: slot.nodeId })))
  compatibility.slots.forEach((slot) => issues.push(...validateContentValue(slot, content[slot.key], options.mediaIds)))

  document.pages.forEach((page) => walkNodes(page.schema.root, (node) => {
    Object.entries(node.bindings || {}).forEach(([property, binding]) => {
      if (binding.type === 'setting' && binding.required) {
        const value = options.settings?.[binding.key]
        if (value === undefined || value === null || value === '') issues.push(issue('error', 'setting.required-missing', `Required site setting “${binding.label || binding.key}” (${binding.key}) is missing.`, { pageId: page.id, nodeId: node.id, path: `bindings.${property}` }))
      }
      if (binding.type === 'collection' && options.collections && !Array.isArray(options.collections[binding.collection])) {
        issues.push(issue('error', 'collection.missing', `Collection “${binding.collection}” is not available in the release snapshot.`, { pageId: page.id, nodeId: node.id, path: `bindings.${property}` }))
      }
    })
  }))
  return finalize(issues)
}

export function finalize(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((entry) => entry.severity === 'error')
  const warnings = issues.filter((entry) => entry.severity === 'warning')
  const infos = issues.filter((entry) => entry.severity === 'info')
  return { valid: errors.length === 0, issues, errors, warnings, infos }
}
