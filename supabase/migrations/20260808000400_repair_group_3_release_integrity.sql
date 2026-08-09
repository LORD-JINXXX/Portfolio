-- Repair Group 3: release state-machine integrity, trusted validation,
-- serialized activation, controlled rollback, and browser-write lockdown.

-- Release numbers are allocated by PostgreSQL so concurrent candidate
-- creation cannot race on MAX(release_number) + 1.
create sequence if not exists public.site_release_number_seq as integer;

lock table public.site_releases in share row exclusive mode;

do $$
declare
  current_max bigint;
begin
  select coalesce(max(release_number), 0) into current_max
  from public.site_releases;

  if current_max > 0 then
    perform pg_catalog.setval('public.site_release_number_seq'::regclass, current_max, true);
  else
    perform pg_catalog.setval('public.site_release_number_seq'::regclass, 1, false);
  end if;
end $$;

alter sequence public.site_release_number_seq owned by public.site_releases.release_number;
alter table public.site_releases
  alter column release_number set default nextval('public.site_release_number_seq'::regclass),
  add column if not exists snapshot_revision_token uuid not null default gen_random_uuid(),
  add column if not exists layout_schema_version integer,
  add column if not exists runtime_min_version text,
  add column if not exists ready_at timestamptz,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null,
  add column if not exists deactivated_by uuid references public.profiles(id) on delete set null;

update public.site_releases as release
set layout_schema_version = version.schema_version,
    runtime_min_version = version.runtime_min_version
from public.layout_versions as version
where version.id = release.layout_version_id
  and (release.layout_schema_version is null or release.runtime_min_version is null);

alter table public.site_releases
  alter column layout_schema_version set not null,
  alter column runtime_min_version set not null;

alter table public.release_validation_results
  add column if not exists valid boolean not null default false,
  add column if not exists issues jsonb not null default '[]'::jsonb,
  add column if not exists snapshot_revision_token uuid,
  add column if not exists runtime_version text,
  add column if not exists validation_kind text not null default 'candidate'
    check (validation_kind in ('candidate', 'rollback')),
  add column if not exists validated_by uuid references public.profiles(id) on delete set null;

-- The reused project predates the Phase 5 aggregate validation contract and
-- may still have one row per check (check_name/passed/message/details). Keep
-- those historical columns and rows, but make them optional for new aggregate
-- validation records.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'release_validation_results'
      and column_name = 'passed'
  ) then
    execute $legacy$
      update public.release_validation_results
      set valid = coalesce(passed, false),
          issues = case
            when coalesce(passed, false) then '[]'::jsonb
            else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
              'severity', 'error',
              'code', coalesce(check_name, 'legacy.release-check'),
              'message', coalesce(message, 'Legacy release validation failed'),
              'details', details
            )))
          end
    $legacy$;
    alter table public.release_validation_results
      alter column check_name drop not null,
      alter column passed drop not null;
  end if;
end $$;

create index if not exists idx_release_validation_snapshot
  on public.release_validation_results(site_release_id, snapshot_revision_token, valid, created_at desc);

create unique index if not exists one_active_site_release
  on public.site_releases((status)) where status = 'active';

