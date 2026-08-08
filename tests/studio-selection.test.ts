import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasNodeIdFromTarget } from '../apps/studio/src/canvas-selection'

function targetFor(nodeId: string | null) {
  return {
    closest(selector: string) {
      assert.equal(selector, '[data-runtime-node-id]')
      return nodeId ? { getAttribute: (name: string) => name === 'data-runtime-node-id' ? nodeId : null } : null
    },
  }
}

test('canvas node targeting resolves the clicked editable node', () => {
  assert.equal(canvasNodeIdFromTarget(targetFor('heading-node')), 'heading-node')
})

test('nested canvas targeting keeps the nearest child identity', () => {
  const nestedHeadingTarget = targetFor('child-heading')
  assert.equal(canvasNodeIdFromTarget(nestedHeadingTarget), 'child-heading')
  assert.notEqual(canvasNodeIdFromTarget(nestedHeadingTarget), 'parent-container')
})

test('empty canvas targeting deterministically clears selection', () => {
  assert.equal(canvasNodeIdFromTarget(targetFor(null)), null)
  assert.equal(canvasNodeIdFromTarget(null), null)
})
