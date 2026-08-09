import 'dotenv/config'
import crypto from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { createServerSupabaseClients } from '@platform/supabase'
import { cloneNodeWithFreshIds, createBlankDocument, createCosmicPortfolioTemplate, slugify } from '@platform/builder-core'
import { ANIMATION_PRESETS } from '@platform/animation-runtime'
import { LAYOUT_SCHEMA_VERSION, RUNTIME_VERSION, type EditorDocument, type EditorPage } from '@platform/contracts'
import { buildContentCompatibility, collectContentSlots, isRuntimeCompatible, validateEditorDocument } from '@platform/validation'
import { createRequireAdmin, createRequireStudio, type AuthedRequest } from './lib/auth'
import { evaluateLayoutLifecycle } from './lib/layout-lifecycle'
import { loadProjectGallery, normalizeStructuredMediaInput, replaceProjectGallery } from './lib/structured-media'
import {
  SAMPLE_COLLECTIONS, audit, collectReferencedMediaIds, editorPageToDb, getActiveManifest, getMediaMap, getPublishedCollections,
  getSettingsObject, loadEditorDocument, manifestFromDocument, nextRevisionNumber, sampleContentForDocument,
  validateRelease, validateVersion,
} from './lib/platform'

const { supabaseAdmin } = createServerSupabaseClients(process.env)
const app = express()
const PORT = Number(process.env.PORT || 4000)
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true'
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:5173')
  .split(',').map((value) => value.trim()).filter(Boolean)

app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error(`Origin ${origin} is not allowed`)) }, credentials: true }))
app.use(express.json({ limit: '12mb' }))

const asyncRoute = (handler: (req: any, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next)
const requireAdmin = createRequireAdmin(supabaseAdmin, DEV_BYPASS_AUTH)
const requireStudio = createRequireStudio(supabaseAdmin, DEV_BYPASS_AUTH)
const adminRouter = express.Router()
const studioRouter = express.Router()
adminRouter.use(requireAdmin)
studioRouter.use(requireStudio)

app.get('/health', (_req, res) => res.json({ status: 'ok', platformVersion: '0.5.0', runtimeVersion: RUNTIME_VERSION, authBypass: DEV_BYPASS_AUTH, timestamp: new Date().toISOString() }))

function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function pick(source: Record<string, unknown>, keys: string[]) { return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])) }
function actorId(req: AuthedRequest): string | null { return req.actor?.id || null }
function isCreatedLayoutDocument(value: unknown): value is { layout_id: string; version_id: string; layout_slug: string } {
  const row = asObject(value)
  return typeof row.layout_id === 'string' && typeof row.version_id === 'string' && typeof row.layout_slug === 'string'
}
function jsonContainsExactValue(value: unknown, target: string): boolean {
  if (value === target) return true
  if (Array.isArray(value)) return value.some((item) => jsonContainsExactValue(item, target))
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some((item) => jsonContainsExactValue(item, target))
  return false
}

// ---------------------------------------------------------------------------
// Public runtime + public structured APIs
// ---------------------------------------------------------------------------
app.get('/api/public/runtime', asyncRoute(async (_req, res) => {
  const manifest = await getActiveManifest(supabaseAdmin)
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  res.json({ data: manifest })
}))

app.get('/api/public/manifest', asyncRoute(async (_req, res) => {
  const manifest = await getActiveManifest(supabaseAdmin)
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  res.json({ data: manifest })
}))

app.get('/api/public/runtime/page/:slug', asyncRoute(async (req, res) => {
  const manifest = await getActiveManifest(supabaseAdmin)
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  const slug = req.params.slug === 'home' ? 'home' : req.params.slug
  const route = manifest.routes.find((item) => item.slug === slug)
  if (!route) return res.status(404).json({ error: 'Page not found' })
  res.json({ data: { route, globals: manifest.globals, designTokens: manifest.designTokens, content: manifest.content, settings: manifest.settings, media: manifest.media, collections: manifest.collections } })
}))

function publicCollection(table: string, orderField = 'display_order') {
  return asyncRoute(async (req, res) => {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact' }).eq('published', true).order(orderField, { ascending: true })
    if (req.query.featured === 'true') query = query.eq('featured', true)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)))
    query = query.limit(limit)
    const { data, error, count } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json({ data: data || [], meta: { total: count || 0, page: 1, limit } })
  })
}
app.get('/api/public/projects', publicCollection('projects'))
app.get('/api/public/notes', publicCollection('notes'))
app.get('/api/public/experience', publicCollection('experiences'))
app.get('/api/public/apps', publicCollection('ai_apps'))
app.get('/api/public/projects/:slug', asyncRoute(async (req, res) => { const { data, error } = await supabaseAdmin.from('projects').select('*').eq('slug', req.params.slug).eq('published', true).maybeSingle(); if (error || !data) return res.status(404).json({ error: 'Project not found' }); res.json({ data }) }))
app.get('/api/public/notes/:slug', asyncRoute(async (req, res) => { const { data, error } = await supabaseAdmin.from('notes').select('*').eq('slug', req.params.slug).eq('published', true).maybeSingle(); if (error || !data) return res.status(404).json({ error: 'Note not found' }); res.json({ data }) }))

// ---------------------------------------------------------------------------
// Studio APIs — design authoring, persistence, validation, publishing
// ---------------------------------------------------------------------------
studioRouter.get('/me', (req: AuthedRequest, res) => res.json({ data: req.actor }))

