# Dynamic Portfolio Platform

A monorepo containing four independently deployable applications:

```text
apps/web      Public portfolio runtime + user auth/dashboard shell
apps/admin    CMS, visual Site Content editor, Layout Library and Releases
apps/studio   Visual website design authoring
apps/api      Trusted Node/Express platform backend
```

Shared platform packages live under `packages/` and Supabase migrations under `supabase/`.

`portfolio.md` is the architecture source of truth. `IMPLEMENTATION_PHASE5_BATCHES_1_40.md` describes the integrated implementation through Batch 40.

## Core workflow

```text
Studio design + sample data
→ save draft/version/pages
→ validate + publish immutable layout
→ Admin Layout Library sample preview
→ Configure Content (does not change production)
→ visual Admin content draft + publish
→ create release snapshot
→ release preview with real content
→ atomic activate
→ Public Web loads RuntimeManifest
```

Studio Preview, Admin previews/content mode and Public Web use the same `@platform/runtime-renderer`.

## Start here

1. Read `docs/LOCAL_SETUP.md`.
2. Apply `supabase/migrations/20260808000100_platform_phase5_complete.sql`.
3. Configure only the `.env` files described in the setup guide.
4. Run `npm install`.
5. Run `npm run typecheck`, `npm test`, `npm run build`.
6. Run `npm run dev`.
7. Follow `docs/PHASE5_TEST_PLAN.md` for the Batch-41 end-to-end gate.

## Important security note

Rotate any Supabase service-role credential that has ever appeared in a shared ZIP or committed environment file. The service-role key belongs only in `apps/api/.env`, never in a `VITE_*` variable.
