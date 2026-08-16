begin;

-- Patch 06: keep the canonical project gallery relation and the legacy projects.gallery
-- compatibility column in one database transaction. The API invokes this only through
-- the service role after its normal structured-content validation.
create or replace function public.replace_project_gallery_media(
  target_project_id uuid,
  media_ids uuid[]
)
returns table(media_id uuid, sort_order integer, public_url text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  normalized_ids uuid[] := coalesce(media_ids, '{}'::uuid[]);
begin
  if target_project_id is null then raise exception 'Project id is required'; end if;
  perform 1 from public.projects where id = target_project_id;
  if not found then raise exception 'Project not found'; end if;

  if cardinality(normalized_ids) > 60 then
    raise exception 'Project gallery cannot exceed 60 managed media items';
  end if;
  if cardinality(normalized_ids) <> (select count(distinct requested.value) from unnest(normalized_ids) as requested(value)) then
    raise exception 'Project gallery cannot contain duplicate media';
  end if;
  if exists (
    select 1
    from unnest(normalized_ids) as requested(value)
    left join public.media m on m.id = requested.value
    where m.id is null
  ) then
    raise exception 'Project gallery contains unknown managed media';
  end if;

  delete from public.project_gallery_media where project_id = target_project_id;

  insert into public.project_gallery_media(project_id, media_id, sort_order)
  select target_project_id, requested.value, (requested.ordinality - 1)::integer
  from unnest(normalized_ids) with ordinality as requested(value, ordinality)
  order by requested.ordinality;

  update public.projects p
  set gallery = coalesce((
    select array_agg(m.public_url order by requested.ordinality)
      filter (where m.public_url is not null and m.public_url <> '')
    from unnest(normalized_ids) with ordinality as requested(value, ordinality)
    join public.media m on m.id = requested.value
  ), '{}'::text[])
  where p.id = target_project_id;

  return query
  select requested.value, (requested.ordinality - 1)::integer, m.public_url
  from unnest(normalized_ids) with ordinality as requested(value, ordinality)
  join public.media m on m.id = requested.value
  order by requested.ordinality;
end;
$$;

revoke all on function public.replace_project_gallery_media(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_project_gallery_media(uuid, uuid[]) to service_role;

-- Project Details uses the generic collection constraint vocabulary introduced by
-- Patch 06. Existing user-authored metadata is preserved; defaults are added only
-- when the corresponding constraint is absent.
update public.collection_definitions d
set fields_json = (
  select coalesce(jsonb_agg(
    case when field.value->>'key' = 'project_slug' then
      (case when field.value ? 'unique' then field.value else field.value || '{"unique":true}'::jsonb end)
      ||
      (case when field.value ? 'relation' then '{}'::jsonb else jsonb_build_object(
        'relation', jsonb_build_object(
          'collection', 'projects',
          'field', 'slug',
          'requirePublished', true,
          'targetCoverage', 'warning'
        )
      ) end)
    else field.value end
    order by field.ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(d.fields_json) with ordinality as field(value, ordinality)
), updated_at = now()
where d.key = 'project_details';

-- The API provides generic uniqueness validation for custom collection fields.
-- This index additionally closes the concurrent-write race for the current
-- Project Details relation without changing the generic collection table shape.
create unique index if not exists collection_items_project_details_project_slug_unique
on public.collection_items ((data_json->>'project_slug'))
where collection_key = 'project_details'
  and nullif(btrim(data_json->>'project_slug'), '') is not null;

commit;
