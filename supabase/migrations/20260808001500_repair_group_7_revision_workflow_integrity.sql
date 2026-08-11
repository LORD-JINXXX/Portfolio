-- Repair Group 7: serialize creation of mutable content/settings draft revisions.
-- Publishing remains separate from production activation; published revisions stay immutable.

begin;

create sequence if not exists public.content_revision_number_seq;
create sequence if not exists public.settings_revision_number_seq;

do $$
declare n bigint;
begin
  select coalesce(max(revision_number),0) into n from public.content_revisions;
  perform pg_catalog.setval('public.content_revision_number_seq'::regclass, greatest(n,1), n > 0);
  select coalesce(max(revision_number),0) into n from public.settings_revisions;
  perform pg_catalog.setval('public.settings_revision_number_seq'::regclass, greatest(n,1), n > 0);
end $$;

create or replace function public.get_or_create_content_draft(actor_user_id uuid)
returns public.content_revisions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  result public.content_revisions%rowtype;
  source_values jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio.content_revision_draft'));
  select * into result from public.content_revisions where status='draft' order by revision_number desc limit 1 for update;
  if found then return result; end if;

  select values_json into source_values from public.content_revisions where status='published' order by revision_number desc limit 1;
  if source_values is null then
    select coalesce(jsonb_object_agg(key,value_json),'{}'::jsonb) into source_values from public.site_content;
  end if;

  insert into public.content_revisions(revision_number,status,values_json,created_by)
  values(nextval('public.content_revision_number_seq'), 'draft', coalesce(source_values,'{}'::jsonb), actor_user_id)
  returning * into result;

  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json)
  values(actor_user_id,'content_revision_draft_created','content_revision',result.id,to_jsonb(result));
  return result;
end;
$$;

create or replace function public.get_or_create_settings_draft(actor_user_id uuid)
returns public.settings_revisions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  result public.settings_revisions%rowtype;
  source_values jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('portfolio.settings_revision_draft'));
  select * into result from public.settings_revisions where status='draft' order by revision_number desc limit 1 for update;
  if found then return result; end if;

  select values_json into source_values from public.settings_revisions where status='published' order by revision_number desc limit 1;
  if source_values is null then
    select coalesce(jsonb_object_agg(key,value_json),'{}'::jsonb) into source_values from public.site_settings;
  end if;

  insert into public.settings_revisions(revision_number,status,values_json,created_by)
  values(nextval('public.settings_revision_number_seq'), 'draft', coalesce(source_values,'{}'::jsonb), actor_user_id)
  returning * into result;

  insert into public.audit_logs(actor_user_id,action,resource_type,resource_id,after_json)
  values(actor_user_id,'settings_revision_draft_created','settings_revision',result.id,to_jsonb(result));
  return result;
end;
$$;

revoke all on sequence public.content_revision_number_seq from public, anon, authenticated;
revoke all on sequence public.settings_revision_number_seq from public, anon, authenticated;
revoke all on function public.get_or_create_content_draft(uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_settings_draft(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_content_draft(uuid) to service_role;
grant execute on function public.get_or_create_settings_draft(uuid) to service_role;

commit;