studioRouter.get('/layouts', asyncRoute(async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('layouts').select('*').neq('status', 'archived').order('updated_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const layoutIds = (data || []).map((layout: any) => layout.id)
  if (!layoutIds.length) return res.json({ data: [] })
  const { data: versions, error: versionError } = await supabaseAdmin.from('layout_versions').select('id,layout_id,version_number,status,created_at,published_at').in('layout_id', layoutIds).order('version_number', { ascending: false })
  if (versionError) return res.status(400).json({ error: versionError.message })
  const versionIds = (versions || []).map((version: any) => version.id)
  const [releaseResult, workspaceResult, pageResult, validationResult] = versionIds.length ? await Promise.all([
    supabaseAdmin.from('site_releases').select('layout_version_id').in('layout_version_id', versionIds),
    supabaseAdmin.from('admin_workspace').select('configuring_layout_version_id').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('layout_pages').select('layout_version_id').in('layout_version_id', versionIds),
    supabaseAdmin.from('layout_validation_results').select('layout_version_id').in('layout_version_id', versionIds),
  ]) : [{ data: [] }, { data: null }, { data: [] }, { data: [] }] as any
  const dependencyError = releaseResult.error || workspaceResult.error || pageResult.error || validationResult.error
  if (dependencyError) return res.status(400).json({ error: dependencyError.message })
  const releaseVersionIds = new Set<string>((releaseResult.data || []).map((row: any) => String(row.layout_version_id)))
  const countByVersion = (rows: any[]) => rows.reduce((counts, row) => counts.set(row.layout_version_id, (counts.get(row.layout_version_id) || 0) + 1), new Map<string, number>())
  const pageCounts = countByVersion(pageResult.data || [])
  const validationCounts = countByVersion(validationResult.data || [])
  const enriched = (data || []).map((layout: any) => {
    const layoutVersions = (versions || []).filter((version: any) => version.layout_id === layout.id)
    const lifecycle = evaluateLayoutLifecycle({ versions: layoutVersions, releaseVersionIds, workspaceVersionId: workspaceResult.data?.configuring_layout_version_id || null, pageCounts, validationCounts })
    return { ...layout, versions: lifecycle.versions, lifecycle: { ...lifecycle, versions: undefined } }
  })
  res.json({ data: enriched })
}))

studioRouter.post('/layouts', asyncRoute(async (req: AuthedRequest, res) => {
  const template = req.body.template === 'cosmic' ? 'cosmic' : 'blank'
  let document: EditorDocument = req.body.document || (template === 'cosmic' ? createCosmicPortfolioTemplate() : createBlankDocument(req.body.name || 'Untitled Layout'))
  const layoutName = String(req.body.name || document.layoutName).trim()
  if (!layoutName) return res.status(422).json({ error: 'Layout name is required' })
  document = { ...document, layoutName, layoutSlug: slugify(layoutName), layoutDescription: req.body.description ?? document.layoutDescription }
  const parsed = validateEditorDocument(document)
  if (!parsed.valid && parsed.errors.some((entry) => entry.code === 'schema.invalid')) return res.status(422).json({ error: 'Invalid layout document', validation: parsed })

  const { data: created, error: createError } = await supabaseAdmin.rpc('create_layout_document', {
    layout_name_value: document.layoutName,
    layout_slug_base_value: document.layoutSlug,
    layout_description_value: document.layoutDescription || '',
    schema_version_value: LAYOUT_SCHEMA_VERSION,
    runtime_min_version_value: RUNTIME_VERSION,
    design_tokens_value: document.designTokens,
    pages_value: document.pages.map((page) => editorPageToDb(page)),
    actor_user_id: actorId(req),
  }).single()
  if (createError || !isCreatedLayoutDocument(created)) {
    console.error('Atomic layout creation failed', createError)
    if (createError?.message.includes('Layout name is required') || createError?.message.includes('at least one page')) return res.status(422).json({ error: createError.message })
    if (createError?.code === '23505') return res.status(409).json({ error: 'The starter document conflicts with existing layout data. Retry creation.' })
    return res.status(400).json({ error: 'Layout creation failed. No layout was created.' })
  }
  await audit(supabaseAdmin, actorId(req), 'layout_created', 'layout', created.layout_id, { name: document.layoutName, slug: created.layout_slug, version_id: created.version_id })
  const saved = await loadEditorDocument(supabaseAdmin, created.version_id)
  res.status(201).json({ data: saved })
}))

studioRouter.get('/layouts/:id/editor', asyncRoute(async (req, res) => {
  const { data: versions, error } = await supabaseAdmin.from('layout_versions').select('*').eq('layout_id', req.params.id).order('version_number', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const selected = (versions || []).find((version: any) => version.status === 'draft') || (versions || [])[0]
  if (!selected) return res.status(404).json({ error: 'Layout has no versions' })
  const document = await loadEditorDocument(supabaseAdmin, selected.id)
  res.json({ data: document, readOnly: selected.status !== 'draft' })
}))

studioRouter.get('/layouts/:layoutId/versions/:versionId/editor', asyncRoute(async (req, res) => {
  const { data: version, error } = await supabaseAdmin.from('layout_versions').select('id,status').eq('id', req.params.versionId).eq('layout_id', req.params.layoutId).maybeSingle()
  if (error) { console.error('Studio editor route lookup failed', error); return res.status(400).json({ error: 'Unable to load the requested layout version' }) }
  if (!version) return res.status(404).json({ error: 'Layout version not found for this layout' })
  const document = await loadEditorDocument(supabaseAdmin, version.id)
  res.json({ data: document, readOnly: version.status !== 'draft' })
}))

studioRouter.post('/layouts/:id/drafts', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: versions, error } = await supabaseAdmin.from('layout_versions').select('*').eq('layout_id', req.params.id).order('version_number', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const existingDraft = (versions || []).find((version: any) => version.status === 'draft')
  if (existingDraft) return res.json({ data: await loadEditorDocument(supabaseAdmin, existingDraft.id) })
  const source = (versions || [])[0]
  if (!source) return res.status(404).json({ error: 'No source version found' })
  const sourceDoc = await loadEditorDocument(supabaseAdmin, source.id)
  const nextVersion = Math.max(...(versions || []).map((version: any) => version.version_number), 0) + 1
  const { data: draft, error: draftError } = await supabaseAdmin.from('layout_versions').insert({ layout_id: req.params.id, version_number: nextVersion, schema_version: LAYOUT_SCHEMA_VERSION, runtime_min_version: RUNTIME_VERSION, status: 'draft', design_tokens: sourceDoc.designTokens, created_by: actorId(req), changelog: `Draft from v${source.version_number}` }).select().single()
  if (draftError) return res.status(400).json({ error: draftError.message })
  const pages: EditorPage[] = sourceDoc.pages.map((page) => { const id = crypto.randomUUID(); return { ...page, id, schema: { ...page.schema, pageId: id } } })
  const { error: copyError } = await supabaseAdmin.from('layout_pages').insert(pages.map((page) => editorPageToDb(page, draft.id)))
  if (copyError) return res.status(400).json({ error: copyError.message })
  await audit(supabaseAdmin, actorId(req), 'layout_draft_created', 'layout_version', draft.id, { source_version_id: source.id })
  res.status(201).json({ data: await loadEditorDocument(supabaseAdmin, draft.id) })
}))

