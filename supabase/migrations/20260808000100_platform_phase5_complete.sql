create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity / roles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin','user','designer','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Structured content
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value_json jsonb,
  type text not null default 'text',
  description text,
  group_name text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_content add column if not exists value_json jsonb;
alter table public.site_content add column if not exists type text not null default 'text';
alter table public.site_content add column if not exists description text;
alter table public.site_content add column if not exists group_name text;
alter table public.site_content add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.site_content add column if not exists updated_at timestamptz not null default now();
update public.site_content set value_json = '{}'::jsonb where value_json is null;
alter table public.site_content alter column value_json set default '{}'::jsonb;
alter table public.site_content alter column value_json set not null;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  short_description text not null default '', full_description text, thumbnail text, gallery text[] not null default '{}',
  technologies text[] not null default '{}', github_url text, live_url text, featured boolean not null default false,
  published boolean not null default false, display_order integer not null default 0, seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.projects add column if not exists display_order integer not null default 0;
alter table public.projects add column if not exists seo jsonb not null default '{}'::jsonb;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  summary text not null default '', content text not null default '', category text, tags text[] not null default '{}', cover_image text,
  featured boolean not null default false, published boolean not null default false, display_order integer not null default 0,
  seo jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.notes add column if not exists display_order integer not null default 0;

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(), company text not null, role text not null, employment_type text, location text,
  start_date date not null, end_date date, current boolean not null default false, summary text,
  responsibilities text[] not null default '{}', technologies text[] not null default '{}', logo text,
  display_order integer not null default 0, published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.experiences add column if not exists created_at timestamptz not null default now();
alter table public.experiences add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ai_apps (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  short_description text not null default '', full_description text, icon text, cover_image text, category text,
  tags text[] not null default '{}', requires_login boolean not null default false,
  status text not null default 'coming_soon' check(status in ('coming_soon','available','maintenance','disabled')),
  published boolean not null default false, featured boolean not null default false, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.ai_apps add column if not exists created_at timestamptz not null default now();
alter table public.ai_apps add column if not exists updated_at timestamptz not null default now();

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(), key text not null unique, value_json jsonb not null default '{}'::jsonb,
  type text not null default 'text', description text, updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(), filename text not null, storage_path text not null, public_url text,
  mime_type text not null, size bigint not null default 0, kind text not null default 'image', width integer, height integer,
  duration numeric, alt_text text, created_at timestamptz not null default now()
);
alter table public.media add column if not exists public_url text;

