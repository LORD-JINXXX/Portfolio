-- Patch 12: first-class Blogs structured collection with managed-media-safe rich content blocks.
begin;

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  excerpt text not null default '',
  cover_media_id uuid references public.media(id) on delete restrict,
  author_name text,
  category text,
  tags text[] not null default '{}',
  content_blocks jsonb not null default '[]'::jsonb,
  search_text text not null default '',
  reading_time_minutes integer not null default 1,
  published_at timestamptz,
  featured boolean not null default false,
  published boolean not null default false,
  display_order integer not null default 0,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blogs_content_blocks_array check (jsonb_typeof(content_blocks) = 'array'),
  constraint blogs_content_blocks_size check (octet_length(content_blocks::text) <= 1048576),
  constraint blogs_reading_time_positive check (reading_time_minutes between 1 and 10000)
);

alter table public.blogs enable row level security;

drop trigger if exists set_blogs_updated_at on public.blogs;
create trigger set_blogs_updated_at
before update on public.blogs
for each row execute procedure public.set_updated_at();

drop policy if exists blogs_public_read on public.blogs;
drop policy if exists blogs_admin_write on public.blogs;
create policy blogs_public_read on public.blogs
for select to anon, authenticated
using (published = true or public.is_admin(auth.uid()));
create policy blogs_admin_write on public.blogs
for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Current production authority is the API/release layer, not direct browser PostgREST.
revoke select, insert, update, delete on table public.blogs from anon, authenticated;
grant select, insert, update, delete on table public.blogs to service_role;

create index if not exists blogs_display_order_id_idx on public.blogs(display_order asc, id asc);
create index if not exists blogs_published_at_id_idx on public.blogs(published_at desc nulls last, id asc);
create index if not exists blogs_published_idx on public.blogs(published, id asc);
create index if not exists blogs_featured_idx on public.blogs(featured, id asc);
create index if not exists blogs_category_idx on public.blogs(category, id asc);
create index if not exists blogs_tags_gin_idx on public.blogs using gin(tags);

-- Draft blog blocks store managed media UUIDs inside JSONB. Protect those bytes
-- even before a blog reaches an immutable release snapshot.
create or replace function public.protect_blog_content_media_delete()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.blogs
    where public.jsonb_contains_exact_string(content_blocks, old.id::text)
  ) then
    raise exception 'Media is referenced by a blog content block';
  end if;
  return old;
end;
$$;

revoke all on function public.protect_blog_content_media_delete() from public, anon, authenticated;

drop trigger if exists protect_blog_content_media_delete on public.media;
create trigger protect_blog_content_media_delete
before delete on public.media
for each row execute procedure public.protect_blog_content_media_delete();

commit;
