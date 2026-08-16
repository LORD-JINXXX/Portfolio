import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { freezeProjectGallerySnapshots, getPublishedCollections } from '../apps/api/src/lib/platform'

function fakeCollectionsDb(tables: Record<string, any[]>, galleryError: string | null = null) {
  const calls: Array<{ table: string; operation: string; value?: unknown }> = []
  return {
    calls,
    db: {
      from(table: string) {
        calls.push({ table, operation: 'from' })
        const builder: any = {
          select(value: string) { calls.push({ table, operation: 'select', value }); return builder },
          eq(field: string, value: unknown) { calls.push({ table, operation: `eq:${field}`, value }); return builder },
          in(field: string, value: unknown) { calls.push({ table, operation: `in:${field}`, value }); return builder },
          order(field: string) { calls.push({ table, operation: `order:${field}` }); return builder },
          then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
            const error = table === 'project_gallery_media' && galleryError ? { message: galleryError } : null
            return Promise.resolve({ data: tables[table] || [], error }).then(resolve, reject)
          },
        }
        return builder
      },
    },
  }
}

test('published collection snapshots freeze ordered canonical gallery relations without cross-project leakage', async () => {
  const projects = [
    { id: 'project-a', title: 'A', gallery: ['legacy-a'] },
    { id: 'project-b', title: 'B', gallery: ['legacy-b'] },
    { id: 'project-empty', title: 'Empty', gallery: [] },
  ]
  const rows = [
    { project_id: 'project-b', media_id: 'media-c', sort_order: 0 },
    { project_id: 'project-a', media_id: 'media-b', sort_order: 1 },
    { project_id: 'project-a', media_id: 'media-a', sort_order: 0 },
  ]
  const fake = fakeCollectionsDb({ projects, notes: [], experiences: [], ai_apps: [], project_gallery_media: rows })
  const snapshot = await getPublishedCollections(fake.db as any)
  const frozen = snapshot.projects as any[]

  assert.deepEqual(frozen[0].gallery_media, [{ media_id: 'media-a', sort_order: 0 }, { media_id: 'media-b', sort_order: 1 }])
  assert.deepEqual(frozen[0].gallery_media_ids, ['media-a', 'media-b'])
  assert.deepEqual(frozen[1].gallery_media, [{ media_id: 'media-c', sort_order: 0 }])
  assert.deepEqual(frozen[1].gallery_media_ids, ['media-c'])
  assert.deepEqual(frozen[2].gallery_media, [])
  assert.deepEqual(frozen[2].gallery_media_ids, [])
  assert.deepEqual(frozen.map((project) => project.gallery), [['legacy-a'], ['legacy-b'], []])
  assert.equal(frozen[0].gallery_media.some((entry: any) => entry.media_id === 'legacy-a'), false)

  rows[2].media_id = 'later-live-change'
  assert.deepEqual(frozen[0].gallery_media, [{ media_id: 'media-a', sort_order: 0 }, { media_id: 'media-b', sort_order: 1 }])
})

test('published collection snapshots batch-load all Project galleries once in deterministic query order', async () => {
  const fake = fakeCollectionsDb({ projects: [{ id: 'project-a' }, { id: 'project-b' }], notes: [], experiences: [], ai_apps: [], project_gallery_media: [] })
  await getPublishedCollections(fake.db as any)
  const galleryCalls = fake.calls.filter((call) => call.table === 'project_gallery_media')
  assert.equal(galleryCalls.filter((call) => call.operation === 'from').length, 1)
  assert.deepEqual(galleryCalls.find((call) => call.operation === 'in:project_id')?.value, ['project-a', 'project-b'])
  assert.deepEqual(galleryCalls.filter((call) => call.operation.startsWith('order:')).map((call) => call.operation), ['order:project_id', 'order:sort_order'])
})

test('published collection snapshots skip gallery query when no Projects exist', async () => {
  const fake = fakeCollectionsDb({ projects: [], notes: [], experiences: [], ai_apps: [] })
  const snapshot = await getPublishedCollections(fake.db as any)
  assert.deepEqual(snapshot.projects, [])
  assert.equal(fake.calls.some((call) => call.table === 'project_gallery_media'), false)
})

test('gallery snapshot failure prevents the release creation continuation', async () => {
  const fake = fakeCollectionsDb({ projects: [{ id: 'project-a' }], notes: [], experiences: [], ai_apps: [] }, 'gallery unavailable')
  let createCalls = 0
  await assert.rejects(async () => {
    const snapshot = await getPublishedCollections(fake.db as any)
    createCalls += 1
    return snapshot
  }, /gallery unavailable/)
  assert.equal(createCalls, 0)
})

test('candidate route assembles canonical collections snapshot before create_site_release', () => {
  const api = fs.readFileSync(new URL('../apps/api/src/index.ts', import.meta.url), 'utf8')
  const route = api.slice(api.indexOf("adminRouter.post('/releases'"), api.indexOf("adminRouter.post('/releases/:id/validate'"))
  assert.ok(route.indexOf('getPublishedCollections(supabaseAdmin)') < route.indexOf("rpc('create_site_release'"))
  assert.doesNotMatch(route, /activate_release|rollback_release|status\s*=\s*['"](?:ready|active|superseded)['"]/)
})

test('gallery snapshot helper uses relation identity rather than legacy gallery values', () => {
  const frozen = freezeProjectGallerySnapshots(
    [{ id: 'project-a', gallery: ['https://legacy.example/not-authoritative.png'] }],
    [{ project_id: 'project-a', media_id: 'canonical-media-id', sort_order: 0 }],
  )
  assert.deepEqual(frozen[0].gallery_media, [{ media_id: 'canonical-media-id', sort_order: 0 }])
  assert.deepEqual(frozen[0].gallery_media_ids, ['canonical-media-id'])
  assert.deepEqual(frozen[0].gallery, ['https://legacy.example/not-authoritative.png'])
})
