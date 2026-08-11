# Phase 5 deployment model

The platform is a monorepo, but its four applications are independently deployable:

- `@platform/web` — public runtime only. Reads the Active RuntimeManifest through the Platform API.
- `@platform/admin` — authenticated Admin CMS. Owns content/settings/media/release operations through the Platform API.
- `@platform/studio` — authenticated UI/UX Studio. Owns layout drafts/publication through the Platform API.
- `@platform/api` — trusted server boundary. It is the only application that receives `SUPABASE_SERVICE_ROLE_KEY`.

A Studio layout publish, Content publish, Settings publish, or Ready release does **not** change production. Only Admin release activation changes the Public Web Active release.

## Root commands

```bash
npm ci
npm run dev:web
npm run dev:admin
npm run dev:studio
npm run dev:api

npm run build:web
npm run build:admin
npm run build:studio
npm run build:api
```

`npm run build` still verifies every workspace together. `npm run clean` is cross-platform and removes generated workspace artifacts.

## Production API environment

Required server-only values:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NODE_ENV=production
DEV_BYPASS_AUTH=false
ALLOWED_ORIGINS=https://admin.example.com,https://studio.example.com
PUBLIC_WEB_RUNTIME_VERSION=1.0.0
```

The API refuses to start in production when auth bypass is enabled, when CORS origins are not explicit, or when the deployed Public Web runtime version is missing.

Frontend applications receive only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`. Never add a service-role key to a `VITE_*` variable.

## Database migrations

Apply migrations in filename order. Before applying to production, reconcile the linked project's actual function definitions and migration history because a prior development session may have left unrecorded function-definition drift around migration `01000`. Do not use `migration repair` to hide drift; compare `pg_get_functiondef(...)` to the repository migrations first.

After migration application, run the Phase 5 manual gate in `docs/PHASE5_TEST_PLAN.md` before considering production certified.
