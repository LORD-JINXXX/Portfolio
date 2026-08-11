import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql=fs.readFileSync(new URL('../supabase/migrations/20260808000100_platform_phase5_complete.sql',import.meta.url),'utf8')
const repairGroup2Sql=fs.readFileSync(new URL('../supabase/migrations/20260808000200_repair_group_2_studio_persistence_integrity.sql',import.meta.url),'utf8')
const atomicCreateSql=fs.readFileSync(new URL('../supabase/migrations/20260808000300_repair_group_2_atomic_layout_creation.sql',import.meta.url),'utf8')
const repairGroup3Sql=fs.readFileSync(new URL('../supabase/migrations/20260808000400_repair_group_3_release_integrity.sql',import.meta.url),'utf8')
const layoutLifecycleSql=fs.readFileSync(new URL('../supabase/migrations/20260808000500_studio_layout_lifecycle.sql',import.meta.url),'utf8')
const releaseMediaIntegritySql=fs.readFileSync(new URL('../supabase/migrations/20260808000600_repair_group_4_release_media_integrity.sql',import.meta.url),'utf8')
const legacyMediaReconciliationSql=fs.readFileSync(new URL('../supabase/migrations/20260808000700_repair_group_4_legacy_media_schema_reconciliation.sql',import.meta.url),'utf8')
const structuredMediaSql=fs.readFileSync(new URL('../supabase/migrations/20260808000800_repair_group_4_structured_media_normalization.sql',import.meta.url),'utf8')
const releaseMediaCertificationSql=fs.readFileSync(new URL('../supabase/migrations/20260808000900_repair_group_4_release_media_certification.sql',import.meta.url),'utf8')
const releaseMediaEnforcementSql=fs.readFileSync(new URL('../supabase/migrations/20260808001000_repair_group_4_release_media_enforcement.sql',import.meta.url),'utf8')
const mediaDeleteSql=fs.readFileSync(new URL('../supabase/migrations/20260808001100_repair_group_4_race_safe_media_delete.sql',import.meta.url),'utf8')
const legacyCertificationSql=fs.readFileSync(new URL('../supabase/migrations/20260808001200_repair_group_4_legacy_release_media_certification.sql',import.meta.url),'utf8')
const revisionRlsSql=fs.readFileSync(new URL('../supabase/migrations/20260808001300_repair_groups_7_8_revision_and_rls_hardening.sql',import.meta.url),'utf8')
const legacyResolutionSql=fs.readFileSync(new URL('../supabase/migrations/20260808001400_repair_group_4_legacy_media_resolution.sql',import.meta.url),'utf8')
const revisionWorkflowSql=fs.readFileSync(new URL('../supabase/migrations/20260808001500_repair_group_7_revision_workflow_integrity.sql',import.meta.url),'utf8')
const mediaAuditHardeningSql=fs.readFileSync(new URL('../supabase/migrations/20260808001600_repair_groups_4_8_media_delete_audit_hardening.sql',import.meta.url),'utf8')
const atomicDraftCloneSql=fs.readFileSync(new URL('../supabase/migrations/20260808001700_repair_group_6_atomic_layout_draft_clone.sql',import.meta.url),'utf8')
const phase5MigrationFiles=[
  '20260808000900_repair_group_4_release_media_certification.sql',
  '20260808001000_repair_group_4_release_media_enforcement.sql',
  '20260808001100_repair_group_4_race_safe_media_delete.sql',
  '20260808001200_repair_group_4_legacy_release_media_certification.sql',
  '20260808001300_repair_groups_7_8_revision_and_rls_hardening.sql',
  '20260808001400_repair_group_4_legacy_media_resolution.sql',
  '20260808001500_repair_group_7_revision_workflow_integrity.sql',
  '20260808001600_repair_groups_4_8_media_delete_audit_hardening.sql',
  '20260808001700_repair_group_6_atomic_layout_draft_clone.sql',
]

function stripSqlStringsAndComments(value:string){
  return value
    .replace(/'(?:''|[^'])*'/gs,"''")
    .replace(/--[^\n\r]*/g,'')
    .replace(/\/\*[\s\S]*?\*\//g,'')
}

function assertBalancedSqlBody(body:string,fileName:string,bodyIndex:number){
  const normalized=stripSqlStringsAndComments(body)
  let parentheses=0
  let brackets=0
  for(const character of normalized){
    if(character==='(') parentheses += 1
    else if(character===')') parentheses -= 1
    else if(character==='[') brackets += 1
    else if(character===']') brackets -= 1
    assert.ok(parentheses>=0,`${fileName} body ${bodyIndex} closes a parenthesis before it opens`)
    assert.ok(brackets>=0,`${fileName} body ${bodyIndex} closes a bracket before it opens`)
  }
  assert.equal(parentheses,0,`${fileName} body ${bodyIndex} has unbalanced parentheses`)
  assert.equal(brackets,0,`${fileName} body ${bodyIndex} has unbalanced brackets`)

  // PL/pgSQL block END tokens and SQL CASE-expression END tokens share the
  // same spelling. Count both sources so an accidental duplicated BEGIN/END
  // in a migration body is caught without rejecting legitimate CASE ... END.
  const beginCount=(normalized.match(/\bbegin\b/gi)||[]).length
  const caseCount=(normalized.match(/(?<!\bend\s)\bcase\b/gi)||[]).length
  const plainEndCount=(normalized.match(/\bend\b(?!\s+(?:if|loop|case|while|for)\b)/gi)||[]).length
  assert.equal(
    plainEndCount,
    beginCount+caseCount,
    `${fileName} body ${bodyIndex} has an unmatched PL/pgSQL BEGIN/END or CASE/END`,
  )
}
const repairGroup2Migrations=[sql,repairGroup2Sql]
test('Phase 5 forward migrations have balanced dollar-quoted SQL/PLpgSQL bodies',()=>{
  for(const fileName of phase5MigrationFiles){
    const migration=fs.readFileSync(new URL(`../supabase/migrations/${fileName}`,import.meta.url),'utf8')
    const bodies=[...migration.matchAll(/\$\$([\s\S]*?)\$\$/g)].map(match=>match[1])
    assert.ok(bodies.length>0,`${fileName} should contain at least one dollar-quoted body`)
    bodies.forEach((body,index)=>assertBalancedSqlBody(body,fileName,index))
  }
})

