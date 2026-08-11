import 'dotenv/config'
import crypto from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { createServerSupabaseClients } from '@platform/supabase'
import { cloneNodeWithFreshIds, createBlankDocument, createCosmicPortfolioTemplate, slugify } from '@platform/builder-core'
import { ANIMATION_PRESETS } from '@platform/animation-runtime'
import { LAYOUT_SCHEMA_VERSION, PLATFORM_VERSION, RUNTIME_VERSION, type EditorDocument, type EditorPage } from '@platform/contracts'
import { buildContentCompatibility, collectContentSlots, isRuntimeCompatible, validateContentValue, validateEditorDocument, validateReleaseCandidate } from '@platform/validation'
import { createRequireAdmin, createRequireStudio, type AuthedRequest } from './lib/auth'
import { evaluateLayoutLifecycle } from './lib/layout-lifecycle'
import { collectAndCertifyReleaseCandidateMedia, type CreatedRelease } from './lib/release-candidate-media'
import { certifyLegacyReleaseMedia, collectLegacyReleaseMedia } from './lib/legacy-release-media'
import { getReleaseMediaMap, validateCanonicalMediaStorageObjects, validateReleaseStorageObjects } from './lib/release-media-runtime'
import { MAX_CMS_MEDIA_BYTES, mediaKindForMime, sniffMediaMime, validateDeclaredMime } from './lib/media-file'
import { loadProjectGallery, normalizeStructuredMediaInput, replaceProjectGallery } from './lib/structured-media'
import { assertStructuredPublishReady, normalizeMediaMetadataPatch, normalizeSettingValue, normalizeStructuredRecordInput } from './lib/structured-content'
import { buildRobotsTxt, buildSitemapXml, resolveSeoMetadata } from './lib/seo'
import {
  apiSecurityHeaders, createDistributedRateLimiter, createMemoryRateLimiter, enforceParsedBodyShape, enforceRequestShape,
  loadSecurityConfig, mutationOnly, privateNoStore, publicEdgeCache, requestIdentity, requireJsonContentType, structuredRequestLogger,
} from './lib/security'
import {
  SAMPLE_COLLECTIONS, audit, editorPageToDb, getActiveManifest, getMediaMap, getPublishedCollections,
  getDeployedPublicRuntimeVersion, getSettingsObject, loadEditorDocument, manifestFromDocument, sampleContentForDocument,
  validateRelease, validateVersion,
} from './lib/platform'

const { supabaseAdmin } = createServerSupabaseClients(process.env)
const app = express()
const PORT = Number(process.env.PORT || 4000)
const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true'
const isProduction = process.env.NODE_ENV === 'production'
const securityConfig = loadSecurityConfig(process.env)
if (isProduction && DEV_BYPASS_AUTH) throw new Error('DEV_BYPASS_AUTH must be false in production')
if (isProduction && !String(process.env.ALLOWED_ORIGINS || '').trim()) throw new Error('ALLOWED_ORIGINS must be explicitly configured in production')
if (isProduction && !String(process.env.PUBLIC_WEB_RUNTIME_VERSION || '').trim()) throw new Error('PUBLIC_WEB_RUNTIME_VERSION must identify the deployed Public Web runtime in production')
if (isProduction) {
  const publicSiteUrl = String(process.env.PUBLIC_SITE_URL || '').trim()
  let parsedPublicSiteUrl: URL | null = null
  try { parsedPublicSiteUrl = publicSiteUrl ? new URL(publicSiteUrl) : null } catch {}
  if (!parsedPublicSiteUrl || parsedPublicSiteUrl.protocol !== 'https:') throw new Error('PUBLIC_SITE_URL must be an explicit HTTPS origin in production')
}
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:5173')
  .split(',').map((value) => value.trim()).filter(Boolean)
if (allowedOrigins.includes('*')) throw new Error('Wildcard CORS origins are not allowed')

app.disable('x-powered-by')
if (securityConfig.trustProxyHops !== false) app.set('trust proxy', securityConfig.trustProxyHops)
app.use(requestIdentity)
app.use(apiSecurityHeaders(securityConfig))
app.use(enforceRequestShape)
app.use(structuredRequestLogger(securityConfig))
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error(`Origin ${origin} is not allowed`)) }, credentials: false, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type','X-Request-Id'] }))
// Keep ordinary JSON small. Media upload is the one intentionally larger JSON route
// because Phase 5 still transports the validated 8 MB CMS object as base64.
app.use('/api/admin/media/upload', express.json({ limit: '12mb' }))
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }))
app.use(express.urlencoded({ extended: false, limit: '64kb' }))
app.use(enforceParsedBodyShape)

