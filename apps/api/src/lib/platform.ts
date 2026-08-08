import type { SupabaseClient } from '@supabase/supabase-js'
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
} from '@platform/contracts'
import { collectContentSlots, finalize, validateEditorDocument, validateReleaseCandidate } from '@platform/validation'

export const SAMPLE_COLLECTIONS: Record<string, unknown[]> = {
  projects: [
    { id: 'sample-project-1', slug: 'visual-build', title: 'VisualBuild', short_description: 'A visual development framework that generates readable React/TypeScript source.', full_description: 'A production-style sample project used for layout preview.', technologies: ['React', 'TypeScript', 'Node.js'], featured: true, published: true, display_order: 1 },
    { id: 'sample-project-2', slug: 'document-platform', title: 'Document Platform', short_description: 'Secure nested document management with authentication and activity history.', full_description: 'Sample project details.', technologies: ['React', 'Express', 'MongoDB'], featured: true, published: true, display_order: 2 },
    { id: 'sample-project-3', slug: 'portfolio-studio', title: 'Portfolio Studio', short_description: 'A visual design and publishing platform for a dynamic portfolio.', full_description: 'Sample project details.', technologies: ['React', 'Supabase', 'TypeScript'], featured: true, published: true, display_order: 3 },
  ],
  notes: [
    { id: 'sample-note-1', slug: 'building-runtime-renderers', title: 'Building Runtime Renderers', summary: 'Notes on keeping editor and production rendering aligned.', content: 'Sample note content.', category: 'Engineering', tags: ['React', 'Architecture'], published: true, display_order: 1 },
    { id: 'sample-note-2', slug: 'smooth-scroll-animation', title: 'Smooth Scroll Animation', summary: 'Practical notes on performant scroll-linked UI.', content: 'Sample note content.', category: 'Frontend', tags: ['Animation'], published: true, display_order: 2 },
  ],
  experience: [
    { id: 'sample-exp-1', company: 'SpearHub', role: 'Web Developer', start_date: '2024-07-01', end_date: '2025-10-01', current: false, summary: 'Built ERP, onboarding, operator and documentation experiences.', technologies: ['React', 'Next.js', 'Node.js'], published: true, display_order: 1 },
    { id: 'sample-exp-2', company: 'Independent', role: 'Full Stack Developer', start_date: '2023-12-01', current: true, summary: 'Building full-stack products and developer tooling.', technologies: ['TypeScript', 'React', 'Supabase'], published: true, display_order: 2 },
  ],
  apps: [
    { id: 'sample-app-1', slug: 'global-job-matcher', name: 'Global Job Matcher', short_description: 'Resume-aware job matching application.', status: 'coming_soon', published: true, featured: true, display_order: 1 },
    { id: 'sample-app-2', slug: 'code-explainer', name: 'Code Explanation Agent', short_description: 'Explain code and architecture clearly.', status: 'coming_soon', published: true, featured: true, display_order: 2 },
  ],
}

export function dbPageToEditorPage(row: any): EditorPage {
  const schema = typeof row.layout_tree === 'string' ? JSON.parse(row.layout_tree) : row.layout_tree
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    pageType: row.page_type,
    routePattern: row.route_pattern || (row.slug === 'home' ? '/' : `/${row.slug}`),
    seoDefaults: row.seo_defaults || {},
    sortOrder: row.sort_order || 0,
    schema: { ...schema, schemaVersion: schema?.schemaVersion || LAYOUT_SCHEMA_VERSION, pageId: row.id },
  }
}

