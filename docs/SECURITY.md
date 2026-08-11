# Security Model

## Authentication

Supabase Auth is the identity source. Public registration creates a normal user profile through the database trigger. There is no public Admin registration path.

## Authorization layers

```text
frontend route gate
+ API bearer-token verification
+ API role authorization / ownership
+ trusted service operation or service-role RPC
+ PostgreSQL RLS / triggers / constraints
+ Storage policy
```

Frontend guards are convenience controls, not security boundaries.

## Roles

- `user`: public/authenticated user areas only.
- `admin`: Admin CMS and Studio.
- `designer` / `editor`: future delegated Studio roles; the API restricts them to layouts they own and privileged database mutations still use the trusted service layer.

## Credentials

- Browser applications use only the public Supabase key and API URL.
- `SUPABASE_SERVICE_ROLE_KEY` belongs only in the Platform API environment.
- Real `.env` files are excluded from the deliverable.
- Rotate any privileged credential that has ever appeared in a shared archive or commit.

## Production API fail-closed configuration

Production refuses to start with:

- `DEV_BYPASS_AUTH=true`;
- wildcard or missing `ALLOWED_ORIGINS`;
- missing `PUBLIC_WEB_RUNTIME_VERSION`.

The deployed runtime version is part of release compatibility; API source constants are not used as a substitute for knowing the deployed Public Web capability.

## Media

- CMS uploads have server-side byte-size limits and magic-byte MIME sniffing; client metadata is not authoritative.
- Managed selections use stable `media.id` and immutable `storage_path` identity.
- Release version 1 media is represented by immutable `release_media_references`.
- Media deletion is DB-first. It locks the media row, rejects canonical/legacy/frozen release references, commits a durable cleanup job, then the API removes the Storage object.
- A Storage cleanup failure does not resurrect or break a database reference; the cleanup job remains retryable.
- Public object delivery can remain public while direct Storage object enumeration policies are removed.

## Releases / publishing

- Published layout/content/settings revisions and Ready/Active/Superseded release snapshots are protected by database rules.
- Candidate validation, activation and rollback are trusted service-role operations.
- Exactly one Active release is enforced atomically.
- Certified release transitions require relational media integrity and trusted physical Storage availability.
- A legacy version-0 Active release cannot be superseded until it is made rollback-safe through explicit historical certification.
- Historical media certification is never automatic or bulk; exact legacy mappings and physical Storage preflight are required.

## Audit

Audit history is append-only. Critical transitions write their audit event in the same database transaction as the state change. Actor references use restrictive integrity rather than silently deleting audit provenance.

## Browser mutation boundary

Critical content/settings/release/media/layout lifecycle writes follow:

```text
authenticated browser
→ Platform API
→ validated service operation / service-only RPC
→ database
```

Browser roles do not receive general privileged PostgREST write access as a substitute for this boundary.