const asyncRoute = (handler: (req: any, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(handler(req, res, next)).catch(next)
const requireAdmin = createRequireAdmin(supabaseAdmin, DEV_BYPASS_AUTH)
const requireStudio = createRequireStudio(supabaseAdmin, DEV_BYPASS_AUTH)
const adminRouter = express.Router()
const studioRouter = express.Router()

const publicBurstLimiter = createMemoryRateLimiter(securityConfig, { id: 'public', limit: securityConfig.publicRequestsPerMinute, windowSeconds: 60, message: 'Too many public requests. Please retry shortly.', distributed: false })
const infrastructureProbeLimiter = createMemoryRateLimiter(securityConfig, { id: 'infrastructure-probe', limit: 120, windowSeconds: 60, message: 'Too many health/readiness requests. Please retry shortly.', distributed: false })
const privilegedIpLimiter = createMemoryRateLimiter(securityConfig, { id: 'privileged-ip', limit: securityConfig.privilegedRequestsPerMinute, windowSeconds: 60, message: 'Too many privileged requests. Please retry shortly.', distributed: false })
const privilegedSharedLimiter = createDistributedRateLimiter(supabaseAdmin, securityConfig, { id: 'privileged-user', limit: securityConfig.privilegedRequestsPerMinute, windowSeconds: 60, message: 'Privileged request limit reached. Please retry shortly.', key: (req) => `user:${req.actor?.id || 'unknown'}` })
const mutationMemoryLimiter = createMemoryRateLimiter(securityConfig, { id: 'mutation', limit: securityConfig.mutationRequestsPerMinute, windowSeconds: 60, message: 'Too many write requests. Please retry shortly.' })
const mutationSharedLimiter = createDistributedRateLimiter(supabaseAdmin, securityConfig, { id: 'mutation-user', limit: securityConfig.mutationRequestsPerMinute, windowSeconds: 60, message: 'Write request limit reached. Please retry shortly.', key: (req) => `user:${req.actor?.id || 'unknown'}` })
const uploadMemoryLimiter = createMemoryRateLimiter(securityConfig, { id: 'media-upload', limit: securityConfig.uploadRequestsPerTenMinutes, windowSeconds: 600, message: 'Media upload limit reached. Please retry later.' })
const uploadSharedLimiter = createDistributedRateLimiter(supabaseAdmin, securityConfig, { id: 'media-upload-user', limit: securityConfig.uploadRequestsPerTenMinutes, windowSeconds: 600, message: 'Media upload limit reached. Please retry later.', key: (req) => `user:${req.actor?.id || 'unknown'}` })

adminRouter.use(privilegedIpLimiter)
adminRouter.use(privateNoStore)
adminRouter.use(requireAdmin)
adminRouter.use(privilegedSharedLimiter)
adminRouter.use(mutationOnly(requireJsonContentType))
adminRouter.use(mutationOnly(mutationMemoryLimiter))
adminRouter.use(mutationOnly(mutationSharedLimiter))
studioRouter.use(privilegedIpLimiter)
studioRouter.use(privateNoStore)
studioRouter.use(requireStudio)
studioRouter.use(privilegedSharedLimiter)
studioRouter.use(mutationOnly(requireJsonContentType))
studioRouter.use(mutationOnly(mutationMemoryLimiter))
studioRouter.use(mutationOnly(mutationSharedLimiter))

app.use('/api/public', publicBurstLimiter)
app.use(['/health', '/ready'], privateNoStore, infrastructureProbeLimiter)
app.get('/health', (_req, res) => res.json({ status: 'ok', platformVersion: PLATFORM_VERSION, runtimeVersion: RUNTIME_VERSION, securityMode: securityConfig.mode, timestamp: new Date().toISOString() }))
app.get('/ready', asyncRoute(async (_req, res) => {
  const probe = await Promise.race([
    supabaseAdmin.from('site_releases').select('id').limit(1),
    new Promise<{ error: { message: string } }>((resolve) => setTimeout(() => resolve({ error: { message: 'Dependency probe timed out' } }), 4000)),
  ])
  if (probe.error) return res.status(503).json({ status: 'not-ready', dependency: 'supabase', requestId: res.locals.requestId })
  res.json({ status: 'ready', dependency: 'supabase', timestamp: new Date().toISOString() })
}))

function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function pick(source: Record<string, unknown>, keys: string[]) { return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])) }
function actorId(req: AuthedRequest): string | null { return req.actor?.id || null }
function studioActorIsAdmin(req: AuthedRequest): boolean { return req.actor?.role === 'admin' }
async function studioCanAccessLayout(req: AuthedRequest, layoutId: string): Promise<boolean> {
  if (studioActorIsAdmin(req)) return true
  if (!req.actor?.id) return false
  const { data } = await supabaseAdmin.from('layouts').select('id,created_by').eq('id', layoutId).maybeSingle()
  return Boolean(data && data.created_by === req.actor.id)
}
async function studioCanAccessVersion(req: AuthedRequest, versionId: string): Promise<boolean> {
  if (studioActorIsAdmin(req)) return true
  if (!req.actor?.id) return false
  const { data } = await supabaseAdmin.from('layout_versions').select('layout_id,layouts(created_by)').eq('id', versionId).maybeSingle()
  const owner = (data as any)?.layouts?.created_by
  return Boolean(data && owner === req.actor.id)
}
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


function applyPublicReleaseCache(req: Request, res: Response, manifest: { releaseId?: string | null; mediaSnapshotVersion?: number }): boolean {
  const etag = `"release-${manifest.releaseId || 'none'}-m${manifest.mediaSnapshotVersion ?? 0}"`
  publicEdgeCache(securityConfig, etag)(req, res, () => undefined)
  if (req.header('if-none-match') === etag) { res.status(304).end(); return true }
  return false
}

let activeManifestCache: { value: Awaited<ReturnType<typeof getActiveManifest>>; expiresAt: number } | null = null
let activeManifestPromise: Promise<Awaited<ReturnType<typeof getActiveManifest>>> | null = null
async function getPublicActiveManifest() {
  const now = Date.now()
  if (activeManifestCache && activeManifestCache.expiresAt > now) return activeManifestCache.value
  if (activeManifestPromise) return activeManifestPromise
  activeManifestPromise = getActiveManifest(supabaseAdmin).then((value) => {
    activeManifestCache = { value, expiresAt: Date.now() + securityConfig.manifestMemoryCacheMs }
    return value
  }).finally(() => { activeManifestPromise = null })
  return activeManifestPromise
}
function invalidatePublicManifestCache() { activeManifestCache = null }
function publicSeoFallbackOrigin(req: Request): string {
  const configured = String(process.env.PUBLIC_SITE_URL || '').trim()
  if (configured) return configured
  if (isProduction) return ''
  return typeof req.query.origin === 'string' ? req.query.origin : ''
}

// ---------------------------------------------------------------------------
// Public runtime + public structured APIs
// ---------------------------------------------------------------------------
app.get('/api/public/runtime', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  res.json({ data: manifest })
}))

app.get('/api/public/manifest', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  res.json({ data: manifest })
}))

app.get('/api/public/runtime/page/:slug', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  const slug = req.params.slug === 'home' ? 'home' : req.params.slug
  const route = manifest.routes.find((item) => item.slug === slug)
  if (!route) return res.status(404).json({ error: 'Page not found' })
  res.json({ data: { route, globals: manifest.globals, designTokens: manifest.designTokens, content: manifest.content, settings: manifest.settings, media: manifest.media, collections: manifest.collections } })
}))

app.get('/api/public/seo', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  const path = typeof req.query.path === 'string' ? req.query.path : '/'
  const fallbackOrigin = publicSeoFallbackOrigin(req)
  const metadata = resolveSeoMetadata(manifest, path, fallbackOrigin)
  if (!metadata) return res.status(404).json({ error: 'SEO route not found' })
  res.json({ data: metadata, meta: { releaseId: manifest.releaseId, releaseNumber: manifest.releaseNumber } })
}))

app.get('/api/public/sitemap.xml', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).type('text/plain').send('No active site release')
  if (applyPublicReleaseCache(req, res, manifest)) return
  const fallbackOrigin = publicSeoFallbackOrigin(req)
  const xml = buildSitemapXml(manifest, fallbackOrigin)
  res.type('application/xml').send(xml)
}))

app.get('/api/public/robots.txt', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.type('text/plain').send('User-agent: *\nDisallow: /\n')
  if (applyPublicReleaseCache(req, res, manifest)) return
  const fallbackOrigin = publicSeoFallbackOrigin(req)
  res.type('text/plain').send(buildRobotsTxt(manifest, fallbackOrigin))
}))

