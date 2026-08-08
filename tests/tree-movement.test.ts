import test from 'node:test'
import assert from 'node:assert/strict'
import type { LayoutPageSchema, StudioNode } from '../packages/contracts/src/index'
import {
  canMoveNode,
  canNodeContainChildren,
  commitNodeMove,
  createNode,
  findNodeById,
  moveNodeInTree,
  resolveNodeDropTarget,
} from '../packages/builder-core/src/editor-state'
import { canvasDropPosition } from '../apps/studio/src/canvas-drag'

function leaf(id: string, type = 'p', locked = false): StudioNode {
  return { id, type, tag: type, props: { text: id }, styles: { desktop: {} }, layout: { mode: 'flow' }, meta: { label: id, locked }, children: undefined }
}

function container(id: string, children: StudioNode[] = [], locked = false, type = 'container'): StudioNode {
  return { id, type, tag: 'div', props: {}, styles: { desktop: {} }, layout: { mode: 'flow' }, meta: { label: id, locked }, children }
}

function schema(root: StudioNode[]): LayoutPageSchema {
  return { schemaVersion: 5, pageId: 'page-1', root }
}

function childIds(root: StudioNode[], parentId: string): string[] {
  return findNodeById(root, parentId)?.children?.map((node) => node.id) || []
}

function allIds(nodes: StudioNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...allIds(node.children || [])])
}

test('tree movement reorders a sibling before another sibling', () => {
  const root = [container('hero', [leaf('heading'), leaf('paragraph'), leaf('button', 'button')])]
  const destination = resolveNodeDropTarget(root, 'heading', 'before')!
  const result = moveNodeInTree(root, 'button', destination.parentId, destination.index)
  assert.equal(result.moved, true)
  assert.deepEqual(childIds(result.root, 'hero'), ['button', 'heading', 'paragraph'])
})

test('tree movement reorders a sibling after another sibling', () => {
  const root = [container('hero', [leaf('heading'), leaf('paragraph'), leaf('button', 'button')])]
  const destination = resolveNodeDropTarget(root, 'button', 'after')!
  const result = moveNodeInTree(root, 'heading', destination.parentId, destination.index)
  assert.deepEqual(childIds(result.root, 'hero'), ['paragraph', 'button', 'heading'])
})

test('tree movement moves a node inside a valid container', () => {
  const root = [leaf('heading'), container('target')]
  const destination = resolveNodeDropTarget(root, 'target', 'inside')!
  const result = moveNodeInTree(root, 'heading', destination.parentId, destination.index)
  assert.deepEqual(result.root.map((node) => node.id), ['target'])
  assert.deepEqual(childIds(result.root, 'target'), ['heading'])
})

test('tree movement moves a node between different containers', () => {
  const root = [container('section', [container('a', [leaf('heading')]), container('b')], false, 'section')]
  const destination = resolveNodeDropTarget(root, 'b', 'inside')!
  const result = moveNodeInTree(root, 'heading', destination.parentId, destination.index)
  assert.deepEqual(childIds(result.root, 'a'), [])
  assert.deepEqual(childIds(result.root, 'b'), ['heading'])
})

test('tree movement moves a child out to a valid ancestor', () => {
  const root = [container('section', [container('a', [leaf('heading')]), container('b')], false, 'section')]
  const result = moveNodeInTree(root, 'heading', 'section', 1)
  assert.deepEqual(childIds(result.root, 'a'), [])
  assert.deepEqual(childIds(result.root, 'section'), ['a', 'heading', 'b'])
})

test('self drops and descendant cycles are rejected without mutation', () => {
  const root = [container('parent', [container('child')])]
  const before = JSON.stringify(root)
  const self = moveNodeInTree(root, 'parent', 'parent', 0)
  const cycle = moveNodeInTree(root, 'parent', 'child', 0)
  assert.equal(self.rejection, 'self-drop')
  assert.equal(cycle.rejection, 'descendant-cycle')
  assert.equal(self.root, root)
  assert.equal(cycle.root, root)
  assert.equal(JSON.stringify(root), before)
})

