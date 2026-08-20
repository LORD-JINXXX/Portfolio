import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MAX_CMS_MEDIA_BYTES,
  PUBLIC_MEDIA_BUCKET,
  TUS_CHUNK_BYTES,
  createCmsMediaStoragePath,
  inferMediaMime,
  resolveCmsMediaMaxBytes,
  sanitizeMediaFilename,
  signMediaUploadIntent,
  supabaseTusEndpoint,
  verifyMediaUploadIntent,
} from '../apps/api/src/lib/media-upload-intent'
import { uploadBlobResumable, tusUploadMetadata, type PreparedMediaUpload } from '../apps/admin/src/resumable-media-upload'

const prepared = (overrides: Partial<PreparedMediaUpload> = {}): PreparedMediaUpload => ({
  storagePath: 'cms/2026-08-18/media-video.mp4',
  bucket: PUBLIC_MEDIA_BUCKET,
  tusEndpoint: 'https://project.storage.supabase.co/storage/v1/upload/resumable',
  uploadToken: 'signed-storage-token',
  finalizeToken: 'signed-finalize-token',
  chunkSize: TUS_CHUNK_BYTES,
  maxBytes: DEFAULT_MAX_CMS_MEDIA_BYTES,
  ...overrides,
})

test('media upload intent helpers sanitize metadata, derive direct Storage endpoint, and verify actor-bound tokens', () => {
  assert.equal(sanitizeMediaFilename('../My video (final).mp4'), '_My_video__final_.mp4')
  assert.equal(inferMediaMime('video.mp4', ''), 'video/mp4')
  assert.equal(inferMediaMime('photo.jpg', 'image/jpg'), 'image/jpeg')
  assert.throws(() => inferMediaMime('payload.exe', 'application/octet-stream'), /Unsupported/)
  assert.equal(resolveCmsMediaMaxBytes(undefined), DEFAULT_MAX_CMS_MEDIA_BYTES)
  assert.equal(supabaseTusEndpoint('https://project.supabase.co'), 'https://project.storage.supabase.co/storage/v1/upload/resumable')
  assert.equal(supabaseTusEndpoint('http://127.0.0.1:54321'), 'http://127.0.0.1:54321/storage/v1/upload/resumable')
  assert.match(createCmsMediaStoragePath('hero image.png', new Date('2026-08-18T00:00:00Z'), 'fixed-id'), /^cms\/2026-08-18\/fixed-id-hero_image\.png$/)

  const claims = {
    actorId: 'admin-1',
    bucket: PUBLIC_MEDIA_BUCKET,
    storagePath: 'cms/2026-08-18/fixed-id-hero.png',
    filename: 'hero.png',
    mimeType: 'image/png',
    sizeBytes: 123,
    altText: '',
    expiresAt: 10_000,
  } as const
  const token = signMediaUploadIntent(claims, 'test-secret-at-least-long-enough')
  assert.equal(verifyMediaUploadIntent(token, 'test-secret-at-least-long-enough', 'admin-1', 9_000).storagePath, claims.storagePath)
  assert.throws(() => verifyMediaUploadIntent(token, 'test-secret-at-least-long-enough', 'admin-2', 9_000), /does not belong/)
  assert.throws(() => verifyMediaUploadIntent(token, 'test-secret-at-least-long-enough', 'admin-1', 10_001), /expired/)
})

test('TUS metadata carries the signed upload target without exposing service-role credentials', () => {
  const metadata = tusUploadMetadata(PUBLIC_MEDIA_BUCKET, 'cms/test/video.mp4', 'video/mp4')
  assert.match(metadata, /bucketName /)
  assert.match(metadata, /objectName /)
  assert.match(metadata, /contentType /)
  assert.doesNotMatch(metadata, /service_role|SUPABASE_SERVICE_ROLE/i)
})

test('resumable upload creates one TUS upload and sends large files in required 6 MB chunks', async () => {
  const size = TUS_CHUNK_BYTES + 1024
  const file = new Blob([new Uint8Array(size)], { type: 'video/mp4' })
  const calls: Array<{ method: string; offset: string | null; size: number }> = []
  let serverOffset = 0
  const fetcher = async (_input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = String(init.method || 'GET')
    const headers = new Headers(init.headers)
    const bodySize = init.body instanceof Blob ? init.body.size : 0
    calls.push({ method, offset: headers.get('Upload-Offset'), size: bodySize })
    if (method === 'POST') return new Response(null, { status: 201, headers: { Location: '/storage/v1/upload/resumable/upload-1' } })
    if (method === 'PATCH') {
      assert.equal(Number(headers.get('Upload-Offset')), serverOffset)
      serverOffset += bodySize
      return new Response(null, { status: 204, headers: { 'Upload-Offset': String(serverOffset) } })
    }
    throw new Error(`Unexpected ${method}`)
  }
  const progress: number[] = []
  await uploadBlobResumable({ file, filename: 'video.mp4', mimeType: 'video/mp4', prepared: prepared(), fetcher: fetcher as typeof fetch, onProgress: (value) => progress.push(Math.round(value.percentage)) })
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'PATCH', 'PATCH'])
  assert.equal(calls[1].size, TUS_CHUNK_BYTES)
  assert.equal(calls[2].size, 1024)
  assert.equal(serverOffset, size)
  assert.deepEqual(progress, [0, Math.round((TUS_CHUNK_BYTES / size) * 100), 100])
})

test('resumable upload recovers the server offset after an ambiguous chunk failure instead of restarting', async () => {
  const size = TUS_CHUNK_BYTES + 2048
  const file = new Blob([new Uint8Array(size)], { type: 'video/mp4' })
  let firstPatch = true
  const offsets: number[] = []
  const fetcher = async (_input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = String(init.method || 'GET')
    const headers = new Headers(init.headers)
    if (method === 'POST') return new Response(null, { status: 201, headers: { Location: '/storage/v1/upload/resumable/upload-2' } })
    if (method === 'PATCH') {
      const offset = Number(headers.get('Upload-Offset'))
      offsets.push(offset)
      if (firstPatch) {
        firstPatch = false
        // Simulate the server accepting the first chunk while the client loses the response.
        throw new Error('connection reset after server commit')
      }
      return new Response(null, { status: 204, headers: { 'Upload-Offset': String(size) } })
    }
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Upload-Offset': String(TUS_CHUNK_BYTES) } })
    throw new Error(`Unexpected ${method}`)
  }
  await uploadBlobResumable({ file, filename: 'video.mp4', mimeType: 'video/mp4', prepared: prepared(), fetcher: fetcher as typeof fetch, retryDelaysMs: [0] })
  assert.deepEqual(offsets, [0, TUS_CHUNK_BYTES])
})