// Public collection compatibility endpoints are projections of the ACTIVE
// release snapshot. They must never expose current CMS rows ahead of production
// activation. Public Web itself consumes /api/public/runtime, but these endpoints
// preserve the same release-only authority for external/read-only consumers.
function activeReleaseCollection(collectionKey: 'projects' | 'notes' | 'experience' | 'apps') {
  return asyncRoute(async (req, res) => {
    const manifest = await getPublicActiveManifest()
    if (!manifest) return res.status(404).json({ error: 'No active site release' })
    if (applyPublicReleaseCache(req, res, manifest)) return
    const source = Array.isArray(manifest.collections?.[collectionKey]) ? manifest.collections[collectionKey] : []
    const featuredOnly = req.query.featured === 'true'
    const rows = featuredOnly ? source.filter((row: any) => row?.featured === true) : source
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)))
    res.json({ data: rows.slice(0, limit), meta: { total: rows.length, page: 1, limit, releaseId: manifest.releaseId, releaseNumber: manifest.releaseNumber } })
  })
}
app.get('/api/public/projects', activeReleaseCollection('projects'))
app.get('/api/public/notes', activeReleaseCollection('notes'))
app.get('/api/public/experience', activeReleaseCollection('experience'))
app.get('/api/public/apps', activeReleaseCollection('apps'))
app.get('/api/public/projects/:slug', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  const data = (manifest.collections?.projects || []).find((row: any) => String(row?.slug || '') === req.params.slug)
  if (!data) return res.status(404).json({ error: 'Project not found' })
  res.json({ data, meta: { releaseId: manifest.releaseId, releaseNumber: manifest.releaseNumber } })
}))
app.get('/api/public/notes/:slug', asyncRoute(async (req, res) => {
  const manifest = await getPublicActiveManifest()
  if (!manifest) return res.status(404).json({ error: 'No active site release' })
  if (applyPublicReleaseCache(req, res, manifest)) return
  const data = (manifest.collections?.notes || []).find((row: any) => String(row?.slug || '') === req.params.slug)
  if (!data) return res.status(404).json({ error: 'Note not found' })
  res.json({ data, meta: { releaseId: manifest.releaseId, releaseNumber: manifest.releaseNumber } })
}))

// ---------------------------------------------------------------------------
// Studio APIs — design authoring, persistence, validation, publishing
// ---------------------------------------------------------------------------
studioRouter.get('/me', (req: AuthedRequest, res) => res.json({ data: req.actor }))

studioRouter.get('/layouts', asyncRoute(async (req: AuthedRequest, res) => {
  let layoutQuery = supabaseAdmin.from('layouts').select('*').neq('status', 'archived').order('updated_at', { ascending: false })
  if (!studioActorIsAdmin(req)) layoutQuery = layoutQuery.eq('created_by', actorId(req))
  const { data, error } = await layoutQuery
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

studioRouter.get('/layouts/:id/editor', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessLayout(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can access only layouts it owns.' })
  const { data: versions, error } = await supabaseAdmin.from('layout_versions').select('*').eq('layout_id', req.params.id).order('version_number', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const selected = (versions || []).find((version: any) => version.status === 'draft') || (versions || [])[0]
  if (!selected) return res.status(404).json({ error: 'Layout has no versions' })
  const document = await loadEditorDocument(supabaseAdmin, selected.id)
  res.json({ data: document, readOnly: selected.status !== 'draft' })
}))

studioRouter.get('/layouts/:layoutId/versions/:versionId/editor', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessLayout(req, req.params.layoutId)) return res.status(403).json({ error: 'This Studio role can access only layouts it owns.' })
  const { data: version, error } = await supabaseAdmin.from('layout_versions').select('id,status').eq('id', req.params.versionId).eq('layout_id', req.params.layoutId).maybeSingle()
  if (error) { console.error('Studio editor route lookup failed', error); return res.status(400).json({ error: 'Unable to load the requested layout version' }) }
  if (!version) return res.status(404).json({ error: 'Layout version not found for this layout' })
  const document = await loadEditorDocument(supabaseAdmin, version.id)
  res.json({ data: document, readOnly: version.status !== 'draft' })
}))

studioRouter.post('/layouts/:id/drafts', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessLayout(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can modify only layouts it owns.' })
  const { data: draftId, error } = await supabaseAdmin.rpc('get_or_create_layout_draft', {
    target_layout_id: req.params.id,
    schema_version_value: LAYOUT_SCHEMA_VERSION,
    runtime_min_version_value: RUNTIME_VERSION,
    actor_user_id: actorId(req),
  })
  if (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('Archived') || error.message.includes('no pages') ? 409 : 400
    return res.status(status).json({ error: error.message })
  }
  if (!draftId) return res.status(500).json({ error: 'Draft creation returned no version id.' })
  res.status(201).json({ data: await loadEditorDocument(supabaseAdmin, String(draftId)) })
}))