studioRouter.post('/layouts/:id/duplicate', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: versions, error } = await supabaseAdmin.from('layout_versions').select('*').eq('layout_id', req.params.id).order('version_number', { ascending: false })
  if (error) return res.status(400).json({ error:error.message })
  let source: any = null
  for (const version of versions || []) {
    const { count } = await supabaseAdmin.from('layout_pages').select('id', { count:'exact', head:true }).eq('layout_version_id', version.id)
    if ((count || 0) > 0) { source = version; break }
  }
  if (!source) return res.status(409).json({ error:'Layout has no readable version to duplicate' })
  const sourceDoc = await loadEditorDocument(supabaseAdmin, source.id)
  const name = String(req.body.name || `${sourceDoc.layoutName} Copy`).trim() || `${sourceDoc.layoutName} Copy`
  const pages: EditorPage[] = sourceDoc.pages.map((page) => { const id=crypto.randomUUID(); return { ...page, id, schema:{ ...page.schema, pageId:id, root:page.schema.root.map(cloneNodeWithFreshIds) } } })
  const { data: created, error: createError } = await supabaseAdmin.rpc('create_layout_document', {
    layout_name_value:name, layout_slug_base_value:slugify(name), layout_description_value:sourceDoc.layoutDescription || '', schema_version_value:LAYOUT_SCHEMA_VERSION,
    runtime_min_version_value:RUNTIME_VERSION, design_tokens_value:sourceDoc.designTokens, pages_value:pages.map((page)=>editorPageToDb(page)), actor_user_id:actorId(req),
  }).single()
  if (createError || !isCreatedLayoutDocument(created)) return res.status(400).json({ error:'Layout duplication failed. No copy was created.' })
  await audit(supabaseAdmin,actorId(req),'layout_duplicated','layout',created.layout_id,{source_layout_id:req.params.id,source_version_id:source.id})
  res.status(201).json({ data:await loadEditorDocument(supabaseAdmin,created.version_id) })
}))

studioRouter.put('/versions/:id/document', asyncRoute(async (req: AuthedRequest, res) => {
  const versionId = req.params.id
  const { data: version, error: versionError } = await supabaseAdmin.from('layout_versions').select('*, layouts(*)').eq('id', versionId).single()
  if (versionError || !version) return res.status(404).json({ error: 'Version not found' })
  if (version.status !== 'draft') return res.status(409).json({ error: 'Published/archived versions are immutable. Create a new draft.' })
  const document = req.body.document as EditorDocument
  const candidate = { ...document, layoutId: version.layout_id, versionId, versionNumber: version.version_number, versionStatus: 'draft' as const }
  const parsed = validateEditorDocument(candidate)
  const structuralErrors = parsed.errors.filter((entry) => entry.code.startsWith('schema.') || entry.code === 'node.id-duplicate' || entry.code === 'node.cycle')
  if (structuralErrors.length) return res.status(422).json({ error: 'Document contains structural errors', validation: parsed })
  const { error: saveError } = await supabaseAdmin.rpc('save_layout_document', {
    target_layout_id: version.layout_id,
    target_version_id: versionId,
    layout_name: candidate.layoutName,
    layout_slug: slugify(candidate.layoutSlug || candidate.layoutName),
    layout_description: candidate.layoutDescription || '',
    schema_version_value: LAYOUT_SCHEMA_VERSION,
    runtime_min_version_value: RUNTIME_VERSION,
    design_tokens_value: candidate.designTokens,
    changelog_value: req.body.changelog ?? version.changelog,
    pages_value: candidate.pages.map((page) => editorPageToDb(page, versionId)),
  })
  if (saveError) return res.status(saveError.message.includes('immutable') ? 409 : 400).json({ error: saveError.message })
  await audit(supabaseAdmin, actorId(req), 'layout_draft_saved', 'layout_version', versionId, { page_count: candidate.pages.length })
  res.json({ data: await loadEditorDocument(supabaseAdmin, versionId), validation: parsed })
}))

studioRouter.post('/versions/:id/validate', asyncRoute(async (req, res) => {
  const { document, result } = await validateVersion(supabaseAdmin, req.params.id)
  res.status(result.valid ? 200 : 422).json({ data: { document, validation: result } })
}))

studioRouter.post('/versions/:id/publish', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: version } = await supabaseAdmin.from('layout_versions').select('*').eq('id', req.params.id).maybeSingle()
  if (!version) return res.status(404).json({ error: 'Version not found' })
  if (version.status === 'published') return res.json({ data: version, message: 'Already published' })
  if (version.status !== 'draft') return res.status(409).json({ error: 'Only draft versions can be published' })
  const { result, revisionToken } = await validateVersion(supabaseAdmin, req.params.id)
  if (!result.valid) return res.status(422).json({ error: 'Publishing blocked by validation errors', validation: result })
  const thumbnail = typeof req.body.thumbnail_data === 'string' ? req.body.thumbnail_data.slice(0, 700000) : null
  const { data: published, error } = await supabaseAdmin.rpc('publish_layout_version', {
    target_version_id: req.params.id,
    expected_revision_token: revisionToken,
    thumbnail_value: thumbnail,
    changelog_value: String(req.body.changelog || version.changelog || 'Published from Studio'),
  })
  if (error) return res.status(error.message.includes('Revalidate before publishing') ? 409 : 400).json({ error: error.message })
  await audit(supabaseAdmin, actorId(req), 'layout_published', 'layout_version', req.params.id, { version_number: published.version_number })
  res.json({ data: { published, document: await loadEditorDocument(supabaseAdmin, req.params.id) }, validation: result })
}))

