# Local Setup — Phase 5 Final Handoff

This repository contains the completed Phase-5 code implementation. Repair Group 10 is the final local/live/browser acceptance gate.

## 0. Security first

Never put a Supabase service-role key in Web, Admin or Studio. It belongs only in `apps/api/.env`.

If a service-role credential was ever included in a shared ZIP or committed environment file, rotate it before continuing. Real `.env` files are excluded from the handoff ZIP.

Before writing to a linked remote database, read the drift warning in `docs/PHASE5_TEST_PLAN.md`.

## 1. Prerequisites

- Node.js `>=20.19.0 <23`.
- npm 10+.
- Docker Desktop / compatible container runtime for preferred local Supabase testing.
- Supabase CLI.
- A Supabase project for the eventual controlled remote deployment.

Local application ports:

```text
Public Web    http://localhost:3000
Admin CMS     http://localhost:3001
UI/UX Studio http://localhost:3002
Platform API  http://localhost:4000
```

## 2. Install and verify

```powershell
npm ci
npm run lint
npm test
npm run typecheck
npm run build
```

For a dependency-light source/SQL check:

```powershell
npm run lint:source
npm run test:static
```

## 3. Start local Supabase

```powershell
docker version
npx supabase start
```

`docker version` must show both Client and Server. If the daemon is not running, start Docker Desktop first.

Use the repository's established local reset/apply workflow so **all files in `supabase/migrations/` apply in filename order**. Do not apply only `00100`; repair migrations through `01700` are required.

## 4. API environment

Copy:

```text
apps/api/.env.example
→ apps/api/.env
```

Fill the local values, including:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=4000
DEV_BYPASS_AUTH=false
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
PUBLIC_WEB_RUNTIME_VERSION=1.4.0
```

Keep `DEV_BYPASS_AUTH=false` for the real integration gate.

## 5. Frontend environments

For `apps/web`, `apps/admin` and `apps/studio`, copy `.env.example` to `.env` and fill:

```text
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to a `VITE_*` value.

## 6. First Admin account

Register/sign in normally so the profile trigger creates the user profile. From a trusted SQL/Dashboard session, assign that profile the `admin` role. Public registration never creates Admin accounts and normal users cannot self-promote.

## 7. Start applications

All workspaces:

```powershell
npm run dev
```

Or independently:

```powershell
npm run dev:web
npm run dev:admin
npm run dev:studio
npm run dev:api
```

## 8. Final Phase-5 gate

Follow `docs/PHASE5_TEST_PLAN.md` completely. Do not mark Phase 5 production-complete until Repair Group 10 passes.
