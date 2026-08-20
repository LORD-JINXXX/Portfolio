import assert from 'node:assert/strict'
import test from 'node:test'
import type { CollectionBinding, LayoutPageSchema, PaginationPagesBinding, StudioNode } from '@platform/contracts'
import { createAiAgePortfolioTemplate, createCinematicTransitionPortfolioTemplate, createCosmicPortfolioTemplate, wireProjectsPageQuery } from '@platform/builder-core'

function node(id: string, type: string, props: Record<string, unknown> = {}, children?: StudioNode[]): StudioNode {
  return { id, type, tag: type, props, styles: { desktop: {} }, layout: { mode: 'flow' }, children }
}

function findNode(nodes: readonly StudioNode[], id: string): StudioNode | undefined {
  for (const current of nodes) {
    if (current.id === id) return current
    const nested = findNode(current.children || [], id)
    if (nested) return nested
  }
  return undefined
}

function collectionBinding(current: StudioNode): CollectionBinding {
  const binding = current.bindings?.items
  assert.ok(binding && binding.type === 'collection')
  return binding
}

function paginationPagesBinding(current: StudioNode): PaginationPagesBinding {
  const binding = current.bindings?.items
  assert.ok(binding && binding.type === 'pagination-pages')
  return binding
}

test('wireProjectsPageQuery connects an existing authored Projects page without replacing filters or sort', () => {
  const schema: LayoutPageSchema = {
    schemaVersion: 1,
    pageId: 'projects-page',
    collectionName: 'projects',
    initialState: { 'custom.keep': true },
    root: [node('main', 'main', {}, [
      node('search', 'input', { type: 'search', placeholder: 'Search projects' }),
      {
        ...node('collection', 'div', { collection: 'projects' }),
        type: 'collection',
        bindings: {
          items: {
            type: 'collection', collection: 'projects', limit: 6,
            filters: [{ field: 'featured', operator: 'eq', value: true }],
            sort: [{ field: 'display_order', direction: 'asc' }],
          },
        },
      },
      node('pagination', 'div', {}, [
        node('prev', 'button', { text: 'Previous' }),
        node('p1', 'button', { text: '1' }),
        node('p2', 'button', { text: '2' }),
        node('next', 'button', { text: 'Next' }),
      ]),
    ])],
  }

  const result = wireProjectsPageQuery(schema)
  assert.equal(result.report.changed, true)
  assert.equal(result.report.searchInputNodeId, 'search')
  assert.equal(result.report.previousButtonNodeId, 'prev')
  assert.equal(result.report.nextButtonNodeId, 'next')
  assert.deepEqual(result.report.pageButtonNodeIds, ['p1', 'p2'])
  assert.ok(result.report.pageNumbersWrapperNodeId)
  assert.equal(result.report.pageNumberTemplateNodeId, 'p1')

  const collection = findNode(result.schema.root, 'collection')
  assert.ok(collection)
  const binding = collectionBinding(collection)
  assert.deepEqual(binding.filters, [{ field: 'featured', operator: 'eq', value: true }])
  assert.deepEqual(binding.sort, [{ field: 'display_order', direction: 'asc' }])
  assert.equal(binding.limit, undefined)
  assert.equal(binding.pagination?.pageSize, 6)
  assert.equal(binding.pagination?.pageStateKey, 'projects.page')
  assert.deepEqual(binding.search?.fields, ['title', 'short_description', 'full_description', 'technologies'])

  const search = findNode(result.schema.root, 'search')
  assert.deepEqual(search?.interactions?.find((entry) => entry.event === 'input')?.actions, [
    { type: 'set-state', key: 'projects.search', value: { source: 'event', key: 'value' } },
    { type: 'set-state', key: 'projects.page', value: { source: 'literal', value: 1 } },
  ])
  assert.deepEqual(findNode(result.schema.root, 'prev')?.interactions?.[0]?.actions, [{ type: 'increment-state', key: 'projects.page', amount: -1 }])
  assert.deepEqual(findNode(result.schema.root, 'next')?.interactions?.[0]?.actions, [{ type: 'increment-state', key: 'projects.page', amount: 1 }])
  assert.deepEqual(findNode(result.schema.root, 'prev')?.disabledWhen, { left: { source: 'state', key: 'projects.hasPrevious' }, operator: 'falsy' })
  assert.deepEqual(findNode(result.schema.root, 'next')?.disabledWhen, { left: { source: 'state', key: 'projects.hasNext' }, operator: 'falsy' })
  assert.equal(findNode(result.schema.root, 'p2'), undefined, 'legacy extra numeric buttons should be collapsed into one template')
  const pageWrapper = findNode(result.schema.root, result.report.pageNumbersWrapperNodeId!)
  assert.ok(pageWrapper)
  const pageRepeat = paginationPagesBinding(pageWrapper)
  assert.equal(pageRepeat.pageStateKey, 'projects.page')
  assert.equal(pageRepeat.pageCountStateKey, 'projects.pageCount')
  assert.equal(pageRepeat.maxVisiblePages, 7)
  const pageTemplate = findNode(result.schema.root, 'p1')
  assert.deepEqual(pageTemplate?.bindings?.text, { type: 'field', field: 'label', fallback: '1' })
  assert.deepEqual(pageTemplate?.bindings?.disabled, { type: 'field', field: 'disabled', fallback: false })
  assert.deepEqual(pageTemplate?.interactions?.find((entry) => entry.event === 'click')?.actions, [{ type: 'set-state', key: 'projects.page', value: { source: 'field', key: 'pageNumber', fallback: 1 } }])
  assert.ok(pageTemplate?.conditionalStyles?.some((rule) => rule.id === 'projects-pagination-page-active'))

  assert.equal(result.schema.initialState?.['custom.keep'], true)
  assert.equal(result.schema.initialState?.['projects.search'], '')
  assert.equal(result.schema.initialState?.['projects.page'], 1)
  assert.equal(result.schema.initialState?.['projects.total'], 0)
})

