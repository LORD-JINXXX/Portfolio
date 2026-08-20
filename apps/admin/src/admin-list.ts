export type AdminListResource = 'projects' | 'blogs' | 'notes' | 'experience' | 'apps'
export type AdminListDirection = 'asc' | 'desc'

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

export interface AdminListQueryState {
  q: string
  page: number
  pageSize: number
  sort: string
  direction: AdminListDirection
  filters: Record<string, string>
}

export interface AdminListOption {
  value: string
  label: string
}

export interface AdminListFilterControl {
  field: string
  label: string
  kind: 'select' | 'text'
  placeholder?: string
  options?: readonly AdminListOption[]
}

export interface AdminListUiConfig {
  searchPlaceholder: string
  defaultSort: string
  defaultDirection: AdminListDirection
  sorts: readonly AdminListOption[]
  filters: readonly AdminListFilterControl[]
}

const PUBLISHED_FILTER: AdminListFilterControl = {
  field: 'published',
  label: 'Publication',
  kind: 'select',
  options: [
    { value: '', label: 'All' },
    { value: 'true', label: 'Published' },
    { value: 'false', label: 'Draft' },
  ],
}

const FEATURED_FILTER: AdminListFilterControl = {
  field: 'featured',
  label: 'Featured',
  kind: 'select',
  options: [
    { value: '', label: 'All' },
    { value: 'true', label: 'Featured' },
    { value: 'false', label: 'Not featured' },
  ],
}

export const ADMIN_LIST_UI_CONFIG: Readonly<Record<AdminListResource, AdminListUiConfig>> = {
  projects: {
    searchPlaceholder: 'Search title, slug or description…',
    defaultSort: 'display_order',
    defaultDirection: 'asc',
    sorts: [
      { value: 'display_order', label: 'Display order' },
      { value: 'created_at', label: 'Created' },
      { value: 'updated_at', label: 'Updated' },
      { value: 'title', label: 'Title' },
      { value: 'published', label: 'Published' },
      { value: 'featured', label: 'Featured' },
    ],
    filters: [PUBLISHED_FILTER, FEATURED_FILTER],
  },
  blogs: {
    searchPlaceholder: 'Search title, slug, excerpt, author, category or article content…',
    defaultSort: 'published_at',
    defaultDirection: 'desc',
    sorts: [
      { value: 'published_at', label: 'Published date' },
      { value: 'created_at', label: 'Created' },
      { value: 'updated_at', label: 'Updated' },
      { value: 'display_order', label: 'Display order' },
      { value: 'title', label: 'Title' },
      { value: 'category', label: 'Category' },
      { value: 'published', label: 'Published' },
      { value: 'featured', label: 'Featured' },
    ],
    filters: [
      PUBLISHED_FILTER,
      FEATURED_FILTER,
      { field: 'category', label: 'Category', kind: 'text', placeholder: 'Exact category' },
    ],
  },
  notes: {
    searchPlaceholder: 'Search title, slug, summary or category…',
    defaultSort: 'display_order',
    defaultDirection: 'asc',
    sorts: [
      { value: 'display_order', label: 'Display order' },
      { value: 'created_at', label: 'Created' },
      { value: 'updated_at', label: 'Updated' },
      { value: 'title', label: 'Title' },
      { value: 'category', label: 'Category' },
      { value: 'published', label: 'Published' },
      { value: 'featured', label: 'Featured' },
    ],
    filters: [
      PUBLISHED_FILTER,
      FEATURED_FILTER,
      { field: 'category', label: 'Category', kind: 'text', placeholder: 'Exact category' },
    ],
  },
  experience: {
    searchPlaceholder: 'Search company, role, location or summary…',
    defaultSort: 'display_order',
    defaultDirection: 'asc',
    sorts: [
      { value: 'display_order', label: 'Display order' },
      { value: 'created_at', label: 'Created' },
      { value: 'updated_at', label: 'Updated' },
      { value: 'company', label: 'Company' },
      { value: 'role', label: 'Role' },
      { value: 'start_date', label: 'Start date' },
      { value: 'end_date', label: 'End date' },
      { value: 'published', label: 'Published' },
      { value: 'current', label: 'Current role' },
    ],
    filters: [
      PUBLISHED_FILTER,
      {
        field: 'current',
        label: 'Current role',
        kind: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'true', label: 'Current' },
          { value: 'false', label: 'Past' },
        ],
      },
      { field: 'employment_type', label: 'Employment type', kind: 'text', placeholder: 'Exact type' },
    ],
  },
  apps: {
    searchPlaceholder: 'Search name, slug, description, category or status…',
    defaultSort: 'display_order',
    defaultDirection: 'asc',
    sorts: [
      { value: 'display_order', label: 'Display order' },
      { value: 'created_at', label: 'Created' },
      { value: 'updated_at', label: 'Updated' },
      { value: 'name', label: 'Name' },
      { value: 'category', label: 'Category' },
      { value: 'status', label: 'Status' },
      { value: 'published', label: 'Published' },
      { value: 'featured', label: 'Featured' },
      { value: 'requires_login', label: 'Requires login' },
    ],
    filters: [
      PUBLISHED_FILTER,
      FEATURED_FILTER,
      {
        field: 'requires_login',
        label: 'Requires login',
        kind: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'true', label: 'Required' },
          { value: 'false', label: 'Not required' },
        ],
      },
      { field: 'category', label: 'Category', kind: 'text', placeholder: 'Exact category' },
      {
        field: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'coming_soon', label: 'Coming soon' },
          { value: 'available', label: 'Available' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
    ],
  },
}

export const ADMIN_LIST_PAGE_SIZES = [10, 25, 50, 100] as const

export function createAdminListQueryState(resource: AdminListResource): AdminListQueryState {
  const config = ADMIN_LIST_UI_CONFIG[resource]
  return {
    q: '',
    page: 1,
    pageSize: 25,
    sort: config.defaultSort,
    direction: config.defaultDirection,
    filters: {},
  }
}

export function hasActiveAdminListFilters(filters: Record<string, string>): boolean {
  return Object.values(filters).some((value) => value.trim() !== '')
}

export function buildAdminListPath(resource: AdminListResource, state: AdminListQueryState): string {
  const params = new URLSearchParams()
  if (state.q.trim()) params.set('q', state.q.trim())
  params.set('page', String(Math.max(1, Math.trunc(state.page) || 1)))
  params.set('pageSize', String(Math.max(1, Math.trunc(state.pageSize) || 25)))
  params.set('sort', state.sort)
  params.set('direction', state.direction)
  for (const [field, value] of Object.entries(state.filters)) {
    const normalized = value.trim()
    if (normalized) params.set(`filter.${field}`, normalized)
  }
  return `/api/admin/${resource}?${params.toString()}`
}

export type AdminPaginationItem = number | 'start-ellipsis' | 'end-ellipsis'

export function adminPaginationItems(page: number, totalPages: number): AdminPaginationItem[] {
  const total = Math.max(0, Math.trunc(totalPages) || 0)
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const current = Math.min(total, Math.max(1, Math.trunc(page) || 1))
  if (current <= 4) return [1, 2, 3, 4, 5, 'end-ellipsis', total]
  if (current >= total - 3) return [1, 'start-ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'start-ellipsis', current - 1, current, current + 1, 'end-ellipsis', total]
}

export function isAdminListAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError')
}