-- Published release inputs and the denormalized compatibility fields must
-- still match when a release is made ready, activated, or rolled back.
create or replace function public.assert_release_inputs(target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  release_row public.site_releases%rowtype;
  layout_status text;
  layout_schema integer;
  layout_runtime text;
  content_status text;
  settings_status text;
  settings_values jsonb;
begin
  select * into release_row
  from public.site_releases
  where id = target_release_id;

  if not found then
    raise exception 'Release not found';
  end if;
  if release_row.content_revision_id is null or release_row.settings_revision_id is null then
    raise exception 'Legacy release has no complete content/settings snapshot and cannot transition';
  end if;

  select status, schema_version, runtime_min_version
  into layout_status, layout_schema, layout_runtime
  from public.layout_versions
  where id = release_row.layout_version_id;

  if not found or layout_status <> 'published' then
    raise exception 'Release layout version must be published';
  end if;
  if release_row.layout_schema_version is distinct from layout_schema
    or release_row.runtime_min_version is distinct from layout_runtime then
    raise exception 'Release compatibility snapshot does not match its layout version';
  end if;

  select status into content_status
  from public.content_revisions
  where id = release_row.content_revision_id;

  if not found or content_status <> 'published' then
    raise exception 'Release content revision must be published';
  end if;

  select status, values_json into settings_status, settings_values
  from public.settings_revisions
  where id = release_row.settings_revision_id;

  if not found or settings_status <> 'published' then
    raise exception 'Release settings revision must be published';
  end if;
  if release_row.settings_snapshot is distinct from settings_values then
    raise exception 'Release settings snapshot does not match its settings revision';
  end if;
end; $$;

revoke all on function public.assert_release_inputs(uuid) from public, anon, authenticated;

-- State changes are accepted only while one of the trusted RPCs has selected
-- the corresponding transition for the current transaction.
create or replace function public.protect_site_release()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  transition_name text := pg_catalog.current_setting('app.release_transition', true);
  snapshot_changed boolean;
  valid_transition boolean := false;
begin
  if tg_op = 'DELETE' then
    raise exception 'Site releases are append-only and cannot be deleted';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New releases must start as draft candidates';
    end if;
    if new.content_revision_id is null or new.settings_revision_id is null then
      raise exception 'New releases require content and settings revisions';
    end if;
    if new.layout_schema_version is null or nullif(new.runtime_min_version, '') is null then
      raise exception 'New releases require a compatibility snapshot';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.release_number is distinct from old.release_number
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Release identity fields are immutable';
  end if;

  if new.snapshot_revision_token is distinct from old.snapshot_revision_token then
    raise exception 'Release snapshot revision tokens cannot be assigned directly';
  end if;

  snapshot_changed :=
    new.layout_version_id is distinct from old.layout_version_id or
    new.content_revision_id is distinct from old.content_revision_id or
    new.settings_revision_id is distinct from old.settings_revision_id or
    new.layout_schema_version is distinct from old.layout_schema_version or
    new.runtime_min_version is distinct from old.runtime_min_version or
    new.settings_snapshot is distinct from old.settings_snapshot or
    new.collections_snapshot is distinct from old.collections_snapshot or
    new.media_snapshot is distinct from old.media_snapshot or
    new.notes is distinct from old.notes;

  if old.status <> 'draft' and snapshot_changed then
    raise exception 'Ready and activated release snapshots are immutable';
  end if;

  if new.status is distinct from old.status then
    valid_transition :=
      (transition_name = 'validation' and old.status = 'draft' and new.status = 'ready') or
      (transition_name = 'activation' and (
        (old.status = 'ready' and new.status = 'active') or
        (old.status = 'active' and new.status = 'superseded')
      )) or
      (transition_name = 'rollback' and (
        (old.status = 'superseded' and new.status = 'active') or
        (old.status = 'active' and new.status = 'superseded')
      ));

    if not valid_transition then
      raise exception 'Illegal release transition from % to %', old.status, new.status;
    end if;
  end if;

  if (new.ready_at is distinct from old.ready_at
      or new.validated_at is distinct from old.validated_at
      or new.validated_by is distinct from old.validated_by)
    and not (transition_name = 'validation' and old.status = 'draft' and new.status = 'ready') then
    raise exception 'Release validation metadata can change only during validation';
  end if;

  if (new.activated_at is distinct from old.activated_at
      or new.activated_by is distinct from old.activated_by
      or new.deactivated_at is distinct from old.deactivated_at
      or new.deactivated_by is distinct from old.deactivated_by)
    and not (transition_name in ('activation', 'rollback') and valid_transition) then
    raise exception 'Release activation metadata can change only during activation or rollback';
  end if;

  if old.status = 'draft' and snapshot_changed then
    new.snapshot_revision_token := gen_random_uuid();
  end if;

  return new;
end; $$;

drop trigger if exists protect_activated_release_snapshot_write on public.site_releases;
drop trigger if exists protect_site_release_write on public.site_releases;
create trigger protect_site_release_write
before insert or update or delete on public.site_releases
for each row execute procedure public.protect_site_release();

revoke all on function public.protect_site_release() from public, anon, authenticated;

create or replace function public.protect_release_validation_result()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  current_token uuid;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Release validation results are append-only';
  end if;

  select snapshot_revision_token into current_token
  from public.site_releases
  where id = new.site_release_id;

  if not found or new.snapshot_revision_token is null
    or new.snapshot_revision_token is distinct from current_token then
    raise exception 'Release validation does not match the current release snapshot';
  end if;
  if nullif(new.runtime_version, '') is null then
    raise exception 'Release validation must record the runtime version';
  end if;

  return new;
end; $$;

drop trigger if exists protect_release_validation_result_write on public.release_validation_results;
create trigger protect_release_validation_result_write
before insert or update or delete on public.release_validation_results
for each row execute procedure public.protect_release_validation_result();

revoke all on function public.protect_release_validation_result() from public, anon, authenticated;

-- Release transition audit entries are committed in the same transaction as
-- the transition. All audit records are append-only.
create or replace function public.protect_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'Audit logs are append-only';
end; $$;

drop trigger if exists protect_audit_log_write on public.audit_logs;
create trigger protect_audit_log_write
before update or delete on public.audit_logs
for each row execute procedure public.protect_audit_log();

revoke all on function public.protect_audit_log() from public, anon, authenticated;

create or replace function public.create_site_release(
  target_layout_version_id uuid,
  target_content_revision_id uuid,
  target_settings_revision_id uuid,
  collections_snapshot_value jsonb,
  media_snapshot_value jsonb,
  notes_value text,
  actor_user_id uuid
)
returns public.site_releases
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  layout_schema integer;
  layout_runtime text;
  settings_values jsonb;
  created_release public.site_releases%rowtype;
begin
  select schema_version, runtime_min_version
  into layout_schema, layout_runtime
  from public.layout_versions
  where id = target_layout_version_id and status = 'published';
  if not found then raise exception 'Published layout version not found'; end if;

  perform 1 from public.content_revisions
  where id = target_content_revision_id and status = 'published';
  if not found then raise exception 'Published content revision not found'; end if;

  select values_json into settings_values
  from public.settings_revisions
  where id = target_settings_revision_id and status = 'published';
  if not found then raise exception 'Published settings revision not found'; end if;

  insert into public.site_releases(
    layout_version_id,
    content_revision_id,
    settings_revision_id,
    layout_schema_version,
    runtime_min_version,
    settings_snapshot,
    collections_snapshot,
    media_snapshot,
    status,
    notes,
    created_by
  ) values (
    target_layout_version_id,
    target_content_revision_id,
    target_settings_revision_id,
    layout_schema,
    layout_runtime,
    settings_values,
    coalesce(collections_snapshot_value, '{}'::jsonb),
    coalesce(media_snapshot_value, '{}'::jsonb),
    'draft',
    coalesce(notes_value, 'Release candidate'),
    actor_user_id
  ) returning * into created_release;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, after_json, metadata)
  values (
    actor_user_id,
    'release_created',
    'site_release',
    created_release.id,
    to_jsonb(created_release),
    jsonb_build_object('release_number', created_release.release_number)
  );

  return created_release;
