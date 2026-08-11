# Dynamic Portfolio Platform

Production-ready monorepo for a release-driven portfolio platform with four independently deployable applications:

```text
apps/web      Public portfolio runtime + user authentication shell
apps/admin    CMS, Site Content, structured collections, Media and Releases
apps/studio   Visual website-layout authoring
apps/api      Trusted Node/Express platform backend
```

Shared contracts/runtime/editor packages live under `packages/`; forward-only database migrations live under `supabase/migrations/`.

`portfolio.md` remains the canonical architecture source of truth. Phase 5 established the immutable release workflow. Phase 6 adds production security, resilience/scaling foundations and release-aware SEO without changing the rule that **only controlled Admin release activation changes Public Web**.

## Production workflow

```text
Studio design with sample data
→ save / validate / publish immutable layout version
→ Admin previews/configures a compatible published version
→ Admin edits/publishes immutable content + settings revisions
→ Admin creates an exact release candidate
→ canonical media certification + validation
→ read-only preview
→ controlled atomic activation
→ Public Web consumes only the Active RuntimeManifest
```

Studio Publish, Content Publish, Settings Publish and Ready status do **not** change production.

## Phase 6

Phase 6 implements a strict production baseline covering:

- fail-closed production configuration and explicit proxy/CORS trust;
- layered request limits, body/query-shape guards and request timeouts;
- bounded in-memory edge/origin burst protection plus shared Supabase-backed privileged rate limits;
- per-user/per-feature daily quota primitives for future AI applications;
- production-fail-closed CAPTCHA for Public/Admin/Studio Supabase password authentication;
- optional AAL2/MFA enforcement for Admin and Studio;
- service-role-only security counters and tighter RLS/read boundaries;
- security headers, CSP, noindex protection for Admin/Studio, safe production errors and structured request IDs/logging;
- stateless API deployment, health/readiness endpoints, graceful shutdown and short Active-manifest caching;
- release-aware server-visible SEO, canonical URLs, Open Graph/Twitter metadata, JSON-LD, `sitemap.xml` and `robots.txt`;
- safe runtime media-loading defaults for Core Web Vitals;
- guarded load-smoke tooling and deployment/WAF guidance.

A large network-level DDoS attack cannot be solved inside Express alone. Production must still place the public services behind a CDN/edge provider with managed DDoS protection/WAF and provider-level rate/bot rules. See `docs/PHASE6_SECURITY_SCALING_SEO.md`.

## Start here

1. Read `docs/LOCAL_SETUP.md`.
2. Read `PHASE6_HANDOFF.md`.
3. Read `docs/PHASE6_SECURITY_SCALING_SEO.md` and `docs/PHASE6_TEST_PLAN.md` before production deployment.
4. Use Node `>=20.19.0 <23`.
5. Install dependencies and verify the repository:

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:static
npm run test:security
```

6. Confirm the linked database is already through Phase 5 migration `01700`, review the dry run, and then apply migration `01800`:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review first, then:
npx supabase db push --linked
```

7. Configure the production environment from the app-specific `.env.example` files. Never copy real secrets into source control.
8. Configure CAPTCHA/MFA/WAF only after following the Phase 6 security guide and test plan.

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

## Security checks

```powershell
npm run test:security
npm run test:static
```

A bounded local load smoke is also available:

```powershell
npm run test:load-smoke
```

The load script refuses a non-local target unless `ALLOW_REMOTE_LOAD_TEST=true`. Use a staging system you control; do not stress-test production casually.

## Security boundaries

- `SUPABASE_SERVICE_ROLE_KEY` belongs only in the API environment.
- No service-role credential may appear in a `VITE_*` variable or browser bundle.
- Public Web receives published data through the Platform API/Active release boundary, not direct draft/current CMS-table reads.
- Admin and Studio are authenticated, non-indexable control surfaces.
- Browser sessions use Supabase SPA authentication. Because those tokens are browser-managed rather than HttpOnly BFF cookies, CSP/XSS prevention and short-lived/refreshable sessions remain important defenses.
- Rotate any secret that has ever appeared in a shared archive, screenshot, shell history or committed file.

## Version

Platform version: **0.6.0**  
Runtime compatibility version: **1.0.0**

Phase 6 implementation is complete in this handoff. Production certification still requires the targeted checks in `docs/PHASE6_TEST_PLAN.md` plus real edge/WAF configuration on the chosen hosting platform.
