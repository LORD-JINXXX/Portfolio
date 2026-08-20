import type { SupabaseClient } from '@supabase/supabase-js'

export const BUILTIN_COLLECTION_KEYS = new Set(['projects', 'blogs', 'notes', 'experience', 'apps'])
export const COLLECTION_FIELD_TYPES = new Set(['text','textarea','number','boolean','date','array','json','media','url','select'])
export const COLLECTION_SCHEMA_SNAPSHOT_KEY = '__collection_schemas'
export const MAX_COLLECTION_ARRAY_ITEMS = 200
export const MAX_COLLECTION_ITEM_BYTES = 256 * 1024

export interface CollectionRelationDefinition {
  collection: string
  field: string
  requirePublished?: boolean
  targetCoverage?: 'none'|'warning'|'error'
}

export interface CollectionFieldDefinition {
  key: string
  label: string
  type: 'text'|'textarea'|'number'|'boolean'|'date'|'array'|'json'|'media'|'url'|'select'
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  /** Optional nested schema for structured array items. Plain arrays remain unchanged when omitted. */
  itemFields?: CollectionFieldDefinition[]
  /** Field used by Admin as the collapsed label for a structured array item. */
  itemLabelField?: string
  /** Optional top-level uniqueness constraint for scalar custom-collection fields. */
  unique?: boolean
  /** Optional top-level relation to a built-in or custom collection field. */
  relation?: CollectionRelationDefinition
}
export interface CollectionDefinition {
  id: string
  key: string
  label: string
  description?: string | null
  fields_json: CollectionFieldDefinition[]
  display_order: number
}

export interface CollectionIntegrityIssue {
  severity: 'error'|'warning'
  code: string
  message: string
  collectionKey?: string
  itemId?: string
  fieldKey?: string
}

function unavailable(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return text.includes('42p01') || text.includes('pgrst205') || text.includes('collection_definitions') && text.includes('not find')
}

function normalizeAnyCollectionKey(value: unknown) {
  const key = String(value || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(key)) throw new Error('Collection key must use 2-64 lowercase letters, numbers, hyphens, or underscores and start with a letter.')
  if (key.startsWith('__')) throw new Error('Collection keys beginning with __ are reserved for internal release metadata.')
  return key
}

export function normalizeCollectionKey(value: unknown) {
  const key = normalizeAnyCollectionKey(value)
  if (BUILTIN_COLLECTION_KEYS.has(key)) throw new Error(`Collection key ${key} is reserved by a built-in collection.`)
  return key
}

