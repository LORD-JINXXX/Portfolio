import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

test('canonical StudioNode contract exists only in contracts package', () => {
  const contract = read('packages/contracts/src/index.ts')
  assert.match(contract, /export interface StudioNode\s*{/)
  const candidates = [
    'packages/builder-core/src/editor-state.ts',
    'packages/runtime-renderer/src/index.tsx',
    'apps/studio/src/StudioEditor.tsx',
  ]
  for (const file of candidates) assert.doesNotMatch(read(file), /interface StudioNode\s*{/)
})

test('Studio editor and Admin/Public preview all use the shared runtime renderer', () => {
  const studio = read('apps/studio/src/StudioEditor.tsx')
  const admin = read('apps/admin/src/App.tsx')
  const web = read('apps/web/src/App.tsx')
  assert.match(studio, /RuntimeRenderer/)
  assert.match(studio, /RuntimeSitePreview/)
  assert.match(admin, /RuntimeSitePreview/)
  assert.match(web, /RuntimeSitePreview/)
  assert.equal(exists('apps/studio/src/StudioCanvas.tsx'), false)
})

test('Admin and Studio app themes are independent from layout design tokens', () => {
  const theme = read('packages/ui/src/theme.tsx')
  const admin = read('apps/admin/src/App.tsx')
  const studioApp = read('apps/studio/src/App.tsx')
  const inspector = read('apps/studio/src/Inspector.tsx')
  for (const key of ['--surface-alt','--border-hover','--text-muted','--text-secondary','--primary-hover','--primary-text','--workspace']) assert.match(theme, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  assert.match(admin, /portfolio-admin-theme/)
  assert.match(studioApp, /portfolio-studio-theme/)
  assert.match(inspector, /TokensTab/)
  assert.match(inspector, /--site-/)
})

test('API uses authenticated Admin/Studio routers and explicit CORS origins', () => {
  const api = read('apps/api/src/index.ts')
  const auth = read('apps/api/src/lib/auth.ts')
  assert.match(api, /app\.use\('\/api\/studio',\s*studioRouter\)/)
  assert.match(api, /app\.use\('\/api\/admin',\s*adminRouter\)/)
  assert.match(auth, /createRequireAdmin/)
  assert.match(auth, /createRequireStudio/)
  assert.match(api, /allowedOrigins/)
  assert.doesNotMatch(api, /app\.use\(cors\(\)\)/)
})

test('API runtime package entrypoints expose required named values through tsx', () => {
  const script = `
    import { ANIMATION_PRESETS } from '@platform/animation-runtime'
    import { cloneNodeWithFreshIds, createBlankDocument, createCosmicPortfolioTemplate, slugify } from '@platform/builder-core'
    import { LAYOUT_SCHEMA_VERSION, RUNTIME_VERSION } from '@platform/contracts'
    import { createServerSupabaseClients } from '@platform/supabase'
    import { buildContentCompatibility, collectContentSlots, isRuntimeCompatible, validateEditorDocument } from '@platform/validation'
    const required = [cloneNodeWithFreshIds, createBlankDocument, createCosmicPortfolioTemplate, slugify, createServerSupabaseClients, buildContentCompatibility, collectContentSlots, isRuntimeCompatible, validateEditorDocument]
    if (!Array.isArray(ANIMATION_PRESETS) || ANIMATION_PRESETS.length === 0 || required.some(value => typeof value !== 'function') || !LAYOUT_SCHEMA_VERSION || !RUNTIME_VERSION) process.exit(1)
  `
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('release flow has immutable snapshots and only atomic activation', () => {
  const api = read('apps/api/src/index.ts')
  const migration = read('supabase/migrations/20260808000100_platform_phase5_complete.sql')
  assert.match(api, /settings_snapshot:settings/)
  assert.match(api, /collections_snapshot:collections/)
  assert.match(api, /media_snapshot:mediaSnapshot/)
  assert.match(api, /rpc\('activate_release'/)
  assert.doesNotMatch(api, /Atomic activation failed[\s\S]*supabaseAdmin\.from\('site_releases'\)\.update\(\{ status:'superseded'/)
  assert.match(migration, /create unique index if not exists one_active_site_release/i)
  assert.match(migration, /create or replace function public\.activate_release/i)
})

test('Public Web uses clean browser routes and runtime manifest bootstrap', () => {
  const web = read('apps/web/src/App.tsx')
  assert.match(web, /BrowserRouter/)
  assert.doesNotMatch(web, /HashRouter/)
  assert.match(web, /\/api\/public\/runtime/)
  assert.match(web, /linkMode="browser"/)
  assert.match(read('apps/web/vercel.json'), /index\.html/)
})

test('Studio persistence includes pages and immutable publication workflow', () => {
  const api = read('apps/api/src/index.ts')
  const platform = read('apps/api/src/lib/platform.ts')
  const contracts = read('packages/contracts/src/index.ts')
  const migration = read('supabase/migrations/20260808000100_platform_phase5_complete.sql')
  const repairMigration = read('supabase/migrations/20260808000200_repair_group_2_studio_persistence_integrity.sql')
  assert.match(api, /studioRouter\.put\('\/versions\/:id\/document'/)
  assert.match(api, /rpc\('save_layout_document'/)
  assert.match(api, /pages_value: candidate\.pages\.map/)
  assert.match(api, /Published\/archived versions are immutable/)
  assert.match(api, /studioRouter\.post\('\/versions\/:id\/publish'/)
  assert.match(api, /rpc\('publish_layout_version'/)
  assert.match(api, /expected_revision_token: revisionToken/)
  assert.match(platform, /revisionToken: version\.revision_token/)
  assert.match(platform, /revisionToken === version\?\.revision_token/)
  assert.match(contracts, /revisionToken\?: string/)
  assert.match(api, /studioRouter\.post\('\/layouts\/:id\/drafts'/)
  assert.match(migration, /Page % belongs to another layout version/)
  assert.match(migration, /old_version_status/)
  assert.match(migration, /new_version_status/)
  assert.match(repairMigration, /security definer\s+set search_path = pg_catalog, pg_temp/i)
  assert.match(repairMigration, /Draft changed after validation\. Revalidate before publishing/)
})

test('Blank and Cosmic layout creation use one atomic collision-safe RPC', () => {
  const studio = read('apps/studio/src/App.tsx')
  const api = read('apps/api/src/index.ts')
  const migration = read('supabase/migrations/20260808000300_repair_group_2_atomic_layout_creation.sql')
  const route = api.slice(api.indexOf("studioRouter.post('/layouts'"), api.indexOf("studioRouter.get('/layouts/:id/editor'"))
  assert.match(studio, /template==='cosmic'\?'Cosmic Portfolio':'Untitled Layout'/)
  assert.match(route, /rpc\('create_layout_document'/)
  assert.match(route, /pages_value: document\.pages\.map/)
  assert.doesNotMatch(route, /from\('layouts'\)\.insert|from\('layout_versions'\)\.insert|from\('layout_pages'\)\.insert/)
  assert.match(route, /Layout creation failed\. No layout was created\./)
  assert.match(migration, /exception when unique_violation/i)
  assert.match(migration, /layouts_slug_key/i)
})

test('Studio editor deep link hydrates the exact persisted layout version', () => {
  const main = read('apps/studio/src/main.tsx')
  const app = read('apps/studio/src/App.tsx')
  const routing = read('apps/studio/src/routing.ts')
  const api = read('apps/api/src/index.ts')
  assert.match(main, /BrowserRouter/)
  assert.match(routing, /\/layouts\/\$\{encodeURIComponent\(layoutId\)\}\/versions\/\$\{encodeURIComponent\(versionId\)\}\/editor/)
  assert.match(app, /parseStudioEditorRoute\(location\.pathname\)/)
  assert.match(app, /selectedPageFromSearch\(location\.search\)/)
  assert.match(app, /editor\.loadDocument\(document, preferredPageId\)/)
  assert.match(app, /\/api\/studio\/layouts\/\$\{editorRoute\.layoutId\}\/versions\/\$\{editorRoute\.versionId\}\/editor/)
  assert.match(api, /studioRouter\.get\('\/layouts\/:layoutId\/versions\/:versionId\/editor'/)
  assert.match(api, /\.eq\('id', req\.params\.versionId\)\.eq\('layout_id', req\.params\.layoutId\)/)
  assert.match(app, /Returned to the Layout Library/)
})

test('Studio Canvas, Layers and Inspector share non-persistent node selection', () => {
  const studio = read('apps/studio/src/StudioEditor.tsx')
  const builder = read('packages/builder-core/src/editor-state.ts')
  assert.match(studio, /canvasNodeIdFromTarget\(event\.target\)/)
  assert.match(studio, /event\.stopPropagation\(\);editor\.selectNode/)
  assert.match(studio, /onClick=\{selectCanvasNode\}/)
  assert.match(studio, /selectedNodeId=\{state\.selectedNodeId\}/)
  assert.doesNotMatch(studio, /onNodeClick=\{node=>editor\.selectNode/)
  assert.match(studio, /selected=\{state\.selectedNodeId\} onSelect=\{editor\.selectNode\}/)
  assert.match(studio, /const selected=state\.selectedNodeId\?findNodeById/)
  assert.match(studio, /<Inspector node=\{selected\}/)
  assert.match(studio, /onClick=\{\(\)=>editor\.selectNode\(null\)\}/)
  assert.match(builder, /selectNode: \(id: string \| null\) => setState\(\(prev\) => \(\{ \.\.\.prev, selectedNodeId: id \}\)\)/)
})

test('Admin implements layout gallery, visual content editor and release preview', () => {
  const admin = read('apps/admin/src/App.tsx')
  assert.match(admin, /function Layouts/)
  assert.match(admin, /function VisualContent/)
  assert.match(admin, /function ReleasePreview/)
  assert.match(admin, /Content Inspector/)
  assert.match(admin, /Save Draft/)
  assert.match(admin, /Configure/)
})

test('environment secrets are gitignored and example files are provided', () => {
  const gitignore = read('.gitignore')

  assert.match(gitignore, /^\.env\*$/m)
  assert.match(gitignore, /^!\.env\.example$/m)

  for (const dir of ['apps/api', 'apps/web', 'apps/admin', 'apps/studio']) {
    assert.equal(exists(path.join(dir, '.env.example')), true)
  }
})


test('Admin visual content editor can inspect site settings and structured collections', () => {
  const admin = read('apps/admin/src/App.tsx')
  const renderer = read('packages/runtime-renderer/src/index.tsx')
  assert.match(admin, /b\.type==='collection'/)
  assert.match(admin, /Manage \{pretty\(b\.collection\)\}/)
  assert.match(admin, /Open Settings/)
  assert.match(renderer, /binding\.type === 'content' \|\| binding\.type === 'setting' \|\| binding\.type === 'collection'/)
})

test('workspace imports shared packages through declared package entrypoints', () => {
  for (const file of ['apps/api/src/index.ts','apps/studio/src/Inspector.tsx']) assert.doesNotMatch(read(file), /@platform\/builder-core\/animations/)
  assert.match(read('packages/builder-core/src/index.ts'), /export \* from '\.\/animations'/)
  assert.match(read('apps/api/src/index.ts'), /ANIMATION_PRESETS \} from '@platform\/animation-runtime'/)
})

test('release UI distinguishes activation from rollback', () => {
  const admin = read('apps/admin/src/App.tsx')
  assert.doesNotMatch(admin, /Activate \/ Rollback/)
  assert.match(admin, /r\.status==='superseded'\?'Rollback':'Activate'/)
})


test('Admin Site Content tabs use RuntimeRoute.pageId rather than a nonexistent route id', () => {
  const admin = read('apps/admin/src/App.tsx')
  assert.match(admin, /ordinary\.map\(route=>\(\{id:route\.pageId,name:route\.name,schema:route\.schema\}\)\)/)
  assert.match(admin, /previewMode\?manifest:\{\.\.\.manifest,globals:\{\}\}/)
})
