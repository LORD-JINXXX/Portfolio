import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectionBinding } from '@platform/contracts'
import { applyCollectionQuery, applyCollectionQueryWithMeta } from '@platform/runtime-renderer'

const projects = [
  { id: 1, title: 'Realtime Portfolio', description: 'React and Supabase', category: 'web', featured: true, created_at: '2026-02-10', technologies: ['React', 'Supabase'] },
  { id: 2, title: 'AI Notes', description: 'Semantic notebook', category: 'ai', featured: false, created_at: '2026-04-12', technologies: ['TypeScript', 'OpenAI'] },
  { id: 3, title: 'React Motion Lab', description: 'Animation experiments', category: 'web', featured: true, created_at: '2026-03-01', technologies: ['React', 'Motion'] },
  { id: 4, title: 'Data Console', description: 'Admin analytics', category: 'tools', featured: false, created_at: '2026-01-05', technologies: ['Postgres', 'React'] },
  { id: 5, title: 'Search Studio', description: 'Visual query builder', category: 'tools', featured: true, created_at: '2026-05-20', technologies: ['TypeScript', 'React'] },
]

test('collection search is case-insensitive by default and searches array fields', () => {
  const binding: CollectionBinding = {
    type: 'collection',
    collection: 'projects',
    search: {
      query: { source: 'state', key: 'projects.search', fallback: '' },
      fields: ['title', 'technologies'],
    },
  }

  const react = applyCollectionQuery(projects, binding, { runtimeState: { 'projects.search': 'rEaCt' } }) as typeof projects
  assert.deepEqual(react.map((item) => item.id), [1, 3, 4, 5])

  const exact = applyCollectionQuery(projects, { ...binding, search: { ...binding.search!, mode: 'exact' } }, { runtimeState: { 'projects.search': 'React' } }) as typeof projects
  assert.deepEqual(exact.map((item) => item.id), [1, 3, 4, 5])
})

test('conditional filters and sorts activate from runtime state', () => {
  const binding: CollectionBinding = {
    type: 'collection',
    collection: 'projects',
    filters: [{
      field: 'featured',
      operator: 'eq',
      value: true,
      when: { left: { source: 'state', key: 'featuredOnly', fallback: false }, operator: 'truthy' },
    }],
    sort: [
      {
        field: 'created_at',
        direction: 'desc',
        when: {
          left: { source: 'state', key: 'sortMode', fallback: 'newest' },
          operator: 'eq',
          right: { source: 'literal', value: 'newest' },
        },
      },
      {
        field: 'title',
        direction: 'asc',
        when: {
          left: { source: 'state', key: 'sortMode', fallback: 'newest' },
          operator: 'eq',
          right: { source: 'literal', value: 'title' },
        },
      },
    ],
  }

  const featuredNewest = applyCollectionQuery(projects, binding, { runtimeState: { featuredOnly: true, sortMode: 'newest' } }) as typeof projects
  assert.deepEqual(featuredNewest.map((item) => item.id), [5, 3, 1])

  const allByTitle = applyCollectionQuery(projects, binding, { runtimeState: { featuredOnly: false, sortMode: 'title' } }) as typeof projects
  assert.deepEqual(allByTitle.map((item) => item.id), [2, 4, 3, 1, 5])
})

test('pagination reports pre-page totals and slices the requested page', () => {
  const binding: CollectionBinding = {
    type: 'collection',
    collection: 'projects',
    pagination: {
      pageStateKey: 'projects.page',
      pageSize: 2,
      totalStateKey: 'projects.total',
      pageCountStateKey: 'projects.pageCount',
      hasNextStateKey: 'projects.hasNext',
      hasPreviousStateKey: 'projects.hasPrevious',
    },
  }

  const page2 = applyCollectionQueryWithMeta(projects, binding, { runtimeState: { 'projects.page': 2 } })
  assert.deepEqual((page2.items as typeof projects).map((item) => item.id), [3, 4])
  assert.deepEqual({ total: page2.total, page: page2.page, pageCount: page2.pageCount, hasNext: page2.hasNext, hasPrevious: page2.hasPrevious }, {
    total: 5,
    page: 2,
    pageCount: 3,
    hasNext: true,
    hasPrevious: true,
  })

  const clamped = applyCollectionQueryWithMeta(projects, binding, { runtimeState: { 'projects.page': 99 } })
  assert.equal(clamped.requestedPage, 99)
  assert.equal(clamped.page, 3)
  assert.deepEqual((clamped.items as typeof projects).map((item) => item.id), [5])
  assert.equal(clamped.hasNext, false)
})

test('legacy limit remains a total result cap before pagination', () => {
  const binding: CollectionBinding = {
    type: 'collection',
    collection: 'projects',
    limit: 3,
    pagination: { pageStateKey: 'page', pageSize: 2 },
  }

  const page2 = applyCollectionQueryWithMeta(projects, binding, { runtimeState: { page: 2 } })
  assert.equal(page2.total, 3)
  assert.equal(page2.pageCount, 2)
  assert.deepEqual((page2.items as typeof projects).map((item) => item.id), [3])
})

test('empty search results normalize pagination metadata safely', () => {
  const binding: CollectionBinding = {
    type: 'collection',
    collection: 'projects',
    search: { query: { source: 'state', key: 'q' }, fields: ['title'] },
    pagination: { pageStateKey: 'page', pageSize: 12 },
  }

  const result = applyCollectionQueryWithMeta(projects, binding, { runtimeState: { q: 'does-not-exist', page: 8 } })
  assert.deepEqual(result.items, [])
  assert.equal(result.total, 0)
  assert.equal(result.page, 1)
  assert.equal(result.pageCount, 0)
  assert.equal(result.hasNext, false)
  assert.equal(result.hasPrevious, false)
})
