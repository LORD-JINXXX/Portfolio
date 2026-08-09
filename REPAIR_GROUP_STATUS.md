# Dynamic Portfolio Platform - Repair Group Status

**Canonical architecture:** `portfolio.md`
**Current phase:** Phase 5 / Batch 41 integration and repair gate
**Date:** 2026-08-10

## Current Checkpoint

- Repair Group 1: Complete.
- Repair Group 2: Complete.
- Pre-RG3 zero-version orphan cleanup: Complete.
- Repair Group 3: Complete.
- Repair Group 4: Next; not started.
- Repair Groups 5-10: Not started.
- Phase 5: Not complete.

Studio Publish remains separate from production activation. Published layout
versions remain immutable, Admin owns Releases, and Public Web resolves only
the active release.

## RG3 Final Guarantees

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
- Studio Publish remains isolated from production activation.
- Ready release status remains isolated from production activation.
- Only controlled Admin activation changes production.
- Admin and Studio network actions use visible pending states, synchronous
  duplicate/conflict gates, guaranteed cleanup and controlled feedback.
- The final typed API-action inventory covers 83 Admin/Studio actions and found
  no remaining explicit clickable network action without in-progress feedback.

## Validation

- `npm run test:static`: 74 / 74 passed.
- `npm test`: 159 / 159 passed.
- `npm run typecheck`: 18 / 18 tasks passed.
- `npm run build`: 11 / 11 tasks passed.
- Admin: HTTP 200.
- Studio: HTTP 200.
- API health: healthy; auth bypass `false`.
- RG3 migration applied successfully to the linked Supabase project.
- Existing active release remained unchanged after migration.

## RG3 Manual Acceptance

Passed in a real Admin/Studio/Public Web browser flow:

1. Studio Publish left Public Web unchanged.
2. Complete candidate creation and Draft Preview left Public Web and release status unchanged.
3. Revision-bound validation moved a valid Draft to Ready.
4. Ready remained non-production until controlled activation.
5. Atomic activation switched Public Runtime/Web and preserved exactly one Active release.
6. A second complete release was created, previewed, validated and activated.
7. The previous Active release became Superseded.
8. Controlled rollback restored the previous immutable layout/content/settings snapshot.
9. Release transition audit/history events were verified.
10. Public Web switched releases without redeployment.

## Architecture Contract

- Studio → design and immutable published layout versions.
- Admin → content and controlled release activation.
- Release → exact immutable layout/content/settings snapshot.
- Public Web → Active release only.
- Studio Publish ≠ Production Activation.
- Ready Release ≠ Production Activation.
- Only controlled Admin activation changes production.

## Next

Repair Group 3 is complete.

Repair Group 4 — Release Snapshot + Media Integrity — is the exact next repair
group and has not been started.