-- ---------------------------------------------------------------------------
-- Design / Studio
-- ---------------------------------------------------------------------------
create table if not exists public.layouts (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text,
  thumbnail_media_id uuid references public.media(id) on delete set null,
  status text not null default 'active' check(status in ('active','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.layout_versions (
  id uuid primary key default gen_random_uuid(), layout_id uuid not null references public.layouts(id) on delete cascade,
  version_number integer not null, schema_version integer not null default 3, runtime_min_version text not null default '1.0.0',
  status text not null default 'draft' check(status in ('draft','published','archived')), changelog text,
  design_tokens jsonb not null default '{"variables":{}}'::jsonb, thumbnail_data text,
  revision_token uuid not null default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), published_at timestamptz,
  unique(layout_id, version_number)
);
alter table public.layout_versions add column if not exists design_tokens jsonb not null default '{"variables":{}}'::jsonb;
alter table public.layout_versions add column if not exists thumbnail_data text;
alter table public.layout_versions add column if not exists revision_token uuid not null default gen_random_uuid();

create table if not exists public.layout_pages (
  id uuid primary key default gen_random_uuid(), layout_version_id uuid not null references public.layout_versions(id) on delete cascade,
  slug text not null, name text not null, page_type text not null default 'standard' check(page_type in ('standard','home','collection_index','collection_detail','system')),
  route_pattern text, seo_defaults jsonb not null default '{}'::jsonb, sort_order integer not null default 0,
  layout_tree jsonb not null default '{"schemaVersion":3,"pageId":"","root":[]}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(layout_version_id, slug), unique(layout_version_id, route_pattern)
);

-- Admin can configure a candidate layout without changing the live release.
create table if not exists public.admin_workspace (
  id smallint primary key default 1 check(id = 1),
  configuring_layout_version_id uuid references public.layout_versions(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.admin_workspace(id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Content/settings revisions + publishing
-- ---------------------------------------------------------------------------
create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(), revision_number integer not null unique,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  values_json jsonb not null default '{}'::jsonb, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), published_at timestamptz
);

create table if not exists public.settings_revisions (
  id uuid primary key default gen_random_uuid(), revision_number integer not null unique,
  status text not null default 'published' check(status in ('draft','published','archived')),
  values_json jsonb not null default '{}'::jsonb, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), published_at timestamptz
);

create table if not exists public.site_releases (
  id uuid primary key default gen_random_uuid(), release_number integer not null unique,
  layout_version_id uuid not null references public.layout_versions(id) on delete restrict,
  content_revision_id uuid references public.content_revisions(id) on delete restrict,
  settings_revision_id uuid references public.settings_revisions(id) on delete restrict,
  settings_snapshot jsonb not null default '{}'::jsonb,
  collections_snapshot jsonb not null default '{}'::jsonb,
  media_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check(status in ('draft','ready','active','superseded','archived','failed')),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
  activated_at timestamptz, deactivated_at timestamptz, notes text
);
alter table public.site_releases add column if not exists content_revision_id uuid references public.content_revisions(id) on delete restrict;
alter table public.site_releases add column if not exists settings_revision_id uuid references public.settings_revisions(id) on delete restrict;
alter table public.site_releases add column if not exists settings_snapshot jsonb not null default '{}'::jsonb;
alter table public.site_releases add column if not exists collections_snapshot jsonb not null default '{}'::jsonb;
alter table public.site_releases add column if not exists media_snapshot jsonb not null default '{}'::jsonb;

create unique index if not exists one_active_site_release on public.site_releases((status)) where status = 'active';

create table if not exists public.layout_validation_results (
  id uuid primary key default gen_random_uuid(), layout_version_id uuid not null references public.layout_versions(id) on delete cascade,
  valid boolean not null, issues jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.release_validation_results (
  id uuid primary key default gen_random_uuid(), site_release_id uuid not null references public.site_releases(id) on delete cascade,
  valid boolean not null default false, issues jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null, resource_type text not null, resource_id uuid, before_json jsonb, after_json jsonb,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Updated-at helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','site_content','projects','notes','experiences','ai_apps','site_settings','layouts','layout_pages'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Published layout/content immutability
-- ---------------------------------------------------------------------------
create or replace function public.protect_published_layout_version()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' then raise exception 'Published layout versions are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.revision_token := gen_random_uuid();
  return new;
end; $$;
drop trigger if exists protect_published_layout_version_update on public.layout_versions;
create trigger protect_published_layout_version_update before update or delete on public.layout_versions
for each row execute procedure public.protect_published_layout_version();

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
create trigger protect_published_layout_page_write before insert or update or delete on public.layout_pages
for each row execute procedure public.protect_published_layout_page();
revoke all on function public.protect_published_layout_page() from public, anon, authenticated;

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
returns void language plpgsql security definer set search_path = public as $$
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
      layout_tree = excluded.layout_tree, layout_version_id = excluded.layout_version_id;
  end loop;
end; $$;
revoke all on function public.save_layout_document(uuid, uuid, text, text, text, integer, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_layout_document(uuid, uuid, text, text, text, integer, text, jsonb, text, jsonb) to service_role;

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

create or replace function public.protect_published_content_revision()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' then raise exception 'Published content revisions are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists protect_published_content_revision_update on public.content_revisions;
create trigger protect_published_content_revision_update before update or delete on public.content_revisions
for each row execute procedure public.protect_published_content_revision();

create or replace function public.protect_published_settings_revision()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' then raise exception 'Published settings revisions are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists protect_published_settings_revision_update on public.settings_revisions;
create trigger protect_published_settings_revision_update before update or delete on public.settings_revisions
for each row execute procedure public.protect_published_settings_revision();

create or replace function public.protect_activated_release_snapshot()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('active','superseded') then raise exception 'Activated release snapshots are immutable'; end if;
    return old;
  end if;
  if old.status in ('active','superseded') and (
    new.release_number is distinct from old.release_number or
    new.layout_version_id is distinct from old.layout_version_id or
    new.content_revision_id is distinct from old.content_revision_id or
    new.settings_revision_id is distinct from old.settings_revision_id or
    new.settings_snapshot is distinct from old.settings_snapshot or
    new.collections_snapshot is distinct from old.collections_snapshot or
    new.media_snapshot is distinct from old.media_snapshot or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at
  ) then raise exception 'Activated release snapshots are immutable';
  end if;
  return new;
end; $$;
drop trigger if exists protect_activated_release_snapshot_write on public.site_releases;
create trigger protect_activated_release_snapshot_write before update or delete on public.site_releases
for each row execute procedure public.protect_activated_release_snapshot();

-- ---------------------------------------------------------------------------
-- Atomic release activation / rollback
-- ---------------------------------------------------------------------------
create or replace function public.activate_release(target_release_id uuid)
returns public.site_releases
language plpgsql
security definer set search_path = public
as $$
declare target public.site_releases;
begin
  select * into target from public.site_releases where id = target_release_id for update;
  if not found then raise exception 'Release not found'; end if;
  if target.status = 'active' then return target; end if;
  if target.status not in ('draft','ready','superseded') then raise exception 'Release status % cannot be activated', target.status; end if;

  update public.site_releases
     set status = 'superseded', deactivated_at = now()
   where status = 'active' and id <> target_release_id;

  update public.site_releases
     set status = 'active', activated_at = now(), deactivated_at = null
   where id = target_release_id
   returning * into target;

  return target;
end; $$;
revoke all on function public.activate_release(uuid) from public;
grant execute on function public.activate_release(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_projects_published_order on public.projects(published, display_order);
create index if not exists idx_notes_published_order on public.notes(published, display_order);
create index if not exists idx_experience_published_order on public.experiences(published, display_order);
create index if not exists idx_apps_published_order on public.ai_apps(published, display_order);
create index if not exists idx_layout_versions_layout_status on public.layout_versions(layout_id, status, version_number desc);
create index if not exists idx_layout_pages_version_order on public.layout_pages(layout_version_id, sort_order);
create index if not exists idx_releases_status_number on public.site_releases(status, release_number desc);
create index if not exists idx_audit_resource on public.audit_logs(resource_type, resource_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.site_content enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;
alter table public.experiences enable row level security;
alter table public.ai_apps enable row level security;
alter table public.site_settings enable row level security;
alter table public.media enable row level security;
alter table public.layouts enable row level security;
alter table public.layout_versions enable row level security;
alter table public.layout_pages enable row level security;
alter table public.admin_workspace enable row level security;
alter table public.content_revisions enable row level security;
alter table public.settings_revisions enable row level security;
alter table public.site_releases enable row level security;
alter table public.layout_validation_results enable row level security;
alter table public.release_validation_results enable row level security;
alter table public.audit_logs enable row level security;

-- Remove legacy and current named policies first.
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','site_content','projects','notes','experiences','ai_apps','site_settings','media','layouts','layout_versions','layout_pages','admin_workspace','content_revisions','settings_revisions','site_releases','layout_validation_results','release_validation_results','audit_logs') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy profiles_own_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin(auth.uid()));
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy projects_public_read on public.projects for select to anon, authenticated using (published = true or public.is_admin(auth.uid()));
create policy notes_public_read on public.notes for select to anon, authenticated using (published = true or public.is_admin(auth.uid()));
create policy experience_public_read on public.experiences for select to anon, authenticated using (published = true or public.is_admin(auth.uid()));
create policy apps_public_read on public.ai_apps for select to anon, authenticated using (published = true or public.is_admin(auth.uid()));
create policy media_public_read on public.media for select to anon, authenticated using (true);

-- Direct browser writes are limited to authenticated admins. Studio designer/editor access goes through the authorized API service layer.
create policy projects_admin_write on public.projects for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy notes_admin_write on public.notes for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy experience_admin_write on public.experiences for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy apps_admin_write on public.ai_apps for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy media_admin_write on public.media for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Administrative/design domains are not exposed to anonymous users through direct PostgREST.
do $$ declare t text; begin
  foreach t in array array['site_content','site_settings','layouts','layout_versions','layout_pages','admin_workspace','content_revisions','settings_revisions','site_releases','layout_validation_results','release_validation_results','audit_logs'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t || '_admin_all', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets(id, name, public) values ('public-media','public-media',true)
on conflict (id) do update set public = excluded.public;
insert into storage.buckets(id, name, public) values ('user-resumes','user-resumes',false)
on conflict (id) do update set public = excluded.public;

-- Policies can already exist on a reused project, so drop only our names.
drop policy if exists public_media_read on storage.objects;
drop policy if exists public_media_admin_write on storage.objects;
drop policy if exists user_resume_owner on storage.objects;
create policy public_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'public-media');
create policy public_media_admin_write on storage.objects for all to authenticated using (bucket_id='public-media' and public.is_admin(auth.uid())) with check (bucket_id='public-media' and public.is_admin(auth.uid()));
create policy user_resume_owner on storage.objects for all to authenticated using (bucket_id='user-resumes' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id='user-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
