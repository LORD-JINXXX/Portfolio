# Dynamic Portfolio Platform

A Phase-5 monorepo with four independently deployable applications:

```text
apps/web      Public portfolio runtime + normal user auth/dashboard shell
apps/admin    CMS, Site Content editor, Layout Library, Media and Releases
apps/studio   Visual website layout authoring
apps/api      Trusted Node/Express platform backend
```

Shared contracts/runtime/editor packages live under `packages/`; forward database migrations live under `supabase/migrations/`.

`portfolio.md` is the canonical architecture source of truth. `REPAIR_GROUP_STATUS.md` is the current repair/handoff status.

## Core production workflow

```text
Studio design with sample data
→ save/validate/publish immutable layout version
→ Admin discovers/previews/configures a compatible published version
→ Admin edits/publishes immutable content + settings revisions
→ Admin creates exact release candidate
→ canonical media certification + validation
→ read-only preview
→ controlled atomic activation
→ Public Web loads only the Active RuntimeManifest
```

Studio Publish, Content Publish, Settings Publish and Ready status **do not** change production. Only controlled Admin release activation does.

Studio Preview, Admin previews and Public Web use the shared `@platform/runtime-renderer` and deterministic routing contract.

## Start here

1. Read `docs/LOCAL_SETUP.md`.
2. Read the remote-drift precaution in `docs/PHASE5_TEST_PLAN.md` **before any linked database write**.
3. Use Node `>=20.19.0 <23` and run `npm ci`.
4. Run `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.
5. Start/apply a local Supabase database and apply **all** migrations in filename order.
6. Configure only the `.env` files described in the setup guide.
7. Run the applications together or through the independent `dev:*` scripts.
8. Execute `docs/PHASE5_TEST_PLAN.md` as Repair Group 10.

## Independent application commands

```powershell
npm run dev:web
npm run dev:admin
npm run dev:studio
npm run dev:api

npm run build:web
npm run build:admin
npm run build:studio
npm run build:api
```

## Security note

Rotate any Supabase service-role credential that has ever appeared in a shared ZIP or committed environment file. The service-role key belongs only in `apps/api/.env`, never in a `VITE_*` variable.

## Phase status

Repair Groups 1-9 and RG4C2/C3/D are implemented in this handoff. Repair Group 10 is the final dependency-backed, database and browser/live acceptance gate. Phase 6 / AI execution remains deferred until Phase 5 is certified.