function normalizeFieldGroup(value: unknown, path: string, depth: number): CollectionFieldDefinition[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`)
  if (value.length > 40) throw new Error(`${path} can define at most 40 fields.`)
  if (depth > 3) throw new Error('Structured array schemas can be nested at most 3 levels deep.')
  const seen = new Set<string>()
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${path} field ${index + 1} must be an object.`)
    const input = raw as Record<string, unknown>
    const key = String(input.key || '').trim()
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw new Error(`${path} field ${index + 1} has an invalid key.`)
    if (seen.has(key)) throw new Error(`Duplicate field key in ${path}: ${key}`)
    seen.add(key)
    const type = String(input.type || 'text') as CollectionFieldDefinition['type']
    if (!COLLECTION_FIELD_TYPES.has(type)) throw new Error(`Unsupported field type for ${key}: ${type}`)
    const label = String(input.label || key).trim().slice(0, 80)
    const options = type === 'select' && Array.isArray(input.options)
      ? input.options.slice(0, 100).map((option: any) => ({ label: String(option?.label ?? option?.value ?? '').slice(0, 100), value: String(option?.value ?? '').slice(0, 200) })).filter((option) => option.value)
      : undefined

    let itemFields: CollectionFieldDefinition[] | undefined
    let itemLabelField: string | undefined
    const rawItemFields = input.itemFields ?? input.item_fields
    if (rawItemFields !== undefined) {
      if (type !== 'array') throw new Error(`itemFields is only supported for array field ${key}.`)
      itemFields = normalizeFieldGroup(rawItemFields, `${path}.${key}.itemFields`, depth + 1)
      if (!itemFields.length) throw new Error(`Structured array field ${key} must define at least one item field.`)
      const requestedLabelField = String(input.itemLabelField ?? input.item_label_field ?? '').trim()
      if (requestedLabelField) {
        if (!itemFields.some((field) => field.key === requestedLabelField)) throw new Error(`itemLabelField for ${key} must match one of its itemFields.`)
        itemLabelField = requestedLabelField
      } else if (itemFields.some((field) => field.key === 'name')) itemLabelField = 'name'
    } else if (input.itemLabelField !== undefined || input.item_label_field !== undefined) {
      throw new Error(`itemLabelField requires itemFields on array field ${key}.`)
    }

    let unique: boolean | undefined
    let relation: CollectionRelationDefinition | undefined
    if (input.unique !== undefined) {
      if (depth > 0) throw new Error(`unique is supported only for top-level collection fields (${key}).`)
      if (type === 'array' || type === 'json') throw new Error(`unique is not supported for ${type} field ${key}.`)
      unique = Boolean(input.unique)
    }
    if (input.relation !== undefined && input.relation !== null) {
      if (depth > 0) throw new Error(`relation is supported only for top-level collection fields (${key}).`)
      if (type === 'array' || type === 'json' || type === 'boolean') throw new Error(`relation is not supported for ${type} field ${key}.`)
      if (!input.relation || typeof input.relation !== 'object' || Array.isArray(input.relation)) throw new Error(`relation for ${key} must be an object.`)
      const rawRelation = input.relation as Record<string, unknown>
      const collection = normalizeAnyCollectionKey(rawRelation.collection)
      const field = String(rawRelation.field || '').trim()
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field)) throw new Error(`relation field for ${key} is invalid.`)
      const rawCoverage = String(rawRelation.targetCoverage ?? rawRelation.target_coverage ?? 'none').trim().toLowerCase()
      if (!['none','warning','error'].includes(rawCoverage)) throw new Error(`relation targetCoverage for ${key} must be none, warning, or error.`)
      relation = {
        collection,
        field,
        requirePublished: rawRelation.requirePublished === undefined && rawRelation.require_published === undefined ? true : Boolean(rawRelation.requirePublished ?? rawRelation.require_published),
        targetCoverage: rawCoverage as CollectionRelationDefinition['targetCoverage'],
      }
    }

    return {
      key,
      label,
      type,
      required: Boolean(input.required),
      placeholder: input.placeholder == null ? undefined : String(input.placeholder).slice(0, 200),
      options,
      itemFields,
      itemLabelField,
      unique,
      relation,
    }
  })
}

export function normalizeCollectionFields(value: unknown): CollectionFieldDefinition[] {
  if (!Array.isArray(value)) throw new Error('fields_json must be an array.')
  return normalizeFieldGroup(value, 'fields_json', 0)
}

export async function getCollectionDefinitions(db: SupabaseClient): Promise<CollectionDefinition[]> {
  const { data, error } = await db.from('collection_definitions').select('*').order('display_order', { ascending: true }).order('label', { ascending: true })
  if (error) {
    if (unavailable(error)) return []
    throw new Error(error.message)
  }
  return (data || []).map((row: any) => ({ ...row, fields_json: normalizeCollectionFields(row.fields_json || []) }))
}

export function collectionDefinitionsSnapshot(definitions: CollectionDefinition[]): unknown[] {
  return definitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description || null,
    display_order: definition.display_order || 0,
    fields_json: definition.fields_json,
  }))
}