end; $$;

create or replace function public.record_release_validation(
  target_release_id uuid,
  expected_snapshot_revision_token uuid,
  validation_valid boolean,
  validation_issues jsonb,
  validated_runtime_version text,
  actor_user_id uuid
)
returns public.site_releases
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.site_releases%rowtype;
  has_errors boolean;
begin
  select * into target
  from public.site_releases
  where id = target_release_id
  for update;

  if not found then raise exception 'Release not found'; end if;
  if target.status <> 'draft' then raise exception 'Only draft releases can be validated'; end if;
  if target.snapshot_revision_token is distinct from expected_snapshot_revision_token then
    raise exception 'Release changed during validation. Revalidate the current snapshot';
  end if;
  if jsonb_typeof(coalesce(validation_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Validation issues must be a JSON array';
  end if;
  if nullif(validated_runtime_version, '') is null then
    raise exception 'Validated runtime version is required';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(validation_issues, '[]'::jsonb)) as issue
    where issue->>'severity' = 'error'
  ) into has_errors;

  if validation_valid = has_errors then
    raise exception 'Validation validity does not match its issues';
  end if;

  perform public.assert_release_inputs(target_release_id);

  insert into public.release_validation_results(
    site_release_id,
    valid,
    issues,
    snapshot_revision_token,
    runtime_version,
    validation_kind,
    validated_by
  ) values (
    target_release_id,
    validation_valid,
    coalesce(validation_issues, '[]'::jsonb),
    target.snapshot_revision_token,
    validated_runtime_version,
    'candidate',
    actor_user_id
  );

  if validation_valid then
    perform pg_catalog.set_config('app.release_transition', 'validation', true);
    update public.site_releases
    set status = 'ready',
        ready_at = now(),
        validated_at = now(),
        validated_by = actor_user_id
    where id = target_release_id
    returning * into target;
  end if;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, after_json, metadata)
  values (
    actor_user_id,
    case when validation_valid then 'release_validated' else 'release_validation_failed' end,
    'site_release',
    target_release_id,
    to_jsonb(target),
    jsonb_build_object(
      'valid', validation_valid,
      'snapshot_revision_token', target.snapshot_revision_token,
      'runtime_version', validated_runtime_version
    )
  );

  return target;
