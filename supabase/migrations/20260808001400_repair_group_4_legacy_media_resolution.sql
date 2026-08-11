-- Repair Group 4D: explicit, auditable resolution of frozen legacy media values.
-- This does not rewrite historical release snapshots. It records a sidecar mapping
-- from one exact legacy value in one release to one canonical media row, allowing
-- trusted historical certification to remain deterministic and reviewable.

begin;

create table if not exists public.release_media_legacy_resolutions (
  site_release_id uuid not null references public.site_releases(id) on delete restrict,
  legacy_value text not null check (length(trim(legacy_value)) > 0),
  media_id uuid not null references public.media(id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (site_release_id, legacy_value)
);

create index if not exists idx_release_media_legacy_resolutions_media
  on public.release_media_legacy_resolutions(media_id, site_release_id);

alter table public.release_media_legacy_resolutions enable row level security;
revoke all on table public.release_media_legacy_resolutions from public, anon, authenticated;
grant select on table public.release_media_legacy_resolutions to service_role;

create or replace function public.set_release_media_legacy_resolution(
  target_release_id uuid,
  exact_legacy_value text,
  target_media_id uuid,
  actor_user_id uuid
)
returns public.release_media_legacy_resolutions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target_release public.site_releases%rowtype;
  result public.release_media_legacy_resolutions%rowtype;
begin
  if exact_legacy_value is null or length(trim(exact_legacy_value)) = 0 then
    raise exception 'Legacy media value is required';
  end if;

  select * into target_release from public.site_releases where id = target_release_id for update;
  if not found then raise exception 'Release not found'; end if;
  if target_release.media_snapshot_version <> 0 then
    raise exception 'Legacy media resolutions are immutable after media certification';
  end if;
  if target_release.status not in ('draft','ready','active','superseded') then
    raise exception 'Release status is not eligible for legacy media resolution';
  end if;
  if not exists(select 1 from public.media where id = target_media_id) then
    raise exception 'Canonical media not found';
  end if;

  insert into public.release_media_legacy_resolutions(site_release_id, legacy_value, media_id, created_by)
  values(target_release_id, trim(exact_legacy_value), target_media_id, actor_user_id)
  on conflict(site_release_id, legacy_value) do update
    set media_id = excluded.media_id,
        created_by = excluded.created_by,
        created_at = now()
  returning * into result;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, after_json)
  values(actor_user_id, 'release_legacy_media_resolution_set', 'site_release', target_release_id,
    jsonb_build_object('legacy_value', result.legacy_value, 'media_id', result.media_id));

  return result;
end;
$$;

revoke all on function public.set_release_media_legacy_resolution(uuid,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.set_release_media_legacy_resolution(uuid,text,uuid,uuid) to service_role;

commit;
