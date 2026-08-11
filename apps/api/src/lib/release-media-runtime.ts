import type { SupabaseClient } from '@supabase/supabase-js'
import type { RuntimeManifest, ValidationIssue } from '@platform/contracts'

export interface ReleaseMediaReferenceRow {
  media_id: string
  bucket_id: string
  storage_path: string
  mime_type: string
  size: number
  alt_text?: string | null
  captured_public_url?: string | null
}

export async function loadReleaseMediaReferences(db: SupabaseClient, releaseId: string): Promise<ReleaseMediaReferenceRow[]> {
  const { data, error } = await db
    .from('release_media_references')
    .select('media_id,bucket_id,storage_path,mime_type,size,alt_text,captured_public_url')
    .eq('site_release_id', releaseId)
    .order('media_id', { ascending: true })
  if (error) throw new Error(`Failed to load authoritative release media: ${error.message}`)
  return (data || []) as ReleaseMediaReferenceRow[]
}

/**
 * Runtime media authority:
 * - certified v1 releases use immutable release_media_references only;
 * - legacy v0 releases may use their exact frozen legacy media_snapshot;
 * - an empty snapshot remains empty and NEVER expands to current live media.
 */
export async function getReleaseMediaMap(db: SupabaseClient, release: any): Promise<RuntimeManifest['media']> {
  if (Number(release?.media_snapshot_version || 0) !== 1) return release?.media_snapshot || {}
  const refs = await loadReleaseMediaReferences(db, String(release.id))
  const media: RuntimeManifest['media'] = {}
  for (const ref of refs) {
    const generated = db.storage.from(ref.bucket_id || 'public-media').getPublicUrl(ref.storage_path).data?.publicUrl || ''
    media[ref.media_id] = { id: ref.media_id, url: ref.captured_public_url || generated, alt: ref.alt_text || undefined }
  }
  return media
}


export async function validateCanonicalMediaStorageObjects(db: SupabaseClient, mediaIds: string[]): Promise<ValidationIssue[]> {
  const ids = [...new Set(mediaIds.map(String).filter(Boolean))].sort()
  if (!ids.length) return []
  const { data, error } = await db.from('media').select('id,storage_path').in('id', ids)
  if (error) return [{ severity: 'error', code: 'release.media-storage-check-failed', message: `Failed to load canonical media for Storage verification: ${error.message}` }]
  const rows = data || []
  const byId = new Map(rows.map((row: any) => [String(row.id), row]))
  const issues: ValidationIssue[] = []
  for (const id of ids) {
    const row: any = byId.get(id)
    if (!row?.storage_path) {
      issues.push({ severity: 'error', code: 'release.media-missing', message: `Canonical media ${id} is missing or has no storage path.` })
      continue
    }
    try {
      const bucket: any = db.storage.from('public-media')
      if (typeof bucket.exists !== 'function') {
        issues.push({ severity: 'error', code: 'release.media-storage-check-unavailable', message: 'The configured Storage client cannot verify release media availability.' })
        break
      }
      const result = await bucket.exists(row.storage_path)
      if (result?.error) issues.push({ severity: 'error', code: 'release.media-storage-check-failed', message: `Storage availability check failed for media ${id}: ${result.error.message}` })
      else if (!result?.data) issues.push({ severity: 'error', code: 'release.media-storage-missing', message: `Release media ${id} is missing from public-media/${row.storage_path}.` })
    } catch (cause) {
      issues.push({ severity: 'error', code: 'release.media-storage-check-failed', message: `Storage availability check failed for media ${id}: ${cause instanceof Error ? cause.message : 'unknown error'}` })
    }
  }
  return issues
}

export async function validateReleaseStorageObjects(db: SupabaseClient, release: any): Promise<ValidationIssue[]> {
  if (Number(release?.media_snapshot_version || 0) !== 1) return []
  let refs: ReleaseMediaReferenceRow[]
  try { refs = await loadReleaseMediaReferences(db, String(release.id)) }
  catch (error) { return [{ severity: 'error', code: 'release.media-storage-check-failed', message: error instanceof Error ? error.message : 'Failed to load release media references.' }] }
  const issues: ValidationIssue[] = []
  for (const ref of refs) {
    try {
      const bucket: any = db.storage.from(ref.bucket_id || 'public-media')
      if (typeof bucket.exists !== 'function') {
        issues.push({ severity: 'error', code: 'release.media-storage-check-unavailable', message: 'The configured Storage client cannot verify release media availability.' })
        break
      }
      const result = await bucket.exists(ref.storage_path)
      if (result?.error) issues.push({ severity: 'error', code: 'release.media-storage-check-failed', message: `Storage availability check failed for media ${ref.media_id}: ${result.error.message}` })
      else if (!result?.data) issues.push({ severity: 'error', code: 'release.media-storage-missing', message: `Release media ${ref.media_id} is missing from ${ref.bucket_id}/${ref.storage_path}.` })
    } catch (error) {
      issues.push({ severity: 'error', code: 'release.media-storage-check-failed', message: `Storage availability check failed for media ${ref.media_id}: ${error instanceof Error ? error.message : 'unknown error'}` })
    }
  }
  return issues
}