test('migration defines atomic release activation and one-active invariant',()=>{assert.match(sql,/create or replace function public\.activate_release/i);assert.match(sql,/one_active_site_release/i);assert.match(sql,/where status = 'active'/i)})
test('migration protects published layouts and content',()=>{assert.match(sql,/Published layout versions are immutable/);assert.match(sql,/Pages in published layout versions are immutable/);assert.match(sql,/Published content revisions are immutable/)})
test('Studio document persistence is atomic and rejects cross-version page ownership',()=>{for(const migration of repairGroup2Migrations){assert.match(migration,/create or replace function public\.save_layout_document/i);assert.match(migration,/Page % belongs to another layout version/i);assert.match(migration,/where id = target_version_id and layout_id = target_layout_id\s+for update/i)}})
test('page immutability is privileged, serialized and rejects every version reassignment',()=>{for(const migration of repairGroup2Migrations){assert.match(migration,/create or replace function public\.protect_published_layout_page\(\)[\s\S]*?security definer[\s\S]*?set search_path = pg_catalog, pg_temp/i);assert.match(migration,/old_version_status/i);assert.match(migration,/new_version_status/i);assert.match(migration,/select status into old_version_status[\s\S]*for update/i);assert.match(migration,/select status into new_version_status[\s\S]*for update/i);assert.match(migration,/new\.layout_version_id is distinct from old\.layout_version_id/i);assert.match(migration,/set revision_token = gen_random_uuid\(\)/i)}})
test('layout publication requires the exact validated draft revision',()=>{for(const migration of repairGroup2Migrations){assert.match(migration,/revision_token uuid not null default gen_random_uuid\(\)/i);assert.match(migration,/drop function if exists public\.publish_layout_version\(uuid, text, text\)/i);assert.match(migration,/expected_revision_token uuid/i);assert.match(migration,/published\.revision_token is distinct from expected_revision_token/i);assert.match(migration,/where id = target_version_id and status = 'draft' and revision_token = expected_revision_token/i);assert.match(migration,/Draft changed after validation\. Revalidate before publishing/i)}})
test('Repair Group 2 forward migration is narrow and service-role-only',()=>{const functions=[...repairGroup2Sql.matchAll(/create or replace function public\.(\w+)/gi)].map(match=>match[1]).sort();assert.deepEqual(functions,['protect_published_layout_page','protect_published_layout_version','publish_layout_version','save_layout_document']);assert.equal((repairGroup2Sql.match(/\balter table\b/gi)||[]).length,1);assert.match(repairGroup2Sql,/alter table public\.layout_versions add column if not exists revision_token uuid not null default gen_random_uuid\(\)/i);assert.doesNotMatch(repairGroup2Sql,/\b(?:create|drop)\s+table\b/i);assert.doesNotMatch(repairGroup2Sql,/\b(?:create|drop)\s+policy\b/i);assert.doesNotMatch(repairGroup2Sql,/\bsite_releases\b|\bactivate_release\b|\bstorage\.objects\b/i);assert.match(repairGroup2Sql,/revoke all on function public\.protect_published_layout_page\(\) from public, anon, authenticated/i);assert.match(repairGroup2Sql,/revoke all on function public\.save_layout_document[\s\S]*from public, anon, authenticated/i);assert.match(repairGroup2Sql,/grant execute on function public\.save_layout_document[\s\S]*to service_role/i);assert.match(repairGroup2Sql,/revoke all on function public\.publish_layout_version\(uuid, uuid, text, text\) from public, anon, authenticated/i);assert.match(repairGroup2Sql,/grant execute on function public\.publish_layout_version\(uuid, uuid, text, text\) to service_role/i)})
test('initial layout creation atomically inserts the layout, draft and starter pages',()=>{assert.match(atomicCreateSql,/create or replace function public\.create_layout_document/i);assert.match(atomicCreateSql,/insert into public\.layouts/i);assert.match(atomicCreateSql,/insert into public\.layout_versions/i);assert.match(atomicCreateSql,/insert into public\.layout_pages/i);assert.match(atomicCreateSql,/status, design_tokens, created_by[\s\S]*'draft'/i);assert.doesNotMatch(atomicCreateSql,/delete from public\.layouts/i);assert.match(atomicCreateSql,/grant execute on function public\.create_layout_document[\s\S]*to service_role/i)})
test('atomic layout creation retries only slug conflicts with deterministic suffixes',()=>{assert.match(atomicCreateSql,/exception when unique_violation/i);assert.match(atomicCreateSql,/violated_constraint <> 'layouts_slug_key'/i);assert.match(atomicCreateSql,/slug_suffix := slug_suffix \+ 1/i);assert.match(atomicCreateSql,/candidate_slug := normalized_slug \|\| '-' \|\| slug_suffix::text/i);assert.doesNotMatch(atomicCreateSql,/\bsite_releases\b|\bactivate_release\b|\bstorage\.objects\b/i)})
test('atomic layout slug normalization lowercases before filtering',()=>{assert.match(atomicCreateSql,/normalized_slug := btrim\(regexp_replace\(lower\(coalesce\(layout_slug_base_value, ''\)\), '\[\^a-z0-9\]\+', '-', 'g'\), '-'\)/i);assert.equal('My Layout'.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),'my-layout')})
test('normal profile updates cannot self-promote role',()=>{assert.match(sql,/profiles_admin_update/);assert.match(sql,/role = 'admin'/)})

test('release snapshots include media references',()=>{assert.match(sql,/media_snapshot jsonb/i)})
test('draft deletes return OLD instead of silently cancelling',()=>{assert.match(sql,/if tg_op = 'DELETE' then return old; end if;/i)})

test('settings revisions and activated release snapshots are immutable',()=>{assert.match(sql,/Published settings revisions are immutable/);assert.match(sql,/Activated release snapshots are immutable/)})