export function definitionsFromSnapshot(collections: Record<string, unknown[]>): CollectionDefinition[] {
  const raw = collections?.[COLLECTION_SCHEMA_SNAPSHOT_KEY]
  if (!Array.isArray(raw)) return []
  const result: CollectionDefinition[] = []
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Collection schema snapshot entry ${index + 1} must be an object.`)
    const row = entry as Record<string, unknown>
    const key = normalizeCollectionKey(row.key)
    result.push({
      id: `snapshot:${key}`,
      key,
      label: String(row.label || key).trim().slice(0, 80) || key,
      description: row.description == null ? null : String(row.description).slice(0, 1000),
      fields_json: normalizeCollectionFields(row.fields_json || []),
      display_order: Number.isFinite(Number(row.display_order)) ? Number(row.display_order) : 0,
    })
  }
  return result
}

export function stripInternalCollectionMetadata(collections: Record<string, unknown[]> | undefined | null): Record<string, unknown[]> {
  return Object.fromEntries(Object.entries(collections || {}).filter(([key, value]) => !key.startsWith('__') && Array.isArray(value)))
}

function addReleaseMediaAliases(value: unknown, fields: CollectionFieldDefinition[]): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const source = value as Record<string, unknown>
  const output: Record<string, unknown> = { ...source }
  for (const field of fields) {
    const fieldValue = source[field.key]
    if (field.type === 'media' && typeof fieldValue === 'string' && fieldValue) output[`__release_${field.key}_media_id`] = fieldValue
    if (field.type === 'array' && field.itemFields?.length && Array.isArray(fieldValue)) {
      output[field.key] = fieldValue.map((item) => addReleaseMediaAliases(item, field.itemFields || []))
    }
  }
  return output
}

function parseArrayValue(value: unknown, field: CollectionFieldDefinition, path: string) {
  let parsed: unknown[]
  if (Array.isArray(value)) parsed = value
  else if (value == null || value === '') parsed = []
  else if (typeof value === 'string') {
    try {
      const decoded = JSON.parse(value)
      if (!Array.isArray(decoded)) throw new Error()
      parsed = decoded
    } catch { throw new Error(`${path} must be an array.`) }
  } else throw new Error(`${path} must be an array.`)
  if (parsed.length > MAX_COLLECTION_ARRAY_ITEMS) throw new Error(`${path} can contain at most ${MAX_COLLECTION_ARRAY_ITEMS} items.`)
  return parsed
}

function isEmptyValue(value: unknown) {
  return value == null || value === '' || Array.isArray(value) && value.length === 0 || Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0)
}

function parseCollectionFieldValue(value: unknown, field: CollectionFieldDefinition, path: string, mediaIds: string[]): unknown {
  if (field.type === 'boolean') {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'false' || normalized === '0' || normalized === '') return false
      if (normalized === 'true' || normalized === '1') return true
      throw new Error(`${path} must be true or false.`)
    }
    return Boolean(value)
  }
  if (field.type === 'number') {
    if (value === '' || value == null) return null
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error(`${path} must be a number.`)
    return number
  }
  if (field.type === 'array') {
    const parsed = parseArrayValue(value, field, path)
    if (!field.itemFields?.length) return parsed
    return parsed.map((item, itemIndex) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${path} item ${itemIndex + 1} must be an object.`)
      const input = item as Record<string, unknown>
      const output: Record<string, unknown> = {}
      for (const itemField of field.itemFields || []) {
        const childPath = `${path} item ${itemIndex + 1} → ${itemField.label}`
        const childValue = parseCollectionFieldValue(input[itemField.key], itemField, childPath, mediaIds)
        if (itemField.required && isEmptyValue(childValue)) throw new Error(`${childPath} is required.`)
        output[itemField.key] = childValue
      }
      return output
    })
  }
  if (field.type === 'json') {
    if (value == null || value === '') return {}
    if (typeof value === 'object') return value
    if (typeof value === 'string') { try { return JSON.parse(value) } catch {} }
    throw new Error(`${path} must be valid JSON.`)
  }
  const text = value == null ? '' : String(value).trim()
  if (field.type === 'url' && text) {
    try { const parsed = new URL(text); if (!['http:','https:'].includes(parsed.protocol)) throw new Error() } catch { throw new Error(`${path} must be an http(s) URL.`) }
  }
  if (field.type === 'select' && text && field.options?.length && !field.options.some((option) => option.value === text)) throw new Error(`${path} must use one of the configured options.`)
  if (field.type === 'media' && text) mediaIds.push(text)
  return text
}

