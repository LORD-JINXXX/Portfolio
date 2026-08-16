import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEditorDocument, normalizeLayoutPageSchema } from '@platform/builder-core'
import {
  DEFAULT_DESIGN_TOKENS,
  LAYOUT_SCHEMA_VERSION,
  RUNTIME_VERSION,
  type ContentRevision,
  type EditorDocument,
  type EditorPage,
  type Layout,
  type LayoutPage,
  type LayoutVersion,
  type RuntimeManifest,
  type ValidationIssue,
} from '@platform/contracts'
import { finalize, validateEditorDocument, validateReleaseCandidate } from '@platform/validation'
import { getReleaseMediaMap, loadReleaseMediaReferences, validateReleaseStorageObjects } from './release-media-runtime'
import {
  COLLECTION_SCHEMA_SNAPSHOT_KEY, collectionDefinitionsSnapshot, definitionsFromSnapshot, getCollectionDefinitions,
  getGenericPublishedCollections, stripInternalCollectionMetadata, validateCollectionSnapshotIntegrity,
} from './generic-collections'

export { PREVIEW_SAMPLE_COLLECTIONS as SAMPLE_COLLECTIONS, sampleContentForDocument } from '@platform/validation'


export function getDeployedPublicRuntimeVersion(): string | null {
  const configured = String(process.env.PUBLIC_WEB_RUNTIME_VERSION || '').trim()
  if (configured) return configured
  return process.env.NODE_ENV === 'production' ? null : RUNTIME_VERSION
}

export function dbPageToEditorPage(row: any): EditorPage {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    pageType: row.page_type,
    routePattern: row.route_pattern || (row.slug === 'home' ? '/' : `/${row.slug}`),
    seoDefaults: row.seo_defaults || {},
    sortOrder: row.sort_order || 0,
    schema: normalizeLayoutPageSchema(row.layout_tree, row.id),
  }
}

export function editorPageToDb(page: EditorPage, versionId?: string) {
  return {
    id: page.id,
    ...(versionId ? { layout_version_id: versionId } : {}),
    slug: page.slug,
    name: page.name,
    page_type: page.pageType,
    route_pattern: page.routePattern,
    seo_defaults: page.seoDefaults || {},
    sort_order: page.sortOrder,
    layout_tree: { ...page.schema, schemaVersion: LAYOUT_SCHEMA_VERSION, pageId: page.id },
  }
}

export async function loadEditorDocument(db: SupabaseClient, versionId: string): Promise<EditorDocument> {
  const { data: version, error: versionError } = await db.from('layout_versions').select('*, layouts(*)').eq('id', versionId).single()
  if (versionError || !version) throw new Error(versionError?.message || 'Layout version not found')
  const { data: pages, error: pagesError } = await db.from('layout_pages').select('*').eq('layout_version_id', versionId).order('sort_order', { ascending: true })
  if (pagesError) throw new Error(pagesError.message)
  const layout = version.layouts as any
  return normalizeEditorDocument({
    layoutId: layout.id,
    layoutName: layout.name,
    layoutSlug: layout.slug,
    layoutDescription: layout.description || '',
    versionId: version.id,
    versionNumber: version.version_number,
    versionStatus: version.status,
    revisionToken: version.revision_token,
    designTokens: version.design_tokens && Object.keys(version.design_tokens).length ? version.design_tokens : DEFAULT_DESIGN_TOKENS,
    pages: (pages || []).map(dbPageToEditorPage),
  })
}

export async function getMediaMap(db: SupabaseClient, ids?: string[]): Promise<RuntimeManifest['media']> {
  if (ids && ids.length === 0) return {}
  let query = db.from('media').select('*')
  if (ids?.length) query = query.in('id', ids)
  const { data } = await query
  const map: RuntimeManifest['media'] = {}
  for (const row of data || []) {
    let url = row.public_url || ''
    if (!url && row.storage_path) {
      const { data: publicUrl } = db.storage.from('public-media').getPublicUrl(row.storage_path)
      url = publicUrl?.publicUrl || ''
    }
    map[row.id] = { id: row.id, url, alt: row.alt_text || undefined }
  }
  return map
}

export async function getSettingsObject(db: SupabaseClient): Promise<Record<string, unknown>> {
  const { data } = await db.from('site_settings').select('key,value_json')
  return Object.fromEntries((data || []).map((row: any) => [row.key, row.value_json]))
}

