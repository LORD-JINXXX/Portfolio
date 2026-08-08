# Local Setup — Phase 5 Integrated Platform

This repository is wired through implementation Batch 40. Batch 41 is the manual end-to-end gate that should be run after the local environment is configured.

## 0. Security first

The migration source ZIP used during development contained a Supabase service-role credential in a local `.env` file. Treat that credential as exposed and rotate it in Supabase **before** using this project further.

Never place the replacement service-role key in Web, Admin, or Studio. It belongs only in `apps/api/.env`.

The packaged repository contains only `.env.example` files.

## 1. Prerequisites

- Node.js 18+ (a current LTS is recommended).
- npm 10+.
- A Supabase project.
- Supabase CLI if you want to apply migrations from the terminal; otherwise run the migration in the Supabase SQL editor.

Local application ports are:

```text
Public Web   http://localhost:3000
Admin CMS    http://localhost:3001
UI/UX Studio http://localhost:3002
Platform API http://localhost:4000
```

## 2. Install dependencies

From the repository root:

```bash
npm install
```

Then verify:

```bash
npm run typecheck
npm test
npm run build
```

A fast source/SQL invariant check is also available:

```bash
npm run test:static
```

## 3. Create the database schema

Apply:

```text
supabase/migrations/20260808000100_platform_phase5_complete.sql
```

The migration is designed to establish the identity/profile, structured-content, design/version, content-revision, settings-revision, release, audit, RLS, Storage and atomic activation foundations used by this repository.

## 4. Configure API environment

Copy:

```text
apps/api/.env.example
→ apps/api/.env
```

Fill:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_NEW_ROTATED_SERVICE_ROLE_KEY
PORT=4000
DEV_BYPASS_AUTH=false
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

Keep `DEV_BYPASS_AUTH=false` for the real integration test so API authorization is actually exercised.

## 5. Configure the three frontends

For each of:

```text
apps/web
apps/admin
apps/studio
```

copy `.env.example` to `.env` and fill:

```text
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Do not use the service-role key in any `VITE_*` value.

## 6. Create the first Admin account

Register/sign in through Supabase Auth or the normal application auth flow so the `profiles` trigger creates a profile.

Then, from a trusted Supabase Dashboard/SQL session, assign that user's `profiles.role` to `admin`. There is intentionally no public Admin signup route and normal users cannot promote themselves through RLS.

## 7. Start the platform

From the repository root:

```bash
npm run dev
```

Open Studio/Admin/Web on ports 3002/3001/3000 respectively. The API runs on 4000.

## 8. Run the manual Phase 5 gate

Follow `docs/PHASE5_TEST_PLAN.md` in order. The important complete path is:

```text
Studio layout + sample data
→ persist pages/trees
→ validate/publish immutable version
→ Admin Layout Library preview
→ Configure Content
→ visual Admin content draft/publish
→ structured collections
→ release candidate + production preview
→ atomic activate
→ Public Web runtime manifest
→ second layout switch without Web deployment
→ rollback
```

Do not call Phase 5 complete until that end-to-end gate has passed in the configured local Supabase environment.