test('wireProjectsPageQuery upgrades a Page Numbers Wrapper + Page Number template in place', () => {
  const pageNumber = { ...node('page-number', 'button', { text: '1' }), meta: { label: 'Page Number' } }
  const schema: LayoutPageSchema = {
    schemaVersion: 1, pageId: 'projects-page', collectionName: 'projects',
    root: [node('main', 'main', {}, [
      node('search', 'input', { placeholder: 'Search projects' }),
      { ...node('collection', 'div'), type: 'collection', bindings: { items: { type: 'collection', collection: 'projects' } } },
      node('pagination', 'div', {}, [
        node('prev', 'button', { text: 'Previous' }),
        { ...node('page-wrapper', 'div', {}, [pageNumber]), meta: { label: 'Page Numbers Wrapper' } },
        node('next', 'button', { text: 'Next' }),
      ]),
    ])],
  }
  const result = wireProjectsPageQuery(schema)
  assert.equal(result.report.pageNumbersWrapperNodeId, 'page-wrapper')
  assert.equal(result.report.pageNumberTemplateNodeId, 'page-number')
  const wrapper = findNode(result.schema.root, 'page-wrapper')
  assert.ok(wrapper)
  assert.equal(paginationPagesBinding(wrapper).maxVisiblePages, 7)
  assert.deepEqual(wrapper.children?.map((child) => child.id), ['page-number'])
})

test('wiring reports missing authored controls instead of inventing node ids', () => {
  const schema: LayoutPageSchema = {
    schemaVersion: 1,
    pageId: 'projects-page',
    collectionName: 'projects',
    root: [{
      ...node('collection', 'div', { collection: 'projects' }),
      type: 'collection',
      bindings: { items: { type: 'collection', collection: 'projects' } },
    }],
  }
  const result = wireProjectsPageQuery(schema)
  assert.equal(result.report.changed, true)
  assert.equal(result.report.searchInputNodeId, undefined)
  assert.match(result.report.warnings.join(' '), /no search input/i)
  assert.match(result.report.warnings.join(' '), /no previous/i)
  assert.match(result.report.warnings.join(' '), /no next/i)
})

test('all starter layouts ship with wired Projects query controls', () => {
  for (const document of [createCosmicPortfolioTemplate(), createAiAgePortfolioTemplate(), createCinematicTransitionPortfolioTemplate()]) {
    const projects = document.pages.find((page) => page.pageType === 'collection_index' && page.schema.collectionName === 'projects')
    assert.ok(projects, `${document.layoutName} should contain a Projects index page`)
    const nodes: StudioNode[] = []
    const visit = (items: readonly StudioNode[]) => items.forEach((item) => { nodes.push(item); visit(item.children || []) })
    visit(projects.schema.root)
    const collection = nodes.find((item) => Object.values(item.bindings || {}).some((binding) => binding.type === 'collection' && binding.collection === 'projects'))
    assert.ok(collection)
    const binding = collectionBinding(collection)
    assert.equal(binding.search?.query.source, 'state')
    assert.equal(binding.pagination?.pageStateKey, 'projects.page')
    assert.ok(nodes.some((item) => (item.tag || item.type) === 'input' && item.interactions?.some((entry) => entry.event === 'input')))
    assert.ok(nodes.some((item) => String(item.props?.text || '').toLowerCase() === 'previous' && item.interactions?.some((entry) => entry.event === 'click')))
    assert.ok(nodes.some((item) => String(item.props?.text || '').toLowerCase() === 'next' && item.interactions?.some((entry) => entry.event === 'click')))
    const pageNumbers = nodes.find((item) => Object.values(item.bindings || {}).some((entry) => entry.type === 'pagination-pages'))
    assert.ok(pageNumbers, 'starter layout should contain a dynamic page-number repeat')
    assert.equal(paginationPagesBinding(pageNumbers).pageCountStateKey, 'projects.pageCount')
    assert.equal(pageNumbers.children?.length, 1, 'page-number repeat should keep exactly one authored template')
  }
})