export async function getPublishedCollections(db: SupabaseClient): Promise<Record<string, unknown[]>> {
  const load = async (table: string) => {
    const { data, error } = await db.from(table).select('*').eq('published', true).order('display_order', { ascending: true })
    if (error) throw new Error(error.message)
    return data || []
  }
  const [projects, notes, experience, apps] = await Promise.all([load('projects'), load('notes'), load('experiences'), load('ai_apps')])
  const projectIds = projects.map((project: any) => String(project.id))
  let galleryRows: Array<{ project_id: string; media_id: string; sort_order: number }> = []
  if (projectIds.length) {
    const { data, error } = await db
      .from('project_gallery_media')
      .select('project_id,media_id,sort_order')
      .in('project_id', projectIds)
      .order('project_id', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)
    galleryRows = data || []
  }
  const definitions = await getCollectionDefinitions(db)
  const generic = await getGenericPublishedCollections(db, definitions)
  return { projects: freezeProjectGallerySnapshots(projects, galleryRows), notes, experience, apps, ...generic }
}

export async function getReleaseCollectionsSnapshot(db: SupabaseClient): Promise<Record<string, unknown[]>> {
  const collections = await getPublishedCollections(db)
  const definitions = await getCollectionDefinitions(db)
  return { ...collections, [COLLECTION_SCHEMA_SNAPSHOT_KEY]: collectionDefinitionsSnapshot(definitions) }
}

export function freezeProjectGallerySnapshots(
  projects: any[],
  galleryRows: Array<{ project_id: string; media_id: string; sort_order: number }>,
) {
  const grouped = new Map<string, Array<{ media_id: string; sort_order: number }>>()
  for (const row of galleryRows) {
    const entries = grouped.get(row.project_id) || []
    entries.push({ media_id: row.media_id, sort_order: row.sort_order })
    grouped.set(row.project_id, entries)
  }
  return projects.map((project) => {
    const gallery_media = [...(grouped.get(String(project.id)) || [])]
      .sort((a, b) => a.sort_order - b.sort_order || a.media_id.localeCompare(b.media_id))
    return { ...project, gallery_media, gallery_media_ids: gallery_media.map((entry) => entry.media_id) }
  })
}

export function collectReferencedMediaIds(document: EditorDocument, content: Record<string, unknown> = {}): string[] {
  const ids = new Set<string>()
  const walk = (nodes: any[]) => nodes.forEach((node) => {
    Object.values(node.bindings || {}).forEach((binding: any) => {
      if (binding?.type === 'media' && binding.mediaId) ids.add(String(binding.mediaId))
      if (binding?.type === 'content' && binding.contentType === 'media') {
        const value = content[binding.key]
        if (typeof value === 'string' && value && !/^https?:|^data:|^blob:|^\//.test(value)) ids.add(value)
      }
    })
    walk(node.children || [])
  })
  document.pages.forEach((page) => walk(page.schema.root))
  return [...ids]
}



export function manifestFromDocument(document: EditorDocument, options: {
  releaseId?: string | null
  releaseNumber?: number
  mediaSnapshotVersion?: number
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  media?: RuntimeManifest['media']
  collections?: Record<string, unknown[]>
  contentRevisionId?: string | null
  settingsRevisionId?: string | null
  runtimeMinVersion?: string
  generatedAt?: string
} = {}): RuntimeManifest {
  const header = document.pages.find((page) => page.pageType === 'system' && page.slug === '_header')
  const footer = document.pages.find((page) => page.pageType === 'system' && page.slug === '_footer')
  const ordinary = document.pages.filter((page) => page.pageType !== 'system').sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    releaseId: options.releaseId ?? null,
    releaseNumber: options.releaseNumber,
    mediaSnapshotVersion: options.mediaSnapshotVersion,
    layoutVersionId: document.versionId,
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    runtimeMinVersion: options.runtimeMinVersion || '1.0.0',
    designTokens: document.designTokens || DEFAULT_DESIGN_TOKENS,
    routes: ordinary.map((page) => ({ path: page.routePattern, pageId: page.id, slug: page.slug, name: page.name, pageType: page.pageType, collectionName: page.schema.collectionName, seo: page.seoDefaults, schema: page.schema })),
    globals: { header: header?.schema, footer: footer?.schema },
    content: options.content || {},
    settings: options.settings || {},
    media: options.media || {},
    collections: stripInternalCollectionMetadata(options.collections || {}),
    contentRevisionId: options.contentRevisionId ?? null,
    settingsRevisionId: options.settingsRevisionId ?? null,
    generatedAt: options.generatedAt || new Date().toISOString(),
  }
}