studioRouter.patch('/layouts/:id/rename', asyncRoute(async (req: AuthedRequest, res) => {
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(422).json({ error:'Layout name is required' })
  const { data, error } = await supabaseAdmin.rpc('rename_layout_document', { target_layout_id:req.params.id, layout_name_value:name, layout_slug_base_value:slugify(name), actor_user_id:actorId(req) }).single()
  if (error) return res.status(error.message.includes('not found')?404:400).json({ error:error.message })
  res.json({ data })
}))

studioRouter.patch('/layouts/:id/archive', asyncRoute(async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin.rpc('archive_layout_document', { target_layout_id:req.params.id, actor_user_id:actorId(req) }).single()
  if (error) return res.status(error.message.includes('not found')?404:400).json({ error:error.message })
  res.json({ data })
}))

studioRouter.delete('/layouts/:id', requireAdmin, asyncRoute(async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin.rpc('delete_layout_if_safe', { target_layout_id:req.params.id, actor_user_id:actorId(req) })
  if (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('cannot be permanently deleted') || error.message.includes('Admin workspace') ? 409 : 400
    return res.status(status).json({ error:error.message })
  }
  res.json({ data })
}))

studioRouter.delete('/layouts/:layoutId/versions/:versionId', requireAdmin, asyncRoute(async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin.rpc('discard_layout_draft_if_safe', { target_layout_id:req.params.layoutId, target_version_id:req.params.versionId, actor_user_id:actorId(req) })
  if (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('cannot be discarded') || error.message.includes('Only draft') || error.message.includes('only layout version') ? 409 : 400
    return res.status(status).json({ error:error.message })
  }
  res.json({ data })
}))

studioRouter.get('/bindings/registry', asyncRoute(async (req, res) => {
  const versionId = String(req.query.versionId || '')
  if (!versionId) return res.json({ data: [] })
  const doc = await loadEditorDocument(supabaseAdmin, versionId)
  res.json({ data: collectContentSlots(doc) })
}))
studioRouter.get('/collections', (_req, res) => res.json({ data: [
  { id: 'projects', label: 'Projects' }, { id: 'notes', label: 'Notes' }, { id: 'experience', label: 'Experience' }, { id: 'apps', label: 'AI Apps' },
] }))
studioRouter.get('/animations', (_req, res) => res.json({ data: ANIMATION_PRESETS }))
studioRouter.get('/scroll-behaviors', (_req, res) => res.json({ data: ['normal','sticky','pin','stack-over-previous','parallax','horizontal','reveal'] }))

// ---------------------------------------------------------------------------
// Admin CRUD + visual content + layouts + releases
// ---------------------------------------------------------------------------
adminRouter.get('/me', (req: AuthedRequest, res) => res.json({ data: req.actor }))
adminRouter.get('/dashboard', asyncRoute(async (_req, res) => {
  const tables = ['projects','notes','experiences','ai_apps','media','layouts','content_revisions','site_releases']
  const results = await Promise.all(tables.map(async (table) => { const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }); return [table, count || 0] }))
  const { data: active } = await supabaseAdmin.from('site_releases').select('id,release_number,layout_version_id,activated_at').eq('status','active').maybeSingle()
  res.json({ data: { counts: Object.fromEntries(results), activeRelease: active || null } })
}))

adminRouter.post('/media/upload', asyncRoute(async (req: AuthedRequest, res) => {
  const filename=String(req.body.filename||'').replace(/[^a-zA-Z0-9._-]/g,'_')
  const mime=String(req.body.mime_type||'application/octet-stream')
  const raw=String(req.body.dataBase64||'').replace(/^data:[^;]+;base64,/,'')
  if(!filename||!raw)return res.status(400).json({error:'filename and dataBase64 are required'})
  const bytes=Buffer.from(raw,'base64');const max=8*1024*1024
  if(bytes.length>max)return res.status(413).json({error:'File exceeds the current 8 MB CMS upload limit'})
  const allowed=/^(image|video|audio)\//.test(mime)||['application/pdf','text/plain'].includes(mime)
  if(!allowed)return res.status(415).json({error:'Unsupported media MIME type'})
  const storagePath=`cms/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${filename}`
  const {error:uploadError}=await supabaseAdmin.storage.from('public-media').upload(storagePath,bytes,{contentType:mime,upsert:false})
  if(uploadError)return res.status(400).json({error:uploadError.message})
  const {data:urlData}=supabaseAdmin.storage.from('public-media').getPublicUrl(storagePath)
  const {data,error}=await supabaseAdmin.from('media').insert({filename,storage_path:storagePath,url:urlData.publicUrl,public_url:urlData.publicUrl,mime_type:mime,size_bytes:bytes.length,size:bytes.length,kind:mime.split('/')[0]||'file',alt_text:req.body.alt_text||''}).select().single()
  if(error){await supabaseAdmin.storage.from('public-media').remove([storagePath]);return res.status(400).json({error:error.message})}
  await audit(supabaseAdmin,actorId(req),'media_uploaded','media',data.id,data);res.status(201).json({data})
}))

