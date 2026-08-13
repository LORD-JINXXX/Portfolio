begin;

-- ============================================================
-- Production trusted API grants
--
-- Production keeps Supabase "Automatically expose new tables"
-- disabled. Browser roles remain governed by the existing
-- explicit grants + RLS policies.
--
-- The trusted Platform API uses service_role and therefore
-- needs explicit PostgreSQL object privileges.
-- ============================================================

grant usage on schema public to service_role;

-- Existing application tables.
grant select, insert, update, delete
on all tables in schema public
to service_role;

-- Required for sequence-backed values / revision counters.
grant usage, select, update
on all sequences in schema public
to service_role;

-- Trusted API RPCs.
grant execute
on all routines in schema public
to service_role;


-- ============================================================
-- Future migrations
--
-- Supabase CLI migrations are created as postgres, so future
-- application objects should automatically be accessible only
-- to the trusted backend role, without automatically granting
-- browser roles.
-- ============================================================

alter default privileges for role postgres
in schema public
grant select, insert, update, delete
on tables
to service_role;

alter default privileges for role postgres
in schema public
grant usage, select, update
on sequences
to service_role;

alter default privileges for role postgres
in schema public
grant execute
on routines
to service_role;

commit;