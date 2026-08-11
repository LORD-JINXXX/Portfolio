-- Repair Group 4C1: atomic service-role certification of one exact Draft release.

begin;

create or replace function public.protect_release_media_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('app.release_media_certification', true) = 'certify'
    and exists (
      select 1
      from public.site_releases
      where id = old.site_release_id
        and status = 'draft'
        and media_snapshot_version = 0
    ) then
    return old;
  end if;

  raise exception 'Release media references are immutable';
end;
$$;

revoke all on function public.protect_release_media_reference() from public, anon, authenticated;

create or replace function public.protect_release_media_snapshot_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.media_snapshot_version <> 0 then
      raise exception 'New releases must begin with unverified media accounting';
    end if;
    return new;
  end if;

  if new.media_snapshot_version is distinct from old.media_snapshot_version then
    if pg_catalog.current_setting('app.release_media_certification', true) is distinct from 'certify'
      or old.status <> 'draft'
      or new.status <> 'draft'
      or old.media_snapshot_version <> 0
      or new.media_snapshot_version <> 1 then
      raise exception 'Release media snapshot version can change only during trusted Draft certification';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_release_media_snapshot_version_update on public.site_releases;
create trigger protect_release_media_snapshot_version_update
before insert or update on public.site_releases
for each row execute procedure public.protect_release_media_snapshot_version();

revoke all on function public.protect_release_media_snapshot_version() from public, anon, authenticated;

-- Direct table writes cannot construct a partial authoritative set. The
-- security-definer certification RPC below is the only writer.
revoke insert, update, delete on table public.release_media_references from service_role;
grant select on table public.release_media_references to service_role;
revoke insert, update, delete on table public.site_releases from service_role;
grant select on table public.site_releases to service_role;

create or replace function public.certify_release_media_snapshot(
  target_release_id uuid,
  expected_snapshot_revision_token uuid,
  collector_complete boolean,
  unresolved_references jsonb,
  target_media_ids uuid[],
  actor_user_id uuid
)
returns public.site_releases
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.site_releases%rowtype;
  certified public.site_releases%rowtype;
  normalized_ids uuid[];
  requested_count integer;
  persisted_count integer;
begin
  select * into target
  from public.site_releases
  where id = target_release_id
  for update;

  if not found then raise exception 'Release not found'; end if;
  if target.status <> 'draft' then
    raise exception 'Only Draft releases can receive authoritative media certification';
  end if;
  if target.media_snapshot_version <> 0 then
    raise exception 'Release media accounting is already certified';
  end if;
  if target.snapshot_revision_token is distinct from expected_snapshot_revision_token then
    raise exception 'Release changed during media collection. Recollect the exact snapshot';
  end if;
  if collector_complete is not true then
    raise exception 'Incomplete media collection cannot be certified';
  end if;
  if jsonb_typeof(coalesce(unresolved_references, '[]'::jsonb)) <> 'array' then
    raise exception 'Unresolved media references must be a JSON array';
  end if;
  if jsonb_array_length(coalesce(unresolved_references, '[]'::jsonb)) <> 0 then
    raise exception 'Unresolved managed media references prevent certification';
  end if;
  if exists (select 1 from unnest(coalesce(target_media_ids, '{}'::uuid[])) as input(media_id) where media_id is null) then
    raise exception 'Canonical media IDs cannot contain NULL';
  end if;

  select coalesce(array_agg(media_id order by media_id), '{}'::uuid[])
  into normalized_ids
  from (
    select distinct media_id
    from unnest(coalesce(target_media_ids, '{}'::uuid[])) as input(media_id)
  ) normalized;

  requested_count := cardinality(normalized_ids);
  select count(*) into persisted_count
  from public.media
  where id = any(normalized_ids);

  if persisted_count <> requested_count then
    raise exception 'Every canonical media ID must resolve to public.media';
  end if;

  perform public.assert_release_inputs(target_release_id);
  perform pg_catalog.set_config('app.release_media_certification', 'certify', true);

  delete from public.release_media_references
  where site_release_id = target_release_id;

  insert into public.release_media_references(
    site_release_id,
    media_id,
    bucket_id,
    storage_path,
    mime_type,
    size,
    alt_text,
    captured_public_url
  )
  select
    target_release_id,
    media.id,
    'public-media',
    media.storage_path,
    media.mime_type,
    media.size,
    media.alt_text,
    media.public_url
  from public.media media
  where media.id = any(normalized_ids)
  order by media.id;

  select count(*) into persisted_count
  from public.release_media_references
  where site_release_id = target_release_id;

  if persisted_count <> requested_count then
    raise exception 'Authoritative release media set was not persisted completely';
  end if;

  update public.site_releases
  set media_snapshot_version = 1
  where id = target_release_id
    and status = 'draft'
    and media_snapshot_version = 0
    and snapshot_revision_token = expected_snapshot_revision_token
  returning * into certified;

  if not found then
    raise exception 'Release changed before media certification completed';
  end if;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, after_json, metadata)
  values (
    actor_user_id,
    'release_media_certified',
    'site_release',
    target_release_id,
    to_jsonb(certified),
    jsonb_build_object(
      'media_snapshot_version', certified.media_snapshot_version,
      'media_reference_count', persisted_count,
      'snapshot_revision_token', certified.snapshot_revision_token
    )
  );

  return certified;
end;
$$;

revoke all on function public.certify_release_media_snapshot(uuid, uuid, boolean, jsonb, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.certify_release_media_snapshot(uuid, uuid, boolean, jsonb, uuid[], uuid) to service_role;

comment on function public.certify_release_media_snapshot(uuid, uuid, boolean, jsonb, uuid[], uuid) is
  'Atomically certifies the complete canonical media set for one exact Draft release without changing release identity, status, activation state, or snapshot token.';

commit;
