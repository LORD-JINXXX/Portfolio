-- Repair Group 4B1: media identity and release media reference foundation.
-- This migration does not collect references, certify legacy releases, or alter runtime behavior.

begin;

-- Fail safely if the mandatory live preflight was not representative.
do $$
begin
  if exists (
    select 1
    from public.media
    group by storage_path
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce media storage identity: duplicate storage_path values exist';
  end if;

  if exists (
    select 1
    from public.media
    where storage_path is null or btrim(storage_path) = ''
  ) then
    raise exception 'Cannot enforce media storage identity: blank storage_path values exist';
  end if;
end;
$$;

create unique index if not exists media_storage_path_unique
  on public.media(storage_path);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.media'::regclass
      and conname = 'media_storage_path_not_blank'
  ) then
    alter table public.media
      add constraint media_storage_path_not_blank
      check (btrim(storage_path) <> '');
  end if;
end;
$$;

create or replace function public.protect_media_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Media ID is immutable';
  end if;
  if new.storage_path is distinct from old.storage_path then
    raise exception 'Media storage_path is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_media_identity_update on public.media;
create trigger protect_media_identity_update
before update on public.media
for each row execute procedure public.protect_media_identity();

revoke all on function public.protect_media_identity() from public, anon, authenticated;

create table if not exists public.release_media_references (
  site_release_id uuid not null references public.site_releases(id) on delete restrict,
  media_id uuid not null references public.media(id) on delete restrict,
  bucket_id text not null default 'public-media',
  storage_path text not null,
  mime_type text not null,
  size bigint not null,
  alt_text text,
  captured_public_url text,
  created_at timestamptz not null default now(),
  primary key (site_release_id, media_id),
  constraint release_media_references_bucket_not_blank check (btrim(bucket_id) <> ''),
  constraint release_media_references_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint release_media_references_size_nonnegative check (size >= 0)
);

create index if not exists idx_release_media_references_media_release
  on public.release_media_references(media_id, site_release_id);

create or replace function public.protect_release_media_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'Release media references are immutable';
end;
$$;

drop trigger if exists protect_release_media_reference_write on public.release_media_references;
create trigger protect_release_media_reference_write
before update or delete on public.release_media_references
for each row execute procedure public.protect_release_media_reference();

revoke all on function public.protect_release_media_reference() from public, anon, authenticated;

alter table public.release_media_references enable row level security;
revoke all on table public.release_media_references from public, anon, authenticated;
grant select, insert on table public.release_media_references to service_role;

alter table public.site_releases
  add column if not exists media_snapshot_version smallint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_releases'::regclass
      and conname = 'site_releases_media_snapshot_version_check'
  ) then
    alter table public.site_releases
      add constraint site_releases_media_snapshot_version_check
      check (media_snapshot_version in (0, 1));
  end if;
end;
$$;

create or replace function public.protect_release_media_snapshot_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.media_snapshot_version is distinct from old.media_snapshot_version then
    raise exception 'Release media snapshot version is immutable after release creation';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_release_media_snapshot_version_update on public.site_releases;
create trigger protect_release_media_snapshot_version_update
before update on public.site_releases
for each row execute procedure public.protect_release_media_snapshot_version();

revoke all on function public.protect_release_media_snapshot_version() from public, anon, authenticated;

-- Admin upload/delete already uses the authenticated API and service-role storage client.
-- Keep public reads, but remove direct authenticated browser mutations for this bucket.
drop policy if exists public_media_admin_write on storage.objects;

comment on table public.release_media_references is
  'Immutable release-owned media identity metadata. Populated only by trusted release operations.';
comment on column public.site_releases.media_snapshot_version is
  '0 = legacy/incomplete/unverified media accounting; 1 = complete authoritative media-reference set.';

commit;
