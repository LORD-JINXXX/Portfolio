# Phase 6 — Production Security, Scaling & SEO

Phase 6 hardens the Dynamic Portfolio Platform for public production traffic while preserving the release architecture established in Phase 5.

## Security model

The target is **strict production security**. Application code is one layer only: a large network-level DDoS attack must be absorbed by an edge/CDN/WAF provider before it reaches Node.js.

```text
Internet
  ↓
CDN / managed DDoS protection / WAF / bot controls
  ↓
Public Web edge cache
  ↓
Load balancer / hosting edge
  ↓
Stateless Platform API instances
  ↓
Supabase Auth + PostgreSQL/RLS + Storage
```

### Non-negotiable boundaries

- Browser apps never receive `SUPABASE_SERVICE_ROLE_KEY`.
- Public Web reads production content only from the Active release API.
- Admin and Studio remain authenticated role-gated applications.
- Admin/Studio are `noindex,nofollow,noarchive`.
- Browser roles cannot invoke shared rate-limit/quota RPCs.
- `DEV_BYPASS_AUTH=true` is rejected in production.
- Wildcard CORS is rejected.
- Strict production mode requires Supabase AAL2/MFA for privileged Admin/Studio access.

## DDoS / DoS defense

### Layer 1 — edge (required for production)