export function normalizeCollectionItemShape(definition: CollectionDefinition, value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const output: Record<string, unknown> = {}
  const mediaIds: string[] = []
  for (const field of definition.fields_json) {
    const parsed = parseCollectionFieldValue(input[field.key], field, field.label, mediaIds)
    if (field.required && isEmptyValue(parsed)) throw new Error(`${field.label} is required.`)
    output[field.key] = parsed
  }
  const bytes = Buffer.byteLength(JSON.stringify(output), 'utf8')
  if (bytes > MAX_COLLECTION_ITEM_BYTES) throw new Error(`${definition.label} item exceeds the ${Math.floor(MAX_COLLECTION_ITEM_BYTES / 1024)} KB normalized payload limit.`)
  return { data: output, mediaIds: [...new Set(mediaIds)] }
}

async function assertManagedMediaIds(db: SupabaseClient, mediaIds: string[]) {
  if (!mediaIds.length) return
  const { data, error } = await db.from('media').select('id').in('id', mediaIds)
  if (error) throw new Error(error.message)
  const found = new Set((data || []).map((row: any) => String(row.id)))
  const missing = mediaIds.filter((id) => !found.has(id))
  if (missing.length) throw new Error(`Unknown managed media id: ${missing[0]}`)
}

export async function normalizeCollectionItemData(db: SupabaseClient, definition: CollectionDefinition, value: unknown) {
  const normalized = normalizeCollectionItemShape(definition, value)
  await assertManagedMediaIds(db, normalized.mediaIds)
  return normalized.data
}

const BUILTIN_TABLES: Record<string, string> = { projects: 'projects', blogs: 'blogs', notes: 'notes', experience: 'experiences', apps: 'ai_apps' }
const BUILTIN_RELATION_FIELDS: Record<string, Set<string>> = {
  projects: new Set(['id','slug','title']),
  blogs: new Set(['id','slug','title']),
  notes: new Set(['id','slug','title']),
  experience: new Set(['id','company','role']),
  apps: new Set(['id','slug','name']),
}

export async function assertCollectionDefinitionRelations(db: SupabaseClient, definition: CollectionDefinition) {
  const relations = definition.fields_json.filter((field) => field.relation)
  if (!relations.length) return
  let definitions: CollectionDefinition[] | null = null
  for (const field of relations) {
    const relation = field.relation!
    const builtinFields = BUILTIN_RELATION_FIELDS[relation.collection]
    if (builtinFields) {
      if (!builtinFields.has(relation.field)) throw new Error(`${field.label} relation targets unsupported built-in field ${relation.collection}.${relation.field}.`)
      continue
    }
    const target = relation.collection === definition.key
      ? definition
      : (definitions ||= await getCollectionDefinitions(db)).find((entry) => entry.key === relation.collection)
    if (!target) throw new Error(`${field.label} relation targets unknown collection ${relation.collection}.`)
    if (relation.field !== 'id' && !target.fields_json.some((candidate) => candidate.key === relation.field)) throw new Error(`${field.label} relation targets unknown field ${relation.collection}.${relation.field}.`)
  }
}


function comparable(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') return value.trim()
  return JSON.stringify(value)
}