test('Repair Group 3 allocates release numbers with a database sequence',()=>{assert.match(repairGroup3Sql,/create sequence if not exists public\.site_release_number_seq/i);assert.match(repairGroup3Sql,/alter column release_number set default nextval\('public\.site_release_number_seq'/i);assert.match(repairGroup3Sql,/select coalesce\(max\(release_number\), 0\)/i);assert.match(repairGroup3Sql,/revoke all on sequence public\.site_release_number_seq from public, anon, authenticated/i)})

test('Repair Group 3 ties validation to an exact release snapshot',()=>{assert.match(repairGroup3Sql,/snapshot_revision_token uuid not null default gen_random_uuid\(\)/i);assert.match(repairGroup3Sql,/release_validation_results[\s\S]*snapshot_revision_token uuid/i);assert.match(repairGroup3Sql,/target\.snapshot_revision_token is distinct from expected_snapshot_revision_token/i);assert.match(repairGroup3Sql,/Release changed during validation\. Revalidate the current snapshot/i);assert.match(repairGroup3Sql,/snapshot_revision_token = target\.snapshot_revision_token/i)})

test('Repair Group 3 upgrades the reused per-check validation table without discarding history',()=>{assert.match(repairGroup3Sql,/add column if not exists valid boolean not null default false/i);assert.match(repairGroup3Sql,/add column if not exists issues jsonb not null default '\[\]'::jsonb/i);assert.match(repairGroup3Sql,/column_name = 'passed'/i);assert.match(repairGroup3Sql,/set valid = coalesce\(passed, false\)/i);assert.match(repairGroup3Sql,/alter column check_name drop not null/i);assert.match(repairGroup3Sql,/alter column passed drop not null/i);assert.doesNotMatch(repairGroup3Sql,/drop column (check_name|passed|message|details)/i)})

test('Repair Group 3 enforces legal release transitions and ready immutability',()=>{assert.match(repairGroup3Sql,/Ready and activated release snapshots are immutable/i);assert.match(repairGroup3Sql,/new\.id is distinct from old\.id/i);assert.match(repairGroup3Sql,/transition_name = 'validation' and old\.status = 'draft' and new\.status = 'ready'/i);assert.match(repairGroup3Sql,/old\.status = 'ready' and new\.status = 'active'/i);assert.match(repairGroup3Sql,/old\.status = 'active' and new\.status = 'superseded'/i);assert.match(repairGroup3Sql,/transition_name = 'rollback'[\s\S]*old\.status = 'superseded' and new\.status = 'active'/i);assert.match(repairGroup3Sql,/Illegal release transition from % to %/i);assert.match(repairGroup3Sql,/Site releases are append-only and cannot be deleted/i)})

test('Repair Group 3 activation is serialized, validated and atomic',()=>{assert.match(repairGroup3Sql,/create or replace function public\.activate_release\([\s\S]*expected_snapshot_revision_token uuid[\s\S]*actor_user_id uuid/i);assert.match(repairGroup3Sql,/pg_advisory_xact_lock/i);assert.match(repairGroup3Sql,/target\.status <> 'ready'/i);assert.match(repairGroup3Sql,/perform public\.assert_release_inputs\(target_release_id\)/i);assert.match(repairGroup3Sql,/release_validation_results[\s\S]*validation_kind = 'candidate'[\s\S]*valid = true/i);assert.match(repairGroup3Sql,/set_config\('app\.release_transition', 'activation', true\)/i);assert.match(repairGroup3Sql,/create unique index if not exists one_active_site_release/i)})

test('Repair Group 3 rollback is a distinct controlled operation',()=>{assert.match(repairGroup3Sql,/create or replace function public\.rollback_release/i);assert.match(repairGroup3Sql,/target\.status <> 'superseded'/i);assert.match(repairGroup3Sql,/Rollback requires a different active release/i);assert.match(repairGroup3Sql,/validation_kind[\s\S]*'rollback'/i);assert.match(repairGroup3Sql,/set_config\('app\.release_transition', 'rollback', true\)/i);assert.match(repairGroup3Sql,/'release_rolled_back'/i)})

test('Repair Group 3 release mutations are service-role-only',()=>{for(const signature of ['create_site_release\\(uuid, uuid, uuid, jsonb, jsonb, text, uuid\\)','record_release_validation\\(uuid, uuid, boolean, jsonb, text, uuid\\)','activate_release\\(uuid, uuid, uuid\\)','rollback_release\\(uuid, uuid, jsonb, text, uuid\\)']){assert.match(repairGroup3Sql,new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`,'i'));assert.match(repairGroup3Sql,new RegExp(`grant execute on function public\\.${signature} to service_role`,'i'))}assert.match(repairGroup3Sql,/drop policy if exists site_releases_admin_all/i);assert.match(repairGroup3Sql,/create policy site_releases_admin_read/i);assert.match(repairGroup3Sql,/revoke insert, update, delete on public\.site_releases from anon, authenticated/i);assert.match(repairGroup3Sql,/revoke insert, update, delete on public\.release_validation_results from anon, authenticated/i)})

test('Repair Group 3 commits release audit events with transitions',()=>{assert.match(repairGroup3Sql,/Audit logs are append-only/i);assert.match(repairGroup3Sql,/create trigger protect_audit_log_write/i);for(const action of ['release_created','release_validated','release_activated','release_rolled_back'])assert.match(repairGroup3Sql,new RegExp(`'${action}'`));assert.match(repairGroup3Sql,/insert into public\.audit_logs[\s\S]*'release_activated'/i)})

test('layout hard deletion is locked and rejects immutable history',()=>{assert.match(layoutLifecycleSql,/create or replace function public\.delete_layout_if_safe/i);assert.match(layoutLifecycleSql,/from public\.layouts[\s\S]*for update/i);assert.match(layoutLifecycleSql,/status <> 'draft'/i);assert.match(layoutLifecycleSql,/join public\.layout_versions version on version\.id = release\.layout_version_id/i);assert.match(layoutLifecycleSql,/join public\.layout_versions version on version\.id = workspace\.configuring_layout_version_id/i);assert.match(layoutLifecycleSql,/published or release history and cannot be permanently deleted\. Archive it instead/i)})

test('layout archive preserves versions and release history',()=>{const archive=layoutLifecycleSql.slice(layoutLifecycleSql.indexOf('create or replace function public.archive_layout_document'),layoutLifecycleSql.indexOf('create or replace function public.delete_layout_if_safe'));assert.match(archive,/update public\.layouts[\s\S]*status = 'archived'/i);assert.doesNotMatch(archive,/delete from public\.(layouts|layout_versions|site_releases)/i);assert.match(archive,/'layout_archived'/i)})

test('draft discard is limited to safe non-sole drafts',()=>{assert.match(layoutLifecycleSql,/create or replace function public\.discard_layout_draft_if_safe/i);assert.match(layoutLifecycleSql,/target_version\.status <> 'draft'/i);assert.match(layoutLifecycleSql,/A release-referenced layout version cannot be discarded/i);assert.match(layoutLifecycleSql,/Admin workspace is using this draft/i);assert.match(layoutLifecycleSql,/version_count <= 1/i);assert.match(layoutLifecycleSql,/Only draft layout versions can be discarded\. Published history is immutable/i)})

test('layout lifecycle RPCs are service-role-only and browser deletes are revoked',()=>{for(const signature of ['rename_layout_document\\(uuid, text, text, uuid\\)','archive_layout_document\\(uuid, uuid\\)','delete_layout_if_safe\\(uuid, uuid\\)','discard_layout_draft_if_safe\\(uuid, uuid, uuid\\)']){assert.match(layoutLifecycleSql,new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`,'i'));assert.match(layoutLifecycleSql,new RegExp(`grant execute on function public\\.${signature} to service_role`,'i'))}for(const table of ['layouts','layout_versions','layout_pages','layout_validation_results'])assert.match(layoutLifecycleSql,new RegExp(`revoke delete on public\\.${table} from anon, authenticated`,'i'))})

test('Repair Group 4B1 creates relational immutable release media references',()=>{assert.match(releaseMediaIntegritySql,/create table if not exists public\.release_media_references/i);assert.match(releaseMediaIntegritySql,/primary key \(site_release_id, media_id\)/i);assert.match(releaseMediaIntegritySql,/site_release_id uuid not null references public\.site_releases\(id\) on delete restrict/i);assert.match(releaseMediaIntegritySql,/media_id uuid not null references public\.media\(id\) on delete restrict/i);assert.match(releaseMediaIntegritySql,/create index if not exists idx_release_media_references_media_release[\s\S]*\(media_id, site_release_id\)/i);assert.match(releaseMediaIntegritySql,/Release media references are immutable/i)})

test('Repair Group 4B1 versions complete media accounting without certifying legacy releases',()=>{assert.match(releaseMediaIntegritySql,/add column if not exists media_snapshot_version smallint not null default 0/i);assert.match(releaseMediaIntegritySql,/check \(media_snapshot_version in \(0, 1\)\)/i);assert.match(releaseMediaIntegritySql,/Release media snapshot version is immutable after release creation/i);assert.doesNotMatch(releaseMediaIntegritySql,/update public\.site_releases[\s\S]*media_snapshot_version\s*=\s*1/i)})

test('Repair Group 4B1 enforces stable physical media identity while leaving metadata mutable',()=>{assert.match(releaseMediaIntegritySql,/create unique index if not exists media_storage_path_unique[\s\S]*public\.media\(storage_path\)/i);assert.match(releaseMediaIntegritySql,/new\.id is distinct from old\.id/i);assert.match(releaseMediaIntegritySql,/new\.storage_path is distinct from old\.storage_path/i);assert.doesNotMatch(releaseMediaIntegritySql,/new\.(?:alt_text|public_url) is distinct from old\.(?:alt_text|public_url)/i)})

test('Repair Group 4B1 upgrades reused legacy media tables in forward migration 00700',()=>{for(const column of ['public_url text','size bigint not null default 0','alt_text text'])assert.match(legacyMediaReconciliationSql,new RegExp(`add column if not exists ${column}`,'i'));assert.doesNotMatch(releaseMediaIntegritySql,/alter table public\.media\s+add column if not exists (?:public_url|size|alt_text)/i)})

test('Repair Group 4B1 backfills canonical media values without overwriting valid values',()=>{assert.match(legacyMediaReconciliationSql,/set public_url = url[\s\S]*where \(public_url is null or btrim\(public_url\) = ''\)[\s\S]*url is not null/i);assert.match(legacyMediaReconciliationSql,/set size = size_bytes[\s\S]*where size = 0[\s\S]*size_bytes is not null/i);assert.doesNotMatch(legacyMediaReconciliationSql,/set alt_text\s*=/i)})

test('Repair Group 4B1 retains legacy media compatibility columns',()=>{assert.doesNotMatch(legacyMediaReconciliationSql,/drop (?:column )?(?:url|size_bytes)/i);assert.match(legacyMediaReconciliationSql,/attname = 'url'/i);assert.match(legacyMediaReconciliationSql,/attname = 'size_bytes'/i)})

test('Repair Group 4B1 trusted uploads mirror canonical media values into required legacy columns',()=>{const api=fs.readFileSync(new URL('../apps/api/src/index.ts',import.meta.url),'utf8');assert.match(api,/insert\(\{ filename, storage_path: storagePath, url: urlData\.publicUrl, public_url: urlData\.publicUrl, mime_type: mime, size_bytes: bytes\.length, size: bytes\.length, kind: mediaKindForMime\(mime\)/i)})

test('Repair Group 4B1 release media writes are service-role-only',()=>{assert.match(releaseMediaIntegritySql,/alter table public\.release_media_references enable row level security/i);assert.match(releaseMediaIntegritySql,/revoke all on table public\.release_media_references from public, anon, authenticated/i);assert.match(releaseMediaIntegritySql,/grant select, insert on table public\.release_media_references to service_role/i);assert.doesNotMatch(releaseMediaIntegritySql,/create policy[\s\S]*release_media_references/i)})

test('Repair Group 4B1 removes direct authenticated public-media writes and preserves reads',()=>{assert.match(releaseMediaIntegritySql,/drop policy if exists public_media_admin_write on storage\.objects/i);assert.doesNotMatch(releaseMediaIntegritySql,/drop policy if exists public_media_read/i);assert.doesNotMatch(releaseMediaIntegritySql,/delete from storage\.objects|update storage\.objects|insert into storage\.objects/i)})

test('Repair Group 4B1 remains foundational and does not implement later media batches',()=>{for(const name of ['projects.thumbnail_media_id','notes.cover_media_id','experiences.logo_media_id','ai_apps.icon_media_id','ai_apps.cover_media_id','project_gallery_media'])assert.doesNotMatch(releaseMediaIntegritySql,new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));assert.doesNotMatch(releaseMediaIntegritySql,/collectReferencedMediaIds|RuntimeManifest|activate_release|rollback_release|create_site_release/i)})

test('Repair Group 4B2 adds every structured canonical media column and restrictive FK',()=>{for(const [table,column] of [['projects','thumbnail_media_id'],['notes','cover_media_id'],['experiences','logo_media_id'],['ai_apps','icon_media_id'],['ai_apps','cover_media_id']]){assert.match(structuredMediaSql,new RegExp(`alter table public\\.${table} add column if not exists ${column} uuid`,'i'));assert.match(structuredMediaSql,new RegExp(`foreign key \\(${column}\\) references public\\.media\\(id\\) on delete restrict`,'i'))}})

test('Repair Group 4B2 creates ordered duplicate-safe project gallery media relations',()=>{assert.match(structuredMediaSql,/create table if not exists public\.project_gallery_media/i);assert.match(structuredMediaSql,/primary key \(project_id, sort_order\)/i);assert.match(structuredMediaSql,/unique \(project_id, media_id\)/i);assert.match(structuredMediaSql,/media_id uuid not null references public\.media\(id\) on delete restrict/i);assert.match(structuredMediaSql,/project_id uuid not null references public\.projects\(id\) on delete cascade/i)})

test('Repair Group 4B2 strictly matches managed legacy forms and leaves ambiguous or external values unresolved',()=>{assert.match(structuredMediaSql,/m\.id::text = n\.value[\s\S]*m\.public_url = n\.value[\s\S]*m\.url = n\.value[\s\S]*m\.storage_path = n\.value/i);assert.match(structuredMediaSql,/storage\/v1\/object\/public\/public-media/i);assert.match(structuredMediaSql,/case when count\(\*\) = 1 then min\(id::text\)::uuid else null end/i);assert.doesNotMatch(structuredMediaSql,/filename\s*=|like\s+['"]%/i)})

test('Repair Group 4B2 backfills canonical fields and gallery order while retaining legacy fields',()=>{for(const assignment of ['thumbnail_media_id = public.match_managed_media_id\\(thumbnail\\)','cover_media_id = public.match_managed_media_id\\(cover_image\\)','logo_media_id = public.match_managed_media_id\\(logo\\)','icon_media_id = public.match_managed_media_id\\(icon\\)'])assert.match(structuredMediaSql,new RegExp(assignment,'i'));assert.match(structuredMediaSql,/unnest\(p\.gallery\) with ordinality/i);assert.match(structuredMediaSql,/entry\.ordinality - 1/i);assert.doesNotMatch(structuredMediaSql,/drop (?:column )?(?:thumbnail|gallery|cover_image|logo|icon)/i)})

test('Repair Group 4B2 gallery browser writes are revoked while reads remain scoped',()=>{assert.match(structuredMediaSql,/revoke insert, update, delete, truncate, references, trigger on public\.project_gallery_media from anon, authenticated/i);assert.match(structuredMediaSql,/grant select on public\.project_gallery_media to anon, authenticated/i);assert.match(structuredMediaSql,/p\.published or public\.is_admin\(auth\.uid\(\)\)/i)})

test('Repair Group 4C1 certification locks one exact Draft version-0 release and rejects stale collection',()=>{assert.match(releaseMediaCertificationSql,/where id = target_release_id\s+for update/i);assert.match(releaseMediaCertificationSql,/target\.status <> 'draft'/i);assert.match(releaseMediaCertificationSql,/target\.media_snapshot_version <> 0/i);assert.match(releaseMediaCertificationSql,/target\.snapshot_revision_token is distinct from expected_snapshot_revision_token/i);assert.match(releaseMediaCertificationSql,/Release changed during media collection\. Recollect the exact snapshot/i)})

test('Repair Group 4C1 rejects incomplete and unresolved collector results',()=>{assert.match(releaseMediaCertificationSql,/collector_complete is not true/i);assert.match(releaseMediaCertificationSql,/jsonb_array_length\(coalesce\(unresolved_references, '\[\]'::jsonb\)\) <> 0/i);assert.match(releaseMediaCertificationSql,/Unresolved managed media references prevent certification/i)})

test('Repair Group 4C1 de-duplicates deterministically and verifies every canonical media ID',()=>{assert.match(releaseMediaCertificationSql,/array_agg\(media_id order by media_id\)[\s\S]*select distinct media_id/i);assert.match(releaseMediaCertificationSql,/from public\.media[\s\S]*where id = any\(normalized_ids\)/i);assert.match(releaseMediaCertificationSql,/persisted_count <> requested_count[\s\S]*Every canonical media ID must resolve to public\.media/i)})

test('Repair Group 4C1 atomically replaces references before setting version 1',()=>{const rpc=releaseMediaCertificationSql.slice(releaseMediaCertificationSql.indexOf('create or replace function public.certify_release_media_snapshot'));const removed=rpc.indexOf('delete from public.release_media_references');const inserted=rpc.indexOf('insert into public.release_media_references');const verified=rpc.indexOf('Authoritative release media set was not persisted completely');const certified=rpc.indexOf('set media_snapshot_version = 1');assert.ok(removed>=0&&removed<inserted&&inserted<verified&&verified<certified);assert.match(rpc,/where site_release_id = target_release_id/i);assert.match(rpc,/where id = target_release_id[\s\S]*snapshot_revision_token = expected_snapshot_revision_token/i)})

test('Repair Group 4C1 certification changes no release identity, snapshot token, status, or activation state',()=>{const rpc=releaseMediaCertificationSql.slice(releaseMediaCertificationSql.indexOf('create or replace function public.certify_release_media_snapshot'));const releaseUpdate=rpc.slice(rpc.indexOf('update public.site_releases'),rpc.indexOf('returning * into certified'));const setClause=releaseUpdate.slice(releaseUpdate.indexOf('set'),releaseUpdate.indexOf('where id'));assert.match(setClause,/set media_snapshot_version = 1/i);assert.doesNotMatch(setClause,/(?:status|snapshot_revision_token|layout_version_id|content_revision_id|settings_revision_id|collections_snapshot|media_snapshot|release_number)\s*=/i);assert.doesNotMatch(rpc,/activate_release|rollback_release|status\s*=\s*'(?:active|superseded|ready)'/i)})

test('Repair Group 4C1 keeps RG3 immutability with a Draft-only certification exception',()=>{assert.match(releaseMediaCertificationSql,/current_setting\('app\.release_media_certification', true\) = 'certify'[\s\S]*status = 'draft'[\s\S]*media_snapshot_version = 0/i);assert.match(releaseMediaCertificationSql,/current_setting\('app\.release_media_certification', true\) is distinct from 'certify'/i);assert.match(releaseMediaCertificationSql,/old\.status <> 'draft'[\s\S]*new\.status <> 'draft'[\s\S]*old\.media_snapshot_version <> 0[\s\S]*new\.media_snapshot_version <> 1/i);assert.match(releaseMediaCertificationSql,/Release media references are immutable/i)})

test('Repair Group 4C1 certification is RPC-only and unavailable to browser roles',()=>{assert.match(releaseMediaCertificationSql,/revoke insert, update, delete on table public\.release_media_references from service_role/i);assert.match(releaseMediaCertificationSql,/revoke insert, update, delete on table public\.site_releases from service_role/i);assert.match(releaseMediaCertificationSql,/revoke all on function public\.certify_release_media_snapshot\(uuid, uuid, boolean, jsonb, uuid\[\], uuid\) from public, anon, authenticated/i);assert.match(releaseMediaCertificationSql,/grant execute on function public\.certify_release_media_snapshot\(uuid, uuid, boolean, jsonb, uuid\[\], uuid\) to service_role/i)})

test('Repair Group 4C1 does not bulk-certify historical releases or Release 4',()=>{assert.equal((releaseMediaCertificationSql.match(/update public\.site_releases/gi)||[]).length,1);assert.doesNotMatch(releaseMediaCertificationSql,/release_number\s*=\s*4|media_snapshot_version\s*=\s*1\s*where\s+(?!id = target_release_id)/i);assert.match(releaseMediaCertificationSql,/'release_media_certified'/i)})

test('Repair Group 4C2 creates relational media integrity assertion function',()=>{assert.match(releaseMediaEnforcementSql,/create or replace function public\.assert_release_media_integrity\(target_release_id uuid\)/i);assert.match(releaseMediaEnforcementSql,/release_version is distinct from 1/i);assert.match(releaseMediaEnforcementSql,/media_snapshot_version must be 1/i);assert.match(releaseMediaEnforcementSql,/select count\(\*\) into missing_count[\s\S]*from public\.release_media_references rrm[\s\S]*where rrm\.site_release_id = target_release_id/i);assert.match(releaseMediaEnforcementSql,/not exists[\s\S]*from public\.media m[\s\S]*where m\.id = rrm\.media_id[\s\S]*and m\.storage_path is not distinct from rrm\.storage_path/i);assert.match(releaseMediaEnforcementSql,/Release media references contain unresolved or mismatched canonical media identity/i);assert.match(releaseMediaEnforcementSql,/revoke all on function public\.assert_release_media_integrity\(uuid\) from public, anon, authenticated/i);assert.match(releaseMediaEnforcementSql,/grant execute on function public\.assert_release_media_integrity\(uuid\) to service_role/i)})

test('Repair Group 4C2 assert_release_media_integrity rejects version-0 releases',()=>{assert.match(releaseMediaEnforcementSql,/release_version is distinct from 1/i);assert.match(releaseMediaEnforcementSql,/not certified/i)})

test('Repair Group 4C2 assert_release_media_integrity validates media_id resolves to public.media',()=>{assert.match(releaseMediaEnforcementSql,/from public\.media m[\s\S]*where m\.id = rrm\.media_id/i);assert.match(releaseMediaEnforcementSql,/Release media references contain unresolved/i)})

test('Repair Group 4C2 assert_release_media_integrity verifies captured storage identity',()=>{assert.match(releaseMediaEnforcementSql,/m\.storage_path is not distinct from rrm\.storage_path/i);assert.match(releaseMediaEnforcementSql,/m\.mime_type is not distinct from rrm\.mime_type/i);assert.match(releaseMediaEnforcementSql,/m\.size is not distinct from rrm\.size/i)})

test('Repair Group 4C2 assert_release_media_integrity accepts zero-reference version-1 release',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'));assert.doesNotMatch(fn,/count\(\*\) > 0/i);assert.match(fn,/missing_count/i)})

test('Repair Group 4C2 record_release_validation blocks Draft to Ready on version-0',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.record_release_validation'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/perform public\.assert_release_media_integrity\(target_release_id\)/i);assert.match(body,/if validation_valid then[\s\S]*perform public\.assert_release_media_integrity/i);assert.match(body,/perform public\.assert_release_inputs\(target_release_id\)/i)})

test('Repair Group 4C2 record_release_validation still records failed validation results',()=>{assert.match(releaseMediaEnforcementSql,/insert into public\.release_validation_results/i);assert.match(releaseMediaEnforcementSql,/release_validation_failed/i)})

test('Repair Group 4C2 record_release_validation preserves Draft-only validation',()=>{assert.match(repairGroup3Sql,/old\.status <> 'draft'[\s\S]*new\.status = 'ready'/i)})

test('Repair Group 4C2 activate_release blocks replacement when current Active is version-0',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.activate_release'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/previous_active\.media_snapshot_version = 0/i);assert.match(body,/Replacement activation is blocked while the current Active release has uncertified/i);assert.match(body,/perform public\.assert_release_media_integrity\(target_release_id\)/i);assert.match(body,/pg_advisory_xact_lock/i);assert.match(body,/perform public\.assert_release_inputs\(target_release_id\)/i);assert.match(body,/status = 'superseded'[\s\S]*deactivated/i);assert.match(body,/status = 'active'[\s\S]*activated/i)})

test('Repair Group 4C2 activate_release preserves atomicity and Ready-only target',()=>{assert.match(releaseMediaEnforcementSql,/target\.status <> 'ready'/i);assert.match(releaseMediaEnforcementSql,/status = 'superseded'[\s\S]*deactivated_at = now\(\)/i);assert.match(releaseMediaEnforcementSql,/status = 'active'[\s\S]*activated_at = now\(\)/i);assert.match(releaseMediaEnforcementSql,/if not found then raise exception 'Release activation lost its ready-state lock'/i)})

test('Repair Group 4C2 activate_release preserves snapshot-token validation',()=>{assert.match(releaseMediaEnforcementSql,/target\.snapshot_revision_token is distinct from expected_snapshot_revision_token/i);assert.match(releaseMediaEnforcementSql,/Release snapshot changed after validation/i);assert.match(releaseMediaEnforcementSql,/release_validation_results[\s\S]*snapshot_revision_token = target\.snapshot_revision_token[\s\S]*valid = true/i)})

test('Repair Group 4C2 rollback_release rejects version-0 rollback targets',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.rollback_release'));assert.match(fn,/perform public\.assert_release_media_integrity\(target_release_id\)/i);assert.match(fn,/target\.status <> 'superseded'/i);assert.match(fn,/Rollback requires a different active release/i);assert.match(fn,/target\.snapshot_revision_token is distinct from expected_snapshot_revision_token/i);assert.match(fn,/status = 'superseded'[\s\S]*deactivated/i);assert.match(fn,/status = 'active'[\s\S]*activated/i);assert.match(fn,/release_rolled_back/i);assert.match(fn,/perform public\.assert_release_inputs\(target_release_id\)/i)})

test('Repair Group 4C2 rollback_release preserves validation issue error check',()=>{assert.match(releaseMediaEnforcementSql,/has_errors/i);assert.match(releaseMediaEnforcementSql,/Rollback target is not compatible with the current runtime/i)})

test('Repair Group 4C2 rollback_release preserves advisory lock and append-only validation',()=>{assert.match(releaseMediaEnforcementSql,/pg_advisory_xact_lock/i);assert.match(releaseMediaEnforcementSql,/insert into public\.release_validation_results[\s\S]*validation_kind[\s\S]*'rollback'/i)})

test('Repair Group 4C2 enforces all functions service-role-only with no browser policy',()=>{for(const signature of ['assert_release_media_integrity\\(uuid\\)','record_release_validation\\(uuid, uuid, boolean, jsonb, text, uuid\\)','activate_release\\(uuid, uuid, uuid\\)','rollback_release\\(uuid, uuid, jsonb, text, uuid\\)']){assert.match(releaseMediaEnforcementSql,new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`,'i'));assert.match(releaseMediaEnforcementSql,new RegExp(`grant execute on function public\\.${signature} to service_role`,'i'))}})

test('Repair Group 4C2 migration is forward-only and does not mutate historical state',()=>{assert.match(releaseMediaEnforcementSql,/begin;/i);assert.match(releaseMediaEnforcementSql,/commit;/i);assert.doesNotMatch(releaseMediaEnforcementSql,/update public\.site_releases[\s\S]*set status[\s\S]*where release_number/i);assert.doesNotMatch(releaseMediaEnforcementSql,/release_number\s*=\s*4/i);assert.doesNotMatch(releaseMediaEnforcementSql,/delete from public\.(site_releases|release_media_references|media)\b/i);assert.doesNotMatch(releaseMediaEnforcementSql,/alter table public\.site_releases[\s\S]*media_snapshot_version/i);assert.doesNotMatch(releaseMediaEnforcementSql,/insert into public\.release_media_references/i);assert.doesNotMatch(releaseMediaEnforcementSql,/storage\.objects/i)})

test('Repair Group 4C2 migration does not certify Release 4 or bulk-certify historical releases',()=>{assert.doesNotMatch(releaseMediaEnforcementSql,/release_number\s*=\s*4/i);assert.doesNotMatch(releaseMediaEnforcementSql,/media_snapshot_version\s*=\s*1\s*where\s+(?!id = target_release_id)/i);assert.doesNotMatch(releaseMediaEnforcementSql,/certify_release_media_snapshot/i)})

test('Repair Group 4C2 assert_release_media_integrity is lifecycle-status agnostic (Bug 1 fix)',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'),releaseMediaEnforcementSql.indexOf('revoke all on function public.assert_release_media_integrity'));assert.doesNotMatch(fn,/release_status/i);assert.doesNotMatch(fn,/is distinct from ['"]draft/i);assert.doesNotMatch(fn,/is distinct from ['"]ready/i);assert.doesNotMatch(fn,/is distinct from ['"]superseded/i);assert.doesNotMatch(fn,/Media integrity can only be asserted on Draft/i);assert.match(fn,/select media_snapshot_version/i);assert.match(fn,/release_version is distinct from 1/i)})

test('Repair Group 4C2 Draft status enforcement stays in record_release_validation (not in helper)',()=>{assert.match(releaseMediaEnforcementSql,/if target\.status <> 'draft' then raise exception 'Only draft releases can be validated'/i);const helper=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'),releaseMediaEnforcementSql.indexOf('$$'));assert.doesNotMatch(helper,/draft/i)})

test('Repair Group 4C2 Ready status enforcement stays in activate_release (not in helper)',()=>{assert.match(releaseMediaEnforcementSql,/if target\.status <> 'ready' then raise exception 'Only ready releases can be activated'/i)})

test('Repair Group 4C2 Superseded status enforcement stays in rollback_release (not in helper)',()=>{assert.match(releaseMediaEnforcementSql,/if target\.status <> 'superseded' then raise exception 'Only superseded releases can be rollback targets'/i)})

test('Repair Group 4C2 Ready version-1 target reaches media assertion without status rejection',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.activate_release'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/perform public\.assert_release_media_integrity\(target_release_id\)/i);assert.doesNotMatch(body,/assert_release_media_integrity.*draft/i)})

test('Repair Group 4C2 Superseded version-1 rollback target reaches media assertion without status rejection',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.rollback_release'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/perform public\.assert_release_media_integrity\(target_release_id\)/i);assert.doesNotMatch(body,/assert_release_media_integrity.*draft/i)})

test('Repair Group 4C2 Draft version-1 successful validation passes media assertion before Ready transition',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.record_release_validation'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/if validation_valid then[\s\S]*perform public\.assert_release_media_integrity/i);assert.match(body,/set status = 'ready'/i)})

test('Repair Group 4C2 version-0 fails media assertion regardless of lifecycle status',()=>{assert.match(releaseMediaEnforcementSql,/release_version is distinct from 1/i);assert.match(releaseMediaEnforcementSql,/not certified/i)})

test('Repair Group 4C2 version-1 zero-reference succeeds at media assertion',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'));assert.match(fn,/A version-1 release with zero references is valid/i)})

test('Repair Group 4C2 current-Active-version-0 replacement block is independent of target version',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.activate_release'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/had_previous_active and previous_active\.media_snapshot_version = 0/i)})

test('Repair Group 4C2 Release 4 is not hard-coded by ID or release_number',()=>{assert.doesNotMatch(releaseMediaEnforcementSql,/b4e938f0-f175-4b8c-808f-9ec933dd5f6b/i);assert.doesNotMatch(releaseMediaEnforcementSql,/818577f0-5546-47d4-a9fb-911c0d5e8824/i);assert.doesNotMatch(releaseMediaEnforcementSql,/release_number\s*=\s*4/i)})

test('Repair Group 4C2 failed validation remains persistable without transition',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.record_release_validation'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));assert.match(body,/insert into public\.release_validation_results/i);assert.match(body,/release_validation_failed/i);assert.match(body,/if validation_valid then/i)})

test('Repair Group 4C2 relational media inconsistency is surfaced as ValidationIssue in platform.ts',()=>{const platform=fs.readFileSync(new URL('../apps/api/src/lib/platform.ts',import.meta.url),'utf8');assert.match(platform,/release\.media-uncertified/i);assert.match(platform,/release\.media-identity-mismatch/i);assert.match(platform,/release\.media-missing/i);assert.match(platform,/Number\(release\.media_snapshot_version \|\| 0\) === 1/i);assert.match(platform,/release\.media-uncertified/i)})

test('Repair Group 4C2 DB assertion is the final successful-transition guard',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.record_release_validation'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));const integrity=body.indexOf('assert_release_media_integrity');const transition=body.indexOf("set status = 'ready'");assert.ok(integrity>=0&&integrity<transition)})

test('Repair Group 4C2 enforces the canonical managed bucket even though public.media has no bucket column',()=>{const helperSql=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'),releaseMediaEnforcementSql.indexOf('revoke all on function public.assert_release_media_integrity'));assert.match(helperSql,/rrm\.bucket_id is distinct from 'public-media'/i);assert.match(releaseMediaEnforcementSql,/bucket_id is NOT a column on public\.media/i)})

test('Repair Group 4C2 NULL-safe IS DISTINCT FROM comparison for captured identity',()=>{assert.match(releaseMediaEnforcementSql,/m\.storage_path is not distinct from rrm\.storage_path/i);assert.match(releaseMediaEnforcementSql,/m\.mime_type is not distinct from rrm\.mime_type/i);assert.match(releaseMediaEnforcementSql,/m\.size is not distinct from rrm\.size/i)})

test('Repair Group 4C2 locks referenced media rows for UPDATE to prevent race',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'));assert.match(fn,/for update/i);assert.match(fn,/order by m\.id/i)})

test('Repair Group 4C2 locking is row-scoped not table-wide',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'));assert.match(fn,/join public\.media m on m\.id = rrm\.media_id/i);assert.doesNotMatch(fn,/lock table/i);assert.match(fn,/for update of m/i);assert.doesNotMatch(fn,/lock table/i)})

test('Repair Group 4C2 zero-reference release locks nothing',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.assert_release_media_integrity'));assert.match(fn,/Zero-reference version-1 releases skip this step/i)})

test('Repair Group 4C2 activation current-Active-v0 block occurs before status mutation',()=>{const fn=releaseMediaEnforcementSql.slice(releaseMediaEnforcementSql.indexOf('create or replace function public.activate_release'));const body=fn.slice(fn.indexOf('as $$')+4,fn.indexOf('$$',fn.indexOf('as $$')+4));const blockCheck=body.indexOf('previous_active.media_snapshot_version = 0');const statusSwap=body.indexOf("set_config('app.release_transition', 'activation'");assert.ok(blockCheck>=0&&statusSwap>=0&&blockCheck<statusSwap)})


test('Repair Group 4C2 Media Delete is DB-first and storage cleanup is durable',()=>{
  assert.match(mediaDeleteSql,/create table if not exists public\.media_cleanup_jobs/i)
  assert.match(mediaDeleteSql,/select \* into target from public\.media where id = target_media_id for update/i)
  assert.match(mediaDeleteSql,/insert into public\.media_cleanup_jobs[\s\S]*delete from public\.media where id = target_media_id/i)
  assert.match(mediaDeleteSql,/finish_media_cleanup_job/i)
  assert.doesNotMatch(mediaDeleteSql,/delete from storage\.objects|storage\.from/i)
})

test('Repair Group 4D historical certification is explicit service-only and never bulk backfills',()=>{
  assert.match(legacyCertificationSql,/create or replace function public\.certify_legacy_release_media_snapshot/i)
  assert.match(legacyCertificationSql,/snapshot_revision_token is distinct from expected_snapshot_revision_token/i)
  assert.match(legacyCertificationSql,/target\.status not in \('draft','ready','active','superseded'\)/i)
  assert.match(legacyCertificationSql,/grant execute on function public\.certify_legacy_release_media_snapshot[\s\S]*to service_role/i)
  assert.doesNotMatch(legacyCertificationSql,/where release_number\s*=|update public\.site_releases set media_snapshot_version=1\s*;/i)
})

test('Repair Group 4D legacy resolutions are exact per-release mappings and immutable after certification',()=>{
  assert.match(legacyResolutionSql,/primary key \(site_release_id, legacy_value\)/i)
  assert.match(legacyResolutionSql,/target_release\.media_snapshot_version <> 0/i)
  assert.match(legacyResolutionSql,/legacy_value text not null/i)
  assert.match(legacyResolutionSql,/media_id uuid not null references public\.media\(id\) on delete restrict/i)
  assert.match(legacyResolutionSql,/grant execute on function public\.set_release_media_legacy_resolution[\s\S]*to service_role/i)
})

test('Repair Groups 7 and 8 move content/settings publication and critical writes behind service RPCs',()=>{
  assert.match(revisionRlsSql,/publish_content_revision/i)
  assert.match(revisionRlsSql,/publish_settings_revision/i)
  assert.match(revisionRlsSql,/revoke all on function public\.publish_content_revision[\s\S]*from public,\s*anon,\s*authenticated/i)
  assert.match(revisionRlsSql,/revoke all on function public\.publish_settings_revision[\s\S]*from public,\s*anon,\s*authenticated/i)
  for (const policy of ['projects_admin_write','notes_admin_write','experience_admin_write','apps_admin_write','media_admin_write']) assert.match(revisionRlsSql,new RegExp(`drop policy if exists ${policy}`,'i'))
  assert.match(revisionRlsSql,/drop policy if exists public_media_admin_write on storage\.objects/i)
})

test('Repair Group 7 draft revision allocation is serialized and service-only',()=>{
  assert.match(revisionWorkflowSql,/get_or_create_content_draft/i)
  assert.match(revisionWorkflowSql,/get_or_create_settings_draft/i)
  assert.match(revisionWorkflowSql,/pg_advisory_xact_lock/i)
  assert.match(revisionWorkflowSql,/content_revision_number_seq/i)
  assert.match(revisionWorkflowSql,/settings_revision_number_seq/i)
  assert.doesNotMatch(revisionWorkflowSql,/grant execute[\s\S]*to authenticated/i)
})

test('Repair Groups 4D and 8 Media Delete protects canonical, legacy and frozen release references',()=>{
  assert.match(mediaAuditHardeningSql,/jsonb_contains_any_exact_string/i)
  assert.match(mediaAuditHardeningSql,/release_media_references where media_id = target_media_id/i)
  assert.match(mediaAuditHardeningSql,/release_media_legacy_resolutions where media_id = target_media_id/i)
  assert.match(mediaAuditHardeningSql,/projects where thumbnail = any\(identities\) or gallery && identities/i)
  assert.match(mediaAuditHardeningSql,/site_releases[\s\S]*media_snapshot[\s\S]*collections_snapshot[\s\S]*settings_snapshot/i)
  assert.match(mediaAuditHardeningSql,/insert into public\.media_cleanup_jobs[\s\S]*delete from public\.media/i)
  assert.match(mediaAuditHardeningSql,/drop policy if exists public_media_read on storage\.objects/i)
  assert.match(mediaAuditHardeningSql,/on delete restrict/i)
})

test('Repair Group 6 Create Draft is atomic, serialized and rewrites copied page IDs',()=>{
  assert.match(atomicDraftCloneSql,/create or replace function public\.get_or_create_layout_draft/i)
  assert.match(atomicDraftCloneSql,/from public\.layouts[\s\S]*for update/i)
  assert.match(atomicDraftCloneSql,/status = 'draft'/i)
  assert.match(atomicDraftCloneSql,/coalesce\(max\(version_number\), 0\) \+ 1/i)
  assert.match(atomicDraftCloneSql,/created_page_id := gen_random_uuid\(\)/i)
  assert.match(atomicDraftCloneSql,/jsonb_set\([\s\S]*'\{pageId\}'[\s\S]*created_page_id/i)
  assert.match(atomicDraftCloneSql,/insert into public\.audit_logs/i)
  assert.match(atomicDraftCloneSql,/revoke all on function public\.get_or_create_layout_draft[\s\S]*from public, anon, authenticated/i)
  assert.match(atomicDraftCloneSql,/grant execute on function public\.get_or_create_layout_draft[\s\S]*to service_role/i)
})
