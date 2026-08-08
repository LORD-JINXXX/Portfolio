-- Repair Group 2: atomically create a layout, its initial draft version,
-- and the complete starter document while allocating a stable unique slug.

create or replace function public.create_layout_document(
  layout_name_value text,
  layout_slug_base_value text,
  layout_description_value text,
  schema_version_value integer,
  runtime_min_version_value text,
  design_tokens_value jsonb,
  pages_value jsonb,
  actor_user_id uuid
)
returns table(layout_id uuid, version_id uuid, layout_slug text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  normalized_slug text;
  candidate_slug text;
  slug_suffix integer := 1;
  violated_constraint text;
  page jsonb;
  created_layout public.layouts%rowtype;
  created_version public.layout_versions%rowtype;
begin
  if nullif(btrim(layout_name_value), '') is null then
    raise exception 'Layout name is required';
  end if;
  if pages_value is null or jsonb_typeof(pages_value) <> 'array' or jsonb_array_length(pages_value) = 0 then
    raise exception 'Layout must contain at least one page';
  end if;

  normalized_slug := btrim(lower(regexp_replace(coalesce(layout_slug_base_value, ''), '[^a-z0-9]+', '-', 'g')), '-');
  if normalized_slug = '' then normalized_slug := 'layout'; end if;
  candidate_slug := normalized_slug;

  loop
    begin
      insert into public.layouts(name, slug, description, status, created_by)
      values (btrim(layout_name_value), candidate_slug, coalesce(layout_description_value, ''), 'active', actor_user_id)
      returning * into created_layout;
      exit;
    exception when unique_violation then
      get stacked diagnostics violated_constraint = CONSTRAINT_NAME;
      if violated_constraint <> 'layouts_slug_key' then raise; end if;
      slug_suffix := slug_suffix + 1;
      candidate_slug := normalized_slug || '-' || slug_suffix::text;
    end;
  end loop;

  insert into public.layout_versions(
    layout_id, version_number, schema_version, runtime_min_version, status, design_tokens, created_by
  ) values (
    created_layout.id, 1, schema_version_value, runtime_min_version_value, 'draft', design_tokens_value, actor_user_id
  ) returning * into created_version;

  for page in select value from jsonb_array_elements(pages_value) loop
    insert into public.layout_pages(
      id, layout_version_id, slug, name, page_type, route_pattern, seo_defaults, sort_order, layout_tree
    ) values (
      (page->>'id')::uuid,
      created_version.id,
      page->>'slug',
      page->>'name',
      page->>'page_type',
      nullif(page->>'route_pattern', ''),
      coalesce(page->'seo_defaults', '{}'::jsonb),
      coalesce((page->>'sort_order')::integer, 0),
      page->'layout_tree'
    );
  end loop;

  return query select created_layout.id, created_version.id, candidate_slug;
end; $$;

revoke all on function public.create_layout_document(text, text, text, integer, text, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_layout_document(text, text, text, integer, text, jsonb, jsonb, uuid) to service_role;
