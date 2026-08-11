-- Repair Group 4C2: DB-first, relationally race-safe media deletion.
-- Storage bytes are removed only AFTER this transaction commits. Failed byte
-- cleanup leaves an orphaned object (safe) rather than a certified release
-- pointing at a missing object (unsafe).

begin;

create table if not exists public.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null,
  bucket_id text not null default 'public-media',
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_media_cleanup_jobs_pending on public.media_cleanup_jobs(status, created_at) where status <> 'complete';
alter table public.media_cleanup_jobs enable row level security;
revoke all on table public.media_cleanup_jobs from public, anon, authenticated;
grant select on table public.media_cleanup_jobs to service_role;

create or replace function public.jsonb_contains_exact_string(value jsonb, target text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare item jsonb;
begin
  if value is null then return false; end if;
  if jsonb_typeof(value) = 'string' then return value #>> '{}' = target; end if;
  if jsonb_typeof(value) = 'array' then
    for item in select jsonb_array_elements(value) loop if public.jsonb_contains_exact_string(item, target) then return true; end if; end loop;
  elsif jsonb_typeof(value) = 'object' then
    for item in select entry.value from jsonb_each(value) as entry loop if public.jsonb_contains_exact_string(item, target) then return true; end if; end loop;
  end if;
  return false;
end;
$$;
revoke all on function public.jsonb_contains_exact_string(jsonb,text) from public, anon, authenticated;

create or replace function public.request_media_delete(target_media_id uuid, actor_user_id uuid)
returns public.media_cleanup_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.media%rowtype;
  job public.media_cleanup_jobs%rowtype;
  target_text text := target_media_id::text;
begin
  -- FK inserts take KEY SHARE on public.media; this UPDATE lock is therefore
  -- the serialization point with every canonical relational media reference.
  select * into target from public.media where id = target_media_id for update;
  if not found then raise exception 'Media not found'; end if;

  if exists (select 1 from public.release_media_references where media_id = target_media_id) then raise exception 'Media is referenced by an immutable release'; end if;
  if exists (select 1 from public.project_gallery_media where media_id = target_media_id) then raise exception 'Media is referenced by a project gallery'; end if;
  if exists (select 1 from public.projects where thumbnail_media_id = target_media_id) then raise exception 'Media is referenced by a project'; end if;
  if exists (select 1 from public.notes where cover_media_id = target_media_id) then raise exception 'Media is referenced by a note'; end if;
  if exists (select 1 from public.experiences where logo_media_id = target_media_id) then raise exception 'Media is referenced by experience'; end if;
  if exists (select 1 from public.ai_apps where icon_media_id = target_media_id or cover_media_id = target_media_id) then raise exception 'Media is referenced by an AI app'; end if;
  if exists (select 1 from public.layouts where thumbnail_media_id = target_media_id) then raise exception 'Media is referenced by a layout thumbnail'; end if;

  -- Non-relational authoring JSON remains compatibility data. Block deletion
  -- conservatively when an exact string reference is present in persisted
  -- authoring/revision data. Release safety itself is guaranteed by the FK above.
  if exists (select 1 from public.layout_pages where public.jsonb_contains_exact_string(layout_tree, target_text)) then raise exception 'Media is referenced by a layout document'; end if;
  if exists (select 1 from public.content_revisions where status <> 'archived' and public.jsonb_contains_exact_string(values_json, target_text)) then raise exception 'Media is referenced by a content revision'; end if;
  if exists (select 1 from public.settings_revisions where status <> 'archived' and public.jsonb_contains_exact_string(values_json, target_text)) then raise exception 'Media is referenced by a settings revision'; end if;
  if exists (select 1 from public.site_content where public.jsonb_contains_exact_string(value_json, target_text)) then raise exception 'Media is referenced by site content'; end if;
  if exists (select 1 from public.site_settings where public.jsonb_contains_exact_string(value_json, target_text)) then raise exception 'Media is referenced by site settings'; end if;

  insert into public.media_cleanup_jobs(media_id,bucket_id,storage_path,requested_by)
  values (target_media_id,'public-media',target.storage_path,actor_user_id)
  returning * into job;

  delete from public.media where id = target_media_id;
  if not found then raise exception 'Media delete lost its row lock'; end if;

  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,before_json,metadata)
  values(actor_user_id,'media_delete_committed','media',target_media_id,to_jsonb(target),jsonb_build_object('cleanup_job_id',job.id,'storage_path',target.storage_path));
  return job;
end;
$$;

create or replace function public.finish_media_cleanup_job(target_job_id uuid, succeeded boolean, error_message text, actor_user_id uuid)
returns public.media_cleanup_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare job public.media_cleanup_jobs%rowtype;
begin
  select * into job from public.media_cleanup_jobs where id=target_job_id for update;
  if not found then raise exception 'Media cleanup job not found'; end if;
  if job.status='complete' then return job; end if;
  update public.media_cleanup_jobs
  set status=case when succeeded then 'complete' else 'failed' end,
      attempts=attempts+1,
      last_error=case when succeeded then null else nullif(error_message,'') end,
      completed_at=case when succeeded then now() else null end
  where id=target_job_id returning * into job;
  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json)
  values(actor_user_id,case when succeeded then 'media_storage_cleanup_completed' else 'media_storage_cleanup_failed' end,'media_cleanup_job',target_job_id,to_jsonb(job));
  return job;
end;
$$;

revoke all on function public.request_media_delete(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_media_cleanup_job(uuid,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.request_media_delete(uuid,uuid) to service_role;
grant execute on function public.finish_media_cleanup_job(uuid,boolean,text,uuid) to service_role;

commit;
