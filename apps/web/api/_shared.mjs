const textEncoder = new TextEncoder()

function normalizeOrigin(value) {
  try { return new URL(String(value || '')).origin } catch { return '' }
}

export function platformApiUrl() {
  return String(process.env.PLATFORM_API_URL || process.env.VITE_API_URL || '').trim().replace(/\/+$/, '')
}

export function publicSiteOrigin(req) {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || '').trim()
  if (configured) return normalizeOrigin(configured)
  // Production SEO must never derive canonical authority from an attacker-controlled
  // Host/X-Forwarded-Host header. Local development may use the request host.
  if (process.env.NODE_ENV === 'production') return ''
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim()
  return host ? `${proto}://${host}` : ''
}

export function normalizePublicPath(value) {
  const raw = Array.isArray(value) ? value[0] : String(value || '/')
  let decoded = raw
  try { decoded = decodeURIComponent(raw) } catch {}
  if (!decoded.startsWith('/')) decoded = `/${decoded}`
  const path = decoded.split('#')[0].split('?')[0].replace(/\/{2,}/g, '/')
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path || '/'
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

export function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function sourceFromUrl(value) {
  const origin = normalizeOrigin(value)
  return origin || ''
}

function websocketSource(value) {
  const origin = sourceFromUrl(value)
  if (!origin) return ''
  try {
    const url = new URL(origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.origin
  } catch { return '' }
}

export function htmlSecurityHeaders(req, nonce = '') {
  const apiOrigin = sourceFromUrl(platformApiUrl())
  const supabaseOrigin = sourceFromUrl(process.env.VITE_SUPABASE_URL)
  const supabaseWs = websocketSource(process.env.VITE_SUPABASE_URL)
  const captchaProvider = String(process.env.VITE_CAPTCHA_PROVIDER || '').trim().toLowerCase()
  const connect = new Set(["'self'", apiOrigin, supabaseOrigin, supabaseWs].filter(Boolean))
  const script = new Set(["'self'"])
  if (nonce) script.add(`'nonce-${nonce}'`)
  const frame = new Set()
  if (captchaProvider === 'turnstile') {
    script.add('https://challenges.cloudflare.com')
    frame.add('https://challenges.cloudflare.com')
    connect.add('https://challenges.cloudflare.com')
  }
  if (captchaProvider === 'hcaptcha') {
    script.add('https://js.hcaptcha.com')
    script.add('https://*.hcaptcha.com')
    frame.add('https://*.hcaptcha.com')
    connect.add('https://*.hcaptcha.com')
  }
  const csp = [
    "default-src 'self'",
    `script-src ${[...script].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${[...connect].join(' ')}`,
    frame.size ? `frame-src ${[...frame].join(' ')}` : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim()
  return {
    'Content-Security-Policy': csp,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...(forwardedProto === 'https' ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  }
}

export function setHeaders(res, headers) {
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value))
}

export async function fetchPlatform(path, init = {}) {
  const base = platformApiUrl()
  if (!base) throw new Error('PLATFORM_API_URL is not configured for the Public Web server-rendered shell')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  timeout.unref?.()
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'dynamic-portfolio-web-edge/0.6', ...(init.headers || {}) },
    })
  } finally { clearTimeout(timeout) }
}

export function weakEtag(input) {
  let hash = 2166136261
  for (const byte of textEncoder.encode(String(input || ''))) { hash ^= byte; hash = Math.imul(hash, 16777619) }
  return `W/\"${(hash >>> 0).toString(16)}\"`
}
