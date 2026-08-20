export type AdminListDirection = 'asc' | 'desc'
export type AdminListFilterType = 'text' | 'boolean' | 'number'

export interface AdminListResourceConfig {
  table: string
  searchFields: readonly string[]
  sortFields: readonly string[]
  filterFields: Readonly<Record<string, AdminListFilterType>>
  defaultSort: { field: string; direction: AdminListDirection }
  defaultPageSize?: number
  maxPageSize?: number
}

export interface AdminListQuery {
  enabled: boolean
  q: string
  page: number
  pageSize: number
  sort: string
  direction: AdminListDirection
  filters: Record<string, string | number | boolean>
}

export interface AdminListMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
  sort: string
  direction: AdminListDirection
  q: string
  filters: Record<string, string | number | boolean>
}

export const ADMIN_LIST_DEFAULT_PAGE_SIZE = 25
export const ADMIN_LIST_MAX_PAGE_SIZE = 100
export const ADMIN_LIST_MAX_PAGE = 10_000

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0])
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function positiveInteger(value: unknown, fallback: number, max?: number): number {
  const parsed = Number.parseInt(firstQueryValue(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return max ? Math.min(parsed, max) : parsed
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return undefined
}

function parseFilterValue(value: unknown, type: AdminListFilterType): string | number | boolean | undefined {
  const raw = firstQueryValue(value).trim()
  if (!raw) return undefined
  if (type === 'text') return raw.slice(0, 160)
  if (type === 'boolean') return parseBoolean(raw)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function hasListQueryKey(query: Record<string, unknown>, config: AdminListResourceConfig): boolean {
  if (['q', 'search', 'page', 'pageSize', 'sort', 'direction'].some((key) => query[key] !== undefined)) return true
  return Object.keys(config.filterFields).some((field) =>
    query[field] !== undefined || query[`filter.${field}`] !== undefined || query[`filter[${field}]`] !== undefined,
  )
}

export function sanitizeAdminSearchTerm(value: unknown): string {
  return firstQueryValue(value)
    .trim()
    .slice(0, 120)
    // Supabase .or() accepts raw PostgREST filter syntax. Remove its grouping/
    // wildcard delimiters so a search term can only remain a literal substring.
    .replace(/[%_*(),"\\\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseAdminListQuery(rawQuery: Record<string, unknown>, config: AdminListResourceConfig): AdminListQuery {
  const defaultPageSize = Math.max(1, Math.min(config.defaultPageSize || ADMIN_LIST_DEFAULT_PAGE_SIZE, config.maxPageSize || ADMIN_LIST_MAX_PAGE_SIZE))
  const maxPageSize = Math.max(defaultPageSize, config.maxPageSize || ADMIN_LIST_MAX_PAGE_SIZE)
  const requestedSort = firstQueryValue(rawQuery.sort).trim()
  const sort = config.sortFields.includes(requestedSort) ? requestedSort : config.defaultSort.field
  const requestedDirection = firstQueryValue(rawQuery.direction).trim().toLowerCase()
  const direction: AdminListDirection = requestedDirection === 'desc' ? 'desc' : requestedDirection === 'asc' ? 'asc' : config.defaultSort.direction
  const filters: Record<string, string | number | boolean> = {}

  for (const [field, type] of Object.entries(config.filterFields)) {
    const raw = rawQuery[`filter.${field}`] ?? rawQuery[`filter[${field}]`] ?? rawQuery[field]
    if (raw === undefined) continue
    const parsed = parseFilterValue(raw, type)
    if (parsed !== undefined) filters[field] = parsed
  }

  return {
    enabled: hasListQueryKey(rawQuery, config),
    q: sanitizeAdminSearchTerm(rawQuery.q ?? rawQuery.search),
    page: positiveInteger(rawQuery.page, 1, ADMIN_LIST_MAX_PAGE),
    pageSize: positiveInteger(rawQuery.pageSize, defaultPageSize, maxPageSize),
    sort,
    direction,
    filters,
  }
}

export function adminListRange(query: AdminListQuery): { from: number; to: number } {
  const from = (query.page - 1) * query.pageSize
  return { from, to: from + query.pageSize - 1 }
}

export function adminSearchOrExpression(config: AdminListResourceConfig, query: AdminListQuery): string {
  if (!query.q || config.searchFields.length === 0) return ''
  const pattern = `%${query.q}%`
  return config.searchFields.map((field) => `${field}.ilike.${pattern}`).join(',')
}

export function applyAdminListQuery<T extends {
  or: (expression: string) => T
  eq: (field: string, value: string | number | boolean) => T
  order: (field: string, options: { ascending: boolean }) => T
  range: (from: number, to: number) => T
}>(builder: T, config: AdminListResourceConfig, query: AdminListQuery): T {
  let next = builder
  const searchExpression = adminSearchOrExpression(config, query)
  if (searchExpression) next = next.or(searchExpression)
  for (const [field, value] of Object.entries(query.filters)) next = next.eq(field, value)
  next = next.order(query.sort, { ascending: query.direction === 'asc' })
  // Offset pagination must be deterministic when the primary sort value is shared
  // by multiple rows (for example display_order = 0). UUID id is the canonical
  // stable tie-breaker for all structured Admin resources.
  if (query.sort !== 'id') next = next.order('id', { ascending: true })
  if (query.enabled) {
    const range = adminListRange(query)
    next = next.range(range.from, range.to)
  }
  return next
}

export function createAdminListMeta(query: AdminListQuery, totalValue: number | null | undefined): AdminListMeta {
  const total = Math.max(0, Number(totalValue || 0))
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize)
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    hasNext: totalPages > 0 && query.page < totalPages,
    hasPrevious: totalPages > 0 && query.page > 1,
    sort: query.sort,
    direction: query.direction,
    q: query.q,
    filters: { ...query.filters },
  }
}

export const ADMIN_STRUCTURED_LIST_CONFIG: Readonly<Record<string, AdminListResourceConfig>> = {
  projects: {
    table: 'projects',
    searchFields: ['title', 'slug', 'short_description', 'full_description'],
    sortFields: ['display_order', 'created_at', 'updated_at', 'title', 'published', 'featured'],
    filterFields: { published: 'boolean', featured: 'boolean' },
    defaultSort: { field: 'display_order', direction: 'asc' },
  },
  blogs: {
    table: 'blogs',
    searchFields: ['title', 'slug', 'subtitle', 'excerpt', 'author_name', 'category', 'search_text'],
    sortFields: ['published_at', 'created_at', 'updated_at', 'display_order', 'title', 'category', 'published', 'featured'],
    filterFields: { published: 'boolean', featured: 'boolean', category: 'text' },
    defaultSort: { field: 'published_at', direction: 'desc' },
  },
  notes: {
    table: 'notes',
    searchFields: ['title', 'slug', 'summary', 'category'],
    sortFields: ['display_order', 'created_at', 'updated_at', 'title', 'category', 'published', 'featured'],
    filterFields: { published: 'boolean', featured: 'boolean', category: 'text' },
    defaultSort: { field: 'display_order', direction: 'asc' },
  },
  experience: {
    table: 'experiences',
    searchFields: ['company', 'role', 'employment_type', 'location', 'summary'],
    sortFields: ['display_order', 'created_at', 'updated_at', 'company', 'role', 'start_date', 'end_date', 'published', 'current'],
    filterFields: { published: 'boolean', current: 'boolean', employment_type: 'text' },
    defaultSort: { field: 'display_order', direction: 'asc' },
  },
  apps: {
    table: 'ai_apps',
    searchFields: ['name', 'slug', 'short_description', 'full_description', 'category', 'status'],
    sortFields: ['display_order', 'created_at', 'updated_at', 'name', 'category', 'status', 'published', 'featured', 'requires_login'],
    filterFields: { published: 'boolean', featured: 'boolean', requires_login: 'boolean', category: 'text', status: 'text' },
    defaultSort: { field: 'display_order', direction: 'asc' },
  },
}
