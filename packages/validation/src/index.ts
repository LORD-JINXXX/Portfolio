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

export const SUPPORTED_NODE_TYPES = new Set([
  'section', 'container', 'div', 'header', 'main', 'aside', 'footer', 'article', 'nav', 'details', 'summary',
  'heading', 'text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a',
  'button', 'input', 'textarea', 'img', 'image', 'figure', 'figcaption', 'video', 'audio', 'iframe', 'hr', 'br', 'table',
  'form', 'label', 'select', 'option', 'progress', 'meter', 'dialog', 'mark', 'code', 'collection', 'navbar', 'hero', 'card',
])

export const SUPPORTED_ANIMATIONS = new Set(SUPPORTED_RUNTIME_ANIMATIONS)

export const SUPPORTED_SCROLL_BEHAVIORS = new Set(['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal'])
export const SUPPORTED_COLLECTIONS = new Set(['projects', 'notes', 'experience', 'apps'])

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
  if (binding.type === 'collection') {
    if (!SUPPORTED_COLLECTIONS.has(binding.collection)) out.push(issue('warning', 'binding.collection.unknown', `Collection “${binding.collection}” is not a built-in collection.`, base))
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
    }

    const ancestors = new Set<string>()
    const visit = (nodes: StudioNode[], chain: Set<string>) => {
      nodes.forEach((node) => {
        if (ids.has(node.id)) issues.push(issue('error', 'node.id-duplicate', `Duplicate node ID “${node.id}”.`, { pageId: page.id, nodeId: node.id }))
        ids.add(node.id)
        if (chain.has(node.id)) issues.push(issue('error', 'node.cycle', `Node “${node.id}” creates a cyclic tree.`, { pageId: page.id, nodeId: node.id }))
        if (!SUPPORTED_NODE_TYPES.has(node.type)) issues.push(issue('error', 'node.unsupported', `Unsupported node type “${node.type}”.`, { pageId: page.id, nodeId: node.id }))
        if (!node.styles.desktop && !node.styles.tablet && !node.styles.mobile) issues.push(issue('warning', 'node.styles.empty', `Node “${node.meta?.label || node.type}” has no styles.`, { pageId: page.id, nodeId: node.id }))
        Object.entries(node.bindings || {}).forEach(([property, binding]) => issues.push(...validateBinding(binding, page, node, property)))
        if (node.animation && !SUPPORTED_ANIMATIONS.has(node.animation.type)) issues.push(issue('error', 'animation.unsupported', `Animation “${node.animation.type}” is not supported by the runtime.`, { pageId: page.id, nodeId: node.id }))
        if (node.animation && SUPPORTED_ANIMATIONS.has(node.animation.type) && !getAllowedAnimationTriggers(node.animation.type).includes(node.animation.trigger)) issues.push(issue('error', 'animation.trigger-unsupported', `Animation “${node.animation.type}” does not support the “${node.animation.trigger}” trigger.`, { pageId: page.id, nodeId: node.id }))
        if (node.scrollBehavior && !SUPPORTED_SCROLL_BEHAVIORS.has(node.scrollBehavior.mode)) issues.push(issue('error', 'scroll.unsupported', `Scroll behavior “${node.scrollBehavior.mode}” is not supported.`, { pageId: page.id, nodeId: node.id }))
        if (node.scrollBehavior?.mode === 'stack-over-previous' && !node.meta?.sectionLabel) issues.push(issue('warning', 'scroll.stack-section-label', 'Stacked sections should have a Section Label for Admin navigation.', { pageId: page.id, nodeId: node.id }))
        if (node.layout?.mode === 'absolute' && (node.layout.width === undefined || node.layout.height === undefined)) issues.push(issue('warning', 'layout.absolute-size', 'Absolutely positioned nodes should define width and height.', { pageId: page.id, nodeId: node.id }))
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

function validateContentValue(slot: ContentSlot, value: unknown, mediaIds?: Set<string>): ValidationIssue[] {
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
      return typeof value === 'string' && isExternalOrPathReference(value) ? [] : [issue('error', 'content.url', `Content “${slot.label}” must be a valid URL, route, anchor, mailto, or tel value.`, extra)]
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
