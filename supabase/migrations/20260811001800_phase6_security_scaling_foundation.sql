-- Phase 6: production security/scaling foundation.
-- Adds shared API rate-limit/quota primitives and closes legacy direct-browser
-- reads that bypass the Active-release Platform API boundary.

begin;

create table if not exists public.security_rate_limit_buckets (
  id text primary key,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limit_buckets enable row level security;
revoke all on table public.security_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.security_rate_limit_buckets to service_role;

create index if not exists security_rate_limit_buckets_expires_at_idx
  on public.security_rate_limit_buckets(expires_at);

create or replace function public.consume_security_rate_limit(
  bucket_key text,
  window_seconds integer,
  request_limit integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_row public.security_rate_limit_buckets%rowtype;
  now_value timestamptz := statement_timestamp();
  requested_window integer := greatest(1, least(coalesce($2, 60), 86400));
  requested_limit integer := greatest(1, least(coalesce($3, 1), 1000000));
begin
  if coalesce(length($1), 0) < 8 or length($1) > 256 then
    raise exception 'Invalid rate-limit bucket key';
  end if;

  insert into public.security_rate_limit_buckets(id, window_started_at, expires_at, used, updated_at)
  values($1, now_value, now_value + make_interval(secs => requested_window), 0, now_value)
  on conflict (id) do nothing;

  select * into current_row
  from public.security_rate_limit_buckets
  where id = $1
  for update;

  if current_row.expires_at <= now_value then
    update public.security_rate_limit_buckets
      set window_started_at = now_value,
          expires_at = now_value + make_interval(secs => requested_window),
          used = 1,
          updated_at = now_value
      where id = $1
      returning * into current_row;
    return query select true, greatest(0, requested_limit - 1), current_row.expires_at;
    return;
  end if;

  if current_row.used >= requested_limit then
    return query select false, 0, current_row.expires_at;
    return;
  end if;

  update public.security_rate_limit_buckets
    set used = used + 1,
        updated_at = now_value
    where id = $1
    returning * into current_row;

  return query select true, greatest(0, requested_limit - current_row.used), current_row.expires_at;
end;
$$;

revoke all on function public.consume_security_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text,integer,integer) to service_role;

create table if not exists public.security_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z0-9][a-z0-9._:-]{0,127}$'),
  usage_date date not null default (timezone('utc', now()))::date,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key, usage_date)
);

alter table public.security_daily_usage enable row level security;
revoke all on table public.security_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.security_daily_usage to service_role;

create index if not exists security_daily_usage_date_idx on public.security_daily_usage(usage_date);

create or replace function public.consume_security_daily_quota(
  target_user_id uuid,
  target_feature_key text,
  quota_limit integer,
  amount integer default 1
)
returns table(allowed boolean, remaining integer, used integer, usage_date date)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  today date := (timezone('utc', statement_timestamp()))::date;
  row_value public.security_daily_usage%rowtype;
  effective_limit integer := greatest(1, least(coalesce($3, 1), 1000000));
  effective_amount integer := greatest(1, least(coalesce($4, 1), effective_limit));
begin
  if $1 is null then raise exception 'target_user_id is required'; end if;
  if coalesce($2, '') !~ '^[a-z0-9][a-z0-9._:-]{0,127}$' then raise exception 'Invalid feature_key'; end if;

  insert into public.security_daily_usage(user_id, feature_key, usage_date, used, updated_at)
  values($1, $2, today, 0, statement_timestamp())
  on conflict (user_id, feature_key, usage_date) do nothing;

  select usage_row.* into row_value
  from public.security_daily_usage as usage_row
  where usage_row.user_id = $1
    and usage_row.feature_key = $2
    and usage_row.usage_date = today
  for update;

  if row_value.used + effective_amount > effective_limit then
    return query select false, greatest(0, effective_limit - row_value.used), row_value.used, today;
    return;
  end if;

  update public.security_daily_usage as usage_row
    set used = usage_row.used + effective_amount,
        updated_at = statement_timestamp()
    where usage_row.user_id = $1
      and usage_row.feature_key = $2
      and usage_row.usage_date = today
    returning usage_row.* into row_value;

  return query select true, greatest(0, effective_limit - row_value.used), row_value.used, today;
end;
$$;

revoke all on function public.consume_security_daily_quota(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_daily_quota(uuid,text,integer,integer) to service_role;

-- Public Web is release-driven through the Platform API. Remove legacy direct
-- PostgREST reads that could reveal newly-published CMS data before activation.
drop policy if exists projects_public_read on public.projects;
drop policy if exists notes_public_read on public.notes;
drop policy if exists experience_public_read on public.experiences;
drop policy if exists apps_public_read on public.ai_apps;
drop policy if exists media_public_read on public.media;
drop policy if exists project_gallery_media_public_read on public.project_gallery_media;

revoke select on table public.projects from anon, authenticated;
revoke select on table public.notes from anon, authenticated;
revoke select on table public.experiences from anon, authenticated;
revoke select on table public.ai_apps from anon, authenticated;
revoke select on table public.media from anon, authenticated;
revoke select on table public.project_gallery_media from anon, authenticated;
revoke select on table public.site_releases from authenticated;
revoke select on table public.release_validation_results from authenticated;
revoke select on table public.audit_logs from authenticated;

-- The service boundary retains all required reads. Browser clients use API
-- routes and Supabase Auth only; private user-resume Storage ownership policies
-- remain unchanged.
grant select on table public.projects, public.notes, public.experiences, public.ai_apps,
  public.media, public.project_gallery_media, public.site_releases,
  public.release_validation_results, public.audit_logs to service_role;

commit;
