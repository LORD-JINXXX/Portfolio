-- Forward-only Repair Group 2 delta for databases that already applied
-- 20260808000100_platform_phase5_complete.sql before these definitions changed.

alter table public.layout_versions add column if not exists revision_token uuid not null default gen_random_uuid();

-- ---------------------------------------------------------------------------
-- Published layout-page immutability and ownership
-- ---------------------------------------------------------------------------
create or replace function public.protect_published_layout_version()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' then raise exception 'Published layout versions are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.revision_token := gen_random_uuid();
  return new;
end; $$;

create or replace function public.protect_published_layout_page()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare old_version_status text;
declare new_version_status text;
begin
  if tg_op <> 'INSERT' then
    select status into old_version_status from public.layout_versions where id = old.layout_version_id for update;
    if old_version_status = 'published' then raise exception 'Pages in published layout versions are immutable'; end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.layout_version_id is distinct from old.layout_version_id then
      raise exception 'Layout pages cannot be reassigned to another layout version';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select status into new_version_status from public.layout_versions where id = new.layout_version_id for update;
    if new_version_status = 'published' then raise exception 'Pages in published layout versions are immutable'; end if;
  end if;
  if tg_op = 'DELETE' then
    update public.layout_versions set revision_token = gen_random_uuid() where id = old.layout_version_id and status = 'draft';
    return old;
  end if;
  update public.layout_versions set revision_token = gen_random_uuid() where id = new.layout_version_id and status = 'draft';
  return new;
end; $$;

drop trigger if exists protect_published_layout_page_write on public.layout_pages;
create trigger protect_published_layout_page_write
before insert or update or delete on public.layout_pages
for each row
execute function public.protect_published_layout_page();

revoke all on function public.protect_published_layout_page() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic Studio document persistence
-- ---------------------------------------------------------------------------
create or replace function public.save_layout_document(
  target_layout_id uuid,
  target_version_id uuid,
  layout_name text,
  layout_slug text,
  layout_description text,
  schema_version_value integer,
  runtime_min_version_value text,
  design_tokens_value jsonb,
  changelog_value text,
  pages_value jsonb
)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare version_status text;
declare page jsonb;
declare page_id uuid;
declare existing_version_id uuid;
begin
  select status into version_status
  from public.layout_versions
  where id = target_version_id and layout_id = target_layout_id
  for update;
  if not found then raise exception 'Layout version not found'; end if;
  if version_status <> 'draft' then raise exception 'Published/archived versions are immutable. Create a new draft.'; end if;
  if jsonb_typeof(pages_value) <> 'array' or jsonb_array_length(pages_value) = 0 then raise exception 'Layout must contain at least one page'; end if;

  for page in select value from jsonb_array_elements(pages_value) loop
    page_id := (page->>'id')::uuid;
    select layout_version_id into existing_version_id from public.layout_pages where id = page_id;
    if existing_version_id is not null and existing_version_id <> target_version_id then
      raise exception 'Page % belongs to another layout version', page_id;
    end if;
  end loop;

  update public.layouts set name = layout_name, slug = layout_slug, description = layout_description where id = target_layout_id;
  update public.layout_versions set schema_version = schema_version_value, runtime_min_version = runtime_min_version_value,
    design_tokens = design_tokens_value, changelog = changelog_value where id = target_version_id;

  delete from public.layout_pages
  where layout_version_id = target_version_id
    and id not in (select (value->>'id')::uuid from jsonb_array_elements(pages_value));

  for page in select value from jsonb_array_elements(pages_value) loop
    insert into public.layout_pages(id, layout_version_id, slug, name, page_type, route_pattern, seo_defaults, sort_order, layout_tree)
    values ((page->>'id')::uuid, target_version_id, page->>'slug', page->>'name', page->>'page_type',
      nullif(page->>'route_pattern', ''), coalesce(page->'seo_defaults', '{}'::jsonb), coalesce((page->>'sort_order')::integer, 0), page->'layout_tree')
    on conflict (id) do update set slug = excluded.slug, name = excluded.name, page_type = excluded.page_type,
      route_pattern = excluded.route_pattern, seo_defaults = excluded.seo_defaults, sort_order = excluded.sort_order,
      layout_tree = excluded.layout_tree;
  end loop;
end; $$;

revoke all on function public.save_layout_document(uuid, uuid, text, text, text, integer, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_layout_document(uuid, uuid, text, text, text, integer, text, jsonb, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Draft-only layout publication
-- ---------------------------------------------------------------------------
-- The trusted Studio API performs strict layout validation immediately before
-- this atomic state transition. Publishing here never activates the website.
drop function if exists public.publish_layout_version(uuid, text, text);
create or replace function public.publish_layout_version(
  target_version_id uuid,
  expected_revision_token uuid,
  thumbnail_value text,
  changelog_value text
)
returns public.layout_versions language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare published public.layout_versions;
begin
  select * into published from public.layout_versions where id = target_version_id for update;
  if not found then raise exception 'Layout version not found'; end if;
  if published.status <> 'draft' then raise exception 'Only draft versions can be published'; end if;
  if published.revision_token is distinct from expected_revision_token then
    raise exception 'Draft changed after validation. Revalidate before publishing';
  end if;

  update public.layout_versions
  set status = 'published', published_at = now(), thumbnail_data = coalesce(thumbnail_value, thumbnail_data), changelog = changelog_value
  where id = target_version_id and status = 'draft' and revision_token = expected_revision_token
  returning * into published;
  if not found then raise exception 'Draft changed after validation. Revalidate before publishing'; end if;
  return published;
end; $$;

revoke all on function public.publish_layout_version(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.publish_layout_version(uuid, uuid, text, text) to service_role;