Put every public hostname behind a managed edge provider (for example Cloudflare in proxy mode or the hosting provider's managed DDoS/WAF edge). Enable:

- managed DDoS protection;
- WAF managed rules;
- bot protection;
- connection/request rate limiting at the edge;
- caching for static assets and public release responses;
- TLS only with automatic HTTP→HTTPS redirect;
- origin access restrictions when the hosting architecture supports them.

Recommended edge policies:

- `/login`, `/register`: bot challenge + strict request rate;
- `/api/public/*`: higher read allowance, cache GETs where safe;
- Admin/Studio hostnames: challenge suspicious traffic and restrict to HTTPS;
- API mutation paths: aggressive per-IP burst control in addition to app/user limits;
- do not cache authenticated/Admin/Studio responses.

The API's process-local limiter is **origin self-protection**, not a substitute for an edge DDoS network.

### Layer 2 — API rate limits

Phase 6 adds:

- bounded process-local public/IP burst limits;
- shared authenticated-user limits using PostgreSQL RPC counters;
- separate write limits;
- separate media-upload limits;
- HMAC-hashed limiter identities so raw user/IP identities are not persisted;
- a bounded memory-counter map so rotating-IP traffic cannot grow Node heap without limit;
- `429` + `Retry-After`/RateLimit response headers;
- fail-closed shared protection in strict mode.

Apply migration `20260811001800_phase6_security_scaling_foundation.sql` before enabling strict production mode.

### Layer 3 — request resource limits

The API now limits:

- ordinary JSON body size;
- URL-encoded body size;
- CMS media upload body size separately;
- URI length;
- query parameter count/size;
- nested JSON depth/object count;
- prototype-pollution field names;
- HTTP request/header/keep-alive timeouts;
- maximum parsed header count.

## Production API environment

Recommended values (adjust after staging load tests):

```env
NODE_ENV=production
SECURITY_MODE=strict
DEV_BYPASS_AUTH=false
TRUST_PROXY_HOPS=1
RATE_LIMIT_STORE=supabase
RATE_LIMIT_HASH_SECRET=<cryptographically-random-32-byte-or-longer-secret>
REQUIRE_PRIVILEGED_AAL2=true
PUBLIC_SITE_URL=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example,https://admin.your-domain.example,https://studio.your-domain.example
PUBLIC_WEB_RUNTIME_VERSION=1.5.0

PUBLIC_RATE_LIMIT_PER_MINUTE=240
PRIVILEGED_RATE_LIMIT_PER_MINUTE=180
MUTATION_RATE_LIMIT_PER_MINUTE=60
UPLOAD_RATE_LIMIT_PER_10_MINUTES=20
MEMORY_RATE_LIMIT_MAX_KEYS=50000
PUBLIC_SUCCESS_LOG_SAMPLE_RATE=0.05
PUBLIC_MANIFEST_MEMORY_CACHE_MS=5000

JSON_BODY_LIMIT=256kb
REQUEST_TIMEOUT_MS=30000
HEADERS_TIMEOUT_MS=15000
KEEP_ALIVE_TIMEOUT_MS=5000
PUBLIC_CACHE_SECONDS=60
PUBLIC_STALE_SECONDS=300
```

Never copy secrets into frontend `.env` files.

## Supabase Auth hardening

### CAPTCHA

All three Supabase password-login surfaces (Public Web, Admin and Studio) support the same Cloudflare Turnstile or hCaptcha project configuration. Production authentication fails closed when the provider/site key is missing, preventing an accidental production deployment that bypasses the project-wide Supabase CAPTCHA requirement.

```env
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=<public-site-key>
```

Configure the matching provider secret in Supabase Auth's CAPTCHA settings and set the same public provider/site-key values on Web, Admin and Studio. Local development may leave the provider blank.

### Admin/Studio MFA

1. Enroll and verify at least one TOTP/phone factor on each privileged account.
2. Test that the factor works.
3. Set `REQUIRE_PRIVILEGED_AAL2=true` on the API.
4. Admin/Studio will challenge verified factors when the API reports `MFA_REQUIRED`.

Do not enable AAL2 enforcement before privileged accounts have verified factors or you can intentionally lock yourself out.

### Auth rate limits

Public, Admin and Studio password sign-in calls talk directly to Supabase Auth, so configure Supabase Auth rate limits and CAPTCHA in the Supabase dashboard. The Platform API limiter cannot protect a request that never reaches the Platform API. The three frontends therefore pass the CAPTCHA token directly to Supabase Auth in production.

## Browser/XSS protections

- API disables `X-Powered-By`.
- API and production web shells emit `nosniff`, clickjacking/frame, referrer, permissions and CSP controls.
- Runtime renderer allow-lists HTML tags and DOM properties.
- Active-content URL schemes and active SVG data URLs are rejected.
- Runtime style values reject active CSS payloads.
- Runtime forms are presentation-only and cannot submit/exfiltrate data.
- Plain React content remains escaped by React.
- Never introduce `dangerouslySetInnerHTML` for untrusted Admin/user data without a reviewed sanitizer.

## Upload security

Phase 5 already validates CMS media signatures/MIME/size. Phase 6 adds route-specific upload throttling. Continue to keep:

- Storage uploads server-mediated;
- a hard maximum object size;
- MIME signature verification instead of trusting extensions;
- canonical immutable storage identity;
- DB-first race-safe media deletion;
- private ownership policies for future user resume/private files.

For malware scanning of arbitrary user documents, add a managed scanning service/worker before allowing new file types to become broadly public.

## Stateless horizontal scaling

The API does not store sessions or release state in process memory. Shared authoritative state is Supabase-backed. The small Active-manifest cache is disposable and TTL-bounded; another instance can rebuild it at any time.

Production can therefore run multiple API instances behind a load balancer/container platform. Do not depend on PM2 when the hosting platform already horizontally scales containers/serverless instances.

Phase 6 also adds:

- `/health` — process/liveness response;
- `/ready` — Supabase dependency readiness probe;
- graceful `SIGTERM`/`SIGINT` draining;
- public CDN cache headers + ETags tied to release/media authority;
- in-process request de-duplication for Active-manifest loading;
- shared authenticated rate-limit counters;
- a shared daily per-user usage/quota primitive for future AI apps.

## Caching

Public content is unusually cacheable because production content is immutable per release and changes only through controlled activation.

- Public API responses use CDN `s-maxage` + `stale-while-revalidate`.
- Public API ETags are release/media-version based.
- Active manifest has a very short process-local cache.
- Admin/Studio responses explicitly use `no-store`.

Keep cache TTLs short enough that release activation propagates within your acceptable window. If the eventual host exposes cache purge APIs, purge Public Web/API cache after controlled activation for near-immediate propagation.

## Daily AI/user quotas

Migration 01800 includes `consume_security_daily_quota(...)`, which is:

- atomic;
- per user;
- per feature key;
- UTC-day scoped;
- service-role-only.

Future AI application endpoints should call the server helper in `apps/api/src/lib/quota.ts` before expensive inference/file processing. Browser code must never be allowed to increment/reset quota counters directly.

## Logging / observability

API request logs are structured JSON and include request ID, method, path, status, latency and privileged actor ID/role when available. They deliberately do not log request bodies, Authorization headers, passwords, CAPTCHA tokens or service keys.

In production:

- ship logs to the hosting provider or an observability service;
- alert on 5xx rate, 429 spikes, readiness failures and authentication anomalies;
- add Sentry/OpenTelemetry when choosing the final hosting stack;
- monitor Supabase DB CPU, connections, slow queries, locks and Storage traffic.

Public successful request logs are sampled in production to prevent a traffic flood from turning logging itself into a DoS vector.

## Safe load testing

Run only against localhost or an explicit staging environment you control:

```powershell
npm run test:load-smoke
```

To target staging:

```powershell
$env:LOAD_TEST_URL="https://staging-api.example.com"
$env:ALLOW_REMOTE_LOAD_TEST="true"
$env:LOAD_TEST_REQUESTS="500"
$env:LOAD_TEST_CONCURRENCY="20"
npm run test:load-smoke
```

Never load-test production without explicit capacity/provider approval.

## SEO architecture

Only **Public Web** is indexable.

```text
Studio draft          no SEO effect
Studio publish        no production SEO effect
Admin draft           no SEO effect
Content/settings pub  release-eligible only
Release activation    changes public content + public SEO together
```

### Release-aware metadata

Public SEO is generated from the Active RuntimeManifest only:

- route title/description/canonical/noindex defaults;
- site-level SEO settings;
- Project/Note/AI App detail data;
- canonical managed media for social images.

### Site-level setting keys

Configure/publish these in Admin Settings before building the final production release:

```text
seo.site_url              https://your-domain.example
seo.site_name             Your public site name
seo.default_description   Default description
seo.title_template        %s · %site%
seo.language              en
seo.default_og_image      https://.../social-card.jpg
site.owner_name           Your public display name
site.social.github        https://github.com/...
site.social.linkedin      https://linkedin.com/in/...
```

Admin includes shortcuts for these keys.

### Per-route SEO

Studio Page settings support:

- SEO title;
- SEO description;
- canonical override;
- Open Graph image URL;
- noindex/sitemap exclusion.

Collection-detail pages automatically prefer the item's title/name, summary/short description and canonical cover/thumbnail/icon media.

### Server-visible metadata

The Public Web Vercel deployment includes a server-rendered HTML shell under `apps/web/api/` so crawlers/social preview bots receive metadata before React executes. It proxies release-aware SEO from the Platform API.

The production shell also proxies:

- `/sitemap.xml`;
- `/robots.txt`.

If Public Web is hosted somewhere other than Vercel, implement the equivalent edge/server rewrite; client-only SPA metadata is not sufficient for reliable social/search crawling.

### Structured data

The Active release can emit JSON-LD for:

- `WebSite`;
- `Person`;
- Notes → `BlogPosting`;
- Projects → `CreativeWork` / `SoftwareSourceCode`;
- AI Apps → `SoftwareApplication`.

## Performance / Core Web Vitals

Phase 6 runtime defaults:

- images lazy-load and decode asynchronously unless explicitly overridden;
- audio/video default to metadata-only preload;
- public bundles build without source maps;
- public asset filenames are deterministic for the server-rendered shell;
- CDN cache headers reduce repeat origin traffic.

For the first real visual layout, keep hero/LCP imagery intentionally eager rather than relying on the default lazy behavior: the Studio should explicitly set `loading="eager"` on the single LCP/hero image when appropriate.

## Deployment order

1. Run automated Phase 6 tests locally.
2. Apply migration 01800.
3. Configure Supabase CAPTCHA/auth limits.
4. Enroll privileged MFA, test it, then enable AAL2 requirement.
5. Deploy API with strict production environment.
6. Deploy Public Web/Admin/Studio behind HTTPS edge protection.
7. Configure WAF/edge rate rules.
8. Verify `/health` and `/ready`.
9. Verify Admin/Studio noindex.
10. Verify Public Web server HTML metadata, `/robots.txt`, `/sitemap.xml`.
11. Run staging load smoke.
12. Activate the first real production release only after the checks pass.
