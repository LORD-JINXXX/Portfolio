# API Contracts

Base URL is configured by `VITE_API_URL` in frontends. Admin/Studio APIs require a Supabase bearer access token unless local development explicitly enables `DEV_BYPASS_AUTH=true` outside production.

## Public

- `GET /health`
- `GET /api/public/runtime`
- `GET /api/public/manifest`
- `GET /api/public/runtime/page/:slug`
- `GET /api/public/projects`
- `GET /api/public/projects/:slug`
- `GET /api/public/notes`
- `GET /api/public/notes/:slug`
- `GET /api/public/experience`
- `GET /api/public/apps`

`/api/public/runtime` returns the complete production-oriented `RuntimeManifest` for the active immutable release.

## Studio

- `GET /api/studio/me`
- `GET /api/studio/layouts`
- `POST /api/studio/layouts`
- `GET /api/studio/layouts/:id/editor`
- `POST /api/studio/layouts/:id/duplicate`
- `POST /api/studio/layouts/:id/drafts`
- `PUT /api/studio/versions/:id/document`
- `POST /api/studio/versions/:id/validate`
- `POST /api/studio/versions/:id/publish`
- `PATCH /api/studio/layouts/:id/archive`
- `GET /api/studio/bindings/registry`
- `GET /api/studio/collections`
- `GET /api/studio/animations`
- `GET /api/studio/scroll-behaviors`

Studio can publish an immutable design version but cannot activate production.

## Admin

Admin APIs cover:

- dashboard
- projects, notes, experience, AI app catalog CRUD
- media upload/manage
- settings
- layout library / sample preview / configure selection
- visual content editor context
- content revisions
- compatibility checks
- release creation / production preview / activation / rollback
- audit logs

Release activation is only exposed through the Admin API and then delegated to the atomic database RPC.