studioRouter.post('/layouts/:id/duplicate', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessLayout(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can duplicate only layouts it owns.' })
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
  if (!await studioCanAccessVersion(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can modify only layout versions it owns.' })
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

studioRouter.post('/versions/:id/validate', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessVersion(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can validate only layout versions it owns.' })
  const { document, result } = await validateVersion(supabaseAdmin, req.params.id)
  res.status(result.valid ? 200 : 422).json({ data: { document, validation: result } })
}))

studioRouter.post('/versions/:id/publish', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessVersion(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can publish only layout versions it owns.' })
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
  if (!await studioCanAccessLayout(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can rename only layouts it owns.' })
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(422).json({ error:'Layout name is required' })
  const { data, error } = await supabaseAdmin.rpc('rename_layout_document', { target_layout_id:req.params.id, layout_name_value:name, layout_slug_base_value:slugify(name), actor_user_id:actorId(req) }).single()
  if (error) return res.status(error.message.includes('not found')?404:400).json({ error:error.message })
  res.json({ data })
}))

studioRouter.patch('/layouts/:id/archive', asyncRoute(async (req: AuthedRequest, res) => {
  if (!await studioCanAccessLayout(req, req.params.id)) return res.status(403).json({ error: 'This Studio role can archive only layouts it owns.' })
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

studioRouter.get('/bindings/registry', asyncRoute(async (req: AuthedRequest, res) => {
  const versionId = String(req.query.versionId || '')
  if (!versionId) return res.json({ data: [] })
  if (!await studioCanAccessVersion(req, versionId)) return res.status(403).json({ error: 'This Studio role can inspect bindings only for layout versions it owns.' })
  const doc = await loadEditorDocument(supabaseAdmin, versionId)
  res.json({ data: collectContentSlots(doc) })
}))
studioRouter.get('/media', asyncRoute(async (req, res) => {
  const search = String(req.query.search || '').trim().replace(/[%_]/g, '')
  let query = supabaseAdmin.from('media').select('id,filename,public_url,url,mime_type,kind,alt_text,created_at').order('created_at', { ascending: false }).limit(200)
  if (search) query = query.ilike('filename', `%${search}%`)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data: data || [] })
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

adminRouter.post('/media/upload', uploadMemoryLimiter, uploadSharedLimiter, asyncRoute(async (req: AuthedRequest, res) => {
  const filename = String(req.body.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const declaredMime = String(req.body.mime_type || 'application/octet-stream')
  const raw = String(req.body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '')
  if (!filename || !raw) return res.status(400).json({ error: 'filename and dataBase64 are required' })
  const bytes = Buffer.from(raw, 'base64')
  if (!bytes.length) return res.status(400).json({ error: 'Uploaded media is empty' })
  if (bytes.length > MAX_CMS_MEDIA_BYTES) return res.status(413).json({ error: 'File exceeds the current 8 MB CMS upload limit' })
  let mime: string
  try { mime = validateDeclaredMime(declaredMime, sniffMediaMime(bytes)) }
  catch (error) { return res.status(415).json({ error: error instanceof Error ? error.message : 'Unsupported media file' }) }
  const storagePath = `cms/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${filename}`
  const { error: uploadError } = await supabaseAdmin.storage.from('public-media').upload(storagePath, bytes, { contentType: mime, upsert: false })
  if (uploadError) return res.status(400).json({ error: uploadError.message })
  const { data: urlData } = supabaseAdmin.storage.from('public-media').getPublicUrl(storagePath)
  const { data, error } = await supabaseAdmin.from('media').insert({ filename, storage_path: storagePath, url: urlData.publicUrl, public_url: urlData.publicUrl, mime_type: mime, size_bytes: bytes.length, size: bytes.length, kind: mediaKindForMime(mime), alt_text: String(req.body.alt_text || '') }).select().single()
  if (error) { await supabaseAdmin.storage.from('public-media').remove([storagePath]); return res.status(400).json({ error: error.message }) }
  await audit(supabaseAdmin, actorId(req), 'media_uploaded', 'media', data.id, data)
  res.status(201).json({ data })
}))

adminRouter.get('/media', asyncRoute(async (req, res) => {
  const kind = String(req.query.kind || '').trim().toLowerCase()
  const search = String(req.query.search || '').trim()
  let query = supabaseAdmin.from('media').select('*').order('created_at', { ascending: false })
  if (kind && kind !== 'all') query = query.eq('kind', kind)
  if (search) query = query.ilike('filename', `%${search.replace(/[%_]/g, '')}%`)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data: data || [] })
}))

adminRouter.patch('/media/:id', asyncRoute(async (req: AuthedRequest, res) => {
  let patch: Record<string, unknown>
  try { patch = normalizeMediaMetadataPatch(pick(asObject(req.body), ['alt_text', 'filename'])) } catch (cause) { return res.status(422).json({ error: cause instanceof Error ? cause.message : 'Invalid media metadata' }) }
  if (!Object.keys(patch).length) return res.status(422).json({ error: 'No editable media metadata was supplied' })
  const { data: before } = await supabaseAdmin.from('media').select('*').eq('id', req.params.id).maybeSingle()
  if (!before) return res.status(404).json({ error: 'Media not found' })
  const { data, error } = await supabaseAdmin.from('media').update(patch).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  await audit(supabaseAdmin, actorId(req), 'media_updated', 'media', req.params.id, data, before)
  res.json({ data })
}))

adminRouter.delete('/media/:id', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: job, error } = await supabaseAdmin.rpc('request_media_delete', { target_media_id: req.params.id, actor_user_id: actorId(req) })
  if (error) return res.status(error.message.toLowerCase().includes('referenced') ? 409 : error.message.toLowerCase().includes('not found') ? 404 : 400).json({ error: error.message })
  const cleanup: any = job
  const { error: storageError } = await supabaseAdmin.storage.from(cleanup.bucket_id || 'public-media').remove([cleanup.storage_path])
  const { data: finalJob, error: finishError } = await supabaseAdmin.rpc('finish_media_cleanup_job', { target_job_id: cleanup.id, succeeded: !storageError, error_message: storageError?.message || '', actor_user_id: actorId(req) })
  if (finishError) return res.status(500).json({ error: `Media row was deleted but cleanup status could not be recorded: ${finishError.message}`, data: { id: req.params.id, cleanupPending: true, cleanupJobId: cleanup.id } })
  res.json({ data: { id: req.params.id, cleanupPending: Boolean(storageError), cleanupJob: finalJob }, ...(storageError ? { warning: `Database delete committed; storage cleanup remains pending: ${storageError.message}` } : {}) })
}))

adminRouter.get('/media-cleanup-jobs', asyncRoute(async (req, res) => {
  const status = String(req.query.status || '').trim()
  let query = supabaseAdmin.from('media_cleanup_jobs').select('*').order('created_at', { ascending: false }).limit(200)
  if (status && ['pending','failed','complete'].includes(status)) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data: data || [] })
}))

adminRouter.post('/media-cleanup-jobs/:id/retry', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: job, error } = await supabaseAdmin.from('media_cleanup_jobs').select('*').eq('id', req.params.id).maybeSingle()
  if (error || !job) return res.status(404).json({ error: 'Media cleanup job not found' })
  if (job.status === 'complete') return res.json({ data: job })
  const { error: storageError } = await supabaseAdmin.storage.from(job.bucket_id || 'public-media').remove([job.storage_path])
  const { data: finalJob, error: finishError } = await supabaseAdmin.rpc('finish_media_cleanup_job', { target_job_id: job.id, succeeded: !storageError, error_message: storageError?.message || '', actor_user_id: actorId(req) })
  if (finishError) return res.status(500).json({ error: `Storage cleanup result could not be recorded: ${finishError.message}` })
  res.status(storageError ? 502 : 200).json({ data: finalJob, ...(storageError ? { error: `Storage cleanup remains pending: ${storageError.message}` } : {}) })
}))


