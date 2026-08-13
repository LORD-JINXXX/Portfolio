import type { SupabaseClient } from '@supabase/supabase-js'

export const BUILTIN_COLLECTION_KEYS = new Set(['projects', 'notes', 'experience', 'apps'])
export const COLLECTION_FIELD_TYPES = new Set(['text','textarea','number','boolean','date','array','json','media','url','select'])

export interface CollectionFieldDefinition {
  key: string
  label: string
  type: 'text'|'textarea'|'number'|'boolean'|'date'|'array'|'json'|'media'|'url'|'select'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}
export interface CollectionDefinition {
  id: string
  key: string
  label: string
  description?: string | null
  fields_json: CollectionFieldDefinition[]
  display_order: number
}

function unavailable(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return text.includes('42p01') || text.includes('pgrst205') || text.includes('collection_definitions') && text.includes('not find')
}

export function normalizeCollectionKey(value: unknown) {
  const key = String(value || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(key)) throw new Error('Collection key must use 2-64 lowercase letters, numbers, hyphens, or underscores and start with a letter.')
  if (BUILTIN_COLLECTION_KEYS.has(key)) throw new Error(`Collection key ${key} is reserved by a built-in collection.`)
  return key
}

export function normalizeCollectionFields(value: unknown): CollectionFieldDefinition[] {
  if (!Array.isArray(value)) throw new Error('fields_json must be an array.')
  if (value.length > 40) throw new Error('A collection can define at most 40 fields.')
  const seen = new Set<string>()
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Field ${index + 1} must be an object.`)
    const input = raw as Record<string, unknown>
    const key = String(input.key || '').trim()
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw new Error(`Field ${index + 1} has an invalid key.`)
    if (seen.has(key)) throw new Error(`Duplicate field key: ${key}`)
    seen.add(key)
    const type = String(input.type || 'text') as CollectionFieldDefinition['type']
    if (!COLLECTION_FIELD_TYPES.has(type)) throw new Error(`Unsupported field type for ${key}: ${type}`)
    const label = String(input.label || key).trim().slice(0, 80)
    const options = type === 'select' && Array.isArray(input.options)
      ? input.options.slice(0, 100).map((option: any) => ({ label: String(option?.label ?? option?.value ?? '').slice(0, 100), value: String(option?.value ?? '').slice(0, 200) })).filter((option) => option.value)
      : undefined
    return { key, label, type, required: Boolean(input.required), placeholder: input.placeholder == null ? undefined : String(input.placeholder).slice(0, 200), options }
  })
}

export async function getCollectionDefinitions(db: SupabaseClient): Promise<CollectionDefinition[]> {
  const { data, error } = await db.from('collection_definitions').select('*').order('display_order', { ascending: true }).order('label', { ascending: true })
  if (error) {
    if (unavailable(error)) return []
    throw new Error(error.message)
  }
  return (data || []).map((row: any) => ({ ...row, fields_json: normalizeCollectionFields(row.fields_json || []) }))
}

export async function getGenericPublishedCollections(db: SupabaseClient): Promise<Record<string, unknown[]>> {
  const definitions = await getCollectionDefinitions(db)
  if (!definitions.length) return {}
  const keys = definitions.map((entry) => entry.key)
  const { data, error } = await db.from('collection_items').select('*').in('collection_key', keys).eq('published', true).order('display_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    if (unavailable(error)) return {}
    throw new Error(error.message)
  }
  const result: Record<string, unknown[]> = Object.fromEntries(keys.map((key) => [key, []]))
  for (const row of data || []) {
    const dataJson = row.data_json && typeof row.data_json === 'object' && !Array.isArray(row.data_json) ? row.data_json : {}
    result[row.collection_key]?.push({ id: row.id, ...dataJson, display_order: row.display_order, published: row.published, created_at: row.created_at, updated_at: row.updated_at })
  }
  return result
}

function parseJsonField(value: unknown, field: CollectionFieldDefinition) {
  if (field.type === 'boolean') {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'false' || normalized === '0' || normalized === '') return false
      if (normalized === 'true' || normalized === '1') return true
      throw new Error(`${field.label} must be true or false.`)
    }
    return Boolean(value)
  }
  if (field.type === 'number') {
    if (value === '' || value == null) return null
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number.`)
    return number
  }
  if (field.type === 'array') {
    if (Array.isArray(value)) return value
    if (value == null || value === '') return []
    if (typeof value === 'string') {
      try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed } catch {}
    }
    throw new Error(`${field.label} must be an array.`)
  }
  if (field.type === 'json') {
    if (value == null || value === '') return {}
    if (typeof value === 'object') return value
    if (typeof value === 'string') { try { return JSON.parse(value) } catch {} }
    throw new Error(`${field.label} must be valid JSON.`)
  }
  const text = value == null ? '' : String(value).trim()
  if (field.type === 'url' && text) {
    try { const parsed = new URL(text); if (!['http:','https:'].includes(parsed.protocol)) throw new Error() } catch { throw new Error(`${field.label} must be an http(s) URL.`) }
  }
  if (field.type === 'select' && text && field.options?.length && !field.options.some((option) => option.value === text)) throw new Error(`${field.label} must use one of the configured options.`)
  return text
}

export async function normalizeCollectionItemData(db: SupabaseClient, definition: CollectionDefinition, value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const output: Record<string, unknown> = {}
  const mediaIds: string[] = []
  for (const field of definition.fields_json) {
    const parsed = parseJsonField(input[field.key], field)
    const empty = parsed == null || parsed === '' || Array.isArray(parsed) && parsed.length === 0
    if (field.required && empty) throw new Error(`${field.label} is required.`)
    output[field.key] = parsed
    if (field.type === 'media' && typeof parsed === 'string' && parsed) mediaIds.push(parsed)
  }
  if (mediaIds.length) {
    const { data, error } = await db.from('media').select('id').in('id', [...new Set(mediaIds)])
    if (error) throw new Error(error.message)
    const found = new Set((data || []).map((row: any) => String(row.id)))
    const missing = mediaIds.filter((id) => !found.has(id))
    if (missing.length) throw new Error(`Unknown managed media id: ${missing[0]}`)
  }
  return output
}
