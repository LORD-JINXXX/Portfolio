-- Repair Groups 7/8: immutable revision publication + browser-write hardening.
-- Critical writes flow through the trusted Platform API/service-role boundary.

begin;

create or replace function public.publish_content_revision(target_revision_id uuid, actor_user_id uuid)
returns public.content_revisions
language plpgsql security definer set search_path=pg_catalog,pg_temp
as $$
declare target public.content_revisions%rowtype; entry record;
begin
  select * into target from public.content_revisions where id=target_revision_id for update;
  if not found then raise exception 'Content revision not found'; end if;
  if target.status='published' then return target; end if;
  if target.status<>'draft' then raise exception 'Only draft content revisions can be published'; end if;
  update public.content_revisions set status='published',published_at=now() where id=target_revision_id and status='draft' returning * into target;
  if not found then raise exception 'Content revision changed before publish'; end if;
  for entry in select key,value from jsonb_each(target.values_json) loop
    insert into public.site_content(key,value_json,type,updated_by)
    values(entry.key,entry.value,case jsonb_typeof(entry.value) when 'boolean' then 'boolean' when 'number' then 'number' when 'object' then 'json' when 'array' then 'json' else 'text' end,actor_user_id)
    on conflict(key) do update set value_json=excluded.value_json,type=excluded.type,updated_by=excluded.updated_by,updated_at=now();
  end loop;
  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json,metadata)
  values(actor_user_id,'content_revision_published','content_revision',target.id,to_jsonb(target),jsonb_build_object('revision_number',target.revision_number));
  return target;
end; $$;

create or replace function public.publish_settings_revision(target_revision_id uuid, actor_user_id uuid)
returns public.settings_revisions
language plpgsql security definer set search_path=pg_catalog,pg_temp
as $$
declare target public.settings_revisions%rowtype; entry record;
begin
  select * into target from public.settings_revisions where id=target_revision_id for update;
  if not found then raise exception 'Settings revision not found'; end if;
  if target.status='published' then return target; end if;
  if target.status<>'draft' then raise exception 'Only draft settings revisions can be published'; end if;
  update public.settings_revisions set status='published',published_at=now() where id=target_revision_id and status='draft' returning * into target;
  if not found then raise exception 'Settings revision changed before publish'; end if;
  for entry in select key,value from jsonb_each(target.values_json) loop
    insert into public.site_settings(key,value_json,type,updated_by)
    values(entry.key,entry.value,case jsonb_typeof(entry.value) when 'boolean' then 'boolean' when 'number' then 'number' when 'object' then 'json' when 'array' then 'json' else 'text' end,actor_user_id)
    on conflict(key) do update set value_json=excluded.value_json,type=excluded.type,updated_by=excluded.updated_by,updated_at=now();
  end loop;
  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json,metadata)
  values(actor_user_id,'settings_revision_published','settings_revision',target.id,to_jsonb(target),jsonb_build_object('revision_number',target.revision_number));
  return target;
end; $$;

revoke all on function public.publish_content_revision(uuid,uuid) from public,anon,authenticated;
revoke all on function public.publish_settings_revision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.publish_content_revision(uuid,uuid) to service_role;
grant execute on function public.publish_settings_revision(uuid,uuid) to service_role;

-- Remove legacy direct browser mutation policies. Public structured SELECT is
-- retained for compatibility, but all writes happen through the Platform API.
drop policy if exists projects_admin_write on public.projects;
drop policy if exists notes_admin_write on public.notes;
drop policy if exists experience_admin_write on public.experiences;
drop policy if exists apps_admin_write on public.ai_apps;
drop policy if exists media_admin_write on public.media;
drop policy if exists media_public_read on public.media;

-- Baseline generated *_admin_all policies granted browser mutation rights.
-- Replace them with read-only Admin policies where direct inspection is useful.
do $$
declare t text;
begin
  foreach t in array array['site_content','site_settings','layouts','layout_versions','layout_pages','admin_workspace','content_revisions','settings_revisions','site_releases','layout_validation_results','release_validation_results','audit_logs'] loop
    execute format('drop policy if exists %I on public.%I',t||'_admin_all',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin(auth.uid()))',t||'_admin_read',t);
  end loop;
end $$;

-- Public Storage object reads remain intentionally enabled because public
-- runtime image/video URLs rely on the public-media bucket. Direct writes were
-- removed by RG4B1 and remain absent.
drop policy if exists public_media_admin_write on storage.objects;

commit;