const CRUD_CONFIG: Record<string, { table: string; keys: string[] }> = {
  projects: { table: 'projects', keys: ['slug','title','short_description','full_description','thumbnail_media_id','gallery_media_ids','technologies','github_url','live_url','featured','published','display_order','seo'] },
  notes: { table: 'notes', keys: ['slug','title','summary','content','category','tags','cover_media_id','featured','published','display_order','seo'] },
  experience: { table: 'experiences', keys: ['company','role','employment_type','location','start_date','end_date','current','summary','responsibilities','technologies','logo_media_id','display_order','published'] },
  apps: { table: 'ai_apps', keys: ['slug','name','short_description','full_description','icon_media_id','cover_media_id','category','tags','requires_login','status','published','featured','display_order'] },
}
for (const [resource, config] of Object.entries(CRUD_CONFIG)) {
  adminRouter.get(`/${resource}`, asyncRoute(async (_req, res) => { const { data, error } = await supabaseAdmin.from(config.table).select('*').order(resource === 'media' ? 'created_at' : 'display_order', { ascending: true }); if (error) return res.status(400).json({ error: error.message }); if (resource !== 'projects') return res.json({ data: data || [] }); const gallery = await loadProjectGallery(supabaseAdmin, (data || []).map((row: any) => row.id)); res.json({ data: (data || []).map((row: any) => ({ ...row, gallery_media: gallery.get(row.id) || [], gallery_media_ids: (gallery.get(row.id) || []).map((entry: any) => entry.media_id) })) }) }))
  adminRouter.post(`/${resource}`, asyncRoute(async (req: AuthedRequest, res) => {
    const requested = pick(asObject(req.body), config.keys)
    const galleryMediaIds = requested.gallery_media_ids
    delete requested.gallery_media_ids
    let body = await normalizeStructuredMediaInput(supabaseAdmin, resource, requested)
    if ((resource === 'projects' || resource === 'notes' || resource === 'apps') && !body.slug) body.slug = slugify(String(body.title || body.name || 'item'))
    try { body = normalizeStructuredRecordInput(resource, body, true); assertStructuredPublishReady(resource, body) }
    catch (cause) { return res.status(422).json({ error: cause instanceof Error ? cause.message : 'Invalid structured content' }) }
    const { data, error } = await supabaseAdmin.from(config.table).insert(body).select().single(); if (error) return res.status(400).json({ error: error.message })
    if (resource === 'projects' && Array.isArray(galleryMediaIds)) { const gallery = await replaceProjectGallery(supabaseAdmin, data.id, galleryMediaIds); const { data: updated, error: updateError } = await supabaseAdmin.from(config.table).update({ gallery }).eq('id', data.id).select().single(); if (updateError) return res.status(400).json({ error: updateError.message }); Object.assign(data, updated, { gallery_media_ids: galleryMediaIds }) }
    await audit(supabaseAdmin, actorId(req), `${resource}_created`, resource, data.id, data); res.status(201).json({ data })
  }))
  adminRouter.patch(`/${resource}/:id`, asyncRoute(async (req: AuthedRequest, res) => {
    const requested = pick(asObject(req.body), config.keys)
    const galleryMediaIds = requested.gallery_media_ids
    delete requested.gallery_media_ids
    const { data: before, error: beforeError } = await supabaseAdmin.from(config.table).select('*').eq('id', req.params.id).maybeSingle()
    if (beforeError || !before) return res.status(404).json({ error: 'Record not found' })
    let body = await normalizeStructuredMediaInput(supabaseAdmin, resource, requested)
    try { body = normalizeStructuredRecordInput(resource, body, false); assertStructuredPublishReady(resource, { ...before, ...body }) }
    catch (cause) { return res.status(422).json({ error: cause instanceof Error ? cause.message : 'Invalid structured content' }) }
    if (!Object.keys(body).length && !Array.isArray(galleryMediaIds)) return res.status(422).json({ error: 'No editable fields were supplied' })
    const { data, error } = Object.keys(body).length
      ? await supabaseAdmin.from(config.table).update(body).eq('id', req.params.id).select().single()
      : { data: { ...before }, error: null }
    if (error) return res.status(400).json({ error: error.message })
    if (resource === 'projects' && Array.isArray(galleryMediaIds)) {
      const gallery = await replaceProjectGallery(supabaseAdmin, req.params.id, galleryMediaIds)
      const { data: updated, error: updateError } = await supabaseAdmin.from(config.table).update({ gallery }).eq('id', req.params.id).select().single()
      if (updateError) return res.status(400).json({ error: updateError.message })
      Object.assign(data, updated, { gallery_media_ids: galleryMediaIds })
    }
    await audit(supabaseAdmin, actorId(req), `${resource}_updated`, resource, req.params.id, data, before)
    res.json({ data })
  }))
  adminRouter.delete(`/${resource}/:id`, asyncRoute(async (req: AuthedRequest, res) => {
    const { data: before } = await supabaseAdmin.from(config.table).select('*').eq('id', req.params.id).maybeSingle()
    const { error } = await supabaseAdmin.from(config.table).delete().eq('id', req.params.id)
    if (error) return res.status(400).json({ error: error.message })
    await audit(supabaseAdmin, actorId(req), `${resource}_deleted`, resource, req.params.id, undefined, before)
    res.json({ data: { id: req.params.id } })
  }))
}

adminRouter.get('/settings', asyncRoute(async (_req, res) => {
  const { data: latest } = await supabaseAdmin.from('settings_revisions').select('*').in('status', ['draft','published']).order('revision_number', { ascending: false }).limit(1).maybeSingle()
  const values = latest?.values_json || await getSettingsObject(supabaseAdmin)
  res.json({ data: Object.entries(values).sort(([a],[b]) => a.localeCompare(b)).map(([key, value_json]) => ({ id: `${latest?.id || 'legacy'}:${key}`, key, value_json, revision_id: latest?.id || null, revision_status: latest?.status || 'legacy' })) })
}))

adminRouter.post('/settings-revisions/draft', asyncRoute(async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin.rpc('get_or_create_settings_draft', { actor_user_id: actorId(req) })
  if (error) return res.status(409).json({ error: error.message })
  res.json({ data })
}))

adminRouter.put('/settings-revisions/:id/values', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: revision } = await supabaseAdmin.from('settings_revisions').select('*').eq('id',req.params.id).maybeSingle()
  if (!revision) return res.status(404).json({ error:'Settings revision not found' })
  if (revision.status !== 'draft') return res.status(409).json({ error:'Published settings revisions are immutable. Create a draft.' })
  const key = String(req.body.key || '').trim()
  if (!key || !/^[A-Za-z0-9._-]{1,160}$/.test(key)) return res.status(422).json({ error:'A valid setting key is required' })
  let normalizedValue: unknown
  try { normalizedValue = normalizeSettingValue(key, req.body.value) }
  catch (cause) { return res.status(422).json({ error: cause instanceof Error ? cause.message : 'Invalid setting value' }) }
  const values = { ...(revision.values_json || {}), [key]: normalizedValue }
  const { data, error } = await supabaseAdmin.from('settings_revisions').update({ values_json:values }).eq('id',req.params.id).select().single()
  if (error) return res.status(400).json({ error:error.message })
  res.json({ data })
}))

adminRouter.post('/settings-revisions/:id/publish', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: revision } = await supabaseAdmin.from('settings_revisions').select('*').eq('id',req.params.id).maybeSingle()
  if (!revision) return res.status(404).json({ error:'Settings revision not found' })
  if (revision.status === 'published') return res.json({ data:revision })
  if (revision.status !== 'draft') return res.status(409).json({ error:'Only draft settings can be published' })
  const { data, error } = await supabaseAdmin.rpc('publish_settings_revision', { target_revision_id:req.params.id, actor_user_id:actorId(req) })
  if (error) return res.status(409).json({ error:error.message })
  res.json({ data })
}))

