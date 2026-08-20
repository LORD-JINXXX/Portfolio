import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../apps/admin/src/BlogBlocksEditor.tsx', import.meta.url), 'utf8')

test('Blog block editor uses the expandable Project-Details-style structured-item workflow', () => {
  assert.match(source, /\+ Add Block/)
  assert.match(source, /aria-expanded=\{open\}/)
  assert.match(source, /Block Name \*/)
  assert.match(source, /Block Type \*/)
  assert.match(source, /Move up/)
  assert.match(source, /Move down/)
  assert.match(source, /Delete/)
  assert.match(source, /setPendingFocusId\(block\.id\)/)
})

test('Every Blog section exposes heading, body, media and code together instead of separate semantic blocks', () => {
  for (const token of ['Eyebrow', 'Heading', 'Body', 'Media', 'Media Alt Text', 'Code / Architecture Text', 'Code Language', 'Caption', 'Layout']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(source, /block\.type === 'paragraph'/)
  assert.doesNotMatch(source, /block\.type === 'heading'/)
  assert.match(source, /each block is one complete article section/)
  assert.match(source, /Block Type controls presentation; it does not remove the other fields/)
})

test('Blog section types and layouts match the Project Details authoring model', () => {
  for (const type of ['rich_text', 'image', 'architecture', 'code', 'callout']) assert.match(source, new RegExp(`'${type}'`))
  for (const layout of ['normal', 'wide', 'full', 'split']) assert.match(source, new RegExp(`'${layout}'`))
})
