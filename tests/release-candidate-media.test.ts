import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  collectAndCertifyReleaseCandidateMedia,
  loadExactReleaseMediaInputs,
  type CreatedRelease,
  type ExactReleaseMediaInputs,
} from '../apps/api/src/lib/release-candidate-media'
import type { ReleaseMediaCollection } from '../apps/api/src/lib/release-media'

const release: CreatedRelease = {
  id: 'release-new', status: 'draft', media_snapshot_version: 0,
  snapshot_revision_token: 'exact-token', layout_version_id: 'layout-exact',
  content_revision_id: 'content-exact', settings_revision_id: 'settings-exact',
  settings_snapshot: { brand: 'exact' },
  collections_snapshot: { projects: [{ id: 'project-1', gallery: ['legacy'], gallery_media: [{ media_id: 'media-a', sort_order: 0 }] }], notes: [], experience: [], apps: [] },
}

const inputs: ExactReleaseMediaInputs = {
  document: { pages: [] } as any,
  content: {}, settings: release.settings_snapshot,
  collections: release.collections_snapshot,
  media: [],
}

function collection(overrides: Partial<ReleaseMediaCollection> = {}): ReleaseMediaCollection {
  return { complete: true, mediaIds: ['media-a'], resolved: [], external: [], unresolved: [], ...overrides }
}

test('complete normal candidate collection certifies the exact Draft token and returns version 1', async () => {
  let certified = 0
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, 'actor-1', {
    loadInputs: async () => inputs,
    collect: (value) => {
      assert.equal(value.collections, release.collections_snapshot)
      return collection()
    },
    certify: async (_db, target, media, actor) => {
      certified += 1
      assert.equal(target.snapshot_revision_token, 'exact-token')
      assert.deepEqual(media.mediaIds, ['media-a'])
      assert.equal(actor, 'actor-1')
      return { ...release, status: 'draft', media_snapshot_version: 1 }
    },
  })
  assert.equal(certified, 1)
  assert.equal(result.status, 'certified')
  assert.equal(result.mediaCertified, true)
  assert.equal(result.release.status, 'draft')
  assert.equal(result.release.media_snapshot_version, 1)
})

test('complete zero-media candidate is still certified to version 1', async () => {
  let passedIds: string[] | null = null
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, null, {
    loadInputs: async () => inputs,
    collect: () => collection({ mediaIds: [] }),
    certify: async (_db, _release, media) => {
      passedIds = media.mediaIds
      return { ...release, media_snapshot_version: 1 }
    },
  })
  assert.deepEqual(passedIds, [])
  assert.equal(result.mediaCertified, true)
  assert.equal(result.release.media_snapshot_version, 1)
})

test('unresolved candidate remains a committed Draft version 0 and never invokes certification', async () => {
  let certifications = 0
  const unresolved = [{ source: 'collections.projects[0].thumbnail', value: 'managed-missing', reason: 'managed-public-media-path-not-found' }]
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, null, {
    loadInputs: async () => inputs,
    collect: () => collection({ complete: false, mediaIds: [], unresolved }),
    certify: async () => { certifications += 1; return null },
  })
  assert.equal(certifications, 0)
  assert.equal(result.releaseCreated, true)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.mediaCertified, false)
  assert.equal(result.release.status, 'draft')
  assert.equal(result.release.media_snapshot_version, 0)
  assert.deepEqual(result.collection?.unresolved, unresolved)
})

test('stale-token certification failure reports the existing Draft instead of erasing committed creation', async () => {
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, null, {
    loadInputs: async () => inputs,
    collect: () => collection(),
    certify: async () => { throw new Error('Release changed during media collection') },
    reloadRelease: async () => release,
  })
  assert.equal(result.releaseCreated, true)
  assert.equal(result.status, 'failed')
  assert.equal(result.release.id, release.id)
  assert.equal(result.release.status, 'draft')
  assert.equal(result.release.media_snapshot_version, 0)
  assert.match(result.error || '', /changed during media collection/)
})

test('collector failure preserves the committed Draft and cannot move it to Ready', async () => {
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, null, {
    loadInputs: async () => inputs,
    collect: () => { throw new Error('collector failed') },
  })
  assert.equal(result.releaseCreated, true)
  assert.equal(result.mediaCertified, false)
  assert.equal(result.status, 'failed')
  assert.equal(result.release.status, 'draft')
  assert.equal(result.release.media_snapshot_version, 0)
})