test('leaf and void nodes reject inside drops through canonical capabilities', () => {
  const root = [leaf('moving'), createNode('img', { id: 'image' }), createNode('textarea', { id: 'textarea' }), createNode('video', { id: 'video' }), createNode('container', { id: 'container' })]
  for (const id of ['image', 'textarea', 'video']) {
    assert.equal(canNodeContainChildren(findNodeById(root, id)!), false)
    assert.equal(resolveNodeDropTarget(root, id, 'inside'), null)
    assert.equal(canMoveNode(root, 'moving', id, 0), false)
  }
  assert.equal(canNodeContainChildren(findNodeById(root, 'container')!), true)
})

test('locked nodes and children of locked parents cannot be moved', () => {
  const locked = leaf('locked', 'p', true)
  const root = [locked, container('locked-parent', [leaf('child')], true), container('target')]
  assert.equal(moveNodeInTree(root, 'locked', 'target', 0).rejection, 'source-locked')
  assert.equal(moveNodeInTree(root, 'child', 'target', 0).rejection, 'source-parent-locked')
  assert.equal(moveNodeInTree(root, 'target', 'locked-parent', 0).rejection, 'parent-locked')
})

test('successful movement preserves every node ID and reports the moved selection ID', () => {
  const root = [container('a', [leaf('heading')]), container('b')]
  const beforeIds = allIds(root).sort()
  const result = moveNodeInTree(root, 'heading', 'b', 0)
  assert.deepEqual(allIds(result.root).sort(), beforeIds)
  assert.equal(result.movedNodeId, 'heading')
})

test('hovering or cancelling drag calculates feedback without mutating the tree', () => {
  const root = [container('hero', [leaf('heading'), leaf('paragraph')])]
  const before = JSON.stringify(root)
  assert.equal(canvasDropPosition(5, 100, true), 'before')
  assert.equal(canvasDropPosition(50, 100, true), 'inside')
  assert.equal(canvasDropPosition(50, 100, false), 'after')
  assert.equal(canvasDropPosition(95, 100, true), 'after')
  assert.equal(JSON.stringify(root), before)
})

test('one completed move creates one logical history entry', () => {
  const initial = schema([container('hero', [leaf('heading'), leaf('paragraph')])])
  const history = [initial]
  const committed = commitNodeMove(initial, history, 0, 'paragraph', 'hero', 0)
  assert.equal(committed.moved, true)
  assert.equal(committed.history.length, 2)
  assert.equal(committed.historyIndex, 1)
  assert.equal(committed.movedNodeId, 'paragraph')
  assert.deepEqual(childIds(committed.schema.root, 'hero'), ['paragraph', 'heading'])
})

test('rejected and no-op moves create no history mutation', () => {
  const initial = schema([container('hero', [leaf('heading'), leaf('paragraph')])])
  const history = [initial]
  const rejected = commitNodeMove(initial, history, 0, 'heading', 'heading', 0)
  const noChange = commitNodeMove(initial, history, 0, 'heading', 'hero', 0)
  assert.equal(rejected.moved, false)
  assert.equal(noChange.moved, false)
  assert.equal(rejected.history, history)
  assert.equal(noChange.history, history)
  assert.equal(rejected.schema, initial)
  assert.equal(noChange.schema, initial)
})

test('reordered hierarchy survives document serialization and reload', () => {
  const initial = schema([container('hero', [leaf('heading'), leaf('paragraph'), leaf('button', 'button')])])
  const moved = commitNodeMove(initial, [initial], 0, 'button', 'hero', 0)
  const document = { layoutId: 'layout-1', versionId: 'version-1', pages: [{ id: 'page-1', schema: moved.schema }] }
  const reloaded = JSON.parse(JSON.stringify(document)) as typeof document
  assert.deepEqual(childIds(reloaded.pages[0].schema.root, 'hero'), ['button', 'heading', 'paragraph'])
})
