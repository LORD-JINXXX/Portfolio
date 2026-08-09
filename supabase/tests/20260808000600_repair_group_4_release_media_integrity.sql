begin;

select plan(21);

select has_table('public', 'release_media_references', 'release media reference table exists');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.release_media_references'::regclass
    and contype = 'p'
    and pg_get_constraintdef(oid) = 'PRIMARY KEY (site_release_id, media_id)'
), 'release/media pair is unique');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.release_media_references'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike 'FOREIGN KEY (site_release_id) REFERENCES site_releases(id) ON DELETE RESTRICT'
), 'release reference FK is restrictive');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.release_media_references'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike 'FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE RESTRICT'
), 'media reference FK is restrictive');

select has_index('public', 'release_media_references', 'idx_release_media_references_media_release', 'media/release lookup index exists');
select has_column('public', 'site_releases', 'media_snapshot_version', 'media snapshot completeness version exists');

select ok((
  select pg_get_expr(adbin, adrelid) in ('0', '0::smallint')
  from pg_attrdef
  where adrelid = 'public.site_releases'::regclass
    and adnum = (select attnum from pg_attribute where attrelid = 'public.site_releases'::regclass and attname = 'media_snapshot_version')
), 'media snapshot version defaults to zero');

select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.site_releases'::regclass
    and conname = 'site_releases_media_snapshot_version_check'
    and pg_get_constraintdef(oid) ilike '%media_snapshot_version%0%1%'
), 'unsupported media snapshot versions are rejected');

select is((select count(*) from public.site_releases where media_snapshot_version <> 0), 0::bigint, 'all existing releases remain legacy version zero');
select is((select count(*) from public.release_media_references), 0::bigint, 'RG4B1 does not backfill release references');
select has_index('public', 'media', 'media_storage_path_unique', 'storage path uniqueness is enforced');

select has_trigger('public', 'media', 'protect_media_identity_update', 'media identity update trigger exists');
select has_trigger('public', 'release_media_references', 'protect_release_media_reference_write', 'release media references are immutable');

select ok((select relrowsecurity from pg_class where oid = 'public.release_media_references'::regclass), 'release media references use RLS');

select ok(
  not has_table_privilege('anon', 'public.release_media_references', 'INSERT')
  and not has_table_privilege('anon', 'public.release_media_references', 'UPDATE')
  and not has_table_privilege('anon', 'public.release_media_references', 'DELETE'),
  'anon cannot mutate release media references'
);

select ok(
  not has_table_privilege('authenticated', 'public.release_media_references', 'INSERT')
  and not has_table_privilege('authenticated', 'public.release_media_references', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.release_media_references', 'DELETE'),
  'authenticated cannot mutate release media references'
);

select ok(
  has_table_privilege('service_role', 'public.release_media_references', 'SELECT')
  and has_table_privilege('service_role', 'public.release_media_references', 'INSERT'),
  'service role has the future trusted capture path'
);

select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_media_admin_write'
), 'direct authenticated public-media mutation policy is removed');

select ok(exists (
  select 1 from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_media_read' and cmd = 'SELECT'
), 'public-media read policy remains');

select is((select count(*) from public.site_releases where status = 'active'), 1::bigint, 'exactly one release remains active');
select is((select count(*) from public.site_releases where release_number = 4 and status = 'active' and media_snapshot_version = 0), 1::bigint, 'Release #4 remains active and legacy-unverified');

select * from finish();

rollback;
