import { normalizeBlogContentBlocks } from './blog-content'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const stringLimits: Record<string, number> = {
  slug: 140, title: 220, name: 220, company: 220, role: 220,
  subtitle: 500, excerpt: 2000, author_name: 220,
  short_description: 1000, full_description: 50000, summary: 3000, content: 200000, search_text: 250000,
  category: 160, employment_type: 160, location: 240, filename: 255,
}
const arrayFields = new Set(['gallery', 'technologies', 'tags', 'responsibilities', 'gallery_media_ids'])
const booleanFields = new Set(['featured', 'published', 'requires_login', 'current'])
const mediaIdFields = new Set(['thumbnail_media_id', 'cover_media_id', 'logo_media_id', 'icon_media_id'])
const urlFields = new Set(['github_url', 'live_url', 'thumbnail', 'cover_image', 'logo', 'icon'])

function error(message: string): never { throw new Error(message) }
function text(value: unknown, field: string, max = stringLimits[field] || 5000): string {
  if (typeof value !== 'string') error(`${field} must be text`)
  const normalized = value.trim()
  if (normalized.length > max) error(`${field} exceeds ${max} characters`)
  return normalized
}
function safeHttpUrl(value: unknown, field: string): string | null {
  if (value === null || value === '') return null
  const normalized = text(value, field, 2048)
  let parsed: URL
  try { parsed = new URL(normalized) } catch { error(`${field} must be a valid http/https URL`) }
  if (!['http:', 'https:'].includes(parsed!.protocol.toLowerCase())) error(`${field} must use http or https`)
  return normalized
}
function stringArray(value: unknown, field: string, maxItems = 100): string[] {
  if (!Array.isArray(value)) error(`${field} must be an array`)
  if (value.length > maxItems) error(`${field} exceeds ${maxItems} items`)
  return value.map((entry, index) => text(entry, `${field}[${index}]`, 1000)).filter(Boolean)
}
function plainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) error(`${field} must be an object`)
  const serialized = JSON.stringify(value)
  if (serialized.length > 20000) error(`${field} is too large`)
  return value as Record<string, unknown>
}

/** Validate and normalize the trusted Admin structured-content request body. */
export function normalizeStructuredRecordInput(resource: string, input: Record<string, unknown>, create = false): Record<string, unknown> {
  const output: Record<string, unknown> = { ...input }
  for (const [field, value] of Object.entries(output)) {
    if (field in stringLimits) output[field] = text(value, field)
    else if (arrayFields.has(field)) output[field] = stringArray(value, field, field === 'gallery_media_ids' ? 60 : 100)
    else if (booleanFields.has(field)) {
      if (typeof value !== 'boolean') error(`${field} must be boolean`)
    } else if (field === 'content_blocks') {
      output[field] = normalizeBlogContentBlocks(value)
    } else if (field === 'published_at') {
      if (value === null || value === '') output[field] = null
      else {
        const normalized = text(value, field, 64)
        const time = Date.parse(normalized)
        if (!Number.isFinite(time)) error('published_at must be a valid date/time')
        output[field] = new Date(time).toISOString()
      }
    } else if (field === 'reading_time_minutes') {
      if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 10000) error('reading_time_minutes must be an integer between 1 and 10000')
      output[field] = Number(value)
    } else if (field === 'display_order') {
      if (!Number.isInteger(value) || Number(value) < -100000 || Number(value) > 100000) error('display_order must be an integer between -100000 and 100000')
      output[field] = Number(value)
    } else if (field === 'seo') output[field] = plainObject(value, field)
    else if (field === 'status') {
      const status = text(value, field, 40)
      if (resource === 'apps' && !['coming_soon', 'available', 'maintenance', 'disabled'].includes(status)) error('Invalid AI app status')
      output[field] = status
    } else if (field === 'start_date' || field === 'end_date') {
      if (value === null || value === '') output[field] = null
      else {
        const normalized = text(value, field, 10)
        if (!DATE.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) error(`${field} must be YYYY-MM-DD`)
        output[field] = normalized
      }
    } else if (mediaIdFields.has(field)) {
      if (value === null || value === '') output[field] = null
      else {
        const normalized = text(value, field, 36)
        if (!UUID.test(normalized)) error(`${field} must be a media UUID`)
        output[field] = normalized
      }
    } else if (urlFields.has(field)) output[field] = safeHttpUrl(value, field)
  }

  if (typeof output.slug === 'string' && output.slug && !SLUG.test(output.slug)) error('slug must contain lowercase letters, numbers and hyphens only')
  if (create) {
    if (resource === 'projects' || resource === 'notes' || resource === 'blogs') {
      if (!String(output.title || '').trim()) error('title is required')
      if (!String(output.slug || '').trim()) error('slug is required')
    }
    if (resource === 'apps') {
      if (!String(output.name || '').trim()) error('name is required')
      if (!String(output.slug || '').trim()) error('slug is required')
    }
    if (resource === 'experience') {
      if (!String(output.company || '').trim()) error('company is required')
      if (!String(output.role || '').trim()) error('role is required')
      if (!output.start_date) error('start_date is required')
    }
  }
  return output
}

