import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_STRUCTURED_LIST_CONFIG,
  adminListRange,
  adminSearchOrExpression,
  applyAdminListQuery,
  createAdminListMeta,
  parseAdminListQuery,
  sanitizeAdminSearchTerm,
} from '../apps/api/src/lib/admin-list-query.ts'

test('legacy Admin list requests remain unpaginated and keep the configured default ordering', () => {
  const config = ADMIN_STRUCTURED_LIST_CONFIG.projects
  const query = parseAdminListQuery({}, config)
  assert.equal(query.enabled, false)
  assert.equal(query.page, 1)
  assert.equal(query.pageSize, 25)
  assert.equal(query.sort, 'display_order')
  assert.equal(query.direction, 'asc')
})

test('Admin list query parses search, paging, sorting and allowlisted filters', () => {
  const config = ADMIN_STRUCTURED_LIST_CONFIG.apps
  const query = parseAdminListQuery({
    q: '  AI, tools_(beta)  ',
    page: '3',
    pageSize: '40',
    sort: 'created_at',
    direction: 'desc',
    'filter.published': 'true',
    'filter.status': 'available',
    'filter.not_allowed': 'ignored',
  }, config)

  assert.equal(query.enabled, true)
  assert.equal(query.q, 'AI tools beta')
  assert.equal(query.page, 3)
  assert.equal(query.pageSize, 40)
  assert.equal(query.sort, 'created_at')
  assert.equal(query.direction, 'desc')
  assert.deepEqual(query.filters, { published: true, status: 'available' })
  assert.deepEqual(adminListRange(query), { from: 80, to: 119 })
})

test('Admin list query clamps page size and never accepts arbitrary sort fields', () => {
  const config = ADMIN_STRUCTURED_LIST_CONFIG.notes
  const query = parseAdminListQuery({ pageSize: '99999', sort: 'drop_table', direction: 'sideways' }, config)
  assert.equal(query.pageSize, 100)
  assert.equal(parseAdminListQuery({ page: '999999999' }, config).page, 10_000)
  assert.equal(query.sort, 'display_order')
  assert.equal(query.direction, 'asc')
})

test('search OR expression is generated only from configured scalar search fields', () => {
  const config = ADMIN_STRUCTURED_LIST_CONFIG.projects
  const query = parseAdminListQuery({ q: 'react' }, config)
  assert.equal(
    adminSearchOrExpression(config, query),
    'title.ilike.%react%,slug.ilike.%react%,short_description.ilike.%react%,full_description.ilike.%react%',
  )
  assert.equal(sanitizeAdminSearchTerm('x*%),published.eq.true\u0000'), 'x published.eq.true')
})

test('applyAdminListQuery composes search, filters, ordering and range in a deterministic order', () => {
  const calls: Array<[string, ...unknown[]]> = []
  const builder = {
    or(expression: string) { calls.push(['or', expression]); return this },
    eq(field: string, value: string | number | boolean) { calls.push(['eq', field, value]); return this },
    order(field: string, options: { ascending: boolean }) { calls.push(['order', field, options]); return this },
    range(from: number, to: number) { calls.push(['range', from, to]); return this },
  }
  const config = ADMIN_STRUCTURED_LIST_CONFIG.projects
  const query = parseAdminListQuery({ q: 'portfolio', page: '2', pageSize: '10', sort: 'title', direction: 'desc', published: 'false' }, config)
  applyAdminListQuery(builder, config, query)

  assert.deepEqual(calls, [
    ['or', 'title.ilike.%portfolio%,slug.ilike.%portfolio%,short_description.ilike.%portfolio%,full_description.ilike.%portfolio%'],
    ['eq', 'published', false],
    ['order', 'title', { ascending: false }],
    ['order', 'id', { ascending: true }],
    ['range', 10, 19],
  ])
})

test('pagination metadata exposes total pages and navigation state', () => {
  const query = parseAdminListQuery({ q: 'portfolio', page: '2', pageSize: '25' }, ADMIN_STRUCTURED_LIST_CONFIG.projects)
  assert.deepEqual(createAdminListMeta(query, 61), {
    page: 2,
    pageSize: 25,
    total: 61,
    totalPages: 3,
    hasNext: true,
    hasPrevious: true,
    sort: 'display_order',
    direction: 'asc',
    q: 'portfolio',
    filters: {},
  })
})
