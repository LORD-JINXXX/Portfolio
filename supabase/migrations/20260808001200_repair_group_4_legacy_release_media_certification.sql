-- Repair Group 4D: trusted certification path for immutable historical releases.
-- No row is automatically certified. Admin/API must collect the exact frozen
-- release snapshot first and call this RPC explicitly.

begin;

create or replace function public.protect_release_media_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare context text := pg_catalog.current_setting('app.release_media_certification', true);
begin
  if tg_op = 'DELETE' and context in ('certify','legacy-certify') and exists (
    select 1 from public.site_releases where id=old.site_release_id and media_snapshot_version=0
      and (context='legacy-certify' or status='draft')
  ) then return old; end if;
  raise exception 'Release media references are immutable';
end;
$$;
revoke all on function public.protect_release_media_reference() from public,anon,authenticated;

create or replace function public.protect_release_media_snapshot_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare context text := pg_catalog.current_setting('app.release_media_certification', true);
begin
  if tg_op='INSERT' then
    if new.media_snapshot_version<>0 then raise exception 'New releases must begin with unverified media accounting'; end if;
    return new;
  end if;
  if new.media_snapshot_version is distinct from old.media_snapshot_version then
    if old.media_snapshot_version<>0 or new.media_snapshot_version<>1 or new.status is distinct from old.status
       or context not in ('certify','legacy-certify')
       or (context='certify' and old.status<>'draft')
       or (context='legacy-certify' and old.status not in ('draft','ready','active','superseded')) then
      raise exception 'Release media snapshot version can change only during trusted certification';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_release_media_snapshot_version() from public,anon,authenticated;

create or replace function public.certify_legacy_release_media_snapshot(
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
  select * into target from public.site_releases where id=target_release_id for update;
  if not found then raise exception 'Release not found'; end if;
  if target.status not in ('draft','ready','active','superseded') then raise exception 'Release status is not eligible for legacy certification'; end if;
  if target.media_snapshot_version<>0 then raise exception 'Release media accounting is already certified'; end if;
  if target.snapshot_revision_token is distinct from expected_snapshot_revision_token then raise exception 'Release changed during media collection'; end if;
  if collector_complete is not true then raise exception 'Incomplete media collection cannot be certified'; end if;
  if jsonb_typeof(coalesce(unresolved_references,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(unresolved_references,'[]'::jsonb))<>0 then raise exception 'Unresolved managed media references prevent certification'; end if;
  if exists(select 1 from unnest(coalesce(target_media_ids,'{}'::uuid[])) i(media_id) where media_id is null) then raise exception 'Canonical media IDs cannot contain NULL'; end if;

  select coalesce(array_agg(media_id order by media_id),'{}'::uuid[]) into normalized_ids
  from (select distinct media_id from unnest(coalesce(target_media_ids,'{}'::uuid[])) i(media_id)) d;
  requested_count:=cardinality(normalized_ids);
  select count(*) into persisted_count from public.media where id=any(normalized_ids);
  if persisted_count<>requested_count then raise exception 'Every canonical media ID must resolve to public.media'; end if;

  perform public.assert_release_inputs(target_release_id);
  perform pg_catalog.set_config('app.release_media_certification','legacy-certify',true);
  delete from public.release_media_references where site_release_id=target_release_id;
  insert into public.release_media_references(site_release_id,media_id,bucket_id,storage_path,mime_type,size,alt_text,captured_public_url)
  select target_release_id,m.id,'public-media',m.storage_path,m.mime_type,m.size,m.alt_text,m.public_url
  from public.media m where m.id=any(normalized_ids) order by m.id;
  select count(*) into persisted_count from public.release_media_references where site_release_id=target_release_id;
  if persisted_count<>requested_count then raise exception 'Authoritative release media set was not persisted completely'; end if;

  update public.site_releases set media_snapshot_version=1
  where id=target_release_id and media_snapshot_version=0 and status=target.status and snapshot_revision_token=expected_snapshot_revision_token
  returning * into certified;
  if not found then raise exception 'Release changed before legacy media certification completed'; end if;

  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json,metadata)
  values(actor_user_id,'release_media_legacy_certified','site_release',target_release_id,to_jsonb(certified),jsonb_build_object('previous_status',target.status,'media_reference_count',persisted_count,'snapshot_revision_token',certified.snapshot_revision_token));
  return certified;
end;
$$;
revoke all on function public.certify_legacy_release_media_snapshot(uuid,uuid,boolean,jsonb,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.certify_legacy_release_media_snapshot(uuid,uuid,boolean,jsonb,uuid[],uuid) to service_role;

commit;
