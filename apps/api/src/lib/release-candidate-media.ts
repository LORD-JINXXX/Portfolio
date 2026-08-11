import type { SupabaseClient } from '@supabase/supabase-js'
import type { EditorDocument } from '@platform/contracts'
import { loadEditorDocument } from './platform'
import { collectCanonicalReleaseMedia, type CollectableMedia, type ReleaseMediaCollection } from './release-media'
import { persistReleaseMediaCertification } from './release-media-certification'

export interface CreatedRelease {
  id: string
  status: string
  media_snapshot_version: number
  snapshot_revision_token: string
  layout_version_id: string
  content_revision_id: string
  settings_revision_id: string
  settings_snapshot: Record<string, unknown>
  collections_snapshot: Record<string, unknown[]>
  [key: string]: unknown
}

export interface ExactReleaseMediaInputs {
  document: EditorDocument
  content: Record<string, unknown>
  settings: Record<string, unknown>
  collections: Record<string, unknown[]>
  media: CollectableMedia[]
}

export type CandidateMediaStatus = 'certified' | 'incomplete' | 'failed'

export interface CandidateMediaOutcome {
  releaseCreated: true
  mediaCertified: boolean
  status: CandidateMediaStatus
  release: CreatedRelease
  collection: ReleaseMediaCollection | null
  error?: string
}

export async function loadExactReleaseMediaInputs(
  db: SupabaseClient,
  release: CreatedRelease,
  loadDocument: (db: SupabaseClient, versionId: string) => Promise<EditorDocument> = loadEditorDocument,
): Promise<ExactReleaseMediaInputs> {
  const [document, contentQuery, settingsQuery, mediaQuery] = await Promise.all([
    loadDocument(db, release.layout_version_id),
    db.from('content_revisions').select('id,status,values_json').eq('id', release.content_revision_id).maybeSingle(),
    db.from('settings_revisions').select('id,status,values_json').eq('id', release.settings_revision_id).maybeSingle(),
    db.from('media').select('*'),
  ])
  if (contentQuery.error || contentQuery.data?.status !== 'published') throw new Error('Exact published content revision is unavailable')
  if (settingsQuery.error || settingsQuery.data?.status !== 'published') throw new Error('Exact published settings revision is unavailable')
  if (mediaQuery.error) throw new Error(mediaQuery.error.message)
  if (JSON.stringify(release.settings_snapshot || {}) !== JSON.stringify(settingsQuery.data.values_json || {})) {
    throw new Error('Release settings snapshot does not match its exact revision')
  }
  return {
    document,
    content: contentQuery.data.values_json || {},
    settings: release.settings_snapshot || {},
    collections: release.collections_snapshot || {},
    media: mediaQuery.data || [],
  }
}

interface CandidateMediaDependencies {
  loadInputs?: (db: SupabaseClient, release: CreatedRelease) => Promise<ExactReleaseMediaInputs>
  collect?: typeof collectCanonicalReleaseMedia
  certify?: typeof persistReleaseMediaCertification
  reloadRelease?: (db: SupabaseClient, releaseId: string) => Promise<CreatedRelease | null>
}

async function reloadCreatedRelease(db: SupabaseClient, releaseId: string): Promise<CreatedRelease | null> {
  const { data, error } = await db.from('site_releases').select('*').eq('id', releaseId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as CreatedRelease | null
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

export async function collectAndCertifyReleaseCandidateMedia(
  db: SupabaseClient,
  release: CreatedRelease,
  actorUserId: string | null,
  dependencies: CandidateMediaDependencies = {},
): Promise<CandidateMediaOutcome> {
  const loadInputs = dependencies.loadInputs || loadExactReleaseMediaInputs
  const collect = dependencies.collect || collectCanonicalReleaseMedia
  const certify = dependencies.certify || persistReleaseMediaCertification
  const reloadRelease = dependencies.reloadRelease || reloadCreatedRelease
  let collection: ReleaseMediaCollection | null = null

  try {
    const inputs = await loadInputs(db, release)
    collection = collect({
      ...inputs,
      managedPublicMediaOrigins: [process.env.SUPABASE_URL || ''],
    })
  } catch (cause) {
    return { releaseCreated: true, mediaCertified: false, status: 'failed', release, collection, error: message(cause) }
  }

  if (!collection.complete || collection.unresolved.length) {
    return { releaseCreated: true, mediaCertified: false, status: 'incomplete', release, collection }
  }

  try {
    const certified = await certify(db as any, release, collection, actorUserId) as CreatedRelease
    if (certified.id !== release.id || certified.status !== 'draft' || certified.media_snapshot_version !== 1) {
      throw new Error('Certification returned an unexpected release state')
    }
    return { releaseCreated: true, mediaCertified: true, status: 'certified', release: certified, collection }
  } catch (cause) {
    try {
      const current = await reloadRelease(db, release.id)
      if (current?.status === 'draft' && current.media_snapshot_version === 1) {
        return { releaseCreated: true, mediaCertified: true, status: 'certified', release: current, collection }
      }
      return { releaseCreated: true, mediaCertified: false, status: 'failed', release: current || release, collection, error: message(cause) }
    } catch {
      return { releaseCreated: true, mediaCertified: false, status: 'failed', release, collection, error: message(cause) }
    }
  }
}
