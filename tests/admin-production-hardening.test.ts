import assert from 'node:assert/strict'
import test from 'node:test'
import { draftFingerprint } from '../apps/admin/src/unsaved-changes.ts'

test('draftFingerprint is stable across object key order and sensitive to nested edits', () => {
  const left = {
    title: 'Project',
    published: false,
    blocks: [{ heading: 'Intro', body: 'A' }],
    seo: { description: 'Description', title: 'Title' },
  }
  const same = {
    seo: { title: 'Title', description: 'Description' },
    blocks: [{ body: 'A', heading: 'Intro' }],
    published: false,
    title: 'Project',
  }
  const changed = {
    ...same,
    blocks: [{ body: 'B', heading: 'Intro' }],
  }

  assert.equal(draftFingerprint(left), draftFingerprint(same))
  assert.notEqual(draftFingerprint(left), draftFingerprint(changed))
})

test('draftFingerprint preserves array order so structured-array reorders are dirty', () => {
  const first = { blocks: [{ name: 'A' }, { name: 'B' }] }
  const reordered = { blocks: [{ name: 'B' }, { name: 'A' }] }
  assert.notEqual(draftFingerprint(first), draftFingerprint(reordered))
})