export async function validateVersion(db: SupabaseClient, versionId: string) {
  const document = await loadEditorDocument(db, versionId)
  const [{ data: media }, { data: version }] = await Promise.all([
    db.from('media').select('id'),
    db.from('layout_versions').select('runtime_min_version,revision_token').eq('id', versionId).maybeSingle(),
  ])
  const validated = validateEditorDocument(document, { runtimeVersion: RUNTIME_VERSION, runtimeMinVersion: version?.runtime_min_version || '1.0.0', mediaIds: new Set((media || []).map((row: any) => row.id)) })
  const revisionToken = document.revisionToken
  const result = revisionToken && revisionToken === version?.revision_token ? validated : finalize([...validated.issues, {
    severity: 'error', code: 'draft.changed-during-validation', message: 'Draft changed during validation. Revalidate before publishing.',
  }])
  await db.from('layout_validation_results').insert({ layout_version_id: versionId, valid: result.valid, issues: result.issues })
  return { document, result, revisionToken }
}

export async function validateRelease(db: SupabaseClient, release: any) {
  const document = await loadEditorDocument(db, release.layout_version_id)
  const contentRevisionQuery = release.content_revision_id
    ? db.from('content_revisions').select('*').eq('id', release.content_revision_id).maybeSingle()
    : Promise.resolve({ data: null })
  const settingsRevisionQuery = release.settings_revision_id
    ? db.from('settings_revisions').select('*').eq('id', release.settings_revision_id).maybeSingle()
    : Promise.resolve({ data: null })
  const [{ data: contentRevision }, { data: settingsRevision }, { data: version }] = await Promise.all([
    contentRevisionQuery,
    settingsRevisionQuery,
    db.from('layout_versions').select('status,schema_version,runtime_min_version').eq('id', release.layout_version_id).maybeSingle(),
  ])

  const deployedRuntimeVersion = getDeployedPublicRuntimeVersion()
  let mediaIds = new Set<string>()
  const integrityIssues: ValidationIssue[] = []
  if (Number(release.media_snapshot_version || 0) === 1) {
    try { mediaIds = new Set((await loadReleaseMediaReferences(db, release.id)).map((ref) => ref.media_id)) }
    catch (error) { integrityIssues.push({ severity: 'error', code: 'release.media-reference-load-failed', message: error instanceof Error ? error.message : 'Failed to load release media references.' }) }
  } else {
    integrityIssues.push({ severity: 'error', code: 'release.media-uncertified', message: 'Release media accounting is not certified. Certify the exact release snapshot before validation.' })
  }

  const candidate = validateReleaseCandidate(document, contentRevision?.values_json || {}, {
    runtimeVersion: deployedRuntimeVersion || '0.0.0',
    runtimeMinVersion: version?.runtime_min_version || '1.0.0',
    mediaIds,
    settings: release.settings_snapshot || {},
    collections: stripInternalCollectionMetadata(release.collections_snapshot || {}),
  })

  try {
    const hasFrozenSchemaSnapshot = Array.isArray(release.collections_snapshot?.[COLLECTION_SCHEMA_SNAPSHOT_KEY])
    const frozenDefinitions = definitionsFromSnapshot(release.collections_snapshot || {})
    if (hasFrozenSchemaSnapshot) {
      for (const entry of validateCollectionSnapshotIntegrity(stripInternalCollectionMetadata(release.collections_snapshot || {}), frozenDefinitions)) {
        integrityIssues.push({ severity: entry.severity, code: entry.code, message: entry.message })
      }
    } else {
      integrityIssues.push({ severity: 'warning', code: 'release.collection-schema-snapshot-missing', message: 'This legacy release predates frozen custom collection schemas; custom collection schema integrity cannot be revalidated immutably.' })
    }
  } catch (error) {
    integrityIssues.push({ severity: 'error', code: 'release.collection-schema-snapshot-invalid', message: error instanceof Error ? error.message : 'Frozen custom collection schemas are invalid.' })
  }

  if (!deployedRuntimeVersion) integrityIssues.push({ severity: 'error', code: 'runtime.deployment-version-missing', message: 'PUBLIC_WEB_RUNTIME_VERSION must identify the deployed Public Web runtime before a release can be validated or activated.' })
  if (version?.status !== 'published') integrityIssues.push({ severity: 'error', code: 'release.layout-unpublished', message: 'Release layout version is not published.' })
  if (contentRevision?.status !== 'published') integrityIssues.push({ severity: 'error', code: 'release.content-unpublished', message: 'Release content revision is not published.' })
  if (settingsRevision?.status !== 'published') integrityIssues.push({ severity: 'error', code: 'release.settings-unpublished', message: 'Release settings revision is not published.' })
  if (version && (release.layout_schema_version !== version.schema_version || release.runtime_min_version !== version.runtime_min_version)) integrityIssues.push({ severity: 'error', code: 'release.compatibility-snapshot-mismatch', message: 'Release compatibility data no longer matches its layout version.' })
  if (settingsRevision && JSON.stringify(release.settings_snapshot || {}) !== JSON.stringify(settingsRevision.values_json || {})) integrityIssues.push({ severity: 'error', code: 'release.settings-snapshot-mismatch', message: 'Release settings snapshot does not match its settings revision.' })

  if (Number(release.media_snapshot_version || 0) === 1) {
    const { data: mediaReferences, error: mediaReferencesError } = await db
      .from('release_media_references')
      .select('media_id,storage_path,bucket_id,mime_type,size')
      .eq('site_release_id', release.id)
    if (mediaReferencesError) {
      integrityIssues.push({ severity: 'error', code: 'release.media-reference-load-failed', message: `Failed to load release media references: ${mediaReferencesError.message}` })
    } else if (mediaReferences?.length) {
      const ids = mediaReferences.map((ref: any) => ref.media_id)
      const { data: canonicalMedia, error: mediaError } = await db.from('media').select('id,storage_path,mime_type,size').in('id', ids)
      if (mediaError) integrityIssues.push({ severity: 'error', code: 'release.media-reference-load-failed', message: `Failed to load canonical media: ${mediaError.message}` })
      else {
        const canonicalMap = new Map((canonicalMedia || []).map((row: any) => [row.id, row]))
        for (const ref of mediaReferences) {
          const canonical: any = canonicalMap.get(ref.media_id)
          if (!canonical) integrityIssues.push({ severity: 'error', code: 'release.media-missing', message: `Release media reference ${ref.media_id} has no canonical media row.` })
          else if (canonical.storage_path !== ref.storage_path || canonical.mime_type !== ref.mime_type || canonical.size !== ref.size || ref.bucket_id !== 'public-media') integrityIssues.push({ severity: 'error', code: 'release.media-identity-mismatch', message: `Release media reference ${ref.media_id} captured identity does not match canonical media state.` })
        }
      }
    }
    integrityIssues.push(...await validateReleaseStorageObjects(db, release))
  }

  const result = finalize([...candidate.issues, ...integrityIssues])
  return {
    document,
    contentRevision: contentRevision as ContentRevision | null,
    result,
    runtimeMinVersion: version?.runtime_min_version || release.runtime_min_version || '1.0.0',
    runtimeVersion: deployedRuntimeVersion || '0.0.0',
  }
}