// Legacy direct live-setting mutations are intentionally disabled. Use immutable revisions.
adminRouter.put('/settings/:key', (_req, res) => res.status(410).json({ error:'Direct live setting mutation is disabled. Edit and publish a settings revision.' }))
adminRouter.delete('/settings/:key', (_req, res) => res.status(410).json({ error:'Direct live setting mutation is disabled. Edit and publish a settings revision.' }))


adminRouter.get('/layouts', asyncRoute(async (_req, res) => {
  const { data: layouts, error } = await supabaseAdmin.from('layouts').select('*').eq('status','active').order('updated_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  const layoutIds = (layouts || []).map((layout: any) => layout.id)
  const [{ data: active }, { data: workspace }, versionsResult] = await Promise.all([
    supabaseAdmin.from('site_releases').select('layout_version_id').eq('status','active').maybeSingle(),
    supabaseAdmin.from('admin_workspace').select('*').eq('id',1).single(),
    layoutIds.length
      ? supabaseAdmin.from('layout_versions').select('*').in('layout_id', layoutIds).eq('status','published').order('version_number',{ascending:false})
      : Promise.resolve({ data: [], error: null }),
  ])
  if (versionsResult.error) return res.status(400).json({ error: versionsResult.error.message })
  const publishedVersions = versionsResult.data || []
  const versionIds = publishedVersions.map((version: any) => version.id)
  const pagesResult = versionIds.length
    ? await supabaseAdmin.from('layout_pages').select('id,layout_version_id,page_type,name,slug,route_pattern,sort_order').in('layout_version_id', versionIds).order('sort_order')
    : { data: [], error: null }
  if (pagesResult.error) return res.status(400).json({ error: pagesResult.error.message })
  const pagesByVersion = new Map<string, any[]>()
  for (const page of pagesResult.data || []) {
    const list = pagesByVersion.get(page.layout_version_id) || []
    list.push(page)
    pagesByVersion.set(page.layout_version_id, list)
  }
  const deployedRuntimeVersion = getDeployedPublicRuntimeVersion()
  const describeVersion = (version: any) => {
    const pages = pagesByVersion.get(version.id) || []
    const schemaCompatible = Number(version.schema_version) <= LAYOUT_SCHEMA_VERSION
    const runtimeCompatible = Boolean(deployedRuntimeVersion) && isRuntimeCompatible(version.runtime_min_version || '1.0.0', deployedRuntimeVersion || '0.0.0')
    return {
      ...version,
      pageCount: pages.filter((page: any) => page.page_type !== 'system').length,
      homePage: pages.find((page: any) => page.page_type === 'home') || null,
      compatible: schemaCompatible && runtimeCompatible,
      compatibilityReason: !deployedRuntimeVersion
        ? 'Deployed Public Web runtime version is not configured.'
        : !schemaCompatible
          ? `Layout schema ${version.schema_version} is newer than supported schema ${LAYOUT_SCHEMA_VERSION}.`
          : !runtimeCompatible
            ? `Requires Public Web runtime ${version.runtime_min_version || '1.0.0'} or newer; deployed runtime is ${deployedRuntimeVersion}.`
            : null,
      isLive: active?.layout_version_id === version.id,
      isConfiguring: workspace?.configuring_layout_version_id === version.id,
    }
  }
  const cards = (layouts || []).flatMap((layout: any) => {
    const versions = publishedVersions.filter((version: any) => version.layout_id === layout.id).map(describeVersion)
    if (!versions.length) return []
    const latestPublishedVersion = versions[0]
    return [{
      layout,
      versions,
      latestPublishedVersion,
      pageCount: latestPublishedVersion.pageCount,
      homePage: latestPublishedVersion.homePage,
      compatible: latestPublishedVersion.compatible,
      isLive: versions.some((version: any) => version.isLive),
      isConfiguring: versions.some((version: any) => version.isConfiguring),
      liveVersionId: active?.layout_version_id === latestPublishedVersion.id ? latestPublishedVersion.id : versions.find((version: any) => version.isLive)?.id || null,
      configuringVersionId: versions.find((version: any) => version.isConfiguring)?.id || null,
      deployedRuntimeVersion,
    }]
  })
  res.json({ data: cards, deployedRuntimeVersion })
}))

adminRouter.post('/layouts/:versionId/configure', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: version } = await supabaseAdmin.from('layout_versions').select('*').eq('id', req.params.versionId).eq('status','published').maybeSingle()
  if (!version) return res.status(404).json({ error: 'Published layout version not found' })
  const deployedRuntimeVersion = getDeployedPublicRuntimeVersion()
  if (!deployedRuntimeVersion) return res.status(409).json({ error: 'PUBLIC_WEB_RUNTIME_VERSION must identify the deployed Public Web runtime before configuring a release candidate layout.' })
  if (Number(version.schema_version) > LAYOUT_SCHEMA_VERSION || !isRuntimeCompatible(version.runtime_min_version || '1.0.0', deployedRuntimeVersion)) {
    return res.status(409).json({ error: `Layout version is incompatible with deployed Public Web runtime ${deployedRuntimeVersion}. Choose a compatible published version.` })
  }
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
  const { data, error } = await supabaseAdmin.rpc('get_or_create_content_draft', { actor_user_id: actorId(req) })
  if (error) return res.status(409).json({ error: error.message })
  res.json({ data })
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
  const key = String(req.body.key || '').trim()
  if (!key) return res.status(400).json({ error:'key required' })
  let versionId = String(req.body.version_id || '')
  if (!versionId) { const { data: workspace } = await supabaseAdmin.from('admin_workspace').select('configuring_layout_version_id').eq('id',1).maybeSingle(); versionId = workspace?.configuring_layout_version_id || '' }
  if (!versionId) return res.status(422).json({ error:'Select a published layout before editing typed content.' })
  const document = await loadEditorDocument(supabaseAdmin, versionId)
  const slot = collectContentSlots(document).find((candidate) => candidate.key === key)
  if (!slot) return res.status(422).json({ error:`Content key ${key} is not declared by the selected layout.` })
  const { data: mediaRows } = await supabaseAdmin.from('media').select('id')
  const issues = validateContentValue(slot, req.body.value, new Set((mediaRows || []).map((row:any) => String(row.id))))
  if (issues.some((entry) => entry.severity === 'error')) return res.status(422).json({ error:'Content value does not match the layout content contract.', validation:{ valid:false, issues } })
  const values = { ...(revision.values_json || {}), [key]: req.body.value }
  const { data, error } = await supabaseAdmin.from('content_revisions').update({ values_json:values }).eq('id',req.params.id).select().single()
  if (error) return res.status(400).json({ error:error.message })
  res.json({ data, compatibility:buildContentCompatibility(document, values) })
}))

