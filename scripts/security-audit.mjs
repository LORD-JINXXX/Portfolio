import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const warnings = []
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative) => fs.existsSync(path.join(root, relative))
const fail = (message) => failures.push(message)
const warn = (message) => warnings.push(message)

for (const app of ['web', 'admin', 'studio']) {
  const appRoot = path.join(root, 'apps', app)
  const files = fs.readdirSync(path.join(appRoot, 'src'), { recursive: true }).filter((entry) => typeof entry === 'string' && /\.(?:ts|tsx|js|jsx)$/.test(entry))
  for (const file of files) {
    const content = fs.readFileSync(path.join(appRoot, 'src', file), 'utf8')
    if (/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i.test(content)) fail(`${app}/src/${file} contains a service-role reference`)
  }
  const index = read(`apps/${app}/index.html`)
  if (app !== 'web' && !/noindex,nofollow,noarchive/.test(index)) fail(`${app} index.html is missing explicit noindex metadata`)
}

const api = read('apps/api/src/index.ts')
if (!/allowedOrigins\.includes\('\*'\).*throw new Error\('Wildcard CORS origins are not allowed'\)/s.test(api)) fail('API does not fail closed on wildcard CORS')
if (/origin\s*:\s*['\"]\*['\"]|callback\(null,\s*true\).*includes\('\*'\)/s.test(api)) fail('API contains a permissive wildcard CORS path')
if (!/DEV_BYPASS_AUTH must be false in production/.test(api)) fail('API lacks production auth-bypass fail-closed guard')
if (!/app\.disable\('x-powered-by'\)/.test(api)) fail('API does not disable X-Powered-By')
if (!/loadSecurityConfig/.test(api) || !/createMemoryRateLimiter/.test(api)) fail('API security/rate-limit middleware is not wired')
if (!/server\.requestTimeout/.test(api) || !/server\.headersTimeout/.test(api)) fail('API server timeouts are not configured')
if (!/PUBLIC_SITE_URL must be an explicit HTTPS origin in production/.test(api)) fail('API does not fail closed on missing/insecure production PUBLIC_SITE_URL')
if (!/infrastructureProbeLimiter/.test(api)) fail('Health/readiness endpoints are missing bounded origin probe protection')

const security = read('apps/api/src/lib/security.ts')
if (!/Strict production mode requires REQUIRE_PRIVILEGED_AAL2=true/.test(security)) fail('Strict production mode does not require privileged AAL2')
if (!/strongRateLimitSecret/.test(security) || !/random high-entropy secret/.test(security)) fail('Strict production mode does not reject weak rate-limit HMAC secrets')

const migration = read('supabase/migrations/20260811001800_phase6_security_scaling_foundation.sql')
if (!/revoke all on function public\.consume_security_rate_limit.*anon, authenticated/i.test(migration)) fail('Shared rate-limit RPC is not browser-revoked')
if (!/consume_security_daily_quota/.test(migration)) fail('Per-user daily quota primitive is missing')

for (const app of ['admin', 'studio']) {
  const authGate = read(`apps/${app}/src/AuthGate.tsx`)
  if (!/CAPTCHA_MISCONFIGURED/.test(authGate) || !/captchaToken/.test(authGate)) fail(`${app} production password login is not fail-closed on CAPTCHA configuration`)
  const vercel = read(`apps/${app}/vercel.json`)
  if (!/challenges\.cloudflare\.com/.test(vercel) || !/hcaptcha\.com/.test(vercel)) fail(`${app} production CSP does not permit the configured CAPTCHA providers`)
}
const webCaptcha = read('apps/web/src/Captcha.tsx')
if (!/import\.meta\.env\.PROD/.test(webCaptcha) || !/captchaConfigurationMissing/.test(webCaptcha)) fail('Public Web production auth does not fail closed when CAPTCHA is missing')

const webVercel = read('apps/web/vercel.json')
if (!/api\/render/.test(webVercel) || !/sitemap\.xml/.test(webVercel) || !/robots\.txt/.test(webVercel)) fail('Public Web production SEO shell routing is incomplete')
if (!exists('apps/web/api/render.mjs')) fail('Public Web server-rendered metadata function is missing')

for (const app of ['web', 'admin', 'studio', 'api']) {
  if (exists(`apps/${app}/.env`)) warn(`apps/${app}/.env exists locally; verify it remains ignored and never committed`)
}

if (failures.length) {
  console.error('Phase 6 security audit FAILED')
  failures.forEach((item) => console.error(`- ${item}`))
  process.exitCode = 1
} else {
  console.log('Phase 6 security audit PASS')
}
if (warnings.length) {
  console.warn('Warnings:')
  warnings.forEach((item) => console.warn(`- ${item}`))
}
