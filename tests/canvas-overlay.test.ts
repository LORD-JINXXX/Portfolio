import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasBoundsFromRects, findRuntimeNodeElement } from '../apps/studio/src/canvas-geometry'

test('selection bounds follow the selected runtime node inside a zoomed canvas', () => {
  const bounds = canvasBoundsFromRects(
    { left: 150, top: 100, width: 100, height: 50 },
    { left: 100, top: 50, width: 500, height: 400 },
    1000,
    800,
  )
  assert.deepEqual(bounds, { left: 100, top: 100, width: 200, height: 100 })
})

test('changing selectedNodeId resolves a different runtime overlay target', () => {
  const elements = [
    { getAttribute: (name: string) => name === 'data-runtime-node-id' ? 'heading' : null },
    { getAttribute: (name: string) => name === 'data-runtime-node-id' ? 'paragraph' : null },
  ]
  const root = { querySelectorAll: () => elements }
  assert.equal(findRuntimeNodeElement(root, 'heading'), elements[0])
  assert.equal(findRuntimeNodeElement(root, 'paragraph'), elements[1])
  assert.equal(findRuntimeNodeElement(root, null), null)
})
