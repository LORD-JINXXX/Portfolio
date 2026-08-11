-- Repair Group 4B2: canonical managed-media identities for structured collections.

begin;

alter table public.projects add column if not exists thumbnail_media_id uuid;
alter table public.notes add column if not exists cover_media_id uuid;
alter table public.experiences add column if not exists logo_media_id uuid;
alter table public.ai_apps add column if not exists icon_media_id uuid;
alter table public.ai_apps add column if not exists cover_media_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_thumbnail_media_id_fkey') then
    alter table public.projects add constraint projects_thumbnail_media_id_fkey foreign key (thumbnail_media_id) references public.media(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notes_cover_media_id_fkey') then
    alter table public.notes add constraint notes_cover_media_id_fkey foreign key (cover_media_id) references public.media(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'experiences_logo_media_id_fkey') then
    alter table public.experiences add constraint experiences_logo_media_id_fkey foreign key (logo_media_id) references public.media(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_apps_icon_media_id_fkey') then
    alter table public.ai_apps add constraint ai_apps_icon_media_id_fkey foreign key (icon_media_id) references public.media(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_apps_cover_media_id_fkey') then
    alter table public.ai_apps add constraint ai_apps_cover_media_id_fkey foreign key (cover_media_id) references public.media(id) on delete restrict;
  end if;
end;
$$;

create table if not exists public.project_gallery_media (
  project_id uuid not null references public.projects(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  primary key (project_id, sort_order),
  unique (project_id, media_id)
);

create index if not exists project_gallery_media_media_idx on public.project_gallery_media(media_id);

create or replace function public.decode_url_path(value text)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  result text := value;
  encoded text;
  decoded text;
begin
  for encoded, decoded in
    select * from (values
      ('%20',' '),('%21','!'),('%23','#'),('%24','$'),('%25','%'),('%26','&'),
      ('%27',''''),('%28','('),('%29',')'),('%2B','+'),('%2C',','),('%2F','/'),
      ('%3A',':'),('%3B',';'),('%3D','='),('%3F','?'),('%40','@'),('%5B','['),
      ('%5D',']')
    ) replacements(encoded, decoded)
  loop
    result := replace(replace(result, encoded, decoded), lower(encoded), decoded);
  end loop;
  return result;
end;
$$;

create or replace function public.match_managed_media_id(legacy_value text)
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  with normalized as (
    select nullif(btrim(legacy_value), '') as value
  ), candidates as (
    select m.id
    from public.media m
    cross join normalized n
    where n.value is not null
      and (
        m.id::text = n.value
        or m.public_url = n.value
        or (to_jsonb(m) ->> 'url') = n.value
        or m.storage_path = n.value
        or m.storage_path = case
          when n.value ~ '^https?://[^/]+/storage/v1/object/public/public-media/'
          then public.decode_url_path(split_part(n.value, '/storage/v1/object/public/public-media/', 2))
          else null
        end
      )
    group by m.id
  )
  select case when count(*) = 1 then min(id::text)::uuid else null end from candidates;
$$;

revoke all on function public.match_managed_media_id(text) from public, anon, authenticated;
grant execute on function public.match_managed_media_id(text) to service_role;
revoke all on function public.decode_url_path(text) from public, anon, authenticated;
grant execute on function public.decode_url_path(text) to service_role;

update public.projects set thumbnail_media_id = public.match_managed_media_id(thumbnail)
where thumbnail_media_id is null and nullif(btrim(thumbnail), '') is not null;

update public.notes set cover_media_id = public.match_managed_media_id(cover_image)
where cover_media_id is null and nullif(btrim(cover_image), '') is not null;

update public.experiences set logo_media_id = public.match_managed_media_id(logo)
where logo_media_id is null and nullif(btrim(logo), '') is not null;

update public.ai_apps set icon_media_id = public.match_managed_media_id(icon)
where icon_media_id is null and nullif(btrim(icon), '') is not null;

update public.ai_apps set cover_media_id = public.match_managed_media_id(cover_image)
where cover_media_id is null and nullif(btrim(cover_image), '') is not null;

insert into public.project_gallery_media(project_id, media_id, sort_order)
select p.id, matched.media_id, entry.ordinality - 1
from public.projects p
cross join lateral unnest(p.gallery) with ordinality as entry(value, ordinality)
cross join lateral (select public.match_managed_media_id(entry.value) as media_id) matched
where matched.media_id is not null
on conflict do nothing;

alter table public.project_gallery_media enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.project_gallery_media from anon, authenticated;
grant select on public.project_gallery_media to anon, authenticated;
grant select, insert, update, delete on public.project_gallery_media to service_role;
create policy project_gallery_media_public_read on public.project_gallery_media
  for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and (p.published or public.is_admin(auth.uid()))));

commit;
