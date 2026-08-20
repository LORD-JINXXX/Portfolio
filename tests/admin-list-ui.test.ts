import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_LIST_UI_CONFIG,
  adminPaginationItems,
  buildAdminListPath,
  createAdminListQueryState,
  hasActiveAdminListFilters,
  isAdminListAbortError,
  type AdminListResource,
} from '../apps/admin/src/admin-list.ts'
import { ADMIN_STRUCTURED_LIST_CONFIG } from '../apps/api/src/lib/admin-list-query.ts'

const resources: AdminListResource[] = ['projects', 'blogs', 'notes', 'experience', 'apps']

test('Admin list UI defaults match the server-side allowlisted list contract', () => {
  for (const resource of resources) {
    const ui = ADMIN_LIST_UI_CONFIG[resource]
    const server = ADMIN_STRUCTURED_LIST_CONFIG[resource]
    assert.equal(ui.defaultSort, server.defaultSort.field)
    assert.equal(ui.defaultDirection, server.defaultSort.direction)
    for (const option of ui.sorts) assert.equal(server.sortFields.includes(option.value), true, `${resource} sort ${option.value}`)
    for (const filter of ui.filters) assert.equal(Object.hasOwn(server.filterFields, filter.field), true, `${resource} filter ${filter.field}`)
  }
})

test('Admin list path always opts into server pagination and includes active query controls', () => {
  const state = createAdminListQueryState('projects')
  const path = buildAdminListPath('projects', {
    ...state,
    q: ' react portfolio ',
    page: 3,
    pageSize: 50,
    sort: 'created_at',
    direction: 'desc',
    filters: { published: 'true', featured: '', ignoredBlank: '   ' },
  })
  const url = new URL(path, 'https://portfolio.test')
  assert.equal(url.pathname, '/api/admin/projects')
  assert.equal(url.searchParams.get('q'), 'react portfolio')
  assert.equal(url.searchParams.get('page'), '3')
  assert.equal(url.searchParams.get('pageSize'), '50')
  assert.equal(url.searchParams.get('sort'), 'created_at')
  assert.equal(url.searchParams.get('direction'), 'desc')
  assert.equal(url.searchParams.get('filter.published'), 'true')
  assert.equal(url.searchParams.has('filter.featured'), false)
  assert.equal(url.searchParams.has('filter.ignoredBlank'), false)
})

test('Admin list query defaults use page one and the configured display ordering', () => {
  for (const resource of resources) {
    const state = createAdminListQueryState(resource)
    assert.equal(state.page, 1)
    assert.equal(state.pageSize, 25)
    assert.equal(state.sort, ADMIN_LIST_UI_CONFIG[resource].defaultSort)
    assert.equal(state.direction, ADMIN_LIST_UI_CONFIG[resource].defaultDirection)
    assert.deepEqual(state.filters, {})
  }
})

test('pagination window stays compact at the beginning, middle and end', () => {
  assert.deepEqual(adminPaginationItems(1, 3), [1, 2, 3])
  assert.deepEqual(adminPaginationItems(2, 10), [1, 2, 3, 4, 5, 'end-ellipsis', 10])
  assert.deepEqual(adminPaginationItems(6, 12), [1, 'start-ellipsis', 5, 6, 7, 'end-ellipsis', 12])
  assert.deepEqual(adminPaginationItems(11, 12), [1, 'start-ellipsis', 8, 9, 10, 11, 12])
})

test('active filter detection ignores blank filter controls', () => {
  assert.equal(hasActiveAdminListFilters({ published: '', category: '   ' }), false)
  assert.equal(hasActiveAdminListFilters({ published: 'false' }), true)
})

test('aborted Admin list requests are recognized without relying on DOMException availability', () => {
  assert.equal(isAdminListAbortError({ name: 'AbortError' }), true)
  assert.equal(isAdminListAbortError(new Error('network failed')), false)
  assert.equal(isAdminListAbortError(null), false)
})