export async function assertCollectionItemConstraints(
  db: SupabaseClient,
  definition: CollectionDefinition,
  data: Record<string, unknown>,
  options: { excludeItemId?: string } = {},
) {
  const constrained = definition.fields_json.filter((field) => field.unique || field.relation)
  if (!constrained.length) return

  let sameCollectionRows: any[] | null = null
  const loadSameCollection = async () => {
    if (sameCollectionRows) return sameCollectionRows
    const { data: rows, error } = await db.from('collection_items').select('id,data_json,published').eq('collection_key', definition.key)
    if (error) throw new Error(error.message)
    sameCollectionRows = rows || []
    return sameCollectionRows
  }

  for (const field of constrained) {
    const value = data[field.key]
    if (isEmptyValue(value)) continue
    const expected = comparable(value)
    if (field.unique) {
      const rows = await loadSameCollection()
      const duplicate = rows.find((row: any) => row.id !== options.excludeItemId && comparable(row.data_json?.[field.key]) === expected)
      if (duplicate) throw new Error(`${field.label} must be unique within ${definition.label}.`)
    }
    if (field.relation) {
      const relation = field.relation
      const targetTable = BUILTIN_TABLES[relation.collection]
      let matches: any[] = []
      if (targetTable) {
        let query: any = db.from(targetTable).select(`id,${relation.field},published`).eq(relation.field, value)
        if (relation.requirePublished !== false) query = query.eq('published', true)
        const { data: rows, error } = await query.limit(2)
        if (error) throw new Error(error.message)
        matches = rows || []
      } else {
        let query: any = db.from('collection_items').select('id,data_json,published').eq('collection_key', relation.collection)
        if (relation.requirePublished !== false) query = query.eq('published', true)
        const { data: rows, error } = await query
        if (error) throw new Error(error.message)
        matches = (rows || []).filter((row: any) => comparable(row.data_json?.[relation.field]) === expected)
      }
      if (matches.length === 0) throw new Error(`${field.label} must reference an existing${relation.requirePublished === false ? '' : ' published'} ${relation.collection}.${relation.field} value.`)
      if (matches.length > 1) throw new Error(`${field.label} relation is ambiguous because ${relation.collection}.${relation.field} is not unique.`)
    }
  }
}

export async function assertCollectionDefinitionCompatibleWithExistingItems(db: SupabaseClient, definition: CollectionDefinition) {
  const { data: rows, error } = await db.from('collection_items').select('id,data_json').eq('collection_key', definition.key)
  if (error) throw new Error(error.message)
  const mediaIds = new Set<string>()
  const normalizedRows: Array<{ id: string; data: Record<string, unknown> }> = []
  for (const row of rows || []) {
    try {
      const normalized = normalizeCollectionItemShape(definition, row.data_json || {})
      normalized.mediaIds.forEach((id) => mediaIds.add(id))
      normalizedRows.push({ id: String(row.id), data: normalized.data })
    } catch (cause) {
      throw new Error(`Existing ${definition.label} item ${row.id} is incompatible with the proposed schema: ${cause instanceof Error ? cause.message : 'invalid item'}`)
    }
  }
  await assertManagedMediaIds(db, [...mediaIds])
  for (const row of normalizedRows) {
    try { await assertCollectionItemConstraints(db, definition, row.data, { excludeItemId: row.id }) }
    catch (cause) { throw new Error(`Existing ${definition.label} item ${row.id} violates the proposed schema constraints: ${cause instanceof Error ? cause.message : 'invalid constraint'}`) }
  }
}

