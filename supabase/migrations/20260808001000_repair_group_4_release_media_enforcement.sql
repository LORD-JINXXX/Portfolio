-- Repair Group 4C2: relational release media transition enforcement.
--
-- New candidates must reach media_snapshot_version = 1 before becoming Ready.
-- Replacing the current Active release is blocked while the Active release is
-- still version 0 (uncertified), preserving RG3 rollback safety until RG4D.
-- Superseded version-0 releases cannot be rollback targets.
--
-- No historical backfill, no Release #4 mutation, no physical Storage checks.

begin;

-- ---------------------------------------------------------------------------
-- assert_release_media_integrity
--
-- Relational-only integrity check for a certified (version-1) release.
--
-- Verifies that every release_media_references row resolves to public.media
-- and that the captured identity (bucket_id, storage_path, mime_type, size)
-- remains internally valid. bucket_id is NOT a column on public.media, so the
-- authoritative managed bucket is asserted directly as 'public-media'; the
-- remaining captured fields are compared to the canonical media row.
--
-- Lifecycle status (draft/ready/superseded) is NOT checked here — each
-- calling RG3 transition function enforces its own status requirements.
--
-- To prevent a race where mutable canonical fields (mime_type, size) change
-- between assertion and transition commit, this function locks every referenced
-- public.media row for UPDATE in deterministic media_id order. Zero-reference
-- version-1 releases are valid and lock nothing.
--
-- Version 0 (legacy/uncommitted) is NOT treated as equivalent to zero-media
-- certification. Callers that require certified media must first assert the
-- version and then call this function.
-- ---------------------------------------------------------------------------
create or replace function public.assert_release_media_integrity(target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  release_version smallint;
  missing_count integer;
begin
  select media_snapshot_version
  into release_version
  from public.site_releases
  where id = target_release_id;

  if not found then
    raise exception 'Release not found';
  end if;

  if release_version is distinct from 1 then
    raise exception 'Release media accounting is not certified (media_snapshot_version must be 1)';
  end if;

  -- Lock every referenced public.media row for UPDATE in deterministic
  -- media_id order, preventing concurrent mutation of mutable identity
  -- fields (mime_type, size) between this assertion and the transition commit.
  -- Zero-reference version-1 releases skip this step.
  perform 1
  from public.release_media_references rrm
  join public.media m on m.id = rrm.media_id
  where rrm.site_release_id = target_release_id
  order by m.id
  for update of m;

  -- Every referenced media_id must still resolve to public.media with
  -- matching captured identity. IS DISTINCT FROM provides NULL-safe
  -- comparison even though all compared fields are currently NOT NULL.
  select count(*) into missing_count
  from public.release_media_references rrm
  where rrm.site_release_id = target_release_id
    and (rrm.bucket_id is distinct from 'public-media' or not exists (
      select 1 from public.media m
      where m.id = rrm.media_id
        and m.storage_path is not distinct from rrm.storage_path
        and m.mime_type is not distinct from rrm.mime_type
        and m.size is not distinct from rrm.size
    ));

  if missing_count > 0 then
    raise exception 'Release media references contain unresolved or mismatched canonical media identity';
  end if;

  -- A version-1 release with zero references is valid (zero-media certified).
  -- No additional check is required.
end;
$$;

revoke all on function public.assert_release_media_integrity(uuid) from public, anon, authenticated;
grant execute on function public.assert_release_media_integrity(uuid) to service_role;

comment on function public.assert_release_media_integrity(uuid) is
  'Relational-only media integrity check for certified releases. Verifies release_media_references resolve to public.media with captured managed-bucket/canonical identity; rejects version-0 releases. Lifecycle status checks remain in the owning RG3 transition functions. Does not perform physical Storage existence checks.';

-- ---------------------------------------------------------------------------
-- record_release_validation: enforce Draft→Ready media certification.
--
-- Preserves all RG3 behavior:
--   - release FOR UPDATE
--   - Draft-only validation
--   - exact snapshot_revision_token
--   - append-only validation result
--   - error/warning/info issue behavior
--
-- New rule: Draft→Ready transition is blocked unless the release has
-- media_snapshot_version = 1 and passes relational media integrity.
-- A failed validation result may still be recorded (release stays Draft).
-- ---------------------------------------------------------------------------
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

  if validation_valid then
    -- Relational enforcement: a release must have authoritative media
    -- accounting before transitioning to Ready.
    perform public.assert_release_media_integrity(target_release_id);
  end if;

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
end;
$$;

revoke all on function public.record_release_validation(uuid, uuid, boolean, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.record_release_validation(uuid, uuid, boolean, jsonb, text, uuid) to service_role;

comment on function public.record_release_validation(uuid, uuid, boolean, jsonb, text, uuid) is
  'Records validation result for a Draft candidate; transitions to Ready only when media_snapshot_version = 1 and relational media integrity passes.';

-- ---------------------------------------------------------------------------
-- activate_release: block replacement of an uncertified Active release.
--
-- Preserves all RG3 behavior:
--   - activation advisory lock
--   - row locks
--   - Ready-only target
--   - exact current validation result/token
--   - exactly-one-Active index
--   - atomic old Active -> Superseded / target -> Active
--   - audit behavior
--
-- New rule: if the current Active release is media_snapshot_version = 0,
-- replacement activation is BLOCKED. This preserves RG3 rollback safety
-- (rollback rejects version-0 targets) until RG4D certifies the Active release.
-- ---------------------------------------------------------------------------
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
  perform public.assert_release_media_integrity(target_release_id);

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

  -- Block replacement activation while the current Active release is
  -- uncertified (version 0). This preserves RG3 rollback safety until RG4D.
  if had_previous_active and previous_active.media_snapshot_version = 0 then
    raise exception 'Replacement activation is blocked while the current Active release has uncertified media accounting (media_snapshot_version = 0). Certify Active release media before activation.';
  end if;

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
end;
$$;

revoke all on function public.activate_release(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_release(uuid, uuid, uuid) to service_role;

comment on function public.activate_release(uuid, uuid, uuid) is
  'Atomically activates a Ready release, superseding the previous Active release. Blocks replacement while the current Active release has uncertified (version-0) media accounting.';

-- ---------------------------------------------------------------------------
-- rollback_release: reject version-0 rollback targets.
--
-- Preserves all RG3 behavior:
--   - advisory lock
--   - row locks
--   - Superseded-only target
--   - exact snapshot_revision_token
--   - validation issues error check
--   - append-only validation result
--   - atomic status swap
--   - audit behavior
--
-- New rule: rollback requires the target release to have
-- media_snapshot_version = 1 and pass relational media integrity.
-- ---------------------------------------------------------------------------
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
  perform public.assert_release_media_integrity(target_release_id);

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
end;
$$;

revoke all on function public.rollback_release(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.rollback_release(uuid, uuid, jsonb, text, uuid) to service_role;

comment on function public.rollback_release(uuid, uuid, jsonb, text, uuid) is
  'Atomically rolls back a Superseded release to Active, superseding the previous Active. Requires target media_snapshot_version = 1.';

commit;
