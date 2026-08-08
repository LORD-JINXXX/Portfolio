# Phase 5 End-to-End Test Plan

Run this only after dependencies, Supabase migrations and environment files are configured.

## Automated checks

```bash
npm run test:static
npm test
npm run typecheck
npm run build
```

`npm run test:static` runs the dependency-free source/SQL invariant checks (19 checks in the packaged source).

`tests/platform.test.ts` covers tree IDs/cycles, responsive inheritance, collection queries, content compatibility, runtime compatibility, schema validation, static runtime rendering and supported animations.

`tests/migration.test.ts` asserts critical SQL invariants for atomic activation, immutability, role protection and media snapshots.

## End-to-end gate

1. Studio: create Cosmic starter, edit Header/Home/Footer, create/reorder a page, save, refresh and verify persistence.
2. Studio: mark text/image/link data as Admin-editable; validate; publish.
3. Admin Layouts: confirm card, full sample preview and `Configure Content` do not alter the live release.
4. Admin Site Content: switch Header/Home/Footer/page tabs, select content overlays, save draft values and publish a content revision.
5. Admin structured managers: add projects/notes/experience/apps and verify collection previews.
6. Admin Releases: create candidate, preview real content across pages/devices, resolve validation issues, activate.
7. Public Web: visit clean browser routes such as `/`, `/projects`, `/projects/:slug`, `/notes`, `/notes/:slug` and confirm the active manifest renders through the shared runtime.
8. Studio: publish a second layout/version, configure it without affecting production, then create/activate a release without redeploying Web.
9. Admin Releases: reactivate a prior release and confirm design/content/settings/collection/media snapshot rollback.
10. Verify Admin/Studio deny a normal user and API rejects unauthorized mutation calls.