export function validateCollectionSnapshotIntegrity(
  collections: Record<string, unknown[]>,
  definitions: CollectionDefinition[],
): CollectionIntegrityIssue[] {
  const issues: CollectionIntegrityIssue[] = []
  for (const definition of definitions) {
    const rows = Array.isArray(collections[definition.key]) ? collections[definition.key] as any[] : []
    const normalizedRows: Array<{ row: any; data: Record<string, unknown> }> = []
    for (const row of rows) {
      try {
        const normalized = normalizeCollectionItemShape(definition, row)
        normalizedRows.push({ row, data: normalized.data })
      } catch (cause) {
        issues.push({ severity: 'error', code: 'collection.schema-invalid-item', collectionKey: definition.key, itemId: String(row?.id || ''), message: `${definition.label} item ${row?.id || '(unknown)'} does not match its frozen schema: ${cause instanceof Error ? cause.message : 'invalid item'}` })
      }
    }

    for (const field of definition.fields_json) {
      if (field.unique) {
        const seen = new Map<string, string>()
        for (const { row, data } of normalizedRows) {
          if (isEmptyValue(data[field.key])) continue
          const value = comparable(data[field.key])
          const previous = seen.get(value)
          if (previous) issues.push({ severity: 'error', code: 'collection.unique-duplicate', collectionKey: definition.key, itemId: String(row?.id || ''), fieldKey: field.key, message: `${definition.label}.${field.label} duplicates another item (${previous}).` })
          else seen.set(value, String(row?.id || '(unknown)'))
        }
      }
      if (field.relation) {
        const relation = field.relation
        const targets = Array.isArray(collections[relation.collection]) ? collections[relation.collection] as any[] : []
        const targetValues = new Map<string, number>()
        for (const target of targets) {
          if (relation.requirePublished !== false && target?.published === false) continue
          const value = comparable(target?.[relation.field])
          if (!value) continue
          targetValues.set(value, (targetValues.get(value) || 0) + 1)
        }
        const referenced = new Set<string>()
        for (const { row, data } of normalizedRows) {
          const raw = data[field.key]
          if (isEmptyValue(raw)) continue
          const value = comparable(raw)
          referenced.add(value)
          const count = targetValues.get(value) || 0
          if (count === 0) issues.push({ severity: 'error', code: 'collection.relation-missing', collectionKey: definition.key, itemId: String(row?.id || ''), fieldKey: field.key, message: `${definition.label}.${field.label} references missing ${relation.collection}.${relation.field} value “${value}”.` })
          else if (count > 1) issues.push({ severity: 'error', code: 'collection.relation-ambiguous', collectionKey: definition.key, itemId: String(row?.id || ''), fieldKey: field.key, message: `${definition.label}.${field.label} references ambiguous ${relation.collection}.${relation.field} value “${value}”.` })
        }
        if (relation.targetCoverage && relation.targetCoverage !== 'none') {
          for (const [targetValue] of targetValues) {
            if (referenced.has(targetValue)) continue
            issues.push({ severity: relation.targetCoverage, code: 'collection.relation-uncovered-target', collectionKey: definition.key, fieldKey: field.key, message: `${relation.collection}.${relation.field} value “${targetValue}” has no matching ${definition.key}.${field.key} item.` })
          }
        }
      }
    }
  }
  return issues
}

export async function getGenericPublishedCollections(db: SupabaseClient, providedDefinitions?: CollectionDefinition[]): Promise<Record<string, unknown[]>> {
  const definitions = providedDefinitions || await getCollectionDefinitions(db)
  if (!definitions.length) return {}
  const keys = definitions.map((entry) => entry.key)
  const { data, error } = await db.from('collection_items').select('*').in('collection_key', keys).eq('published', true).order('display_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    if (unavailable(error)) return {}
    throw new Error(error.message)
  }
  const result: Record<string, unknown[]> = Object.fromEntries(keys.map((key) => [key, []]))
  const allMediaIds = new Set<string>()
  for (const row of data || []) {
    const definition = definitions.find((entry) => entry.key === row.collection_key)
    if (!definition) continue
    const normalized = normalizeCollectionItemShape(definition, row.data_json || {})
    normalized.mediaIds.forEach((id) => allMediaIds.add(id))
    const releaseSafeData = addReleaseMediaAliases(normalized.data, definition.fields_json) as Record<string, unknown>
    result[row.collection_key]?.push({ id: row.id, ...releaseSafeData, display_order: row.display_order, published: row.published, created_at: row.created_at, updated_at: row.updated_at })
  }
  await assertManagedMediaIds(db, [...allMediaIds])
  return result
}
