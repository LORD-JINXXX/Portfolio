-- Studio layout lifecycle operations. Critical deletion remains behind the
-- authenticated API and service-role-only, race-safe database functions.

create or replace function public.rename_layout_document(
  target_layout_id uuid,
  layout_name_value text,
  layout_slug_base_value text,
  actor_user_id uuid
)
returns public.layouts
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  previous_layout public.layouts%rowtype;
  renamed_layout public.layouts%rowtype;
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
begin
  select * into previous_layout
  from public.layouts
  where id = target_layout_id
  for update;

  if not found then raise exception 'Layout not found'; end if;
  if nullif(btrim(layout_name_value), '') is null then raise exception 'Layout name is required'; end if;

  base_slug := btrim(regexp_replace(lower(coalesce(layout_slug_base_value, layout_name_value)), '[^a-z0-9]+', '-', 'g'), '-');
  if base_slug = '' then base_slug := 'layout'; end if;
  candidate_slug := base_slug;

  loop
    begin
      update public.layouts
      set name = btrim(layout_name_value), slug = candidate_slug
      where id = target_layout_id
      returning * into renamed_layout;
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      if suffix > 100 then raise exception 'Unable to allocate a unique layout slug'; end if;
      candidate_slug := base_slug || '-' || suffix::text;
    end;
  end loop;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, after_json)
  values (actor_user_id, 'layout_renamed', 'layout', target_layout_id, to_jsonb(previous_layout), to_jsonb(renamed_layout));

  return renamed_layout;
end; $$;

create or replace function public.archive_layout_document(
  target_layout_id uuid,
  actor_user_id uuid
)
returns public.layouts
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  previous_layout public.layouts%rowtype;
  archived_layout public.layouts%rowtype;
begin
  select * into previous_layout
  from public.layouts
  where id = target_layout_id
  for update;

  if not found then raise exception 'Layout not found'; end if;
  if previous_layout.status = 'archived' then return previous_layout; end if;

  update public.layouts
  set status = 'archived'
  where id = target_layout_id
  returning * into archived_layout;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, after_json)
  values (actor_user_id, 'layout_archived', 'layout', target_layout_id, to_jsonb(previous_layout), to_jsonb(archived_layout));

  return archived_layout;
end; $$;

create or replace function public.delete_layout_if_safe(
  target_layout_id uuid,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_layout public.layouts%rowtype;
  version_count integer;
  page_count integer;
  validation_count integer;
begin
  select * into target_layout
  from public.layouts
  where id = target_layout_id
  for update;

  if not found then raise exception 'Layout not found'; end if;

  perform 1
  from public.layout_versions
  where layout_id = target_layout_id
  for update;

  if exists (
    select 1 from public.layout_versions
    where layout_id = target_layout_id and status <> 'draft'
  ) or exists (
    select 1
    from public.site_releases release
    join public.layout_versions version on version.id = release.layout_version_id
    where version.layout_id = target_layout_id
  ) then
    raise exception 'This layout has published or release history and cannot be permanently deleted. Archive it instead.';
  end if;

  if exists (
    select 1
    from public.admin_workspace workspace
    join public.layout_versions version on version.id = workspace.configuring_layout_version_id
    where version.layout_id = target_layout_id
  ) then
    raise exception 'This layout is selected in Admin workspace and cannot be permanently deleted.';
  end if;

  select count(*) into version_count from public.layout_versions where layout_id = target_layout_id;
  select count(*) into page_count
  from public.layout_pages page
  join public.layout_versions version on version.id = page.layout_version_id
  where version.layout_id = target_layout_id;
  select count(*) into validation_count
  from public.layout_validation_results validation
  join public.layout_versions version on version.id = validation.layout_version_id
  where version.layout_id = target_layout_id;

  -- Delete draft dependents explicitly so their draft revision triggers run
  -- before the owning versions are removed.
  delete from public.layout_pages
  where layout_version_id in (select id from public.layout_versions where layout_id = target_layout_id);
  delete from public.layout_validation_results
  where layout_version_id in (select id from public.layout_versions where layout_id = target_layout_id);
  delete from public.layout_versions where layout_id = target_layout_id;
  delete from public.layouts where id = target_layout_id;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, metadata)
  values (
    actor_user_id,
    'layout_deleted',
    'layout',
    target_layout_id,
    to_jsonb(target_layout),
    jsonb_build_object('versions_deleted', version_count, 'pages_deleted', page_count, 'validation_results_deleted', validation_count)
  );

  return jsonb_build_object('id', target_layout_id, 'name', target_layout.name);
end; $$;

create or replace function public.discard_layout_draft_if_safe(
  target_layout_id uuid,
  target_version_id uuid,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_version public.layout_versions%rowtype;
  version_count integer;
  page_count integer;
  validation_count integer;
begin
  perform 1 from public.layouts where id = target_layout_id for update;
  if not found then raise exception 'Layout not found'; end if;

  select * into target_version
  from public.layout_versions
  where id = target_version_id and layout_id = target_layout_id
  for update;

  if not found then raise exception 'Layout version not found'; end if;
  if target_version.status <> 'draft' then
    raise exception 'Only draft layout versions can be discarded. Published history is immutable.';
  end if;
  if exists (select 1 from public.site_releases where layout_version_id = target_version_id) then
    raise exception 'A release-referenced layout version cannot be discarded.';
  end if;
  if exists (select 1 from public.admin_workspace where configuring_layout_version_id = target_version_id) then
    raise exception 'The Admin workspace is using this draft and it cannot be discarded.';
  end if;

  select count(*) into version_count from public.layout_versions where layout_id = target_layout_id;
  if version_count <= 1 then
    raise exception 'The only layout version cannot be discarded. Delete the draft-only layout instead.';
  end if;

  select count(*) into page_count from public.layout_pages where layout_version_id = target_version_id;
  select count(*) into validation_count from public.layout_validation_results where layout_version_id = target_version_id;

  delete from public.layout_pages where layout_version_id = target_version_id;
  delete from public.layout_validation_results where layout_version_id = target_version_id;
  delete from public.layout_versions where id = target_version_id;
  update public.layouts set updated_at = now() where id = target_layout_id;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, metadata)
  values (
    actor_user_id,
    'layout_draft_discarded',
    'layout_version',
    target_version_id,
    to_jsonb(target_version),
    jsonb_build_object('layout_id', target_layout_id, 'pages_deleted', page_count, 'validation_results_deleted', validation_count)
  );

  return jsonb_build_object('id', target_version_id, 'layout_id', target_layout_id, 'version_number', target_version.version_number);
end; $$;

revoke all on function public.rename_layout_document(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.archive_layout_document(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_layout_if_safe(uuid, uuid) from public, anon, authenticated;
revoke all on function public.discard_layout_draft_if_safe(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.rename_layout_document(uuid, text, text, uuid) to service_role;
grant execute on function public.archive_layout_document(uuid, uuid) to service_role;
grant execute on function public.delete_layout_if_safe(uuid, uuid) to service_role;
grant execute on function public.discard_layout_draft_if_safe(uuid, uuid, uuid) to service_role;

-- Existing Admin policies may still permit other direct authoring operations,
-- but destructive layout lifecycle writes must go through the trusted API.
revoke delete on public.layouts from anon, authenticated;
revoke delete on public.layout_versions from anon, authenticated;
revoke delete on public.layout_pages from anon, authenticated;
revoke delete on public.layout_validation_results from anon, authenticated;
