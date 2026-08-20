import assert from 'node:assert/strict'
import test from 'node:test'
import { BindingSchema, StudioNodeSchema, type PaginationPagesBinding, type StudioNode } from '@platform/contracts'
import { buildPaginationPageItems } from '@platform/runtime-renderer'

const binding: PaginationPagesBinding = {
  type: 'pagination-pages',
  pageStateKey: 'projects.page',
  pageCountStateKey: 'projects.pageCount',
  maxVisiblePages: 7,
  showFirstLast: true,
  showEllipsis: true,
}

test('pagination page repeat renders every page when count fits the visible window', () => {
  const items = buildPaginationPageItems(binding, { runtimeState: { 'projects.page': 2, 'projects.pageCount': 4 } })
  assert.deepEqual(items.map((item) => item.label), ['1', '2', '3', '4'])
  assert.equal(items.find((item) => item.pageNumber === 2)?.isActive, true)
  assert.equal(items.every((item) => item.disabled === false), true)
})

test('pagination page repeat truncates large ranges around the active page with ellipses', () => {
  const middle = buildPaginationPageItems(binding, { runtimeState: { 'projects.page': 8, 'projects.pageCount': 20 } })
  assert.deepEqual(middle.map((item) => item.label), ['1', '…', '7', '8', '9', '…', '20'])
  assert.equal(middle.filter((item) => item.isEllipsis).every((item) => item.disabled), true)

  const start = buildPaginationPageItems(binding, { runtimeState: { 'projects.page': 1, 'projects.pageCount': 20 } })
  assert.deepEqual(start.map((item) => item.label), ['1', '2', '3', '4', '5', '…', '20'])

  const end = buildPaginationPageItems(binding, { runtimeState: { 'projects.page': 20, 'projects.pageCount': 20 } })
  assert.deepEqual(end.map((item) => item.label), ['1', '…', '16', '17', '18', '19', '20'])
})

test('pagination repeat clamps stale current-page state to the current page count', () => {
  const items = buildPaginationPageItems(binding, { runtimeState: { 'projects.page': 9, 'projects.pageCount': 2 } })
  assert.deepEqual(items.map((item) => item.label), ['1', '2'])
  assert.equal(items.find((item) => item.pageNumber === 2)?.isActive, true)
})

test('pagination binding and runtime disabled conditions are valid persisted contracts', () => {
  assert.equal(BindingSchema.safeParse(binding).success, true)
  const node: StudioNode = {
    id: 'previous', type: 'button', tag: 'button', props: { text: 'Previous' }, styles: { desktop: {} },
    disabledWhen: { left: { source: 'state', key: 'projects.hasPrevious' }, operator: 'falsy' },
  }
  assert.equal(StudioNodeSchema.safeParse(node).success, true)
})