const CRUD_CONFIG: Record<string, { table: string; keys: string[] }> = {
  projects: { table: 'projects', keys: ['slug','title','short_description','full_description','thumbnail','thumbnail_media_id','gallery','gallery_media_ids','technologies','github_url','live_url','featured','published','display_order','seo'] },
  notes: { table: 'notes', keys: ['slug','title','summary','content','category','tags','cover_image','cover_media_id','featured','published','display_order','seo'] },
  experience: { table: 'experiences', keys: ['company','role','employment_type','location','start_date','end_date','current','summary','responsibilities','technologies','logo','logo_media_id','display_order','published'] },
  apps: { table: 'ai_apps', keys: ['slug','name','short_description','full_description','icon','icon_media_id','cover_image','cover_media_id','category','tags','requires_login','status','published','featured','display_order'] },
  media: { table: 'media', keys: ['filename','storage_path','public_url','mime_type','size','kind','width','height','duration','alt_text'] },
}
for (const [resource, config] of Object.entries(CRUD_CONFIG)) {
  adminRouter.get(`/${resource}`, asyncRoute(async (_req, res) => { const { data, error } = await supabaseAdmin.from(config.table).select('*').order(resource === 'media' ? 'created_at' : 'display_order', { ascending: true }); if (error) return res.status(400).json({ error: error.message }); if (resource !== 'projects') return res.json({ data: data || [] }); const gallery = await loadProjectGallery(supabaseAdmin, (data || []).map((row: any) => row.id)); res.json({ data: (data || []).map((row: any) => ({ ...row, gallery_media: gallery.get(row.id) || [], gallery_media_ids: (gallery.get(row.id) || []).map((entry: any) => entry.media_id) })) }) }))
  adminRouter.post(`/${resource}`, asyncRoute(async (req: AuthedRequest, res) => {
    const requested = pick(asObject(req.body), config.keys)
    const galleryMediaIds = requested.gallery_media_ids
    delete requested.gallery_media_ids
    const body = await normalizeStructuredMediaInput(supabaseAdmin, resource, requested)
    if ((resource === 'projects' || resource === 'notes' || resource === 'apps') && !body.slug) body.slug = slugify(String(body.title || body.name || 'item'))
    const { data, error } = await supabaseAdmin.from(config.table).insert(body).select().single(); if (error) return res.status(400).json({ error: error.message })
    if (resource === 'projects' && Array.isArray(galleryMediaIds)) { const gallery = await replaceProjectGallery(supabaseAdmin, data.id, galleryMediaIds); const { data: updated, error: updateError } = await supabaseAdmin.from(config.table).update({ gallery }).eq('id', data.id).select().single(); if (updateError) return res.status(400).json({ error: updateError.message }); Object.assign(data, updated, { gallery_media_ids: galleryMediaIds }) }
    await audit(supabaseAdmin, actorId(req), `${resource}_created`, resource, data.id, data); res.status(201).json({ data })
  }))
  adminRouter.patch(`/${resource}/:id`, asyncRoute(async (req: AuthedRequest, res) => { const requested = pick(asObject(req.body), config.keys); const galleryMediaIds = requested.gallery_media_ids; delete requested.gallery_media_ids; const body = await normalizeStructuredMediaInput(supabaseAdmin, resource, requested); const { data: before } = await supabaseAdmin.from(config.table).select('*').eq('id', req.params.id).maybeSingle(); const { data, error } = await supabaseAdmin.from(config.table).update(body).eq('id', req.params.id).select().single(); if (error) return res.status(400).json({ error: error.message }); if (resource === 'projects' && Array.isArray(galleryMediaIds)) { const gallery = await replaceProjectGallery(supabaseAdmin, req.params.id, galleryMediaIds); const { data: updated, error: updateError } = await supabaseAdmin.from(config.table).update({ gallery }).eq('id', req.params.id).select().single(); if (updateError) return res.status(400).json({ error: updateError.message }); Object.assign(data, updated, { gallery_media_ids: galleryMediaIds }) } await audit(supabaseAdmin, actorId(req), `${resource}_updated`, resource, req.params.id, data, before); res.json({ data }) }))
  adminRouter.delete(`/${resource}/:id`, asyncRoute(async (req: AuthedRequest, res) => {
    const { data: before } = await supabaseAdmin.from(config.table).select('*').eq('id', req.params.id).maybeSingle()
    if (resource === 'media') {
      const [{ data: releaseRefs }, { data: contentRefs }, { data: pageRefs }] = await Promise.all([
        supabaseAdmin.from('site_releases').select('id,status,media_snapshot').neq('status','archived'),
        supabaseAdmin.from('content_revisions').select('id,status,values_json').neq('status','archived'),
        supabaseAdmin.from('layout_pages').select('id,layout_tree'),
      ])
      const referencedByRelease = (releaseRefs || []).some((row: any) => Boolean(row.media_snapshot?.[req.params.id]))
      const referencedByContent = (contentRefs || []).some((row: any) => jsonContainsExactValue(row.values_json, req.params.id))
      const referencedByLayout = (pageRefs || []).some((row: any) => jsonContainsExactValue(row.layout_tree, req.params.id))
      if (referencedByRelease || referencedByContent || referencedByLayout) return res.status(409).json({ error: 'Media is still referenced by a layout, content revision, or release. Remove the reference before deleting the asset.' })
      if (before?.storage_path) {
        const { error: storageError } = await supabaseAdmin.storage.from('public-media').remove([before.storage_path])
        if (storageError) return res.status(400).json({ error: `Media storage delete failed: ${storageError.message}` })
      }
    }
    const { error } = await supabaseAdmin.from(config.table).delete().eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    await audit(supabaseAdmin, actorId(req), `${resource}_deleted`, resource, req.params.id, undefined, before)
    res.json({ data: { id: req.params.id } })
  }))
}

adminRouter.get('/settings', asyncRoute(async (_req, res) => { const { data, error } = await supabaseAdmin.from('site_settings').select('*').order('key'); if (error) return res.status(400).json({ error: error.message }); res.json({ data: data || [] }) }))
adminRouter.put('/settings/:key', asyncRoute(async (req: AuthedRequest, res) => { const key = decodeURIComponent(req.params.key); const value = req.body.value; const { data, error } = await supabaseAdmin.from('site_settings').upsert({ key, value_json: value, type: req.body.type || 'text', description: req.body.description || '', updated_by: actorId(req) }, { onConflict: 'key' }).select().single(); if (error) return res.status(400).json({ error: error.message }); await audit(supabaseAdmin, actorId(req), 'site_setting_changed', 'site_setting', data.id, data); res.json({ data }) }))
adminRouter.delete('/settings/:key', asyncRoute(async (req, res) => { const { error } = await supabaseAdmin.from('site_settings').delete().eq('key', decodeURIComponent(req.params.key)); if (error) return res.status(400).json({ error: error.message }); res.json({ data: true }) }))

