-- Repair Group 6: atomically clone the latest immutable layout version into
-- one editable draft.  The layout row is the serialization point so two
-- concurrent Create Draft requests cannot allocate duplicate version numbers
-- or leave a version without its copied pages.

begin;

create or replace function public.get_or_create_layout_draft(
  target_layout_id uuid,
  schema_version_value integer,
  runtime_min_version_value text,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_layout public.layouts%rowtype;
  existing_draft_id uuid;
  source_version public.layout_versions%rowtype;
  created_version public.layout_versions%rowtype;
  source_page public.layout_pages%rowtype;
  created_page_id uuid;
  next_version_number integer;
begin
  if target_layout_id is null then raise exception 'Layout id is required'; end if;
  if schema_version_value is null or schema_version_value < 1 then raise exception 'Valid layout schema version is required'; end if;
  if nullif(btrim(runtime_min_version_value), '') is null then raise exception 'Runtime minimum version is required'; end if;

  -- The owning layout row is the per-layout serialization point.
  select * into target_layout
  from public.layouts
  where id = target_layout_id
  for update;
  if not found then raise exception 'Layout not found'; end if;
  if target_layout.status <> 'active' then raise exception 'Archived layouts cannot create new drafts'; end if;

  select id into existing_draft_id
  from public.layout_versions
  where layout_id = target_layout_id and status = 'draft'
  order by version_number desc, id
  limit 1;
  if existing_draft_id is not null then return existing_draft_id; end if;

  select * into source_version
  from public.layout_versions
  where layout_id = target_layout_id
  order by version_number desc, id
  limit 1;
  if not found then raise exception 'No source version found'; end if;

  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.layout_versions
  where layout_id = target_layout_id;

  insert into public.layout_versions(
    layout_id,
    version_number,
    schema_version,
    runtime_min_version,
    status,
    changelog,
    design_tokens,
    created_by
  ) values (
    target_layout_id,
    next_version_number,
    schema_version_value,
    runtime_min_version_value,
    'draft',
    format('Draft from v%s', source_version.version_number),
    coalesce(source_version.design_tokens, '{"variables":{}}'::jsonb),
    actor_user_id
  ) returning * into created_version;

  -- Page rows receive fresh IDs. layout_tree.pageId is rewritten to the new ID
  -- so the frozen page row and the editor document cannot disagree.
  for source_page in
    select *
    from public.layout_pages
    where layout_version_id = source_version.id
    order by sort_order, id
  loop
    created_page_id := gen_random_uuid();
    insert into public.layout_pages(
      id,
      layout_version_id,
      slug,
      name,
      page_type,
      route_pattern,
      seo_defaults,
      sort_order,
      layout_tree
    ) values (
      created_page_id,
      created_version.id,
      source_page.slug,
      source_page.name,
      source_page.page_type,
      source_page.route_pattern,
      coalesce(source_page.seo_defaults, '{}'::jsonb),
      source_page.sort_order,
      jsonb_set(
        coalesce(source_page.layout_tree, '{}'::jsonb),
        '{pageId}',
        to_jsonb(created_page_id::text),
        true
      )
    );
  end loop;

  if not exists (select 1 from public.layout_pages where layout_version_id = created_version.id) then
    raise exception 'Source version has no pages and cannot be cloned';
  end if;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, after_json, metadata)
  values (
    actor_user_id,
    'layout_draft_created',
    'layout_version',
    created_version.id,
    to_jsonb(created_version),
    jsonb_build_object('layout_id', target_layout_id, 'source_version_id', source_version.id, 'source_version_number', source_version.version_number)
  );

  return created_version.id;
end;
$$;

revoke all on function public.get_or_create_layout_draft(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_layout_draft(uuid, integer, text, uuid) to service_role;

commit;
