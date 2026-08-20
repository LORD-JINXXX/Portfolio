import { randomUUID } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BLOCK_ID = /^[A-Za-z0-9_-]{1,80}$/
const BLOG_BLOCK_TYPES = new Set(['rich_text','image','architecture','code','callout'])
const BLOG_BLOCK_LAYOUTS = new Set(['normal','wide','full','split'])

export type BlogBlock = Record<string, unknown> & { id: string; name: string; block_type: string }

function fail(message: string): never { throw new Error(message) }
function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') fail(`${field} must be text`)
  const normalized = value.trim()
  if (!normalized) fail(`${field} is required`)
  if (normalized.length > max) fail(`${field} exceeds ${max} characters`)
  return normalized
}
function optionalText(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') fail(`${field} must be text`)
  const normalized = value.trim()
  if (normalized.length > max) fail(`${field} exceeds ${max} characters`)
  return normalized
}
function optionalMediaId(value: unknown, field: string): string {
  const normalized = optionalText(value, field, 36)
  if (!normalized) return ''
  if (!UUID.test(normalized)) fail(`${field} must be a managed media UUID`)
  return normalized
}
function blockId(value: unknown): string {
  if (typeof value === 'string' && BLOCK_ID.test(value)) return value
  return randomUUID()
}
function derivedLegacyName(input: Record<string, unknown>, index: number): string {
  for (const key of ['name','heading','title','caption','filename','text']) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160)
  }
  return `Blog Section ${index + 1}`
}
function legacyTypeToBlockType(type: string): string {
  if (type === 'image' || type === 'video' || type === 'gallery') return 'image'
  if (type === 'code') return 'code'
  if (type === 'callout' || type === 'quote') return 'callout'
  if (type === 'architecture' || type === 'embed') return 'architecture'
  return 'rich_text'
}
function legacyBody(input: Record<string, unknown>, legacyType: string): string {
  if (typeof input.body === 'string') return input.body
  if (['paragraph','quote','callout'].includes(legacyType) && typeof input.text === 'string') return input.text
  if (legacyType === 'list' && Array.isArray(input.items)) return input.items.map((item) => String(item || '')).filter(Boolean).join('\n')
  if (legacyType === 'embed' && typeof input.url === 'string') return input.url
  return ''
}
function legacyHeading(input: Record<string, unknown>, legacyType: string): string {
  if (typeof input.heading === 'string') return input.heading
  if (legacyType === 'heading' && typeof input.text === 'string') return input.text
  if ((legacyType === 'callout' || legacyType === 'embed') && typeof input.title === 'string') return input.title
  return ''
}
function legacyMediaId(input: Record<string, unknown>): unknown {
  if (input.media_id) return input.media_id
  if (Array.isArray(input.media_ids) && input.media_ids.length) return input.media_ids[0]
  return ''
}

export function normalizeBlogContentBlocks(value: unknown): BlogBlock[] {
  if (!Array.isArray(value)) fail('content_blocks must be an array')
  if (value.length > 200) fail('content_blocks cannot exceed 200 blocks')
  const normalized = value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`content_blocks[${index}] must be an object`)
    const input = entry as Record<string, unknown>
    const legacyType = typeof input.type === 'string' ? input.type.trim() : ''
    const requestedType = typeof input.block_type === 'string' && input.block_type.trim() ? input.block_type.trim() : legacyTypeToBlockType(legacyType)
    if (!BLOG_BLOCK_TYPES.has(requestedType)) fail(`Unsupported blog block type: ${requestedType}`)

    const isLegacy = !input.block_type && Boolean(legacyType)
    const name = isLegacy
      ? (optionalText(input.name, `content_blocks[${index}].name`, 160) || derivedLegacyName(input, index))
      : requiredText(input.name, `content_blocks[${index}].name`, 160)
    const layout = optionalText(input.layout, `content_blocks[${index}].layout`, 20) || (input.full_width === true ? 'full' : 'normal')
    if (!BLOG_BLOCK_LAYOUTS.has(layout)) fail(`content_blocks[${index}].layout must be normal, wide, full or split`)

    const heading = optionalText(isLegacy ? legacyHeading(input, legacyType) : input.heading, `content_blocks[${index}].heading`, 500)
    const body = optionalText(isLegacy ? legacyBody(input, legacyType) : input.body, `content_blocks[${index}].body`, 50000)
    const media_id = optionalMediaId(isLegacy ? legacyMediaId(input) : input.media_id, `content_blocks[${index}].media_id`)
    const code = optionalText(input.code, `content_blocks[${index}].code`, 100000)

    return {
      id: blockId(input.id),
      name,
      block_type: requestedType,
      eyebrow: optionalText(input.eyebrow, `content_blocks[${index}].eyebrow`, 240),
      heading,
      body,
      media_id,
      media_alt: optionalText(input.media_alt, `content_blocks[${index}].media_alt`, 1000),
      code,
      language: optionalText(input.language, `content_blocks[${index}].language`, 80),
      caption: optionalText(input.caption, `content_blocks[${index}].caption`, 1000),
      layout,
    }
  })
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > 1024 * 1024) fail('content_blocks exceeds the 1 MiB article payload limit')
  return normalized
}

export function blogManagedMediaIds(blocks: BlogBlock[]): string[] {
  const ids: string[] = []
  for (const block of blocks) if (typeof block.media_id === 'string' && block.media_id) ids.push(block.media_id)
  return [...new Set(ids)]
}

export function blogPlainText(input: { title?: unknown; subtitle?: unknown; excerpt?: unknown; category?: unknown; tags?: unknown; content_blocks?: unknown }): string {
  const parts: string[] = []
  for (const value of [input.title, input.subtitle, input.excerpt, input.category]) if (typeof value === 'string' && value.trim()) parts.push(value.trim())
  if (Array.isArray(input.tags)) parts.push(...input.tags.filter((value): value is string => typeof value === 'string'))
  const blocks = Array.isArray(input.content_blocks) ? input.content_blocks : []
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const block = raw as Record<string, unknown>
    for (const key of ['name','eyebrow','heading','body','media_alt','caption','code','language']) {
      const value = block[key]
      if (typeof value === 'string' && value.trim()) parts.push(value.trim())
    }
    // Legacy Patch-12/13 blocks remain searchable until they are next saved and normalized.
    for (const key of ['text','title','attribution','filename']) {
      const value = block[key]
      if (typeof value === 'string' && value.trim()) parts.push(value.trim())
    }
    if (Array.isArray(block.items)) parts.push(...block.items.filter((value): value is string => typeof value === 'string'))
  }
  return parts.join('\n').replace(/\s+/g, ' ').trim().slice(0, 250000)
}

export function estimateBlogReadingTimeMinutes(plainText: string): number {
  const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0
  return Math.max(1, Math.ceil(words / 220))
}
