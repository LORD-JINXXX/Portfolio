import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeStructuredMediaInput, replaceProjectGallery } from '../apps/api/src/lib/structured-media'

function mediaDb(rows: any[]) {
  return {
    from(table: string) {
      assert.equal(table, 'media')
      return {
        select() { return this },
        eq(_field: string, id: unknown) { return { maybeSingle: async () => ({ data: rows.find((row) => row.id === id) || null, error: null }) } },
      }
    },
  }
}

test('structured media canonical ID derives compatibility URL from trusted media row', async () => {
  const result = await normalizeStructuredMediaInput(mediaDb([{ id: 'media-1', public_url: 'trusted-url' }]), 'projects', { thumbnail_media_id: 'media-1', thumbnail: 'client-url' })
  assert.equal(result.thumbnail_media_id, 'media-1')
  assert.equal(result.thumbnail, 'trusted-url')
})

test('structured media rejects arbitrary client IDs and clears compatibility field with canonical selection', async () => {
  await assert.rejects(() => normalizeStructuredMediaInput(mediaDb([]), 'notes', { cover_media_id: 'unknown', cover_image: 'client-url' }), /Managed media not found/)
  assert.deepEqual(await normalizeStructuredMediaInput(mediaDb([]), 'notes', { cover_media_id: null, cover_image: 'client-url' }), { cover_media_id: null, cover_image: null })
})

test('project gallery preserves order and rejects duplicates before mutation', async () => {
  await assert.rejects(() => replaceProjectGallery({} as any, 'project-1', ['media-1', 'media-1']), /duplicate media/)
})