export function assertStructuredPublishReady(resource: string, record: Record<string, unknown>) {
  if (record.published !== true) return
  if (resource === 'projects' || resource === 'notes') {
    if (!String(record.title || '').trim() || !String(record.slug || '').trim()) error('Published records require title and slug')
  }
  if (resource === 'blogs') {
    if (!String(record.title || '').trim() || !String(record.slug || '').trim()) error('Published blogs require title and slug')
    if (!String(record.excerpt || '').trim()) error('Published blogs require an excerpt')
    if (!Array.isArray(record.content_blocks) || record.content_blocks.length === 0) error('Published blogs require at least one content block')
  }
  if (resource === 'apps' && (!String(record.name || '').trim() || !String(record.slug || '').trim())) error('Published apps require name and slug')
  if (resource === 'experience' && (!String(record.company || '').trim() || !String(record.role || '').trim() || !record.start_date)) error('Published experience requires company, role and start date')
}

export function normalizeMediaMetadataPatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  if ('filename' in input) {
    const filename = text(input.filename, 'filename', 255)
    if (!filename || /[\\/\u0000-\u001f]/.test(filename)) error('filename is invalid')
    patch.filename = filename
  }
  if ('alt_text' in input) patch.alt_text = input.alt_text === null ? null : text(input.alt_text, 'alt_text', 2000)
  return patch
}

function validateJsonValue(value: unknown, path: string, depth = 0): unknown {
  if (depth > 8) error(`${path} exceeds the maximum nesting depth`)
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) error(`${path} must contain only finite numbers`)
    return value
  }
  if (typeof value === 'string') {
    if (value.length > 10000) error(`${path} exceeds 10000 characters`)
    if (/\u0000/.test(value)) error(`${path} contains an invalid null character`)
    return value
  }
  if (Array.isArray(value)) {
    if (value.length > 200) error(`${path} exceeds 200 items`)
    return value.map((entry, index) => validateJsonValue(entry, `${path}[${index}]`, depth + 1))
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 200) error(`${path} exceeds 200 object keys`)
    return Object.fromEntries(entries.map(([key, entry]) => {
      if (!/^[A-Za-z0-9._-]{1,160}$/.test(key)) error(`${path} contains an invalid object key`)
      return [key, validateJsonValue(entry, `${path}.${key}`, depth + 1)]
    }))
  }
  error(`${path} must be JSON-serializable`)
}

/** Normalize one typed setting value before it is persisted into a draft revision. */
export function normalizeSettingValue(key: string, value: unknown): unknown {
  const normalized = validateJsonValue(value, `setting ${key}`)
  const serialized = JSON.stringify(normalized)
  if (serialized.length > 65536) error(`setting ${key} exceeds 64 KiB`)
  if (typeof normalized === 'string' && /(?:url|href|link)$/i.test(key)) {
    const candidate = normalized.trim()
    if (candidate && !candidate.startsWith('/') && !candidate.startsWith('#')) {
      let parsed: URL
      try { parsed = new URL(candidate) } catch { error(`setting ${key} must be a valid URL or site-relative path`) }
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed!.protocol.toLowerCase())) error(`setting ${key} uses an unsafe URL protocol`)
    }
  }
  return normalized
}
