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
