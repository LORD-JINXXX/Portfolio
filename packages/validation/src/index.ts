import {
  EditorDocumentSchema,
  LAYOUT_SCHEMA_VERSION,
  isSafeCssCustomPropertyName,
  isSafeRuntimeStyleProperty,
  isSafeRuntimeStylesheetValue,
  RUNTIME_VERSION,
  resolveResponsiveLayout,
  resolveResponsiveScrollMode,
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
  blogs: [
    { id: 'sample-blog-1', slug: 'building-a-release-safe-runtime', title: 'Building a Release-Safe Runtime', subtitle: 'How immutable snapshots keep production predictable.', excerpt: 'A practical walkthrough of release-safe portfolio architecture.', author_name: 'Portfolio Owner', category: 'Engineering', tags: ['Architecture','TypeScript'], content_blocks: [{ id:'sample-blog-block-1', name:'Runtime overview', block_type:'rich_text', eyebrow:'01 / OVERVIEW', heading:'Release-safe runtime', body:'Sample blog content for Studio preview.', media_id:'', media_alt:'', code:'', language:'', caption:'', layout:'normal' }], published: true, featured: true, published_at: '2026-08-18T00:00:00.000Z', reading_time_minutes: 5, display_order: 1 },
    { id: 'sample-blog-2', slug: 'designing-dynamic-collections', title: 'Designing Dynamic Collections', excerpt: 'Search, filters, pagination, and reusable collection rendering.', author_name: 'Portfolio Owner', category: 'Frontend', tags: ['React','Studio'], content_blocks: [{ id:'sample-blog-block-2', name:'Pagination engine', block_type:'code', eyebrow:'02 / PAGINATION', heading:'Dynamic page counts', body:'The collection engine derives page count from total results and page size.', media_id:'', media_alt:'', code:'const pageCount = Math.ceil(total / pageSize)', language:'typescript', caption:'Runtime pagination calculation', layout:'normal' }], published: true, featured: false, published_at: '2026-08-12T00:00:00.000Z', reading_time_minutes: 4, display_order: 2 },
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
  'form', 'label', 'select', 'option', 'progress', 'meter', 'dialog', 'mark', 'code', 'collection', 'particle-field', 'ambient-field', 'code-stream', 'intro-sequence', 'cinematic-sequence', 'scene-frame', 'decoration', 'navbar', 'hero', 'card',
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

export const SUPPORTED_SCROLL_BEHAVIORS = new Set(['normal', 'sticky', 'pin', 'stack-over-previous', 'card-deck', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition'])
export const SUPPORTED_COLLECTIONS = new Set(['projects', 'blogs', 'notes', 'experience', 'apps', 'technologies'])

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
    const source = binding.source || 'collection'
    if (source === 'collection' && !binding.collection?.trim()) out.push(issue('error', 'binding.collection.name', 'Named Collection repeat requires a Collection.', base))
    if (source === 'current-item-array' && !binding.field?.trim()) out.push(issue('error', 'binding.collection.array-field', 'Current Item Array repeat requires an array field.', base))
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

  for (const [property, value] of Object.entries(document.designTokens.variables || {})) {
    if (!isSafeCssCustomPropertyName(property)) issues.push(issue('error', 'tokens.variable-name-unsafe', `Design token “${property}” must be a valid CSS custom property beginning with --.`, { path: `designTokens.variables.${property}` }))
    if (!runtimeStyleValueSafe(value)) issues.push(issue('error', 'tokens.variable-value-unsafe', `Design token “${property}” contains a runtime-unsafe CSS value.`, { path: `designTokens.variables.${property}` }))
  }

  const keyframeIds = new Set((document.designTokens.keyframes || []).map((definition) => definition.id))
  for (const [definitionIndex, definition] of (document.designTokens.keyframes || []).entries()) {
    for (const [stepIndex, step] of definition.steps.entries()) {
      for (const [property, value] of Object.entries(step.styles || {})) {
        const path = `designTokens.keyframes.${definitionIndex}.steps.${stepIndex}.styles.${property}`
        if (!isSafeRuntimeStyleProperty(property)) issues.push(issue('error', 'keyframe.style-property-unsafe', `Keyframe style property “${property}” is not allowed by the runtime.`, { path }))
        else if (!runtimeStyleValueSafe(value) || !isSafeRuntimeStylesheetValue(value)) issues.push(issue('error', 'keyframe.style-value-unsafe', `Keyframe style “${property}” contains a stylesheet-unsafe value.`, { path }))
      }
    }
  }
  for (const [registrationIndex, registration] of (document.designTokens.propertyRegistrations || []).entries()) {
    const path = `designTokens.propertyRegistrations.${registrationIndex}`
    if (!isSafeCssCustomPropertyName(registration.name)) issues.push(issue('error', 'property-registration.name-unsafe', `Registered property “${registration.name}” must be a valid CSS custom property.`, { path: `${path}.name` }))
    if (!runtimeStyleValueSafe(registration.initialValue) || !isSafeRuntimeStylesheetValue(registration.initialValue)) issues.push(issue('error', 'property-registration.initial-value-unsafe', `Registered property “${registration.name}” has an unsafe initial value.`, { path: `${path}.initialValue` }))
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
          for (const [property, value] of Object.entries(styleMap || {})) {
            if (!isSafeRuntimeStyleProperty(property)) issues.push(issue('error', 'node.style-property-unsafe', `Style property “${property}” is not allowed by the runtime.`, { pageId: page.id, nodeId: node.id, path: `styles.${responsiveMode}.${property}` }))
            else if (!runtimeStyleValueSafe(value)) issues.push(issue('error', 'node.style-unsafe', `Style “${property}” contains a runtime-unsafe value.`, { pageId: page.id, nodeId: node.id, path: `styles.${responsiveMode}.${property}` }))
          }
        }
        for (const [ruleIndex, rule] of (node.conditionalStyles || []).entries()) {
          for (const [responsiveMode, styleMap] of Object.entries(rule.styles || {})) {
            for (const [property, value] of Object.entries(styleMap || {})) {
              if (!isSafeRuntimeStyleProperty(property)) issues.push(issue('error', 'node.conditional-style-property-unsafe', `Conditional style property “${property}” is not allowed by the runtime.`, { pageId: page.id, nodeId: node.id, path: `conditionalStyles.${ruleIndex}.styles.${responsiveMode}.${property}` }))
              else if (!runtimeStyleValueSafe(value)) issues.push(issue('error', 'node.conditional-style-unsafe', `Conditional style “${property}” contains a runtime-unsafe value.`, { pageId: page.id, nodeId: node.id, path: `conditionalStyles.${ruleIndex}.styles.${responsiveMode}.${property}` }))
            }
          }
        }
        Object.entries(node.bindings || {}).forEach(([property, binding]) => issues.push(...validateBinding(binding, page, node, property)))
        if (node.animation && !SUPPORTED_ANIMATIONS.has(node.animation.type)) issues.push(issue('error', 'animation.unsupported', `Animation “${node.animation.type}” is not supported by the runtime.`, { pageId: page.id, nodeId: node.id }))
        if (node.animation && SUPPORTED_ANIMATIONS.has(node.animation.type) && !getAllowedAnimationTriggers(node.animation.type).includes(node.animation.trigger)) issues.push(issue('error', 'animation.trigger-unsupported', `Animation “${node.animation.type}” does not support the “${node.animation.trigger}” trigger.`, { pageId: page.id, nodeId: node.id }))
        if (node.animation?.type === 'custom-keyframe') {
          if (!node.animation.keyframeId) issues.push(issue('error', 'animation.keyframe-missing', 'Custom keyframe animation must select a reusable keyframe.', { pageId: page.id, nodeId: node.id, path: 'animation.keyframeId' }))
          else if (!keyframeIds.has(node.animation.keyframeId)) issues.push(issue('error', 'animation.keyframe-unknown', `Custom keyframe “${node.animation.keyframeId}” does not exist in this layout.`, { pageId: page.id, nodeId: node.id, path: 'animation.keyframeId' }))
        }
        if (node.animation?.easing && !runtimeStyleValueSafe(node.animation.easing)) issues.push(issue('error', 'animation.easing-unsafe', 'Animation easing contains a runtime-unsafe CSS value.', { pageId: page.id, nodeId: node.id, path: 'animation.easing' }))
        if (node.animation?.trigger === 'state' && !(node.animation.replayOnState || []).length) issues.push(issue('warning', 'animation.state-trigger-without-key', 'State-change-only animation has no replay state keys and will remain idle until a key is configured.', { pageId: page.id, nodeId: node.id }))
        const scrollBehavior = node.scrollBehavior
        if (scrollBehavior && !SUPPORTED_SCROLL_BEHAVIORS.has(scrollBehavior.mode)) issues.push(issue('error', 'scroll.unsupported', `Scroll behavior “${scrollBehavior.mode}” is not supported.`, { pageId: page.id, nodeId: node.id }))
        if (scrollBehavior) {
          for (const [responsiveMode, fallback] of [['tablet', scrollBehavior.tabletFallback], ['mobile', scrollBehavior.mobileFallback]] as const) {
            if (fallback && !SUPPORTED_SCROLL_BEHAVIORS.has(fallback)) issues.push(issue('error', 'scroll.responsive-unsupported', `Scroll behavior “${fallback}” is not supported for ${responsiveMode}.`, { pageId: page.id, nodeId: node.id, path: `scrollBehavior.${responsiveMode}Fallback` }))
          }
        }
        const responsiveScrollModes = scrollBehavior
          ? (['desktop', 'tablet', 'mobile'] as const).map((responsiveMode) => resolveResponsiveScrollMode(scrollBehavior, responsiveMode))
          : []
        if (responsiveScrollModes.includes('section-cover')) {
          const direction = String(scrollBehavior?.params?.direction || 'bottom')
          if (!['top','right','bottom','left'].includes(direction)) issues.push(issue('error', 'scroll.section-cover-direction', 'Section Cover direction must be top, right, bottom, or left.', { pageId: page.id, nodeId: node.id }))
          const distance = Number(scrollBehavior?.params?.distance ?? 100), span = Number(scrollBehavior?.params?.span ?? 100)
          if (!Number.isFinite(distance) || distance < 10 || distance > 200) issues.push(issue('error', 'scroll.section-cover-distance', 'Section Cover travel must be between 10% and 200% of the viewport.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(span) || span < 20 || span > 200) issues.push(issue('error', 'scroll.section-cover-span', 'Section Cover transition span must be between 20% and 200%.', { pageId: page.id, nodeId: node.id }))
        }
        if (responsiveScrollModes.includes('scene-transition')) {
          const enterFrom = String(scrollBehavior?.params?.enterFrom || 'bottom')
          const exitTo = String(scrollBehavior?.params?.exitTo || 'top')
          const entryEffect = String(scrollBehavior?.params?.entryEffect || 'slide')
          if (!['top','right','bottom','left','none'].includes(enterFrom) || !['top','right','bottom','left','none'].includes(exitTo)) issues.push(issue('error', 'scroll.scene-direction', 'Scene Transition directions must be top, right, bottom, left, or none.', { pageId: page.id, nodeId: node.id }))
          if (!['slide','wipe'].includes(entryEffect)) issues.push(issue('error', 'scroll.scene-entry-effect', 'Scene Transition entry effect must be slide or wipe.', { pageId: page.id, nodeId: node.id }))
          const bridgeEnd = Number(scrollBehavior?.params?.bridgeEnd ?? 10), enterEnd = Number(scrollBehavior?.params?.enterEnd ?? 30), exitStart = Number(scrollBehavior?.params?.exitStart ?? 68), exitEnd = Number(scrollBehavior?.params?.exitEnd ?? 100)
          if (![bridgeEnd, enterEnd, exitStart, exitEnd].every(Number.isFinite) || bridgeEnd < 0 || bridgeEnd >= enterEnd || enterEnd > exitStart || exitStart >= exitEnd || exitEnd > 100) issues.push(issue('error', 'scroll.scene-phase-order', 'Scene phases must be ordered: bridge end < entry end ≤ exit start < exit end, within 0–100%.', { pageId: page.id, nodeId: node.id }))
          const distance = Number(scrollBehavior?.params?.distance ?? 100)
          if (!Number.isFinite(distance) || distance < 50 || distance > 160) issues.push(issue('error', 'scroll.scene-distance', 'Scene Transition travel must be between 50% and 160% of the viewport.', { pageId: page.id, nodeId: node.id }))
        }
        if (responsiveScrollModes.includes('card-deck')) {
          const hasCollectionBinding = Object.values(node.bindings || {}).some((binding) => binding.type === 'collection')
          if (!hasCollectionBinding) issues.push(issue('warning', 'scroll.card-deck-collection', 'Card Deck is designed for a collection-bound container so each collection item can become one deck card.', { pageId: page.id, nodeId: node.id }))
          if ((node.children || []).length !== 1) issues.push(issue('warning', 'scroll.card-deck-single-root', 'Card Deck works best with exactly one repeated card template root. Multiple roots are grouped by the collection wrapper but may not share the intended card styling.', { pageId: page.id, nodeId: node.id }))
          const params = scrollBehavior?.params || {}
          const travelVh = Number(params.travelVh ?? 80)
          const peekX = Number(params.peekX ?? 24)
          const tabletPeekX = Number(params.tabletPeekX ?? 18)
          const mobilePeekX = Number(params.mobilePeekX ?? 8)
          const neighborY = Number(params.neighborY ?? 12)
          const neighborScale = Number(params.neighborScale ?? .82)
          const neighborOpacity = Number(params.neighborOpacity ?? .5)
          const rotation = Number(params.rotation ?? 1)
          const visibleNeighbors = Number(params.visibleNeighbors ?? 1)
          const activationLeadVh = Number(params.activationLeadVh ?? 24)
          const centerHoldPercent = Number(params.centerHoldPercent ?? 34)
          if (!Number.isFinite(travelVh) || travelVh < 40 || travelVh > 160) issues.push(issue('error', 'scroll.card-deck-travel', 'Card Deck travel per card must be between 40vh and 160vh.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(peekX) || peekX < 0 || peekX > 60) issues.push(issue('error', 'scroll.card-deck-peek', 'Card Deck desktop neighbor visible percentage must be between 0% and 60% of the card.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(tabletPeekX) || tabletPeekX < 0 || tabletPeekX > 45) issues.push(issue('error', 'scroll.card-deck-tablet-peek', 'Card Deck tablet neighbor visible percentage must be between 0% and 45% of the card.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(mobilePeekX) || mobilePeekX < 0 || mobilePeekX > 35) issues.push(issue('error', 'scroll.card-deck-mobile-peek', 'Card Deck mobile neighbor visible percentage must be between 0% and 35% of the card.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(neighborY) || neighborY < 0 || neighborY > 80) issues.push(issue('error', 'scroll.card-deck-y', 'Card Deck neighbor Y offset must be between 0px and 80px.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(neighborScale) || neighborScale < .5 || neighborScale > 1) issues.push(issue('error', 'scroll.card-deck-scale', 'Card Deck neighbor scale must be between 0.5 and 1.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(neighborOpacity) || neighborOpacity < 0 || neighborOpacity > 1) issues.push(issue('error', 'scroll.card-deck-opacity', 'Card Deck neighbor opacity must be between 0 and 1.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(rotation) || rotation < 0 || rotation > 12) issues.push(issue('error', 'scroll.card-deck-rotation', 'Card Deck neighbor rotation must be between 0° and 12°.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isInteger(visibleNeighbors) || visibleNeighbors < 1 || visibleNeighbors > 3) issues.push(issue('error', 'scroll.card-deck-neighbors', 'Card Deck visible neighbors must be an integer between 1 and 3.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(activationLeadVh) || activationLeadVh < 0 || activationLeadVh > 60) issues.push(issue('error', 'scroll.card-deck-lead', 'Card Deck activation lead must be between 0vh and 60vh.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(centerHoldPercent) || centerHoldPercent < 0 || centerHoldPercent > 70) issues.push(issue('error', 'scroll.card-deck-hold', 'Card Deck center hold must be between 0% and 70% of each card travel slot.', { pageId: page.id, nodeId: node.id }))
        }
        if (responsiveScrollModes.includes('stack-over-previous') && !node.meta?.sectionLabel) issues.push(issue('warning', 'scroll.stack-section-label', 'Stacked sections should have a Section Label for Admin navigation.', { pageId: page.id, nodeId: node.id }))
        if (node.layout) {
          for (const responsiveMode of ['desktop', 'tablet', 'mobile'] as const) {
            const resolvedLayout = resolveResponsiveLayout(node.layout, responsiveMode)
            if (resolvedLayout?.mode === 'absolute' && (resolvedLayout.width === undefined || resolvedLayout.height === undefined)) issues.push(issue('warning', 'layout.absolute-size', `Absolutely positioned nodes should define width and height for ${responsiveMode}.`, { pageId: page.id, nodeId: node.id, path: `layout.${responsiveMode}` }))
          }
        }
        if (node.type === 'cinematic-sequence') {
          for (const [key, fallback] of Object.entries({ entryDistanceVh: 86, exitDistanceVh: 86, topHoldVh: 30, bottomHoldVh: 34, bridgeHoldVh: 30 })) {
            const value = Number(node.props?.[key] ?? fallback)
            if (!Number.isFinite(value) || value < 0 || value > 200) issues.push(issue('error', 'cinematic-sequence.range', `Cinematic Sequence ${key} must be between 0 and 200.`, { pageId: page.id, nodeId: node.id, path: `props.${key}` }))
          }
          if (!(node.children || []).some((child) => child.type === 'scene-frame')) issues.push(issue('warning', 'cinematic-sequence.empty', 'Cinematic Sequence should contain at least one Scene Frame.', { pageId: page.id, nodeId: node.id }))
        }
        if (node.type === 'scene-frame' && (node.props?.enterFrom !== undefined || node.props?.exitTo !== undefined)) {
          const enterFrom = String(node.props?.enterFrom || 'bottom')
          const exitTo = String(node.props?.exitTo || 'top')
          if (!['top','right','bottom','left','none'].includes(enterFrom) || !['top','right','bottom','left','none'].includes(exitTo)) issues.push(issue('error', 'cinematic-scene.direction', 'Shared-stage Scene Frame directions must be top, right, bottom, left, or none.', { pageId: page.id, nodeId: node.id }))
        }
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
        if (node.type === 'ambient-field') {
          const numeric = (key: string, min: number, max: number) => {
            const value = Number(node.props?.[key])
            if (!Number.isFinite(value) || value < min || value > max) issues.push(issue('error', 'ambient-field.range', `Ambient Field ${key} must be between ${min} and ${max}.`, { pageId: page.id, nodeId: node.id, path: `props.${key}` }))
          }
          numeric('count', 1, 120); numeric('size', 8, 160); numeric('minSize', 8, 160); numeric('maxSize', 8, 180); numeric('speed', 0.05, 3); numeric('drift', 0, 400); numeric('opacity', 0, 1); numeric('glow', 0, 1)
          if (Number(node.props?.minSize) > Number(node.props?.maxSize)) issues.push(issue('error', 'ambient-field.size-order', 'Ambient Field Min Size cannot be greater than Max Size.', { pageId: page.id, nodeId: node.id }))
          if (!['text','icons','mixed'].includes(String(node.props?.contentMode || 'text'))) issues.push(issue('error', 'ambient-field.mode', 'Ambient Field content mode must be text, icons, or mixed.', { pageId: page.id, nodeId: node.id }))
          if (!['float','drift','orbit','spin','pulse','flicker','static'].includes(String(node.props?.motion || 'float'))) issues.push(issue('error', 'ambient-field.motion', 'Ambient Field motion is unsupported.', { pageId: page.id, nodeId: node.id }))
          if (!['random','up','down','left','right'].includes(String(node.props?.direction || 'random'))) issues.push(issue('error', 'ambient-field.direction', 'Ambient Field direction is unsupported.', { pageId: page.id, nodeId: node.id }))
          if (!['random','even','edges','center'].includes(String(node.props?.distribution || 'random'))) issues.push(issue('error', 'ambient-field.distribution', 'Ambient Field distribution is unsupported.', { pageId: page.id, nodeId: node.id }))
          if (Boolean(node.props?.randomColors)) {
            const colors = String(node.props?.colors || '').split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
            const validColors = colors.filter((value) => /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)).slice(0, 12)
            if (!validColors.length) issues.push(issue('warning', 'ambient-field.colors', 'Ambient Field Random Colors is enabled but the palette has no valid hex colors; the runtime will use its default palette.', { pageId: page.id, nodeId: node.id, path: 'props.colors' }))
          }
          for (const mediaId of Array.isArray(node.props?.mediaIds) ? node.props?.mediaIds : []) if (typeof mediaId === 'string' && options.mediaIds && !options.mediaIds.has(mediaId)) issues.push(issue('warning', 'media.missing', `Referenced Ambient Field media “${mediaId}” does not exist.`, { pageId: page.id, nodeId: node.id }))
        }
        if (node.type === 'code-stream') {
          const speed = Number(node.props?.speed), gap = Number(node.props?.gap), edgeFade = Number(node.props?.edgeFade)
          if (!Number.isFinite(speed) || speed < .1 || speed > 10) issues.push(issue('error', 'code-stream.speed', 'Code Stream speed must be between 0.1 and 10.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(gap) || gap < 0 || gap > 200) issues.push(issue('error', 'code-stream.gap', 'Code Stream gap must be between 0 and 200.', { pageId: page.id, nodeId: node.id }))
          if (!Number.isFinite(edgeFade) || edgeFade < 0 || edgeFade > 200) issues.push(issue('error', 'code-stream.fade', 'Code Stream edge fade must be between 0 and 200.', { pageId: page.id, nodeId: node.id }))
          if (!['up','down','left','right'].includes(String(node.props?.direction || 'up'))) issues.push(issue('error', 'code-stream.direction', 'Code Stream direction must be up, down, left, or right.', { pageId: page.id, nodeId: node.id }))
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
      if (binding.type === 'collection' && (binding.source || 'collection') === 'collection' && binding.collection && options.collections && !Array.isArray(options.collections[binding.collection])) {
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