export function editorPageToDb(page: EditorPage, versionId: string) {
  return {
    id: page.id,
    layout_version_id: versionId,
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
  return {
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
  }
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
  return { projects, notes, experience, apps }
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

export function sampleContentForDocument(document: EditorDocument): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  collectContentSlots(document).forEach((slot) => {
    if (slot.sample !== undefined) values[slot.key] = slot.sample
    else if (slot.fallback !== undefined) values[slot.key] = slot.fallback
    else if (slot.contentType === 'boolean') values[slot.key] = false
    else if (slot.contentType === 'number') values[slot.key] = 0
    else values[slot.key] = slot.label
  })
  return values
}

export function manifestFromDocument(document: EditorDocument, options: {
  releaseId?: string | null
  releaseNumber?: number
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  media?: RuntimeManifest['media']
  collections?: Record<string, unknown[]>
  contentRevisionId?: string | null
  runtimeMinVersion?: string
} = {}): RuntimeManifest {
  const header = document.pages.find((page) => page.pageType === 'system' && page.slug === '_header')
  const footer = document.pages.find((page) => page.pageType === 'system' && page.slug === '_footer')
  const ordinary = document.pages.filter((page) => page.pageType !== 'system').sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    releaseId: options.releaseId ?? null,
    releaseNumber: options.releaseNumber,
    layoutVersionId: document.versionId,
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    runtimeMinVersion: options.runtimeMinVersion || '1.0.0',
    designTokens: document.designTokens || DEFAULT_DESIGN_TOKENS,
    routes: ordinary.map((page) => ({ path: page.routePattern, pageId: page.id, slug: page.slug, name: page.name, pageType: page.pageType, collectionName: page.schema.collectionName, seo: page.seoDefaults, schema: page.schema })),
    globals: { header: header?.schema, footer: footer?.schema },
    content: options.content || {},
    settings: options.settings || {},
    media: options.media || {},
    collections: options.collections || {},
    contentRevisionId: options.contentRevisionId ?? null,
    generatedAt: new Date().toISOString(),
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
  const [{ data: contentRevision }, { data: media }, { data: version }] = await Promise.all([
    db.from('content_revisions').select('*').eq('id', release.content_revision_id).single(),
    db.from('media').select('id'),
    db.from('layout_versions').select('runtime_min_version').eq('id', release.layout_version_id).maybeSingle(),
  ])
  const result = validateReleaseCandidate(document, contentRevision?.values_json || {}, {
    runtimeVersion: RUNTIME_VERSION,
    runtimeMinVersion: version?.runtime_min_version || '1.0.0',
    mediaIds: new Set((media || []).map((row: any) => row.id)),
    settings: release.settings_snapshot || {},
    collections: release.collections_snapshot || {},
  })
  await db.from('release_validation_results').insert({ site_release_id: release.id, valid: result.valid, issues: result.issues })
  return { document, contentRevision: contentRevision as ContentRevision | null, result, runtimeMinVersion: version?.runtime_min_version || '1.0.0' }
}

export async function getActiveManifest(db: SupabaseClient): Promise<RuntimeManifest | null> {
  const { data: release, error } = await db.from('site_releases').select('*').eq('status', 'active').order('activated_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!release) return null
  const document = await loadEditorDocument(db, release.layout_version_id)
  const [{ data: contentRevision }, { data: version }] = await Promise.all([
    db.from('content_revisions').select('*').eq('id', release.content_revision_id).maybeSingle(),
    db.from('layout_versions').select('runtime_min_version').eq('id', release.layout_version_id).maybeSingle(),
  ])
  const media = release.media_snapshot && Object.keys(release.media_snapshot).length ? release.media_snapshot : await getMediaMap(db)
  return manifestFromDocument(document, {
    releaseId: release.id,
    releaseNumber: release.release_number,
    content: contentRevision?.values_json || {},
    settings: release.settings_snapshot || {},
    media,
    collections: release.collections_snapshot || {},
    contentRevisionId: release.content_revision_id,
    runtimeMinVersion: version?.runtime_min_version || '1.0.0',
  })
}

export async function audit(db: SupabaseClient, actorId: string | null, action: string, resourceType: string, resourceId: string | null, after?: unknown, before?: unknown, metadata?: Record<string, unknown>) {
  await db.from('audit_logs').insert({ actor_user_id: actorId, action, resource_type: resourceType, resource_id: resourceId, before_json: before, after_json: after, metadata: metadata || {} })
}

export function nextRevisionNumber(rows: Array<{ revision_number: number }> | null | undefined): number {
  return Math.max(0, ...(rows || []).map((row) => row.revision_number || 0)) + 1
}