adminRouter.post('/content-revisions/:id/publish', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: revision } = await supabaseAdmin.from('content_revisions').select('*').eq('id',req.params.id).maybeSingle()
  if (!revision) return res.status(404).json({ error:'Content revision not found' })
  if (revision.status === 'published') return res.json({ data:revision })
  if (revision.status !== 'draft') return res.status(409).json({ error:'Only draft content can be published' })
  let versionId = String(req.body.version_id || '')
  if (!versionId) { const { data: workspace } = await supabaseAdmin.from('admin_workspace').select('configuring_layout_version_id').eq('id',1).maybeSingle(); versionId = workspace?.configuring_layout_version_id || '' }
  if (!versionId) return res.status(422).json({ error:'A selected published layout is required to validate content before publish.' })
  const document = await loadEditorDocument(supabaseAdmin, versionId)
  if (document.versionStatus !== 'published') return res.status(409).json({ error:'Content can only be published against a published layout version.' })
  const compatibility = buildContentCompatibility(document, revision.values_json || {})
  const issues:any[] = compatibility.missingRequired.map((slot) => ({ severity:'error',code:'content.required-missing',message:`Required content ${slot.key} is missing.`,pageId:slot.pageId,nodeId:slot.nodeId }))
  const { data: mediaRows } = await supabaseAdmin.from('media').select('id')
  const mediaIds = new Set((mediaRows || []).map((row:any) => String(row.id)))
  for (const slot of compatibility.slots) issues.push(...validateContentValue(slot, revision.values_json?.[slot.key], mediaIds))
  if (issues.some((entry) => entry.severity === 'error')) return res.status(422).json({ error:'Content publication blocked by layout contract errors.', validation:{ valid:false,issues }, compatibility })
  const { data, error } = await supabaseAdmin.rpc('publish_content_revision', { target_revision_id:req.params.id, actor_user_id:actorId(req) })
  if (error) return res.status(409).json({ error:error.message })
  res.json({ data, compatibility })
}))

adminRouter.get('/content', asyncRoute(async (_req,res) => { const { data,error } = await supabaseAdmin.from('site_content').select('*').order('key'); if(error)return res.status(400).json({error:error.message});res.json({data:data||[]}) }))
adminRouter.put('/content/:key', (_req,res) => res.status(410).json({ error:'Direct live content mutation is disabled. Edit and publish a content revision.' }))


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
  if (!settingsRevisionId) {
    const { data: latest } = await supabaseAdmin.from('settings_revisions').select('*').eq('status','published').order('revision_number',{ascending:false}).limit(1).maybeSingle()
    settingsRevisionId = latest?.id || ''
  }
  if (!settingsRevisionId) return res.status(400).json({ error:'Publish a settings revision before creating a release' })
  const { data: settingsRevision } = await supabaseAdmin.from('settings_revisions').select('*').eq('id',settingsRevisionId).eq('status','published').maybeSingle()
  if (!settingsRevision) return res.status(400).json({ error:'Published settings revision not found' })
  const collections = await getPublishedCollections(supabaseAdmin)

  // Preflight the exact immutable inputs before allocating an append-only release number.
  // This prevents obviously incompatible content/layout/settings combinations from becoming
  // permanent Draft releases while preserving post-create media certification as the
  // authoritative accounting step for the frozen candidate snapshot.
  const deployedRuntimeVersion = getDeployedPublicRuntimeVersion()
  if (!deployedRuntimeVersion) return res.status(503).json({ error: 'PUBLIC_WEB_RUNTIME_VERSION must identify the deployed Public Web runtime before creating a release candidate.' })
  const document = await loadEditorDocument(supabaseAdmin, versionId)
  const { data: mediaRows, error: mediaRowsError } = await supabaseAdmin.from('media').select('id')
  if (mediaRowsError) return res.status(503).json({ error: 'Release preflight could not load the canonical media registry.' })
  const preflight = validateReleaseCandidate(document, revision.values_json || {}, {
    runtimeVersion: deployedRuntimeVersion,
    runtimeMinVersion: version.runtime_min_version || '1.0.0',
    mediaIds: new Set((mediaRows || []).map((row: any) => String(row.id))),
    settings: settingsRevision.values_json || {},
    collections,
  })
  if (!preflight.valid) return res.status(422).json({
    error: 'Release candidate is incompatible with the selected layout/content/settings snapshot.',
    validation: preflight,
  })

  // New releases use release_media_references as the only runtime media authority.
  // media_snapshot remains an empty legacy compatibility field.
  const { data: release, error } = await supabaseAdmin.rpc('create_site_release', {
    target_layout_version_id: versionId,
    target_content_revision_id: revisionId,
    target_settings_revision_id: settingsRevisionId,
    collections_snapshot_value: collections,
    media_snapshot_value: {},
    notes_value: req.body.notes || 'Release candidate',
    actor_user_id: actorId(req),
  })
  if (error) return res.status(409).json({ error:`Release candidate creation failed: ${error.message}` })
  const mediaOutcome = await collectAndCertifyReleaseCandidateMedia(supabaseAdmin, release as CreatedRelease, actorId(req))
  res.status(201).json({
    data: mediaOutcome.release,
    releaseCreated: true,
    mediaCertification: {
      status: mediaOutcome.status,
      certified: mediaOutcome.mediaCertified,
      complete: mediaOutcome.collection?.complete || false,
      mediaIds: mediaOutcome.collection?.mediaIds || [],
      issues: mediaOutcome.collection?.unresolved || [],
      external: mediaOutcome.collection?.external || [],
      ...(mediaOutcome.error ? { error: mediaOutcome.error } : {}),
    },
  })
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
  const media = await getReleaseMediaMap(supabaseAdmin, release)
  const manifest = manifestFromDocument(document,{ releaseId:release.id,releaseNumber:release.release_number,content:contentRevision?.values_json||{},settings:release.settings_snapshot||{},media,collections:release.collections_snapshot||{},contentRevisionId:release.content_revision_id,settingsRevisionId:release.settings_revision_id,runtimeMinVersion })
  res.json({ data:{ manifest,validation:result,release } })
}))