adminRouter.get('/layouts', asyncRoute(async (_req, res) => {
  const { data: layouts, error } = await supabaseAdmin.from('layouts').select('*').eq('status','active').order('updated_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const { data: active } = await supabaseAdmin.from('site_releases').select('layout_version_id').eq('status','active').maybeSingle()
  const { data: workspace } = await supabaseAdmin.from('admin_workspace').select('*').eq('id',1).single()
  const cards = []
  for (const layout of layouts || []) {
    const { data: version } = await supabaseAdmin.from('layout_versions').select('*').eq('layout_id', layout.id).eq('status','published').order('version_number',{ascending:false}).limit(1).maybeSingle()
    if (!version) continue
    const { data: pages } = await supabaseAdmin.from('layout_pages').select('*').eq('layout_version_id',version.id).order('sort_order')
    cards.push({ layout, latestPublishedVersion: version, pageCount: (pages || []).filter((page: any) => page.page_type !== 'system').length, homePage: (pages || []).find((page: any) => page.page_type === 'home') || null, compatible: Number(version.schema_version) <= LAYOUT_SCHEMA_VERSION && isRuntimeCompatible(version.runtime_min_version || '1.0.0', RUNTIME_VERSION), isLive: active?.layout_version_id === version.id, isConfiguring: workspace?.configuring_layout_version_id === version.id })
  }
  res.json({ data: cards })
}))

adminRouter.post('/layouts/:versionId/configure', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: version } = await supabaseAdmin.from('layout_versions').select('*').eq('id', req.params.versionId).eq('status','published').maybeSingle()
  if (!version) return res.status(404).json({ error: 'Published layout version not found' })
  const { data, error } = await supabaseAdmin.from('admin_workspace').upsert({ id:1, configuring_layout_version_id: version.id, updated_by: actorId(req), updated_at:new Date().toISOString() }).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await audit(supabaseAdmin, actorId(req), 'layout_selected_for_configuration', 'layout_version', version.id, data)
  res.json({ data })
}))

adminRouter.get('/layouts/versions/:versionId/preview', asyncRoute(async (req, res) => {
  const document = await loadEditorDocument(supabaseAdmin, req.params.versionId)
  if (document.versionStatus !== 'published') return res.status(409).json({ error: 'Only published layouts can be previewed from Admin' })
  const [{ data: version }, media] = await Promise.all([
    supabaseAdmin.from('layout_versions').select('runtime_min_version').eq('id',req.params.versionId).maybeSingle(),
    getMediaMap(supabaseAdmin),
  ])
  const manifest = manifestFromDocument(document, { content: sampleContentForDocument(document), settings: { 'site.social.github':'https://github.com/','site.social.linkedin':'https://linkedin.com/' }, media, collections: SAMPLE_COLLECTIONS, runtimeMinVersion:version?.runtime_min_version||'1.0.0' })
  res.json({ data: manifest })
}))

adminRouter.post('/content-revisions/draft', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: existing } = await supabaseAdmin.from('content_revisions').select('*').eq('status','draft').order('revision_number',{ascending:false}).limit(1).maybeSingle()
  if (existing) return res.json({ data: existing })
  const { data: published } = await supabaseAdmin.from('content_revisions').select('*').eq('status','published').order('revision_number',{ascending:false}).limit(1).maybeSingle()
  let values = published?.values_json || {}
  if (!published) { const { data: rows } = await supabaseAdmin.from('site_content').select('key,value_json'); values = Object.fromEntries((rows || []).map((row:any) => [row.key,row.value_json])) }
  const { data: all } = await supabaseAdmin.from('content_revisions').select('revision_number')
  const { data, error } = await supabaseAdmin.from('content_revisions').insert({ revision_number: nextRevisionNumber(all), status:'draft', values_json:values, created_by:actorId(req) }).select().single()
  if (error) return res.status(400).json({ error:error.message })
  res.status(201).json({ data })
}))

adminRouter.get('/content/editor-context', asyncRoute(async (req, res) => {
  const requestedVersion = String(req.query.versionId || '')
  const { data: workspace } = await supabaseAdmin.from('admin_workspace').select('*').eq('id',1).single()
  const { data: active } = await supabaseAdmin.from('site_releases').select('*').eq('status','active').maybeSingle()
  const versionId = requestedVersion || workspace?.configuring_layout_version_id || active?.layout_version_id
  if (!versionId) return res.status(404).json({ error:'No layout selected for configuration and no active release' })
  const document = await loadEditorDocument(supabaseAdmin, versionId)
  const { data: draft } = await supabaseAdmin.from('content_revisions').select('*').eq('status','draft').order('revision_number',{ascending:false}).limit(1).maybeSingle()
  const { data: latestPublished } = await supabaseAdmin.from('content_revisions').select('*').eq('status','published').order('revision_number',{ascending:false}).limit(1).maybeSingle()
  const revision = draft || latestPublished
  const [media, collections, settings, versionResult] = await Promise.all([
    getMediaMap(supabaseAdmin),
    getPublishedCollections(supabaseAdmin),
    getSettingsObject(supabaseAdmin),
    supabaseAdmin.from('layout_versions').select('runtime_min_version').eq('id',versionId).maybeSingle(),
  ])
  const manifest = manifestFromDocument(document, { content: revision?.values_json || {}, settings, media, collections, contentRevisionId: revision?.id || null, runtimeMinVersion:versionResult.data?.runtime_min_version||'1.0.0' })
  const compatibility = buildContentCompatibility(document, revision?.values_json || {})
  res.json({ data: { manifest, document, revision, compatibility, isConfiguring: workspace?.configuring_layout_version_id === versionId, isLive: active?.layout_version_id === versionId } })
}))

