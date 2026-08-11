import { randomBytes } from 'node:crypto'
import { escapeHtml, fetchPlatform, htmlSecurityHeaders, normalizePublicPath, publicSiteOrigin, safeJson, setHeaders, weakEtag } from './_shared.mjs'

const PRIVATE_PATHS = new Set(['/login', '/register', '/dashboard'])

function fallbackSeo(path, origin) {
  const privatePage = PRIVATE_PATHS.has(path)
  const title = path === '/login' ? 'Sign in' : path === '/register' ? 'Create account' : path === '/dashboard' ? 'Dashboard' : 'Portfolio'
  return {
    title,
    description: privatePage ? 'Private portfolio account page.' : 'Portfolio',
    canonical: origin ? new URL(path, `${origin}/`).href : '',
    robots: privatePage ? 'noindex,nofollow,noarchive' : 'noindex,nofollow',
    ogType: 'website',
    siteName: 'Portfolio',
    jsonLd: null,
  }
}

function renderDocument(seo, path, nonce) {
  const title = escapeHtml(seo.title || 'Portfolio')
  const description = escapeHtml(seo.description || '')
  const canonical = escapeHtml(seo.canonical || '')
  const robots = escapeHtml(seo.robots || 'noindex,nofollow')
  const siteName = escapeHtml(seo.siteName || 'Portfolio')
  const image = seo.image ? escapeHtml(seo.image) : ''
  const ogType = escapeHtml(seo.ogType || 'website')
  const jsonLd = seo.jsonLd ? `<script nonce="${escapeHtml(nonce)}" type="application/ld+json">${safeJson(seo.jsonLd)}</script>` : ''
  return `<!doctype html>
<html lang="${escapeHtml(seo.language || 'en')}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="csp-nonce" content="${escapeHtml(nonce)}" />
    <meta name="csp-nonce" content="${escapeHtml(nonce)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    ${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="${siteName}" />
    ${canonical ? `<meta property="og:url" content="${canonical}" />` : ''}
    ${image ? `<meta property="og:image" content="${image}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
    ${jsonLd}
    <style>
      :root{--bg:#010101;--surface:#0d0d0f;--surface-alt:#121214;--border:#1e1e23;--text:#e6e6e6;--text-muted:#8a8a94;--text-secondary:#b3b3bd;--primary:#2563eb;--primary-hover:#1d4ed8;--primary-text:#fff;--danger:#ef4444;--warning:#f59e0b;--success:#10b981;--accent:#8b5cf6;--canvas:#0a0a0a;--shadow:rgba(0,0,0,.5)}
      html,body,#root{min-height:100%;margin:0} body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text)} *,*::before,*::after{box-sizing:border-box}
    </style>
    <title>${title}</title>
  </head>
  <body data-request-path="${escapeHtml(path)}">
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`
}

export default async function handler(req, res) {
  const nonce = randomBytes(18).toString('base64')
  setHeaders(res, htmlSecurityHeaders(req, nonce))
  const path = normalizePublicPath(req.query?.path || req.url || '/')
  const origin = publicSiteOrigin(req)
  let seo = fallbackSeo(path, origin)
  let status = path.startsWith('/assets/') || path.startsWith('/api/') ? 404 : 200
  const missingProductionOrigin = process.env.NODE_ENV === 'production' && !origin
  if (missingProductionOrigin) {
    seo = { ...seo, title: 'Portfolio unavailable', description: 'Public site configuration is incomplete.', robots: 'noindex,nofollow,noarchive' }
    status = 503
  } else if (!PRIVATE_PATHS.has(path)) {
    try {
      const upstream = await fetchPlatform(`/api/public/seo?path=${encodeURIComponent(path)}${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`)
      if (upstream.ok) {
        const payload = await upstream.json()
        seo = { ...seo, ...(payload?.data || {}) }
        status = 200
      } else if (upstream.status === 404) {
        seo = { ...seo, title: 'Page not found', description: 'This page is not part of the active portfolio release.', robots: 'noindex,nofollow,noarchive' }
        status = 404
      }
    } catch {
      // Fail closed for SEO/indexing if the release API is unavailable. The hydrated
      // client still renders its controlled runtime-unavailable state.
      seo = { ...seo, robots: 'noindex,nofollow,noarchive' }
      status = 503
    }
  }
  const html = renderDocument(seo, path, nonce)
  const etag = weakEtag(`${status}:${seo.canonical}:${seo.title}:${seo.description}:${seo.image || ''}`)
  if (req.headers?.['if-none-match'] === etag) { res.statusCode = 304; res.end(); return }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', PRIVATE_PATHS.has(path) ? 'private, no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  res.setHeader('X-Robots-Tag', seo.robots || 'noindex,nofollow')
  res.statusCode = status
  res.end(html)
}