end; $$;

drop function if exists public.activate_release(uuid);
create or replace function public.activate_release(
  target_release_id uuid,
  expected_snapshot_revision_token uuid,
  actor_user_id uuid
)
returns public.site_releases
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.site_releases%rowtype;
  previous_active public.site_releases%rowtype;
  had_previous_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.site_releases.activation'));

  select * into target
  from public.site_releases
  where id = target_release_id
  for update;

  if not found then raise exception 'Release not found'; end if;
  if target.status = 'active' then return target; end if;
  if target.status <> 'ready' then raise exception 'Only ready releases can be activated'; end if;
  if target.snapshot_revision_token is distinct from expected_snapshot_revision_token then
    raise exception 'Release snapshot changed after validation';
  end if;

  perform public.assert_release_inputs(target_release_id);

  perform 1
  from public.release_validation_results
  where site_release_id = target_release_id
    and snapshot_revision_token = target.snapshot_revision_token
    and validation_kind = 'candidate'
    and valid = true;
  if not found then raise exception 'Release has no valid result for its current snapshot'; end if;

  select * into previous_active
  from public.site_releases
  where status = 'active' and id <> target_release_id
  for update;

  had_previous_active := found;

  perform pg_catalog.set_config('app.release_transition', 'activation', true);

  if had_previous_active then
    update public.site_releases
    set status = 'superseded',
        deactivated_at = now(),
        deactivated_by = actor_user_id
    where id = previous_active.id;
  end if;

  update public.site_releases
  set status = 'active',
      activated_at = now(),
      activated_by = actor_user_id,
      deactivated_at = null,
      deactivated_by = null
  where id = target_release_id and status = 'ready'
  returning * into target;

  if not found then raise exception 'Release activation lost its ready-state lock'; end if;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata)
  values (
    actor_user_id,
    'release_activated',
    'site_release',
    target.id,
    jsonb_build_object('status', 'ready'),
    to_jsonb(target),
    jsonb_build_object('previous_active_release_id', previous_active.id)
  );

  return target;
end; $$;