adminRouter.get('/content/compatibility', asyncRoute(async (req, res) => {
  const versionId = String(req.query.versionId || '')
  const revisionId = String(req.query.revisionId || '')
  if (!versionId) return res.status(400).json({ error:'versionId required' })
  const document = await loadEditorDocument(supabaseAdmin, versionId)
  let values: Record<string,unknown> = {}
  if (revisionId) { const { data } = await supabaseAdmin.from('content_revisions').select('values_json').eq('id',revisionId).maybeSingle(); values = data?.values_json || {} }
  res.json({ data: buildContentCompatibility(document, values) })
}))

adminRouter.put('/content-revisions/:id/values', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: revision } = await supabaseAdmin.from('content_revisions').select('*').eq('id',req.params.id).maybeSingle()
  if (!revision) return res.status(404).json({ error:'Content revision not found' })
  if (revision.status !== 'draft') return res.status(409).json({ error:'Published content revisions are immutable. Create a draft.' })
  const key = String(req.body.key || '').trim(); if (!key) return res.status(400).json({ error:'key required' })
  const values = { ...(revision.values_json || {}), [key]: req.body.value }
  const { data, error } = await supabaseAdmin.from('content_revisions').update({ values_json:values }).eq('id',req.params.id).select().single()
  if (error) return res.status(400).json({ error:error.message })
  res.json({ data })
}))

adminRouter.post('/content-revisions/:id/publish', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: revision } = await supabaseAdmin.from('content_revisions').select('*').eq('id',req.params.id).maybeSingle()
  if (!revision) return res.status(404).json({ error:'Content revision not found' })
  if (revision.status === 'published') return res.json({ data:revision })
  if (revision.status !== 'draft') return res.status(409).json({ error:'Only draft content can be published' })
  const { data, error } = await supabaseAdmin.from('content_revisions').update({ status:'published', published_at:new Date().toISOString() }).eq('id',req.params.id).select().single()
  if (error) return res.status(400).json({ error:error.message })
  const entries = Object.entries(data.values_json || {})
  for (const [key,value] of entries) await supabaseAdmin.from('site_content').upsert({ key, value_json:value, type:typeof value === 'string' ? 'text' : typeof value, updated_by:actorId(req) }, { onConflict:'key' })
  await audit(supabaseAdmin, actorId(req), 'content_revision_published', 'content_revision', data.id, { revision_number:data.revision_number })
  res.json({ data })
}))

adminRouter.get('/content', asyncRoute(async (_req,res) => { const { data,error } = await supabaseAdmin.from('site_content').select('*').order('key'); if(error)return res.status(400).json({error:error.message});res.json({data:data||[]}) }))
adminRouter.put('/content/:key', asyncRoute(async (req:AuthedRequest,res) => { const key=decodeURIComponent(req.params.key); const {data,error}=await supabaseAdmin.from('site_content').upsert({key,value_json:req.body.value,type:req.body.type||'text',description:req.body.description||'',group_name:req.body.group_name||'',updated_by:actorId(req)},{onConflict:'key'}).select().single();if(error)return res.status(400).json({error:error.message});res.json({data}) }))

adminRouter.post('/releases', asyncRoute(async (req: AuthedRequest, res) => {
  const versionId = String(req.body.layout_version_id || '')
  if (!versionId) return res.status(400).json({ error:'layout_version_id required' })
  const { data: version } = await supabaseAdmin.from('layout_versions').select('*').eq('id',versionId).maybeSingle()
  if (!version || version.status !== 'published') return res.status(400).json({ error:'Only published layout versions can be released' })
  let revisionId = String(req.body.content_revision_id || '')
  if (!revisionId) { const { data: latest } = await supabaseAdmin.from('content_revisions').select('*').eq('status','published').order('revision_number',{ascending:false}).limit(1).maybeSingle(); revisionId = latest?.id || '' }
  if (!revisionId) return res.status(400).json({ error:'Publish a content revision before creating a release' })
  const { data: revision } = await supabaseAdmin.from('content_revisions').select('*').eq('id',revisionId).eq('status','published').maybeSingle()
  if (!revision) return res.status(400).json({ error:'Published content revision not found' })
  let settingsRevisionId = String(req.body.settings_revision_id || '')
  let settingsRevision: any = null
  if (settingsRevisionId) {
    const { data } = await supabaseAdmin.from('settings_revisions').select('*').eq('id',settingsRevisionId).eq('status','published').maybeSingle()
    settingsRevision = data
    if (!settingsRevision) return res.status(400).json({ error:'Published settings revision not found' })
  } else {
    const settings = await getSettingsObject(supabaseAdmin)
    const { data: latest } = await supabaseAdmin.from('settings_revisions').select('*').eq('status','published').order('revision_number',{ascending:false}).limit(1).maybeSingle()
    if (latest && JSON.stringify(latest.values_json || {}) === JSON.stringify(settings)) {
      settingsRevision = latest
    } else {
      const { data: settingRows } = await supabaseAdmin.from('settings_revisions').select('revision_number')
      const { data, error } = await supabaseAdmin.from('settings_revisions').insert({ revision_number:nextRevisionNumber(settingRows), status:'published', values_json:settings, created_by:actorId(req), published_at:new Date().toISOString() }).select().single()
      if (error) return res.status(error.code === '23505' ? 409 : 400).json({ error:error.code === '23505' ? 'Settings changed during release creation. Retry with the latest published settings revision.' : error.message })
      settingsRevision = data
    }
    settingsRevisionId = settingsRevision.id
  }
  const collections = await getPublishedCollections(supabaseAdmin)
  const releaseDocument = await loadEditorDocument(supabaseAdmin, versionId)
  const mediaSnapshot = await getMediaMap(supabaseAdmin, collectReferencedMediaIds(releaseDocument, revision.values_json || {}))
  const { data: release, error } = await supabaseAdmin.rpc('create_site_release', {
    target_layout_version_id: versionId,
    target_content_revision_id: revisionId,
    target_settings_revision_id: settingsRevisionId,
    collections_snapshot_value: collections,
    media_snapshot_value: mediaSnapshot,
    notes_value: req.body.notes || 'Release candidate',
    actor_user_id: actorId(req),
  })
  if (error) return res.status(409).json({ error:`Release candidate creation failed: ${error.message}` })
  res.status(201).json({ data:release })
}))

