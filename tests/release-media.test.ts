import assert from 'node:assert/strict'
import test from 'node:test'
import { collectCanonicalReleaseMedia, type ReleaseMediaCollectionInput } from '../apps/api/src/lib/release-media'

const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const M3 = '33333333-3333-4333-8333-333333333333'
const M4 = '44444444-4444-4444-8444-444444444444'
const M5 = '55555555-5555-4555-8555-555555555555'

const media = [M1, M2, M3, M4, M5].map((id, index) => ({
  id,
  storage_path: `folder/image ${index + 1}.png`,
  public_url: `https://project.supabase.co/storage/v1/object/public/public-media/folder/image%20${index + 1}.png`,
  url: `https://legacy.example/media-${index + 1}.png`,
}))

function document(root: any[] = [], id = 'page-1'): any {
  return {
    layoutId: 'layout-1', layoutName: 'Test', versionId: 'version-1', versionNumber: 1,
    versionStatus: 'published', designTokens: { variables: {} },
    pages: [{ id, name: 'Home', slug: 'home', pageType: 'home', routePattern: '/', seoDefaults: {}, sortOrder: 0, schema: { schemaVersion: 3, pageId: id, root } }],
  }
}

function collect(overrides: Partial<ReleaseMediaCollectionInput> = {}) {
  return collectCanonicalReleaseMedia({
    document: document(), content: {}, settings: {},
    collections: { projects: [], notes: [], experience: [], apps: [] },
    media, managedPublicMediaOrigins: ['https://project.supabase.co'], ...overrides,
  })
}

test('collector finds all canonical structured collection media and ordered project gallery IDs', () => {
  const result = collect({ collections: {
    projects: [{ thumbnail_media_id: M1, thumbnail: media[4].public_url, gallery_media: [{ media_id: M3, sort_order: 1 }, { media_id: M2, sort_order: 0 }] }],
    notes: [{ cover_media_id: M4 }],
    experience: [{ logo_media_id: M5 }],
    apps: [{ icon_media_id: M1, cover_media_id: M2 }],
  } })
  assert.equal(result.complete, true)
  assert.deepEqual(result.mediaIds, [M1, M2, M3, M4, M5])
  assert.ok(result.resolved.find((entry) => entry.mediaId === M2)?.sources.some((source) => source.includes('gallery_media[0]')))
  assert.equal(result.resolved.some((entry) => entry.mediaId === M5 && entry.sources.some((source) => source.includes('thumbnail'))), false)
})

test('collector recursively finds typed content/settings, MediaBindings, props and supported CSS media', () => {
  const root = [{
    id: 'parent', type: 'section', styles: { desktop: { backgroundImage: `url("${media[3].storage_path}")` } },
    bindings: { background: { type: 'media', mediaId: M1 } },
    children: [{
      id: 'child', type: 'img', props: { src: media[2].public_url, text: media[4].public_url }, styles: { desktop: {} },
      bindings: {
        src: { type: 'content', key: 'hero.photo', contentType: 'media' },
        poster: { type: 'setting', key: 'ignored.non-src' },
      },
      children: [{ id: 'setting', type: 'img', styles: { desktop: {} }, bindings: { src: { type: 'setting', key: 'brand.image' } } }],
    }],
  }]
  const result = collect({ document: document(root), content: { 'hero.photo': M2, unrelated: media[4].public_url }, settings: { 'brand.image': M5, 'ignored.non-src': M4 } })
  assert.equal(result.complete, true)
  assert.deepEqual(result.mediaIds, [M1, M2, M3, M4, M5])
  assert.equal(result.resolved.filter((entry) => entry.mediaId === M1).length, 1)
})

test('collector strictly resolves canonical URL, legacy URL, storage path and decoded managed public-media path', () => {
  const result = collect({ collections: {
    projects: [{ thumbnail: media[0].public_url, gallery: [media[1].url, media[2].storage_path] }],
    notes: [{ cover_image: 'https://project.supabase.co/storage/v1/object/public/public-media/folder/image%204.png?download=1' }],
    experience: [], apps: [],
  } })
  assert.equal(result.complete, true)
  assert.deepEqual(result.mediaIds, [M1, M2, M3, M4])
})

test('collector classifies external media separately and ignores arbitrary strings outside typed media fields', () => {
  const result = collect({
    document: document([{ id: 'text', type: 'p', props: { text: media[0].public_url }, styles: { desktop: {} }, bindings: { text: { type: 'content', key: 'plain.text', contentType: 'text' } } }]),
    content: { 'plain.text': media[1].public_url, unused: 'not a media reference' },
    collections: { projects: [{ thumbnail: 'https://cdn.example.com/external.png' }], notes: [], experience: [], apps: [] },
  })
  assert.equal(result.complete, true)
  assert.deepEqual(result.mediaIds, [])
  assert.equal(result.external.length, 1)
  assert.equal(result.external[0].reason, 'external-or-unmanaged-media')
  assert.deepEqual(result.unresolved, [])
})

test('collector reports unresolved managed IDs, managed public-media paths and ambiguous exact values', () => {
  const duplicateUrl = 'https://legacy.example/duplicate.png'
  const result = collect({
    media: [...media, { ...media[0], id: '66666666-6666-4666-8666-666666666666', storage_path: 'other.png', public_url: duplicateUrl }, { ...media[1], id: '77777777-7777-4777-8777-777777777777', storage_path: 'other-2.png', public_url: duplicateUrl }],
    collections: {
      projects: [{ thumbnail_media_id: '88888888-8888-4888-8888-888888888888', gallery: [] }],
      notes: [{ cover_image: 'https://project.supabase.co/storage/v1/object/public/public-media/missing.png' }],
      experience: [{ logo: duplicateUrl }], apps: [],
    },
  })
  assert.equal(result.complete, false)
  assert.deepEqual(result.unresolved.map((entry) => entry.reason).sort(), [
    'ambiguous-managed-media-reference',
    'managed-media-id-not-found',
    'managed-public-media-path-not-found',
  ])
})

test('canonical structured identity is authoritative and never falls back to a valid legacy URL', () => {
  const result = collect({ collections: {
    projects: [{ thumbnail_media_id: '88888888-8888-4888-8888-888888888888', thumbnail: media[0].public_url }],
    notes: [], experience: [], apps: [],
  } })
  assert.equal(result.complete, false)
  assert.deepEqual(result.mediaIds, [])
  assert.equal(result.unresolved[0].reason, 'managed-media-id-not-found')
})

test('collector output is de-duplicated and deterministic across media registry order', () => {
  const root = [{ id: 'image', type: 'img', props: { src: media[1].storage_path }, styles: { desktop: {} }, bindings: { src: { type: 'media', mediaId: M2 } } }]
  const options = {
    document: document(root),
    collections: { projects: [{ thumbnail_media_id: M1, gallery_media_ids: [M2, M1] }], notes: [], experience: [], apps: [] },
  }
  const first = collect(options)
  const second = collect({ ...options, media: [...media].reverse() })
  assert.deepEqual(first, second)
  assert.deepEqual(first.mediaIds, [M1, M2])
  assert.equal(first.resolved.length, 2)
  assert.deepEqual(first.resolved[1].sources, [...first.resolved[1].sources].sort())
})