create or replace function public.rollback_release(
  target_release_id uuid,
  expected_snapshot_revision_token uuid,
  validation_issues jsonb,
  validated_runtime_version text,
  actor_user_id uuid
)
returns public.site_releases
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.site_releases%rowtype;
  previous_active public.site_releases%rowtype;
  has_errors boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.site_releases.activation'));

  select * into target
  from public.site_releases
  where id = target_release_id
  for update;

  if not found then raise exception 'Release not found'; end if;
  if target.status <> 'superseded' then raise exception 'Only superseded releases can be rollback targets'; end if;
  if target.snapshot_revision_token is distinct from expected_snapshot_revision_token then
    raise exception 'Rollback target snapshot changed during validation';
  end if;
  if jsonb_typeof(coalesce(validation_issues, '[]'::jsonb)) <> 'array' then
    raise exception 'Validation issues must be a JSON array';
  end if;
  if nullif(validated_runtime_version, '') is null then
    raise exception 'Validated runtime version is required';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(coalesce(validation_issues, '[]'::jsonb)) as issue
    where issue->>'severity' = 'error'
  ) into has_errors;
  if has_errors then raise exception 'Rollback target is not compatible with the current runtime'; end if;

  perform public.assert_release_inputs(target_release_id);

  select * into previous_active
  from public.site_releases
  where status = 'active' and id <> target_release_id
  for update;

  if not found then raise exception 'Rollback requires a different active release'; end if;

  insert into public.release_validation_results(
    site_release_id,
    valid,
    issues,
    snapshot_revision_token,
    runtime_version,
    validation_kind,
    validated_by
  ) values (
    target_release_id,
    true,
    coalesce(validation_issues, '[]'::jsonb),
    target.snapshot_revision_token,
    validated_runtime_version,
    'rollback',
    actor_user_id
  );

  perform pg_catalog.set_config('app.release_transition', 'rollback', true);

  update public.site_releases
  set status = 'superseded',
      deactivated_at = now(),
      deactivated_by = actor_user_id
  where id = previous_active.id;

  update public.site_releases
  set status = 'active',
      activated_at = now(),
      activated_by = actor_user_id,
      deactivated_at = null,
      deactivated_by = null
  where id = target_release_id and status = 'superseded'
  returning * into target;

  if not found then raise exception 'Rollback target lost its superseded-state lock'; end if;

  insert into public.audit_logs(actor_user_id, action, resource_type, resource_id, before_json, after_json, metadata)
  values (
    actor_user_id,
    'release_rolled_back',
    'site_release',
    target.id,
    jsonb_build_object('status', 'superseded'),
    to_jsonb(target),
    jsonb_build_object('superseded_active_release_id', previous_active.id, 'runtime_version', validated_runtime_version)
  );

  return target;
end; $$;

revoke all on function public.create_site_release(uuid, uuid, uuid, jsonb, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.record_release_validation(uuid, uuid, boolean, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.activate_release(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.rollback_release(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;

grant execute on function public.create_site_release(uuid, uuid, uuid, jsonb, jsonb, text, uuid) to service_role;
grant execute on function public.record_release_validation(uuid, uuid, boolean, jsonb, text, uuid) to service_role;
grant execute on function public.activate_release(uuid, uuid, uuid) to service_role;
grant execute on function public.rollback_release(uuid, uuid, jsonb, text, uuid) to service_role;

-- Browser admins may inspect releases through PostgREST, but all release and
-- validation mutations must use the authenticated Admin API and trusted RPCs.
drop policy if exists site_releases_admin_all on public.site_releases;
drop policy if exists release_validation_results_admin_all on public.release_validation_results;
drop policy if exists audit_logs_admin_all on public.audit_logs;
drop policy if exists site_releases_admin_read on public.site_releases;
drop policy if exists release_validation_results_admin_read on public.release_validation_results;
drop policy if exists audit_logs_admin_read on public.audit_logs;

create policy site_releases_admin_read
on public.site_releases for select to authenticated
using (public.is_admin(auth.uid()));

create policy release_validation_results_admin_read
on public.release_validation_results for select to authenticated
using (public.is_admin(auth.uid()));

create policy audit_logs_admin_read
on public.audit_logs for select to authenticated
using (public.is_admin(auth.uid()));

revoke insert, update, delete on public.site_releases from anon, authenticated;
revoke insert, update, delete on public.release_validation_results from anon, authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;
grant select on public.site_releases to authenticated;
grant select on public.release_validation_results to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on sequence public.site_release_number_seq from public, anon, authenticated;
