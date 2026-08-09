-- Repair Group 4B1: reconcile reused legacy media schemas with the canonical API shape.
-- Legacy url and size_bytes columns remain available for older consumers.

begin;

alter table public.media
  add column if not exists public_url text;

alter table public.media
  add column if not exists size bigint not null default 0;

alter table public.media
  add column if not exists alt_text text;

do $$
begin
  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.media'::regclass
      and attname = 'url'
      and not attisdropped
  ) then
    update public.media
    set public_url = url
    where (public_url is null or btrim(public_url) = '')
      and url is not null
      and btrim(url) <> '';
  end if;

  if exists (
    select 1
    from pg_attribute
    where attrelid = 'public.media'::regclass
      and attname = 'size_bytes'
      and not attisdropped
  ) then
    update public.media
    set size = size_bytes
    where size = 0
      and size_bytes is not null
      and size_bytes >= 0;
  end if;
end;
$$;

comment on column public.media.public_url is
  'Canonical public delivery URL; backfilled from legacy media.url without removing compatibility data.';
comment on column public.media.size is
  'Canonical media size in bytes; backfilled from legacy media.size_bytes without removing compatibility data.';

commit;
