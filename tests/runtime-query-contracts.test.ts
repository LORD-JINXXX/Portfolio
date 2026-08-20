import test from 'node:test'
import assert from 'node:assert/strict'
import { BindingSchema, RuntimeValueReferenceSchema, StudioNodeSchema } from '../packages/contracts/src/index'

test('runtime event references are restricted to safe control values', () => {
  assert.equal(RuntimeValueReferenceSchema.safeParse({ source: 'event', key: 'value' }).success, true)
  assert.equal(RuntimeValueReferenceSchema.safeParse({ source: 'event', key: 'checked' }).success, true)
  assert.equal(RuntimeValueReferenceSchema.safeParse({ source: 'event', key: 'target.value' }).success, false)
})

test('runtime nodes accept input/change interactions that write event values to state', () => {
  const node = {
    id: 'projects-search',
    type: 'input',
    tag: 'input',
    styles: { desktop: {} },
    interactions: [
      {
        event: 'input',
        actions: [
          { type: 'set-state', key: 'projects.search', value: { source: 'event', key: 'value' } },
          { type: 'set-state', key: 'projects.page', value: { source: 'literal', value: 1 } },
        ],
      },
    ],
  }

  assert.equal(StudioNodeSchema.safeParse(node).success, true)
})

test('collection bindings accept search, conditional filters/sorts, and page metadata outputs', () => {
  const binding = {
    type: 'collection',
    collection: 'projects',
    search: {
      query: { source: 'state', key: 'projects.search', fallback: '' },
      fields: ['title', 'short_description', 'technologies'],
      mode: 'contains',
    },
    filters: [
      {
        field: 'featured',
        operator: 'eq',
        value: true,
        when: {
          left: { source: 'state', key: 'projects.featuredOnly', fallback: false },
          operator: 'truthy',
        },
      },
    ],
    sort: [
      {
        field: 'created_at',
        direction: 'desc',
        when: {
          left: { source: 'state', key: 'projects.sort', fallback: 'newest' },
          operator: 'eq',
          right: { source: 'literal', value: 'newest' },
        },
      },
      {
        field: 'title',
        direction: 'asc',
        when: {
          left: { source: 'state', key: 'projects.sort', fallback: 'newest' },
          operator: 'eq',
          right: { source: 'literal', value: 'title' },
        },
      },
    ],
    pagination: {
      pageStateKey: 'projects.page',
      pageSize: 12,
      totalStateKey: 'projects.total',
      pageCountStateKey: 'projects.pageCount',
      hasNextStateKey: 'projects.hasNext',
      hasPreviousStateKey: 'projects.hasPrevious',
    },
  }

  assert.equal(BindingSchema.safeParse(binding).success, true)
})

test('collection query contracts remain backwards compatible and reject invalid pagination/search shapes', () => {
  assert.equal(BindingSchema.safeParse({
    type: 'collection',
    collection: 'projects',
    filters: [{ field: 'featured', operator: 'eq', value: true }],
    sort: [{ field: 'display_order', direction: 'asc' }],
    limit: 6,
    countStateKey: 'projects.visibleCount',
  }).success, true)

  assert.equal(BindingSchema.safeParse({
    type: 'collection',
    collection: 'projects',
    search: { query: { source: 'state', key: 'projects.search' }, fields: [] },
  }).success, false)

  assert.equal(BindingSchema.safeParse({
    type: 'collection',
    collection: 'projects',
    pagination: { pageStateKey: 'projects.page', pageSize: 0 },
  }).success, false)
})
