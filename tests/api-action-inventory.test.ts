import test from 'node:test'
import assert from 'node:assert/strict'
import { API_ACTION_INVENTORY } from './api-action-inventory'

test('API action inventory has unique stable ids and covers both applications', () => {
  const ids = API_ACTION_INVENTORY.map((entry) => entry.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(new Set(API_ACTION_INVENTORY.map((entry) => entry.app)), new Set(['Admin', 'Studio']))
  assert.deepEqual(new Set(API_ACTION_INVENTORY.map((entry) => entry.category)), new Set(['MUTATION', 'READ_NETWORK', 'LOCAL', 'BACKGROUND']))
})

test('every audited mutation declares visible pending and synchronous conflict metadata', () => {
  for (const entry of API_ACTION_INVENTORY.filter((candidate) => candidate.category === 'MUTATION')) {
    assert.ok(entry.request, entry.id)
    assert.ok(entry.pendingLabel.endsWith('...'), entry.id)
    assert.ok(entry.actionKey, entry.id)
    assert.ok(entry.conflictKey, entry.id)
    assert.equal(entry.compliance, 'COMPLIANT')
  }
})

test('explicit network reads declare visible loading while local/background actions declare no fake pending state', () => {
  for (const entry of API_ACTION_INVENTORY) {
    if (entry.category === 'READ_NETWORK') {
      assert.ok(entry.request, entry.id)
      assert.match(entry.pendingLabel, /Loading/)
    }
    if (entry.category === 'LOCAL' || entry.category === 'BACKGROUND') {
      assert.equal(entry.pendingLabel, null, entry.id)
      assert.equal(entry.actionKey, null, entry.id)
      assert.equal(entry.conflictKey, null, entry.id)
      assert.equal(entry.category === 'LOCAL' ? entry.request : Boolean(entry.request), entry.category === 'LOCAL' ? null : true, entry.id)
    }
  }
})

test('final audit includes every required high-risk control', () => {
  const ids = new Set(API_ACTION_INVENTORY.map((entry) => entry.id))
  for (const id of [
    'admin.auth.sign-in', 'admin.auth.logout', 'admin.content.save', 'admin.content.publish',
    'admin.projects.create', 'admin.projects.update', 'admin.projects.delete',
    'admin.notes.create', 'admin.notes.update', 'admin.notes.delete',
    'admin.experience.create', 'admin.experience.update', 'admin.experience.delete',
    'admin.apps.create', 'admin.apps.update', 'admin.apps.delete',
    'admin.media.upload', 'admin.media.delete', 'admin.layouts.preview', 'admin.layouts.configure',
    'admin.settings.save', 'admin.releases.create', 'admin.releases.preview', 'admin.releases.validate',
    'admin.releases.activate', 'admin.releases.rollback', 'studio.auth.sign-in', 'studio.auth.logout',
    'studio.library.create-blank', 'studio.library.create-cosmic', 'studio.library.create-ai-age', 'studio.library.create-cinematic', 'studio.library.open',
    'studio.library.rename', 'studio.library.duplicate', 'studio.library.archive', 'studio.library.delete',
    'studio.library.discard', 'studio.editor.save-button', 'studio.editor.save-shortcut',
    'studio.editor.validate', 'studio.editor.publish', 'studio.editor.create-draft',
    'studio.editor.create-blank', 'studio.editor.create-cosmic', 'studio.editor.create-ai-age', 'studio.editor.create-cinematic', 'studio.editor.duplicate', 'studio.editor.archive',
  ]) assert.ok(ids.has(id), id)
})
