export interface CanonicalMediaRecord {
  id: string
  filename: string
  storage_path: string
  public_url: string | null
  mime_type: string
  size: number
  kind: string
  alt_text: string | null
}

export interface MediaUploadResult {
  media: CanonicalMediaRecord
  refreshed: boolean
}

export interface MediaDeleteResult {
  id: string
  refreshed: boolean
}

export interface MediaBatchUploadFailure {
  filename: string
  message: string
}

export interface MediaBatchUploadResult {
  media: CanonicalMediaRecord[]
  failures: MediaBatchUploadFailure[]
  refreshed: boolean
  cancelled: boolean
}

export function canonicalMediaRecord(value: any): CanonicalMediaRecord {
  return {
    id: String(value.id),
    filename: String(value.filename),
    storage_path: String(value.storage_path),
    public_url: value.public_url == null ? null : String(value.public_url),
    mime_type: String(value.mime_type),
    size: Number(value.size),
    kind: String(value.kind),
    alt_text: value.alt_text == null ? null : String(value.alt_text),
  }
}

export async function uploadMediaAndRefresh(dependencies: {
  upload: () => Promise<{ data: unknown }>
  refresh: () => Promise<void>
  preserveCreated: (media: CanonicalMediaRecord) => void
}): Promise<MediaUploadResult> {
  const response = await dependencies.upload()
  const media = canonicalMediaRecord(response.data)
  dependencies.preserveCreated(media)
  try {
    await dependencies.refresh()
    return { media, refreshed: true }
  } catch {
    return { media, refreshed: false }
  }
}

function uploadFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed'
}

function uploadFailureStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = Number((error as { status?: unknown }).status)
  return Number.isFinite(status) ? status : null
}

export async function uploadMediaBatchAndRefresh<T>(dependencies: {
  items: readonly T[]
  filename: (item: T) => string
  upload: (item: T, index: number, total: number) => Promise<{ data: unknown }>
  refresh: () => Promise<void>
  preserveCreated: (media: CanonicalMediaRecord) => void
}): Promise<MediaBatchUploadResult> {
  const media: CanonicalMediaRecord[] = []
  const failures: MediaBatchUploadFailure[] = []
  const total = dependencies.items.length
  let cancelled = false

  for (let index = 0; index < total; index += 1) {
    const item = dependencies.items[index]
    try {
      const response = await dependencies.upload(item, index, total)
      const created = canonicalMediaRecord(response.data)
      dependencies.preserveCreated(created)
      media.push(created)
    } catch (error) {
      const aborted = (error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && error.name === 'AbortError')
      failures.push({ filename: dependencies.filename(item), message: aborted ? 'Upload cancelled.' : uploadFailureMessage(error) })
      if (aborted) {
        cancelled = true
        for (let pending = index + 1; pending < total; pending += 1) {
          failures.push({ filename: dependencies.filename(dependencies.items[pending]), message: 'Not attempted because the upload was cancelled.' })
        }
        break
      }
      // Authentication/authorization and rate-limit failures are not file-specific. Stop instead of
      // hammering the API with the rest of the selected files; the user can retry the remaining batch.
      const status = uploadFailureStatus(error)
      if (status === 401 || status === 403 || status === 429) {
        for (let pending = index + 1; pending < total; pending += 1) {
          failures.push({ filename: dependencies.filename(dependencies.items[pending]), message: 'Not attempted because the server stopped the bulk upload.' })
        }
        break
      }
    }
  }

  let refreshed = true
  if (media.length > 0) {
    try { await dependencies.refresh() }
    catch { refreshed = false }
  }
  return { media, failures, refreshed, cancelled }
}

export async function deleteMediaAndRefresh(dependencies: {
  id: string
  remove: () => Promise<{ data: { id?: unknown } }>
  refresh: () => Promise<void>
  preserveDeleted: (id: string) => void
}): Promise<MediaDeleteResult> {
  const response = await dependencies.remove()
  const id = response.data.id == null ? dependencies.id : String(response.data.id)
  dependencies.preserveDeleted(id)
  try {
    await dependencies.refresh()
    return { id, refreshed: true }
  } catch {
    return { id, refreshed: false }
  }
}
