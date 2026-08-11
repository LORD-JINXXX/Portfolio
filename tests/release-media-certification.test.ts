import assert from 'node:assert/strict'
import test from 'node:test'
import { persistReleaseMediaCertification } from '../apps/api/src/lib/release-media-certification'
import type { ReleaseMediaCollection } from '../apps/api/src/lib/release-media'

const release = {
  id: 'release-1',
  snapshot_revision_token: 'snapshot-token-1',
  status: 'draft',
  media_snapshot_version: 0,
}

function collection(overrides: Partial<ReleaseMediaCollection> = {}): ReleaseMediaCollection {
  return {
    complete: true,
    mediaIds: ['media-b', 'media-a', 'media-b'],
    resolved: [],
    external: [],
    unresolved: [],
    ...overrides,
  }
}

test('complete collection invokes trusted certification once with sorted unique canonical IDs', async () => {
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> = []
  const result = await persistReleaseMediaCertification({
    rpc: async (name, parameters) => {
      calls.push({ name, parameters })
      return { data: { id: release.id, status: 'draft', media_snapshot_version: 1 }, error: null }
    },
  }, release, collection(), 'actor-1')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'certify_release_media_snapshot')
  assert.deepEqual(calls[0].parameters, {
    target_release_id: release.id,
    expected_snapshot_revision_token: release.snapshot_revision_token,
    collector_complete: true,
    unresolved_references: [],
    target_media_ids: ['media-a', 'media-b'],
    actor_user_id: 'actor-1',
  })
  assert.deepEqual(result, { id: release.id, status: 'draft', media_snapshot_version: 1 })
})

test('incomplete or unresolved collection never invokes certification', async () => {
  let calls = 0
  const db = { rpc: async () => { calls += 1; return { data: null, error: null } } }
  await assert.rejects(() => persistReleaseMediaCertification(db, release, collection({ complete: false }), null), /Incomplete media collection/)
  await assert.rejects(() => persistReleaseMediaCertification(db, release, collection({ unresolved: [{ source: 'layout', value: 'missing', reason: 'managed-public-media-path-not-found' }] }), null), /Incomplete media collection/)
  assert.equal(calls, 0)
})

test('non-Draft and already-certified releases are rejected before RPC', async () => {
  let calls = 0
  const db = { rpc: async () => { calls += 1; return { data: null, error: null } } }
  await assert.rejects(() => persistReleaseMediaCertification(db, { ...release, status: 'ready' }, collection(), null), /Only Draft/)
  await assert.rejects(() => persistReleaseMediaCertification(db, { ...release, media_snapshot_version: 1 }, collection(), null), /already certified/)
  assert.equal(calls, 0)
})

test('database transaction failure is surfaced without a success result or retry', async () => {
  let calls = 0
  await assert.rejects(() => persistReleaseMediaCertification({
    rpc: async () => { calls += 1; return { data: null, error: { message: 'transaction rolled back' } } },
  }, release, collection(), null), /transaction rolled back/)
  assert.equal(calls, 1)
})