adminRouter.post('/releases/:id/activate', asyncRoute(async (req:AuthedRequest,res) => {
  const { data:release } = await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle()
  if (!release) return res.status(404).json({error:'Release not found'})
  if (release.status !== 'ready') return res.status(409).json({error:'Only a validated ready release can be activated'})
  const activationCheck = await validateRelease(supabaseAdmin, release)
  if (!activationCheck.result.valid) return res.status(422).json({ error:'Activation blocked because the release no longer passes runtime/media checks', validation:activationCheck.result })
  const {data,error}=await supabaseAdmin.rpc('activate_release',{target_release_id:req.params.id,expected_snapshot_revision_token:release.snapshot_revision_token,actor_user_id:actorId(req)})
  if(error)return res.status(409).json({error:`Atomic activation failed: ${error.message}`})
  invalidatePublicManifestCache()
  res.json({data})
}))
adminRouter.post('/releases/:id/rollback', asyncRoute(async (req:AuthedRequest,res) => {
  const {data:release}=await supabaseAdmin.from('site_releases').select('*').eq('id',req.params.id).maybeSingle(); if(!release)return res.status(404).json({error:'Release not found'})
  if (release.status !== 'superseded') return res.status(409).json({error:'Only a superseded release can be selected for rollback'})
  const {result,runtimeVersion}=await validateRelease(supabaseAdmin,release);if(!result.valid)return res.status(422).json({error:'Rollback blocked by validation errors',validation:result})
  const {data,error}=await supabaseAdmin.rpc('rollback_release',{target_release_id:req.params.id,expected_snapshot_revision_token:release.snapshot_revision_token,validation_issues:result.issues,validated_runtime_version:runtimeVersion,actor_user_id:actorId(req)});if(error)return res.status(409).json({error:`Atomic rollback failed: ${error.message}`})
  invalidatePublicManifestCache()
  res.json({data})
}))
adminRouter.get('/releases/:id/media-certification', asyncRoute(async (req, res) => {
  const { data: release, error } = await supabaseAdmin.from('site_releases').select('*').eq('id', req.params.id).maybeSingle()
  if (error || !release) return res.status(404).json({ error: 'Release not found' })
  if (Number(release.media_snapshot_version || 0) === 1) {
    const { data: refs } = await supabaseAdmin.from('release_media_references').select('*').eq('site_release_id', release.id).order('media_id')
    return res.json({ data: { release, certified: true, references: refs || [] } })
  }
  const collection = await collectLegacyReleaseMedia(supabaseAdmin, release as CreatedRelease)
  const storageIssues = collection.complete && !collection.unresolved.length
    ? await validateCanonicalMediaStorageObjects(supabaseAdmin, collection.mediaIds)
    : []
  res.json({ data: { release, certified: false, collection, storageIssues } })
}))

adminRouter.get('/releases/:id/media-resolutions', asyncRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('release_media_legacy_resolutions').select('site_release_id,legacy_value,media_id,created_at,media:media_id(id,filename,public_url,storage_path,mime_type)').eq('site_release_id', req.params.id).order('legacy_value')
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data: data || [] })
}))

adminRouter.post('/releases/:id/media-resolutions', asyncRoute(async (req: AuthedRequest, res) => {
  const legacyValue = String(req.body?.legacy_value || '').trim()
  const mediaId = String(req.body?.media_id || '').trim()
  if (!legacyValue || !mediaId) return res.status(422).json({ error: 'legacy_value and media_id are required' })
  const { data, error } = await supabaseAdmin.rpc('set_release_media_legacy_resolution', { target_release_id: req.params.id, exact_legacy_value: legacyValue, target_media_id: mediaId, actor_user_id: actorId(req) })
  if (error) return res.status(409).json({ error: error.message })
  res.json({ data })
}))

adminRouter.post('/releases/:id/media-certification', asyncRoute(async (req: AuthedRequest, res) => {
  const { data: release, error } = await supabaseAdmin.from('site_releases').select('*').eq('id', req.params.id).maybeSingle()
  if (error || !release) return res.status(404).json({ error: 'Release not found' })
  try {
    const outcome = await certifyLegacyReleaseMedia(supabaseAdmin, release as CreatedRelease, actorId(req))
    if (!outcome.certified) {
      const storageBlocked = outcome.storageIssues?.some((issue) => issue.severity === 'error')
      return res.status(422).json({ error: storageBlocked ? 'Historical release media certification is blocked because one or more managed Storage objects are unavailable.' : 'Historical release media collection is incomplete. Resolve managed media references before certification.', data: outcome })
    }
    invalidatePublicManifestCache()
    res.json({ data: outcome })
  } catch (cause) { res.status(409).json({ error: cause instanceof Error ? cause.message : 'Historical media certification failed' }) }
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

adminRouter.get('/security/status', (_req, res) => res.json({ data: {
  mode: securityConfig.mode,
  distributedRateLimit: securityConfig.rateLimitStore === 'supabase',
  privilegedMfaRequired: securityConfig.privilegedAal2Required,
  publicCacheSeconds: securityConfig.publicCacheSeconds,
  publicStaleSeconds: securityConfig.publicStaleSeconds,
  requestTimeoutMs: securityConfig.requestTimeoutMs,
} }))

app.use('/api/studio', studioRouter)
app.use('/api/admin', adminRouter)

app.use((_req, res) => res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND', requestId: res.locals.requestId }))

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  const message = String(error?.message || '')
  console.error(JSON.stringify({ level: 'error', event: 'unhandled_request_error', requestId: res.locals.requestId, error: message, stack: isProduction ? undefined : error?.stack }))
  if (message.includes('not allowed')) return res.status(403).json({ error: 'Origin is not allowed', code: 'CORS_DENIED', requestId: res.locals.requestId })
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE', requestId: res.locals.requestId })
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Malformed JSON request body', code: 'INVALID_JSON', requestId: res.locals.requestId })
  res.status(500).json({ error: isProduction ? 'Internal server error' : message || 'Internal server error', code: 'INTERNAL_ERROR', requestId: res.locals.requestId })
})

const server = app.listen(PORT, () => console.log(`Platform API listening on http://localhost:${PORT} (security: ${securityConfig.mode}, auth bypass: ${DEV_BYPASS_AUTH})`))
server.requestTimeout = securityConfig.requestTimeoutMs
server.headersTimeout = securityConfig.headersTimeoutMs
server.keepAliveTimeout = securityConfig.keepAliveTimeoutMs
server.maxHeadersCount = 100

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }))
  const forceExit = setTimeout(() => { console.error(JSON.stringify({ level: 'error', event: 'shutdown_forced' })); process.exit(1) }, Math.max(10_000, securityConfig.requestTimeoutMs + 2_000))
  forceExit.unref()
  server.close(() => {
    clearTimeout(forceExit)
    console.log(JSON.stringify({ level: 'info', event: 'shutdown_complete' }))
    process.exit(0)
  })
}
process.once('SIGTERM', () => { void shutdown('SIGTERM') })
process.once('SIGINT', () => { void shutdown('SIGINT') })
