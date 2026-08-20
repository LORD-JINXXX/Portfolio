begin;

-- Patch 10: query/index hardening for the runtime-query/Admin-list enhancement series.
--
-- The structured Admin list endpoints use bounded offset pagination with a stable
-- UUID id tie-breaker. These indexes focus on the dominant/default query path:
-- exact allowlisted filters followed by display_order. Alternate user-selected
-- sorts still remain valid; add dedicated indexes only if production query plans
-- show that a particular alternate sort is hot enough to justify its write cost.

create index if not exists idx_projects_admin_display_order
  on public.projects(display_order, id);
create index if not exists idx_notes_admin_display_order
  on public.notes(display_order, id);
create index if not exists idx_experiences_admin_display_order
  on public.experiences(display_order, id);
create index if not exists idx_ai_apps_admin_display_order
  on public.ai_apps(display_order, id);

-- Upgrade the original published/default-order indexes with the deterministic id
-- tie-breaker now used by the API. The three-column indexes are strict supersets
-- of the previous (published, display_order) shape for these list paths.
drop index if exists public.idx_projects_published_order;
drop index if exists public.idx_notes_published_order;
drop index if exists public.idx_experience_published_order;
drop index if exists public.idx_apps_published_order;

create index idx_projects_published_order
  on public.projects(published, display_order, id);
create index idx_notes_published_order
  on public.notes(published, display_order, id);
create index idx_experience_published_order
  on public.experiences(published, display_order, id);
create index idx_apps_published_order
  on public.ai_apps(published, display_order, id);

-- Secondary exact filters exposed by the Admin UI.
create index if not exists idx_projects_admin_featured_order
  on public.projects(featured, display_order, id);

create index if not exists idx_notes_admin_featured_order
  on public.notes(featured, display_order, id);
create index if not exists idx_notes_admin_category_order
  on public.notes(category, display_order, id);

create index if not exists idx_experiences_admin_current_order
  on public.experiences(current, display_order, id);
create index if not exists idx_experiences_admin_employment_type_order
  on public.experiences(employment_type, display_order, id);

create index if not exists idx_ai_apps_admin_featured_order
  on public.ai_apps(featured, display_order, id);
create index if not exists idx_ai_apps_admin_requires_login_order
  on public.ai_apps(requires_login, display_order, id);
create index if not exists idx_ai_apps_admin_category_order
  on public.ai_apps(category, display_order, id);
create index if not exists idx_ai_apps_admin_status_order
  on public.ai_apps(status, display_order, id);

-- Media Library and Studio Media Picker both order newest-first. The kind prefix
-- supports the Admin Media kind filter without changing the canonical media model.
create index if not exists idx_media_created_at_id
  on public.media(created_at desc, id);
create index if not exists idx_media_kind_created_at_id
  on public.media(kind, created_at desc, id);

commit;
