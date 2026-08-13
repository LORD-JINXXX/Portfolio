begin;

-- Generic Admin-owned structured collections used by Studio collection bindings.
-- Existing first-class collections (projects/notes/experience/apps) remain unchanged.
create table if not exists public.collection_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  description text,
  fields_json jsonb not null default '[]'::jsonb check (jsonb_typeof(fields_json) = 'array'),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_key text not null references public.collection_definitions(key) on update cascade on delete cascade,
  data_json jsonb not null default '{}'::jsonb check (jsonb_typeof(data_json) = 'object'),
  display_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collection_items_collection_order_idx
  on public.collection_items(collection_key, display_order, created_at, id);
create index if not exists collection_items_published_idx
  on public.collection_items(collection_key, published, display_order, id);

alter table public.collection_definitions enable row level security;
alter table public.collection_items enable row level security;

revoke all on public.collection_definitions from anon, authenticated;
revoke all on public.collection_items from anon, authenticated;
grant select, insert, update, delete on public.collection_definitions to service_role;
grant select, insert, update, delete on public.collection_items to service_role;

-- Reuse the platform-wide timestamp trigger if the base migration is present.
drop trigger if exists set_collection_definitions_updated_at on public.collection_definitions;
create trigger set_collection_definitions_updated_at before update on public.collection_definitions
for each row execute procedure public.set_updated_at();
drop trigger if exists set_collection_items_updated_at on public.collection_items;
create trigger set_collection_items_updated_at before update on public.collection_items
for each row execute procedure public.set_updated_at();

-- Keep generic media references inside the same deletion safety boundary as
-- first-class structured content and immutable release snapshots.
create or replace function public.protect_custom_collection_media_references()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.collection_items
    where public.jsonb_contains_any_exact_string(data_json, array[old.id::text])
  ) then
    raise exception 'Media is referenced by a custom collection item';
  end if;
  return old;
end;
$$;
revoke all on function public.protect_custom_collection_media_references() from public, anon, authenticated;
grant execute on function public.protect_custom_collection_media_references() to service_role;
drop trigger if exists protect_media_custom_collection_references on public.media;
create trigger protect_media_custom_collection_references
before delete on public.media
for each row execute procedure public.protect_custom_collection_media_references();

-- Technologies is the first generic collection required by the current homepage.
-- It is deliberately seeded without content rows: Admin owns the user's real data.
insert into public.collection_definitions(key,label,description,fields_json,display_order)
values (
  'technologies',
  'Technologies',
  'Technology/skill entries used by the Tech Stack section and other Studio layouts.',
  '[
    {"key":"name","label":"Name","type":"text","required":true,"placeholder":"React"},
    {"key":"category","label":"Category","type":"text","required":true,"placeholder":"frontend"},
    {"key":"install_command","label":"Install / terminal label","type":"text","required":false,"placeholder":"npm install react"},
    {"key":"icon_media_id","label":"Icon","type":"media","required":false},
    {"key":"url","label":"Website URL","type":"url","required":false,"placeholder":"https://react.dev"},
    {"key":"description","label":"Description","type":"textarea","required":false}
  ]'::jsonb,
  10
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  fields_json = excluded.fields_json,
  display_order = excluded.display_order,
  updated_at = now();

commit;
