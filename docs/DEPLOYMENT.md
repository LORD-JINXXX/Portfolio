# Production deployment model — Phase 6

The monorepo contains four independently deployable applications:

- `@platform/web` — public Active-release runtime + server-visible SEO shell.
- `@platform/admin` — authenticated/noindex Admin CMS.
- `@platform/studio` — authenticated/noindex UI/UX Studio.
- `@platform/api` — trusted service-role boundary, security controls, public release API.

A Studio publish, Content publish, Settings publish, Draft/Ready release, or preview does **not** change production. Only controlled Admin release activation changes Public Web.

## Root verification

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:static
npm run test:security
```

Independent development/build commands remain available:

```bash
npm run dev:web
npm run dev:admin
npm run dev:studio
npm run dev:api
npm run build:web
npm run build:admin
npm run build:studio
npm run build:api
```

## Database

Phase 5 should already be applied through `01700`. Phase 6 adds:

```text
20260811001800_phase6_security_scaling_foundation.sql
```

Before applying any new production migration:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Review the exact pending list, then apply only when it matches the repository plan.

## Platform API

Use a managed container/app platform capable of running multiple stateless instances behind a load balancer. The supplied `Dockerfile.api` is an optional production container entrypoint.

Required server-only values include:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NODE_ENV=production
DEV_BYPASS_AUTH=false
PUBLIC_WEB_RUNTIME_VERSION=1.0.0
PUBLIC_SITE_URL=https://www.example.com
ALLOWED_ORIGINS=https://www.example.com,https://admin.example.com,https://studio.example.com

SECURITY_MODE=strict
TRUST_PROXY_HOPS=<actual trusted proxy hop count>
RATE_LIMIT_STORE=supabase
RATE_LIMIT_HASH_SECRET=<random 32+ character secret>
REQUIRE_PRIVILEGED_AAL2=true
```

Do not guess `TRUST_PROXY_HOPS`; set it according to the actual hosting/edge chain so client IP rate limiting cannot be spoofed through untrusted forwarded headers.

Generate the rate-limit HMAC secret with a cryptographically secure generator, for example:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Expose `/health` for liveness and `/ready` for dependency readiness. Prefer edge/load-balancer rules that allow expected probe sources and do not advertise `/ready` as a public application endpoint. The API also applies a bounded process-level probe limiter as origin self-protection.

## Public Web

Recommended deployment: Vercel project rooted at `apps/web` (or an equivalent host that supports edge/server HTML rewrites).

Frontend/browser values:

```text
VITE_API_URL=https://api.example.com
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...
```

Server/edge values for SEO shell:

```text
PLATFORM_API_URL=https://api.example.com
PUBLIC_SITE_URL=https://www.example.com
VITE_PUBLIC_SITE_URL=https://www.example.com
```

`apps/web/vercel.json` routes browser pages through an SEO HTML shell while allowing built assets/functions through the filesystem handler. It also proxies `/robots.txt` and `/sitemap.xml` from the Active release.

If hosting Public Web somewhere other than Vercel, reproduce the same behavior: every browser route should return HTML containing release-aware metadata before React executes.

## Admin / Studio

Deploy as separate origins. Their Vercel configs/HTML explicitly mark all routes `noindex,nofollow,noarchive` and add browser security headers.

Frontend values only:

```text
VITE_API_URL=https://api.example.com
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...
```

Admin and Studio use the same Supabase Auth CAPTCHA configuration as Public Web in production. Never add `SUPABASE_SERVICE_ROLE_KEY` to either frontend or any `VITE_*` variable.

## Edge / WAF / DDoS

Application rate limiting is not a network-level DDoS solution. Put public hostnames behind managed CDN/DDoS/WAF protection and configure bot/rate rules before announcing the site publicly. See `docs/PHASE6_SECURITY_SCALING_SEO.md` for the full checklist.

## Final gate

Follow `docs/PHASE6_TEST_PLAN.md`, then configure the first real website layout and create/validate/activate a release through the existing controlled release workflow.
