# Phase 6 Test Plan

## A. Automated repository checks

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm run test:static
npm run test:security
```

Do not use `npm audit fix --force`. Review `npm audit` findings individually.

## B. Migration 01800

Before applying:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Expected new migration: `20260811001800_phase6_security_scaling_foundation.sql` only (assuming Phase 5 is already through 01700).

After review:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
```

Verify browser `anon`/`authenticated` cannot execute the two security RPCs or directly read draft/publication tables that Phase 6 revoked.

## C. Local security checks

- `/health` returns platform `0.6.0`.
- `/ready` returns 200 with Supabase available and 503 when dependency access is unavailable.
- API response does not contain `X-Powered-By`.
- Admin/Studio API responses have `Cache-Control: no-store` and `X-Robots-Tag: noindex...`.
- malformed JSON → controlled 400;
- oversized JSON → 413;
- wrong mutation content type → 415;
- unknown API route → safe 404 + request ID;
- CORS from an unapproved origin is denied;
- rate-limit threshold returns 429 rather than crashing.

## D. Supabase Auth abuse controls

- configure Turnstile/hCaptcha in Supabase;
- configure matching Web, Admin and Studio CAPTCHA env;
- production Public/Admin/Studio password authentication cannot submit until the challenge completes;
- invalid login response is generic;
- normal login still succeeds;
- account confirmation flow still succeeds.

## E. Privileged MFA

Perform only after an Admin account has a verified factor:

- API with `REQUIRE_PRIVILEGED_AAL2=true` rejects AAL1 Admin request with `MFA_REQUIRED`;
- Admin/Studio show challenge UI;
- successful TOTP/phone factor creates AAL2 session;
- Admin/Studio then load normally;
- ordinary user remains forbidden regardless of MFA.

## F. SEO

With an Active release containing SEO settings:

```text
view-source:https://PUBLIC_DOMAIN/
```

Confirm server HTML already contains title, description, canonical, Open Graph, Twitter and JSON-LD before JavaScript runs.

Verify:

- `/robots.txt` returns text and references sitemap;
- `/sitemap.xml` contains only Active-release indexable routes/items;
- login/register/dashboard are noindex and absent from sitemap;
- Admin and Studio response/header/meta are noindex;
- unknown route returns 404/noindex;
- Project/Note detail metadata changes per item;
- Admin draft/content publication does not alter public SEO before activation;
- activation changes public SEO together with the release.

## G. Cache correctness

- repeated Public API GET produces cache headers and ETag;
- `If-None-Match` returns 304 for the same Active release;
- Admin/Studio routes never receive public cache headers;
- after activation, public manifest changes within configured cache propagation window;
- historical active-release media certification changes media-version ETag.

## H. Runtime performance

Inspect representative pages in browser DevTools:

- non-hero images default to `loading=lazy` and `decoding=async`;
- video/audio default to `preload=metadata`;
- explicitly configured hero/LCP image may use `loading=eager`;
- no source maps in production Public Web output;
- no large unexpected network loops.

## I. Scaling smoke (staging/local only)

```powershell
npm run test:load-smoke
```

Then use a controlled staging environment and measure p50/p95/p99, throughput, 429/5xx rate, API CPU/memory and Supabase DB load. Do not stress production.

## J. Edge/WAF

After deployment:

- HTTPS redirect works;
- WAF is enabled;
- bot challenge/rate rule protects auth paths;
- static assets are CDN cached;
- origin is not unintentionally exposed if provider architecture permits origin restriction;
- a blocked/rate-limited request does not reach the application origin when the edge can block it.
