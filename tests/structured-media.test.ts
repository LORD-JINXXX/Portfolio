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


test('project gallery replacement delegates relation + legacy sync to one database RPC', async () => {
  const calls: any[] = []
  const db = {
    async rpc(name: string, args: any) {
      calls.push({ name, args })
      return { data: [
        { media_id: 'media-2', sort_order: 0, public_url: 'https://cdn.example/2.png' },
        { media_id: 'media-1', sort_order: 1, public_url: 'https://cdn.example/1.png' },
      ], error: null }
    },
  }
  const urls = await replaceProjectGallery(db as any, 'project-1', ['media-2', 'media-1'])
  assert.deepEqual(calls, [{ name: 'replace_project_gallery_media', args: { target_project_id: 'project-1', media_ids: ['media-2', 'media-1'] } }])
  assert.deepEqual(urls, ['https://cdn.example/2.png', 'https://cdn.example/1.png'])
})

test('project gallery replacement surfaces an atomic RPC failure', async () => {
  const db = { rpc: async () => ({ data: null, error: { message: 'transaction rolled back' } }) }
  await assert.rejects(() => replaceProjectGallery(db as any, 'project-1', ['media-1']), /transaction rolled back/)
})