adminRouter.post('/releases/:id/validate', asyncRoute(async (req:AuthedRequest,res) => {
  const { data:release } = await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle()
  if (!release) return res.status(404).json({ error:'Release not found' })
  if (release.status !== 'draft') return res.status(409).json({ error:'Only draft release candidates can be validated' })
  const { result, runtimeVersion } = await validateRelease(supabaseAdmin, release)
  const { data:validatedRelease, error } = await supabaseAdmin.rpc('record_release_validation', {
    target_release_id: release.id,
    expected_snapshot_revision_token: release.snapshot_revision_token,
    validation_valid: result.valid,
    validation_issues: result.issues,
    validated_runtime_version: runtimeVersion,
    actor_user_id: actorId(req),
  })
  if (error) return res.status(409).json({ error:`Release validation could not be recorded: ${error.message}`, validation:result })
  res.status(result.valid?200:422).json({ ...(result.valid?{}:{error:'Release validation found blocking errors'}),data:{ release:validatedRelease,validation:result } })
}))

adminRouter.post('/releases/:id/preview', asyncRoute(async (req,res) => {
  const { data:release } = await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle()
  if (!release) return res.status(404).json({ error:'Release not found' })
  const { document, contentRevision, result, runtimeMinVersion } = await validateRelease(supabaseAdmin, release)
  const media = release.media_snapshot && Object.keys(release.media_snapshot).length ? release.media_snapshot : await getMediaMap(supabaseAdmin)
  const manifest = manifestFromDocument(document,{ releaseId:release.id,releaseNumber:release.release_number,content:contentRevision?.values_json||{},settings:release.settings_snapshot||{},media,collections:release.collections_snapshot||{},contentRevisionId:release.content_revision_id,settingsRevisionId:release.settings_revision_id,runtimeMinVersion })
  res.json({ data:{ manifest,validation:result,release } })
}))

adminRouter.post('/releases/:id/activate', asyncRoute(async (req:AuthedRequest,res) => {
  const { data:release } = await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle()
  if (!release) return res.status(404).json({error:'Release not found'})
  if (release.status !== 'ready') return res.status(409).json({error:'Only a validated ready release can be activated'})
  const {data,error}=await supabaseAdmin.rpc('activate_release',{target_release_id:req.params.id,expected_snapshot_revision_token:release.snapshot_revision_token,actor_user_id:actorId(req)})
  if(error)return res.status(409).json({error:`Atomic activation failed: ${error.message}`})
  res.json({data})
}))
adminRouter.post('/releases/:id/rollback', asyncRoute(async (req:AuthedRequest,res) => {
  const {data:release}=await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle(); if(!release)return res.status(404).json({error:'Release not found'})
  if (release.status !== 'superseded') return res.status(409).json({error:'Only a superseded release can be selected for rollback'})
  const {result,runtimeVersion}=await validateRelease(supabaseAdmin,release);if(!result.valid)return res.status(422).json({error:'Rollback blocked by validation errors',validation:result})
  const {data,error}=await supabaseAdmin.rpc('rollback_release',{target_release_id:req.params.id,expected_snapshot_revision_token:release.snapshot_revision_token,validation_issues:result.issues,validated_runtime_version:runtimeVersion,actor_user_id:actorId(req)});if(error)return res.status(409).json({error:`Atomic rollback failed: ${error.message}`})
  res.json({data})
}))
adminRouter.get('/releases/options', asyncRoute(async (_req,res) => {
  const [layouts,content,settings]=await Promise.all([
    supabaseAdmin.from('layout_versions').select('id,layout_id,version_number,schema_version,runtime_min_version,published_at,layouts(name)').eq('status','published').order('published_at',{ascending:false}),
    supabaseAdmin.from('content_revisions').select('id,revision_number,published_at').eq('status','published').order('revision_number',{ascending:false}),
    supabaseAdmin.from('settings_revisions').select('id,revision_number,published_at').eq('status','published').order('revision_number',{ascending:false}),
  ])
  const error=layouts.error||content.error||settings.error
  if(error)return res.status(400).json({error:error.message})
  res.json({data:{layouts:layouts.data||[],content:content.data||[],settings:settings.data||[]}})
}))
adminRouter.get('/releases', asyncRoute(async (_req,res) => { const {data,error}=await supabaseAdmin.from('site_releases').select('*,layout_versions(*),content_revisions(*),settings_revisions(*),release_validation_results(*)').order('release_number',{ascending:false});if(error)return res.status(400).json({error:error.message});res.json({data:data||[]}) }))
adminRouter.get('/releases/:id', asyncRoute(async (req,res) => { const {data,error}=await supabaseAdmin.from('site_releases').select('*,layout_versions(*),content_revisions(*),settings_revisions(*),release_validation_results(*)').eq('id',req.params.id).maybeSingle();if(error||!data)return res.status(404).json({error:'Release not found'});res.json({data}) }))

adminRouter.get('/audit', asyncRoute(async (req,res) => { const limit=Math.min(200,Number(req.query.limit||50));const {data,error}=await supabaseAdmin.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(limit);if(error)return res.status(400).json({error:error.message});res.json({data:data||[]}) }))

app.use('/api/studio', studioRouter)
app.use('/api/admin', adminRouter)

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  if (String(error?.message || '').includes('not allowed')) return res.status(403).json({ error:error.message })
  res.status(500).json({ error: error?.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`Platform API listening on http://localhost:${PORT} (auth bypass: ${DEV_BYPASS_AUTH})`))
