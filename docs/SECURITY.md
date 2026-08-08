# Security Model

## Authentication

Supabase Auth is the identity source. Public registration creates a normal user profile through the database trigger. There is no Admin registration path.

## Authorization layers

```text
frontend route gate
+ API bearer-token verification
+ API role authorization
+ PostgreSQL RLS
+ Storage policies
```

Frontend guards are convenience controls, not security boundaries.

## Roles

- `user`: public/authenticated user areas only.
- `admin`: Admin CMS and Studio.
- `designer` / `editor`: supported by the Studio API role gate for future delegated Studio access; privileged database access still goes through the API service layer.

## Credentials

- Browser applications use only the Supabase public/anon key.
- `SUPABASE_SERVICE_ROLE_KEY` belongs only in the API environment.
- Real `.env` files are intentionally excluded from the deliverable.
- Rotate any service-role credential that has ever been included in a shared ZIP or committed file.

## CORS

Production should set `ALLOWED_ORIGINS` to the exact Web/Admin/Studio origins. Unrestricted production CORS is not used.

## Media

CMS uploads have MIME and size validation. Library selections are stored by stable media ID. Deletion is blocked while a non-archived release, content revision, or layout still references the media record.

## Publishing

Published layout versions and published content revisions are protected by database triggers. Release activation/rollback is atomic through `activate_release` and a unique active-release index.
