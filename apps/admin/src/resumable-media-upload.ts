export const SUPABASE_TUS_VERSION = '1.0.0'
export const SUPABASE_TUS_CHUNK_BYTES = 6 * 1024 * 1024

export interface PreparedMediaUpload {
  storagePath: string
  bucket: string
  tusEndpoint: string
  uploadToken: string
  finalizeToken: string
  chunkSize: number
  maxBytes: number
}

export interface ResumableUploadProgress {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

export interface ResumableUploadOptions {
  file: Blob
  filename: string
  mimeType: string
  prepared: PreparedMediaUpload
  signal?: AbortSignal
  fetcher?: typeof fetch
  retryDelaysMs?: readonly number[]
  onProgress?: (progress: ResumableUploadProgress) => void
}

function metadataValue(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function tusUploadMetadata(bucket: string, objectName: string, contentType: string): string {
  return [
    `bucketName ${metadataValue(bucket)}`,
    `objectName ${metadataValue(objectName)}`,
    `contentType ${metadataValue(contentType)}`,
    `cacheControl ${metadataValue('3600')}`,
  ].join(',')
}

function resolveUploadLocation(endpoint: string, location: string | null): string {
  if (!location) throw new Error('Supabase Storage did not return a resumable upload URL')
  return new URL(location, endpoint).toString()
}

async function responseError(response: Response): Promise<Error & { status?: number }> {
  const payload = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null
  const text = payload?.message || payload?.error || await response.text().catch(() => '')
  return Object.assign(new Error(String(text || `Storage upload failed (${response.status})`)), { status: response.status })
}

function isRecoverableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const abort = () => { clearTimeout(timer); reject(new DOMException('Upload cancelled', 'AbortError')) }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
  })
}

async function createUpload(options: ResumableUploadOptions, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(options.prepared.tusEndpoint, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Tus-Resumable': SUPABASE_TUS_VERSION,
      'Upload-Length': String(options.file.size),
      'Upload-Metadata': tusUploadMetadata(options.prepared.bucket, options.prepared.storagePath, options.mimeType),
      'x-signature': options.prepared.uploadToken,
      'x-upsert': 'false',
    },
  })
  if (!response.ok) throw await responseError(response)
  return resolveUploadLocation(options.prepared.tusEndpoint, response.headers.get('Location'))
}

async function headOffset(uploadUrl: string, token: string, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<number> {
  const response = await fetcher(uploadUrl, {
    method: 'HEAD',
    signal,
    headers: { 'Tus-Resumable': SUPABASE_TUS_VERSION, 'x-signature': token },
  })
  if (!response.ok) throw await responseError(response)
  const offset = Number(response.headers.get('Upload-Offset'))
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Supabase Storage returned an invalid resumable upload offset')
  return offset
}

async function patchChunk(uploadUrl: string, token: string, offset: number, chunk: Blob, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<number> {
  const response = await fetcher(uploadUrl, {
    method: 'PATCH',
    signal,
    headers: {
      'Tus-Resumable': SUPABASE_TUS_VERSION,
      'Upload-Offset': String(offset),
      'Content-Type': 'application/offset+octet-stream',
      'x-signature': token,
    },
    body: chunk,
  })
  if (!response.ok) throw await responseError(response)
  const next = Number(response.headers.get('Upload-Offset'))
  if (!Number.isSafeInteger(next) || next <= offset) throw new Error('Supabase Storage did not advance the resumable upload offset')
  return next
}

export async function uploadBlobResumable(options: ResumableUploadOptions): Promise<{ uploadUrl: string }> {
  const fetcher = options.fetcher || fetch
  const chunkSize = Number(options.prepared.chunkSize) || SUPABASE_TUS_CHUNK_BYTES
  if (chunkSize !== SUPABASE_TUS_CHUNK_BYTES) throw new Error('Supabase resumable uploads currently require 6 MB chunks')
  if (!options.file.size) throw new Error('Uploaded media is empty')
  if (options.file.size > options.prepared.maxBytes) throw Object.assign(new Error(`File exceeds the configured media limit (${Math.ceil(options.prepared.maxBytes / 1024 / 1024)} MB)`), { status: 413 })
  if (options.signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')

  const uploadUrl = await createUpload(options, fetcher)
  const retryDelays = [...(options.retryDelaysMs || [0, 1000, 3000, 5000, 10000])]
  let retryIndex = 0
  let offset = 0
  options.onProgress?.({ bytesUploaded: 0, bytesTotal: options.file.size, percentage: 0 })

  while (offset < options.file.size) {
    const chunk = options.file.slice(offset, Math.min(offset + chunkSize, options.file.size), options.mimeType)
    try {
      offset = await patchChunk(uploadUrl, options.prepared.uploadToken, offset, chunk, options.signal, fetcher)
      retryIndex = 0
      options.onProgress?.({ bytesUploaded: offset, bytesTotal: options.file.size, percentage: Math.min(100, (offset / options.file.size) * 100) })
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
      const status = Number((error as { status?: unknown })?.status || 0)
      if ((status && !isRecoverableStatus(status)) || retryIndex >= retryDelays.length) throw error
      await wait(retryDelays[retryIndex++] || 0, options.signal)
      offset = await headOffset(uploadUrl, options.prepared.uploadToken, options.signal, fetcher)
      options.onProgress?.({ bytesUploaded: offset, bytesTotal: options.file.size, percentage: Math.min(100, (offset / options.file.size) * 100) })
    }
  }

  return { uploadUrl }
}
