# Phase 6 Handoff — Security, Scaling & SEO

## Status

**Phase 6 code implementation: COMPLETE**

This handoff extends the certified Phase 5 release architecture. It does not replace or weaken the immutable release state machine, RLS/service-role boundary, media certification, atomic activation, or rollback guarantees.

Production certification is intentionally a separate deployment/test step because DDoS/WAF behavior, CAPTCHA, MFA, Supabase migration application and real-domain SEO cannot be truthfully certified inside an offline packaging environment.

## New migration

```text
20260811001800_phase6_security_scaling_foundation.sql
```

It adds shared security rate-limit counters, per-user/per-feature daily quota accounting and browser-read hardening. It is forward-only and service-role controlled.

## Security implementation

- Production defaults to `SECURITY_MODE=strict`.
- Strict production refuses startup without explicit trusted-proxy hops, Supabase distributed privileged limits and a strong rate-limit hashing secret.
- API disables `X-Powered-By`, restricts CORS, validates request/query/body shape, enforces size/content-type limits, limits header/request lifetime and caps headers.
- Public-origin burst protection is process-local and bounded so rotating-IP traffic cannot grow memory without limit.
- Authenticated privileged/write/upload limits are also stored in Supabase so horizontally scaled API instances share counters.
- Shared daily user/feature quotas are ready for future AI-agent endpoints.
- Strict production mode requires Supabase AAL2 for Admin/Studio (`REQUIRE_PRIVILEGED_AAL2=true`).
- Public/Admin/Studio password auth uses the same Cloudflare Turnstile or hCaptcha Supabase CAPTCHA configuration in production and fails closed if the frontend provider/site key is missing.
- Admin/Studio browser sessions are refreshable and no longer duplicated into a custom access-token storage key.
- Production API errors are generic and include request IDs; structured request logs exclude bodies/secrets.
- Runtime/user supplied values remain escaped/sanitized by the Phase 5 renderer/validation boundary; no untrusted raw HTML path was introduced.

## DDoS / DoS model

The application contains origin self-protection, but a true distributed network attack must be stopped before it reaches Node/Supabase. Deploy behind a provider that supplies:

```text
CDN / Anycast edge
→ managed DDoS protection
→ WAF + bot/auth path rules
→ TLS / connection controls
→ load balancing / autoscaling
→ stateless API instances
```

Do not expose an avoidable unprotected origin endpoint. Do not replace edge DDoS protection with a database call on every anonymous public request.

## Scaling implementation

- API is stateless with authoritative state in Supabase/object storage.
- `/health` provides liveness; `/ready` probes Supabase readiness.
- graceful SIGTERM/SIGINT draining is implemented.
- Active RuntimeManifest uses a short disposable process cache and in-flight request de-duplication.
- public API responses use release/media-version ETags and CDN caching; Admin/Studio use `no-store`.
- Docker API deployment artifact is included (`Dockerfile.api`).
- bounded load smoke is included (`npm run test:load-smoke`).

## SEO implementation

SEO authority follows the same Active-release boundary as content.

- Public route title/description/canonical/noindex fields are authored in Studio.
- site-level SEO settings are managed through immutable Admin settings revisions.
- collection details derive item-specific metadata and canonical media.
- Public Web includes a Vercel server-rendered HTML shell so crawlers/social bots receive metadata before React hydration.
- Open Graph, Twitter metadata and JSON-LD are emitted server-side.
- Title templates safely expand `%site%` before `%s`, and client-side JSON-LD updates reuse the response CSP nonce during SPA navigation.
- JSON-LD inline script receives a per-response CSP nonce rather than requiring broad inline-script permission.
- `robots.txt` and `sitemap.xml` are generated from the Active RuntimeManifest only.
- login/register/dashboard are noindex; Admin/Studio are noindex at HTML and hosting-header layers.
- sitemap timestamps are stable and invalid dates are safely omitted instead of breaking sitemap generation.

## HSTS / CSP note

HSTS uses a one-year max age with `includeSubDomains`; it does **not** opt the domain into the browser preload list automatically. Only add `preload` after every relevant subdomain is permanently HTTPS-ready and you intentionally submit the domain to the preload program.

Public CSP allows only the application and explicitly configured API/Supabase/CAPTCHA origins for script/connect/frame behavior. Inline styles remain allowed because the current visual runtime uses React style attributes. This is a known architecture requirement, not a reason to permit inline JavaScript.

## Tests executed in the packaging environment

Executed successfully:

```text
npm run lint:source     PASS
npm run test:security   PASS
npm run test:static     177 total / 176 pass / 0 fail / 1 skipped
Phase 6 security + SEO logic tests (dependency-free execution shim)  7/7 PASS
node --check apps/web/api/*.mjs   PASS
```

The one static skip is the dependency-backed suite that requires `tsx`/installed npm dependencies.

Full `npm test`, `npm run typecheck` and `npm run build` could not be executed in the packaging container because dependency installation could not reach the npm registry (`EAI_AGAIN`) and the uploaded source did not contain a complete `node_modules`. They must be run after `npm ci` in the user's normal development environment. This handoff does not claim otherwise.

## Required production configuration before launch

1. Apply/review migration `01800` only after the Phase 5 database is through `01700`.
2. Set the API strict-production variables in `apps/api/.env.example` on the hosting provider.
3. Set exact `ALLOWED_ORIGINS` and exact proxy hop count.
4. Configure Public Web `PUBLIC_SITE_URL`/`PLATFORM_API_URL`.
5. Publish the final SEO settings/content in Admin and activate them through the normal release workflow.
6. Configure Turnstile/hCaptcha in Supabase Auth and set the matching public provider/site key on Public Web, Admin and Studio before production deployment.
7. Enroll an Admin MFA factor **before deploying strict production mode**; strict mode refuses to start unless `REQUIRE_PRIVILEGED_AAL2=true`.
8. Configure provider CDN/WAF/DDoS/bot/rate rules.
9. Run `docs/PHASE6_TEST_PLAN.md` against local/staging and the final public domain.
10. Perform any capacity/load testing against staging, not production.

## Deliberately not implemented

- A false promise that application code can make a public service impossible to DDoS.
- Kubernetes/PM2/Redis/BullMQ merely for architecture theatre when the current product does not need those services yet.
- bcrypt/password storage inside the API; Supabase Auth remains the credential authority.
- direct browser access to service-role quota/rate-limit state.
- a new AI agent implementation; the quota primitive is ready for the next product feature.
