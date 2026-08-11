import type { ReleaseMediaCollection } from './release-media'

type SupabaseRpcClient = {
  rpc: (name: string, parameters: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

export interface ExactReleaseCertificationTarget {
  id: string
  snapshot_revision_token: string
  status?: string
  media_snapshot_version?: number
}

export async function persistReleaseMediaCertification(
  db: SupabaseRpcClient,
  release: ExactReleaseCertificationTarget,
  collection: ReleaseMediaCollection,
  actorUserId: string | null,
) {
  if (!collection.complete || collection.unresolved.length) {
    throw new Error('Incomplete media collection cannot be certified')
  }
  if (release.status !== undefined && release.status !== 'draft') {
    throw new Error('Only Draft releases can receive media certification')
  }
  if (release.media_snapshot_version !== undefined && release.media_snapshot_version !== 0) {
    throw new Error('Release media accounting is already certified')
  }

  const mediaIds = [...new Set(collection.mediaIds)].sort()
  const { data, error } = await db.rpc('certify_release_media_snapshot', {
    target_release_id: release.id,
    expected_snapshot_revision_token: release.snapshot_revision_token,
    collector_complete: true,
    unresolved_references: [],
    target_media_ids: mediaIds,
    actor_user_id: actorUserId,
  })
  if (error) throw new Error(`Release media certification failed: ${error.message}`)
  return data
}
