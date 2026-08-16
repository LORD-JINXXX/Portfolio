# Phase 5 Final Manual / Live Acceptance Plan

This is Repair Group 10, the final Phase-5 certification gate. Run it **after** receiving the completed code handoff. Phase 5 should not be called production-certified until this plan passes.

## 1. Install and verify the code first

Required Node version: `>=20.19.0 <23`.

```powershell
node --version
npm --version
npm ci
npm run lint
npm test
npm run typecheck
npm run build
```

`npm run lint` already includes the dependency-free source/SQL invariant suite and TypeScript typecheck. Do not continue to database deployment if any command fails.

Expected source-only handoff baseline before dependency installation:

- `npm run lint:source` — pass.
- `npm run test:static` — 160 total / 159 pass / 0 fail / 1 dependency-only skip in the handoff environment.

The full dependency-backed totals may be higher; use zero failures as the gate rather than copying an old historical count.

## 2. Reconcile the linked remote database BEFORE any write

A prior external development session reported that it may have executed function definitions from migration `01000` against the linked Supabase project without recording `01000` in `supabase_migrations.schema_migrations`. That report was not conclusively reconciled.

Do **not** begin with `supabase db push`, `supabase migration repair`, or any other write.

Read migration history and inspect actual function definitions using a trusted read-only SQL session. At minimum compare:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;