test('uncertain RPC response is reconciled as certified when the committed Draft is version 1', async () => {
  const result = await collectAndCertifyReleaseCandidateMedia({} as any, release, null, {
    loadInputs: async () => inputs,
    collect: () => collection(),
    certify: async () => { throw new Error('network response lost') },
    reloadRelease: async () => ({ ...release, media_snapshot_version: 1 }),
  })
  assert.equal(result.status, 'certified')
  assert.equal(result.mediaCertified, true)
  assert.equal(result.release.status, 'draft')
})

test('exact input loader uses release identities and frozen collections without querying mutable collections', async () => {
  const calls: Array<{ table: string; id?: unknown }> = []
  const responses: Record<string, any> = {
    content_revisions: { id: 'content-exact', status: 'published', values_json: { hero: 'exact content' } },
    settings_revisions: { id: 'settings-exact', status: 'published', values_json: { brand: 'exact' } },
    media: [{ id: 'media-a', storage_path: 'a.png', public_url: 'https://media/a.png' }],
  }
  const db: any = {
    from(table: string) {
      calls.push({ table })
      const builder: any = {
        select() { return builder },
        eq(_field: string, id: unknown) { calls[calls.length - 1].id = id; return builder },
        maybeSingle: async () => ({ data: responses[table], error: null }),
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: responses[table], error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  let loadedLayout = ''
  const exact = await loadExactReleaseMediaInputs(db, release, async (_db, versionId) => {
    loadedLayout = versionId
    return inputs.document
  })
  assert.equal(loadedLayout, 'layout-exact')
  assert.equal(calls.find((call) => call.table === 'content_revisions')?.id, 'content-exact')
  assert.equal(calls.find((call) => call.table === 'settings_revisions')?.id, 'settings-exact')
  assert.equal(calls.some((call) => ['projects', 'project_gallery_media', 'notes', 'experiences', 'ai_apps'].includes(call.table)), false)
  assert.equal(exact.collections, release.collections_snapshot)
  assert.deepEqual((exact.collections.projects[0] as any).gallery_media, [{ media_id: 'media-a', sort_order: 0 }])
})

test('normal candidate route uses canonical post-create certification with release_media_references as runtime authority', () => {
  const api = fs.readFileSync(new URL('../apps/api/src/index.ts', import.meta.url), 'utf8')
  const route = api.slice(api.indexOf("adminRouter.post('/releases'"), api.indexOf("adminRouter.post('/releases/:id/validate'"))
  const created = route.indexOf("rpc('create_site_release'")
  const canonical = route.indexOf('collectAndCertifyReleaseCandidateMedia')
  assert.ok(created >= 0 && canonical > created)
  assert.doesNotMatch(route, /legacyRuntimeMediaSnapshot/)
  assert.match(route, /New releases use release_media_references as the only runtime media authority/i)
  assert.match(route, /media_snapshot_value:\s*\{\}/)
  assert.match(route, /releaseCreated:\s*true/)
  assert.match(route, /mediaCertification:/)
  assert.doesNotMatch(route, /activate_release|rollback_release|status\s*=\s*['"](?:ready|active|superseded)['"]/)
})

test('Admin candidate feedback distinguishes committed Draft outcomes and historical certification stays server-mediated', () => {
  const admin = fs.readFileSync(new URL('../apps/admin/src/ReleaseManager.tsx', import.meta.url), 'utf8')
  const api = fs.readFileSync(new URL('../apps/api/src/index.ts', import.meta.url), 'utf8')
  assert.match(admin, /created with certified media\. Validate it before activation/i)
  assert.match(admin, /was created as Draft, but media certification/i)
  assert.match(api, /adminRouter\.post\(['"]\/releases\/:id\/media-certification[\s\S]*certifyLegacyReleaseMedia/i)
  assert.match(admin, /apiFetch\(`\/api\/admin\/releases\/\$\{release\.id\}\/media-certification`, \{ method: 'POST' \}\)/)
  assert.doesNotMatch(admin, /\.rpc\(['"]certify_(?:release|legacy_release)_media_snapshot|SUPABASE_SERVICE_ROLE_KEY|service_role|supabaseAdmin/i)
})
