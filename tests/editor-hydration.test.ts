import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EditorDocumentHydrationError,
  createBlankDocument,
  createNode,
  findNodeById,
  normalizeEditorDocument,
  normalizeLayoutPageSchema,
  walkStudioNodes,
} from '../packages/builder-core/src/editor-state'
import { dbPageToEditorPage } from '../apps/api/src/lib/platform'
import { parseStudioEditorRoute } from '../apps/studio/src/routing'

test('normal editor documents hydrate with canonical page roots', () => {
  const document = normalizeEditorDocument(createBlankDocument('Normal Layout'))
  assert.equal(document.pages.length, 3)
  document.pages.forEach((page) => assert.ok(Array.isArray(page.schema.root)))
})

test('leaf nodes may omit children and remain traversable', () => {
  const leaf = createNode('p')
  assert.equal(leaf.children, undefined)
  const visited: string[] = []
  assert.doesNotThrow(() => walkStudioNodes([leaf], (node) => visited.push(node.id)))
  assert.deepEqual(visited, [leaf.id])
})

test('nested container traversal visits every node in order', () => {
  const heading = createNode('h1')
  const paragraph = createNode('p')
  const section = createNode('section', { children: [heading, createNode('div', { children: [paragraph] })] })
  const visited: string[] = []
  walkStudioNodes([section], (node) => visited.push(node.id))
  assert.deepEqual(visited, [section.id, heading.id, section.children![1].id, paragraph.id])
})

test('selection traversal finds nested nodes after hydration', () => {
  const target = createNode('button')
  const document = normalizeEditorDocument(createBlankDocument())
  document.pages[1].schema.root = [createNode('main', { children: [createNode('section', { children: [target] })] })]
  assert.equal(findNodeById(document.pages[1].schema.root, target.id)?.id, target.id)
})

test('legacy persisted nodes trees normalize at the database load boundary', () => {
  const page = dbPageToEditorPage({
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Home',
    slug: 'home',
    page_type: 'home',
    route_pattern: '/',
    seo_defaults: {},
    sort_order: 0,
    layout_tree: JSON.stringify({
      nodes: [{ id: 'legacy-hero', type: 'hero', props: { title: 'Welcome' }, styles: { desktop: { minHeight: '100vh' } } }],
    }),
  })
  assert.equal(page.schema.root[0].id, 'legacy-hero')
  assert.deepEqual(page.schema.root[0].children, [])
})

test('legacy nodes without styles receive safe canonical defaults', () => {
  const schema = normalizeLayoutPageSchema(JSON.stringify({ nodes: [{ id: 'legacy-root', type: 'container', children: [] }] }), 'legacy-page')
  assert.deepEqual(schema.root[0].styles, { desktop: {} })
  assert.deepEqual(schema.root[0].children, [])
})

test('exact-version editor routes hydrate persisted legacy pages without throwing', () => {
  const layoutId = '00000000-0000-4000-8000-000000000010'
  const versionId = '00000000-0000-4000-8000-000000000011'
  assert.deepEqual(parseStudioEditorRoute(`/layouts/${layoutId}/versions/${versionId}/editor`), { layoutId, versionId })
  const page = dbPageToEditorPage({
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Home',
    slug: 'home',
    page_type: 'home',
    route_pattern: '/',
    layout_tree: '{"nodes":[{"id":"root","type":"container","children":[]}]}',
  })
  assert.doesNotThrow(() => normalizeEditorDocument({
    layoutId,
    layoutName: 'Persisted Layout',
    versionId,
    versionNumber: 1,
    versionStatus: 'published',
    designTokens: { variables: {} },
    pages: [page],
  }))
})

test('unrecoverable page trees and empty documents fail with controlled hydration errors', () => {
  assert.throws(
    () => normalizeLayoutPageSchema('{"nodes":{}}', 'broken-page'),
    (error: unknown) => error instanceof EditorDocumentHydrationError && /root node array/.test(error.message),
  )
  const empty = { ...createBlankDocument(), pages: [] }
  assert.throws(
    () => normalizeEditorDocument(empty),
    (error: unknown) => error instanceof EditorDocumentHydrationError && /at least one page/.test(error.message),
  )
})