select pg_get_functiondef('public.assert_release_media_integrity(uuid)'::regprocedure);
```

Also inspect the exact signatures of:

- `public.record_release_validation(...)`
- `public.activate_release(...)`
- `public.rollback_release(...)`

If `01000` is not recorded but its definitions are already present, classify and reconcile that schema drift explicitly before applying migrations. Do not hide unexplained drift by changing migration history.

Before any migration, take a Supabase backup / restore point appropriate to your plan.

## 3. Prefer a local Supabase database for migration acceptance

Docker Desktop (or another Supabase-compatible container runtime) is recommended on Windows.

```powershell
docker version
npx supabase start
```

Both Docker Client and Server must be available. If the daemon is unavailable, fix the local environment rather than substituting uncontrolled writes to production.

Apply/reset the local database using the repository's normal Supabase CLI workflow so **all migrations in `supabase/migrations/` run in filename order**, including repair migrations `00200` through `01700`.

Do not apply only `00100`; later migrations are required parts of Phase 5.

Verify the complete local migration history after application.

## 4. Real RG4 database acceptance

Use disposable LOCAL fixtures wherever possible.

### Certified media transitions

Prove:

1. Draft version 0 produces `release.media-uncertified`, records failed validation and stays Draft.
2. Draft version 1 with **zero** references can validate and become Ready when all other inputs are valid.
3. Draft version 1 with managed references can validate and become Ready.
4. Captured bucket/storage/MIME/size mismatch is rejected.
5. Missing physical `public-media` Storage object produces an error and blocks a successful Ready transition.

### Row-lock concurrency

With two independent PostgreSQL sessions:

1. Session A begins a transaction and invokes `assert_release_media_integrity` for a media-bearing version-1 release.
2. Keep A open.
3. Session B sets a short `lock_timeout` and attempts to update a referenced mutable media identity field.
4. B must block/time out while A holds the media-row lock.
5. Roll back A and verify the row becomes writable again.

### Current Active legacy guard

If the current Active release is version 0, trying to activate a Ready version-1 replacement must fail without any partial status swap. Exactly one Active release must remain.

Before replacing that production Active release, use the RG4D audit/resolution workflow and certify its exact frozen media only after:

- all managed legacy values are resolved exactly;
- no unresolved managed references remain;
- every canonical Storage object physically exists.

Do not auto-certify history.

### Rollback

Prove:

- version-0 Superseded target is rejected;
- valid version-1 Superseded target reaches normal controlled rollback;
- successful rollback leaves exactly one Active release and restores the immutable prior snapshot.

### Media Delete

Prove:

- canonical structured reference blocks deletion;
- certified `release_media_references` blocks deletion;
- unresolved/frozen legacy release reference blocks deletion;
- unreferenced media uses DB-first delete + durable cleanup job;
- Storage deletion failure leaves a pending/failed cleanup job rather than a broken database reference;
- cleanup retry can complete the orphaned Storage removal.

## 5. Permission / security acceptance

With actual `anon`, normal authenticated user, Admin and service-role contexts, verify:

- browser roles cannot execute privileged release/media/revision RPCs;
- browser roles cannot directly mutate release media accounting;
- a normal user cannot access Admin or another designer's Studio layout;
- Admin can use Admin and its intended Studio paths;
- audit logs cannot be updated/deleted through browser roles;
- service-role key is present only in the API environment and never in browser bundles;
- production API refuses `DEV_BYPASS_AUTH=true`;
- production API refuses wildcard/missing allowed origins;
- production API requires `PUBLIC_WEB_RUNTIME_VERSION`.

For uploaded files, test an extension/MIME mismatch and an oversized file. The API must reject the payload based on server-side bytes/limits.

## 6. Studio browser workflow

1. Sign in as Admin/designer.
2. Create both Blank and Cosmic layouts.
3. Add/reorder/duplicate pages; verify there is only one canonical Home route.
4. Refresh deep editor URLs and verify exact layout/version/page hydration.
5. Drag before/after/inside containers.
6. Lock a layer and verify drag, resize and property mutations are blocked until unlocked.
7. Create an absolute/free-position node and use the canvas resize/move handles.
8. Verify desktop/tablet/mobile previews use layout-defined breakpoints.
9. Configure Content, Setting, Collection, Field and Media bindings.
10. Select managed media from the Studio Media Library rather than pasting a mutable live-library reference.
11. Configure animation and scroll behaviors, including reduced-motion/mobile fallback.
12. Validate the draft and publish an immutable layout version.
13. Create another draft from published history and verify copied page IDs are fresh.

Studio Publish must not change Public Web.

## 7. Admin browser workflow

### Layout Library

- Published cards appear.
- Preview renders shared sample content.
- Version history is visible.
- Active/configuring/compatibility state is correct.
- An **older compatible published version** can be selected and configured.
- Configure does not activate production.

### Site Content / Settings

- Editing works against a typed Draft revision rather than live values.
- Save Draft and Publish are distinct.
- Published revisions are immutable.
- Collection-detail preview lets you choose a real project/note and displays exact field context.
- Settings types reject invalid JSON/boolean/URL-like values as applicable.

### Structured content / Media

- Project thumbnail/gallery, Note cover, Experience logo and AI App icon/cover persist canonical media IDs.
- Admin Media tabs: **All / Images / Videos / Documents** filter correctly.
- Search/upload/metadata/delete/retry continue to work under those filters.
- Media list scroll feels native; verify there is no wheel interception, nested-scroll lock, or artificial scroll acceleration.

## 8. Release → Public Web end-to-end gate

1. Publish exact layout/content/settings inputs.
2. Create a candidate. Incompatible runtime/input state must fail **before** allocating an append-only release.
3. Verify canonical media certification outcome.
4. Validate candidate.
5. Preview across pages and devices. Preview must not alter production.
6. Activate only after the currently Active release is rollback-safe/certified.
7. Verify exactly one Active release.
8. Public Web renders the new Active RuntimeManifest without Web redeployment.
9. Test `/`, collection indexes, valid detail slugs, invalid detail slug 404 and an unknown route 404.
10. Verify RuntimeManifest media comes from the release snapshot/reference set; an empty release snapshot must never expose the entire current Media Library.
11. Publish/configure/activate a second layout version without redeploying Public Web.
12. Controlled rollback to the prior certified immutable release and verify design/content/settings/collections/media all restore together.

## 9. Independent deployment gate

Build/deploy each application separately:

```powershell
npm run build:web
npm run build:admin
npm run build:studio
npm run build:api
```

Deploying Studio or Admin must not require redeploying Public Web unless the Public Web runtime itself changes. The API's `PUBLIC_WEB_RUNTIME_VERSION` must equal the actually deployed Web runtime contract (`1.5.0` for the current runtime patch).

## 10. Completion rule

Mark Repair Group 10 and Phase 5 complete only when:

- dependency-backed lint/tests/typecheck/build are green;
- database migration and concurrency tests are green;
- remote drift is reconciled;
- Studio → Admin → Release → Public Web succeeds;
- second-layout activation succeeds without Public Web redeploy;
- controlled rollback succeeds;
- security/role/storage checks succeed;
- no production invariant or secret boundary is weakened.

Phase 6 / AI work remains outside this test plan.
