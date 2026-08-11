-- Repair Groups 4D/8: legacy-safe Media Delete guards + append-only audit/storage hardening.
-- No release is certified or transitioned by this migration.

begin;

-- Reused projects historically carried these compatibility columns. Keep fresh
-- databases schema-compatible with the trusted API without making them authority.
alter table public.media add column if not exists url text;
alter table public.media add column if not exists size_bytes bigint;
update public.media set url = public_url where url is null and public_url is not null;
update public.media set size_bytes = size where size_bytes is null and size is not null;

-- Audit history is evidence, not mutable application data. Prevent service-role
-- mistakes as well as browser writes. Deleting an actor with audit history is
-- rejected instead of mutating historical actor_user_id via ON DELETE SET NULL.
alter table public.audit_logs drop constraint if exists audit_logs_actor_user_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_user_id_fkey
  foreign key (actor_user_id) references public.profiles(id) on delete restrict;

-- RG3 already installed protect_audit_log_write, which rejects UPDATE/DELETE.
-- Keep that canonical append-only trigger; this migration only makes the actor FK explicit.

-- Role/profile changes are not a direct browser mutation surface. Existing own
-- profile reads remain; privileged profile administration is server-owned.
drop policy if exists profiles_admin_update on public.profiles;

-- The bucket is public for object delivery, so public URLs continue to work.
-- Removing storage.objects SELECT prevents anonymous/authenticated listing via
-- the Storage API; runtime obtains explicit canonical URLs from the Platform API.
drop policy if exists public_media_read on storage.objects;

create or replace function public.jsonb_contains_any_exact_string(value jsonb, targets text[])
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare candidate text;
begin
  if value is null or targets is null then return false; end if;
  foreach candidate in array targets loop
    if candidate is not null and btrim(candidate) <> '' and public.jsonb_contains_exact_string(value, candidate) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.jsonb_contains_any_exact_string(jsonb,text[]) from public, anon, authenticated;

-- Replace 01100's deletion RPC with a stricter version that also protects
-- frozen legacy release snapshots and exact legacy authoring references until
-- every historical release has canonical v1 media accounting.
create or replace function public.request_media_delete(target_media_id uuid, actor_user_id uuid)
returns public.media_cleanup_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.media%rowtype;
  job public.media_cleanup_jobs%rowtype;
  identities text[];
begin
  -- Serializes with canonical FK insertions and all concurrent metadata writes.
  select * into target from public.media where id = target_media_id for update;
  if not found then raise exception 'Media not found'; end if;

  identities := array_remove(array[
    target.id::text,
    target.storage_path,
    target.public_url,
    target.url
  ], null);

  -- Canonical relational blockers.
  if exists (select 1 from public.release_media_references where media_id = target_media_id) then raise exception 'Media is referenced by an immutable release'; end if;
  if exists (select 1 from public.release_media_legacy_resolutions where media_id = target_media_id) then raise exception 'Media is referenced by a legacy release resolution'; end if;
  if exists (select 1 from public.project_gallery_media where media_id = target_media_id) then raise exception 'Media is referenced by a project gallery'; end if;
  if exists (select 1 from public.projects where thumbnail_media_id = target_media_id) then raise exception 'Media is referenced by a project'; end if;
  if exists (select 1 from public.notes where cover_media_id = target_media_id) then raise exception 'Media is referenced by a note'; end if;
  if exists (select 1 from public.experiences where logo_media_id = target_media_id) then raise exception 'Media is referenced by experience'; end if;
  if exists (select 1 from public.ai_apps where icon_media_id = target_media_id or cover_media_id = target_media_id) then raise exception 'Media is referenced by an AI app'; end if;
  if exists (select 1 from public.layouts where thumbnail_media_id = target_media_id) then raise exception 'Media is referenced by a layout thumbnail'; end if;

  -- Structured legacy columns are compatibility-only but must remain protected
  -- while historical data can still contain them.
  if exists (select 1 from public.projects where thumbnail = any(identities) or gallery && identities) then raise exception 'Media is referenced by legacy project media'; end if;
  if exists (select 1 from public.notes where cover_image = any(identities)) then raise exception 'Media is referenced by legacy note media'; end if;
  if exists (select 1 from public.experiences where logo = any(identities)) then raise exception 'Media is referenced by legacy experience media'; end if;
  if exists (select 1 from public.ai_apps where icon = any(identities) or cover_image = any(identities)) then raise exception 'Media is referenced by legacy AI app media'; end if;

  -- Persisted authoring/revision references. Exact-string matching intentionally
  -- avoids fuzzy URL/path guesses.
  if exists (select 1 from public.layout_pages where public.jsonb_contains_any_exact_string(layout_tree, identities)) then raise exception 'Media is referenced by a layout document'; end if;
  if exists (select 1 from public.content_revisions where status <> 'archived' and public.jsonb_contains_any_exact_string(values_json, identities)) then raise exception 'Media is referenced by a content revision'; end if;
  if exists (select 1 from public.settings_revisions where status <> 'archived' and public.jsonb_contains_any_exact_string(values_json, identities)) then raise exception 'Media is referenced by a settings revision'; end if;
  if exists (select 1 from public.site_content where public.jsonb_contains_any_exact_string(value_json, identities)) then raise exception 'Media is referenced by site content'; end if;
  if exists (select 1 from public.site_settings where public.jsonb_contains_any_exact_string(value_json, identities)) then raise exception 'Media is referenced by site settings'; end if;

  -- Most importantly, legacy v0 releases are frozen history even before RG4D
  -- certification. Never remove bytes that an Active/Superseded historical
  -- snapshot can still need for serving or rollback.
  if exists (
    select 1 from public.site_releases
    where public.jsonb_contains_any_exact_string(media_snapshot, identities)
       or public.jsonb_contains_any_exact_string(collections_snapshot, identities)
       or public.jsonb_contains_any_exact_string(settings_snapshot, identities)
  ) then raise exception 'Media is referenced by a frozen release snapshot'; end if;

  insert into public.media_cleanup_jobs(media_id,bucket_id,storage_path,requested_by)
  values (target_media_id,'public-media',target.storage_path,actor_user_id)
  returning * into job;

  -- DB-first delete. Storage deletion remains a trusted API follow-up. If that
  -- follow-up fails, only an orphaned object remains; no release can point at
  -- missing physical bytes as a result of this transaction.
  delete from public.media where id = target_media_id;
  if not found then raise exception 'Media delete lost its row lock'; end if;

  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,before_json,metadata)
  values(actor_user_id,'media_delete_committed','media',target_media_id,to_jsonb(target),jsonb_build_object('cleanup_job_id',job.id,'storage_path',target.storage_path));
  return job;
end;
$$;

revoke all on function public.request_media_delete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_media_delete(uuid,uuid) to service_role;

comment on function public.request_media_delete(uuid,uuid) is
  'DB-first media deletion serialized on media row; blocks canonical, legacy authoring, legacy resolution and frozen release snapshot references.';

commit;