export async function getActiveManifest(db: SupabaseClient): Promise<RuntimeManifest | null> {
  const { data: release, error } = await db.from('site_releases').select('*').eq('status', 'active').maybeSingle()
  if (error) throw new Error(error.message)
  if (!release) return null
  const document = await loadEditorDocument(db, release.layout_version_id)
  const contentRevisionQuery = release.content_revision_id
    ? db.from('content_revisions').select('*').eq('id', release.content_revision_id).maybeSingle()
    : Promise.resolve({ data: null })
  const [{ data: contentRevision }, { data: version }] = await Promise.all([
    contentRevisionQuery,
    db.from('layout_versions').select('runtime_min_version').eq('id', release.layout_version_id).maybeSingle(),
  ])
  const media = await getReleaseMediaMap(db, release)
  return manifestFromDocument(document, {
    releaseId: release.id,
    releaseNumber: release.release_number,
    mediaSnapshotVersion: Number(release.media_snapshot_version || 0),
    content: contentRevision?.values_json || {},
    settings: release.settings_snapshot || {},
    media,
    collections: release.collections_snapshot || {},
    contentRevisionId: release.content_revision_id,
    settingsRevisionId: release.settings_revision_id,
    runtimeMinVersion: version?.runtime_min_version || '1.0.0',
    generatedAt: release.activated_at || release.created_at || undefined,
  })
}

export async function audit(db: SupabaseClient, actorId: string | null, action: string, resourceType: string, resourceId: string | null, after?: unknown, before?: unknown, metadata?: Record<string, unknown>) {
  await db.from('audit_logs').insert({ actor_user_id: actorId, action, resource_type: resourceType, resource_id: resourceId, before_json: before, after_json: after, metadata: metadata || {} })
}

export function nextRevisionNumber(rows: Array<{ revision_number: number }> | null | undefined): number {
  return Math.max(0, ...(rows || []).map((row) => row.revision_number || 0)) + 1
}
