import type { SupabaseClient } from '@supabase/supabase-js'
import { collectCanonicalReleaseMedia } from './release-media'
import { loadExactReleaseMediaInputs, type CreatedRelease } from './release-candidate-media'
import { validateCanonicalMediaStorageObjects } from './release-media-runtime'

export async function collectLegacyReleaseMedia(db: SupabaseClient, release: CreatedRelease) {
  const inputs = await loadExactReleaseMediaInputs(db, release)
  const { data: resolutionRows, error: resolutionError } = await db
    .from('release_media_legacy_resolutions')
    .select('legacy_value,media_id')
    .eq('site_release_id', release.id)
  if (resolutionError) throw new Error(`Failed to load legacy release media resolutions: ${resolutionError.message}`)
  const legacyResolutions = Object.fromEntries((resolutionRows || []).map((row: any) => [String(row.legacy_value), String(row.media_id)]))
  return collectCanonicalReleaseMedia({ ...inputs, legacyResolutions, managedPublicMediaOrigins: [process.env.SUPABASE_URL || ''] })
}

export async function certifyLegacyReleaseMedia(db: SupabaseClient, release: CreatedRelease, actorUserId: string | null) {
  if (release.media_snapshot_version !== 0) throw new Error('Release media accounting is already certified')
  if (!['draft','ready','active','superseded'].includes(String(release.status))) throw new Error('Release status is not eligible for historical media certification')
  const collection = await collectLegacyReleaseMedia(db, release)
  if (!collection.complete || collection.unresolved.length) return { certified: false as const, collection, storageIssues: [], release }
  const mediaIds = [...new Set(collection.mediaIds)].sort()
  const storageIssues = await validateCanonicalMediaStorageObjects(db, mediaIds)
  if (storageIssues.some((issue) => issue.severity === 'error')) return { certified: false as const, collection, storageIssues, release }
  const { data, error } = await db.rpc('certify_legacy_release_media_snapshot', {
    target_release_id: release.id,
    expected_snapshot_revision_token: release.snapshot_revision_token,
    collector_complete: true,
    unresolved_references: [],
    target_media_ids: mediaIds,
    actor_user_id: actorUserId,
  })
  if (error) throw new Error(`Historical release media certification failed: ${error.message}`)
  return { certified: true as const, collection, storageIssues, release: data }
}
