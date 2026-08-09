# Dynamic Portfolio Platform - Repair Group Status

**Canonical architecture:** `portfolio.md`
**Current phase:** Phase 5 / Batch 41 integration and repair gate
**Date:** 2026-08-09

## Current Checkpoint

- Repair Group 1: Complete.
- Repair Group 2: Complete.
- Pre-RG3 zero-version orphan cleanup: Complete.
- Repair Group 3: Implementation complete; manual browser verification pending.
- Repair Groups 4-10: Not started.
- Phase 5: Not complete.

Studio Publish remains separate from production activation. Published layout
versions remain immutable, Admin owns Releases, and Public Web resolves only
the active release.

## RG3 Implemented

- Forward migration: `20260808000400_repair_group_3_release_integrity.sql`.
- Race-safe database sequence for release numbers.
- Exact release snapshot revision tokens.
- Persisted layout schema/runtime compatibility data.
- Validation records bound to snapshot token and runtime version.
- Legal release transitions enforced in PostgreSQL.
- Immutable Ready, Active and Superseded snapshots.
- Append-only releases, validation history and audit logs.
- Service-role-only create, validate, activate and rollback RPCs.
- Serialized atomic activation with row locks and the one-active index.
- Dedicated controlled rollback for compatible superseded releases.
- Read-only browser RLS for release, validation and audit tables.
- Transition audit events written atomically with the transition.
- Admin UI separates Validate, Preview, Activate and Rollback.
- Public runtime continues to load only `status = active`.

## Validation

- `npm run test:static`: 45 / 45 passed.
- `npm test`: 68 / 68 passed.
- `npm run typecheck`: 18 / 18 tasks passed.
- `npm run build`: 11 / 11 tasks passed.
- `http://localhost:4000/health`: healthy; auth bypass disabled.
- RG3 migration applied successfully to the linked Supabase project.
- Existing active release remained unchanged after migration.

## Remaining RG3 Gate

RG3 must not be marked complete until a real admin browser session proves:

1. Studio Publish leaves Public Web unchanged.
2. Candidate creation leaves Public Web unchanged.
3. Validation moves only a valid Draft to Ready.
4. Preview leaves Public Web unchanged.
5. Activate changes Public Web and preserves exactly one Active release.
6. A second complete release can be activated.
7. Rollback atomically restores the first release's layout, content and settings.
8. Release transition audit events are present.

Do not begin Repair Group 4 before this manual RG3 gate is reviewed.
