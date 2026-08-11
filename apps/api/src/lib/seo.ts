import type { RuntimeManifest, RuntimeRoute } from '@platform/contracts'

export interface SeoMetadata {
  title: string
  description: string
  canonical: string
  robots: string
  ogType: string
  image?: string
  siteName: string
  language: string
  jsonLd: Record<string, unknown>[]
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim()
}

function setting(manifest: RuntimeManifest, ...keys: string[]): string {
  for (const key of keys) {
    const value = stringValue(manifest.settings?.[key])
    if (value) return value
  }
  return ''
}

function normalizeOrigin(raw: string): string {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.origin
  } catch { return '' }
}

export function resolvePublicSiteOrigin(manifest: RuntimeManifest, fallback = ''): string {
  return normalizeOrigin(setting(manifest, 'seo.site_url', 'site.url', 'site.public_url') || fallback)
}

function normalizePath(pathname: string): string {
  const raw = `/${String(pathname || '/').split('?')[0].split('#')[0]}`.replace(/\/{2,}/g, '/')
  return raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function compilePattern(pattern: string) {
  const names: string[] = []
  const normalized = normalizePath(pattern || '/')
  const segments = normalized.split('/').filter(Boolean)
  const source = segments.map((segment) => {
    if (segment.startsWith(':')) { names.push(segment.slice(1)); return '([^/]+)' }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('/')
  const score = segments.reduce((total, segment) => total + (segment.startsWith(':') ? 10 : 100) + segment.length, segments.length * 1000)
  return { regex: new RegExp(`^/${source}/?$`), names, score }
}

export function matchSeoRoute(routes: RuntimeRoute[], pathname: string): { route: RuntimeRoute; params: Record<string, string> } | null {
  const normalized = normalizePath(pathname)
  const candidates = routes.map((route) => ({ route, compiled: compilePattern(route.path) }))
    .sort((a, b) => b.compiled.score - a.compiled.score || a.route.path.localeCompare(b.route.path))
  for (const candidate of candidates) {
    const match = normalized.match(candidate.compiled.regex)
    if (!match) continue
    const params: Record<string, string> = {}
    candidate.compiled.names.forEach((name, index) => { try { params[name] = decodeURIComponent(match[index + 1]) } catch { params[name] = match[index + 1] } })
    return { route: candidate.route, params }
  }
  return null
}

function fieldContext(manifest: RuntimeManifest, route: RuntimeRoute, params: Record<string, string>): Record<string, unknown> | undefined {
  if (route.pageType !== 'collection_detail' || !route.collectionName) return undefined
  const identifier = params.slug ?? params.id ?? Object.values(params)[0]
  return (manifest.collections?.[route.collectionName] || []).find((item: any) => String(item?.slug ?? item?.id) === String(identifier)) as Record<string, unknown> | undefined
}

function mediaUrl(manifest: RuntimeManifest, field: Record<string, unknown> | undefined, seo: Record<string, unknown>): string {
  const mediaId = field?.cover_media_id ?? field?.thumbnail_media_id ?? field?.icon_media_id ?? seo.ogMediaId ?? seo.og_media_id
  if (typeof mediaId === 'string' && manifest.media?.[mediaId]?.url) return manifest.media[mediaId].url
  const candidate = stringValue(field?.cover_image ?? field?.thumbnail ?? field?.icon ?? seo.ogImage ?? seo.og_image ?? setting(manifest, 'seo.default_og_image'))
  if (!candidate) return ''
  const origin = resolvePublicSiteOrigin(manifest)
  try {
    const parsed = origin ? new URL(candidate, `${origin}/`) : new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''
  } catch { return '' }
}

function absoluteCanonical(origin: string, path: string, requested: unknown): string {
  const requestedValue = stringValue(requested)
  if (requestedValue) {
    try {
      const parsed = new URL(requestedValue, origin || 'https://invalid.local')
      if (['http:', 'https:'].includes(parsed.protocol) && origin) return new URL(parsed.pathname + parsed.search, origin).href
    } catch {}
  }
  return origin ? new URL(normalizePath(path), `${origin}/`).href : normalizePath(path)
}

function socialUrls(manifest: RuntimeManifest): string[] {
  return ['site.social.github', 'site.social.linkedin', 'site.social.twitter', 'site.social.x', 'site.social.youtube']
    .map((key) => setting(manifest, key)).filter(Boolean)
}

function structuredData(manifest: RuntimeManifest, route: RuntimeRoute, field: Record<string, unknown> | undefined, meta: Omit<SeoMetadata, 'jsonLd'>): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = []
  const ownerName = setting(manifest, 'site.owner_name', 'person.name', 'site.name')
  let siteUrl = meta.canonical
  try { if (meta.canonical) siteUrl = new URL('/', meta.canonical).href } catch {}
  graph.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: meta.siteName, url: siteUrl })
  if (ownerName) graph.push({ '@context': 'https://schema.org', '@type': 'Person', name: ownerName, url: siteUrl || meta.canonical, sameAs: socialUrls(manifest) })
  if (!field) return graph

  const base = { '@context': 'https://schema.org', name: stringValue(field.title || field.name), description: meta.description, url: meta.canonical, ...(meta.image ? { image: meta.image } : {}) }
  if (route.collectionName === 'notes') {
    graph.push({ ...base, '@type': 'BlogPosting', datePublished: stringValue(field.published_at || field.created_at) || undefined, dateModified: stringValue(field.updated_at) || undefined, author: ownerName ? { '@type': 'Person', name: ownerName } : undefined })
  } else if (route.collectionName === 'projects') {
    graph.push({ ...base, '@type': field.github_url ? 'SoftwareSourceCode' : 'CreativeWork', codeRepository: stringValue(field.github_url) || undefined, url: stringValue(field.live_url) || meta.canonical })
  } else if (route.collectionName === 'apps') {
    graph.push({ ...base, '@type': 'SoftwareApplication', applicationCategory: stringValue(field.category) || 'WebApplication', operatingSystem: 'Web' })
  }
  return graph
}

export function resolveSeoMetadata(manifest: RuntimeManifest, pathname: string, fallbackOrigin = ''): SeoMetadata | null {
  const matched = matchSeoRoute(manifest.routes, pathname)
  if (!matched) return null
  const field = fieldContext(manifest, matched.route, matched.params)
  if (matched.route.pageType === 'collection_detail' && !field) return null
  const seo = matched.route.seo || {}
  const siteName = setting(manifest, 'seo.site_name', 'site.name') || 'Portfolio'
  const itemTitle = stringValue(field?.title || field?.name || seo.title || matched.route.name) || siteName
  const titleTemplate = setting(manifest, 'seo.title_template')
  const title = titleTemplate && itemTitle !== siteName ? titleTemplate.replace(/%site%/g, siteName).replace(/%s/g, itemTitle) : itemTitle
  const description = stringValue(field?.summary || field?.short_description || seo.description || setting(manifest, 'seo.default_description', 'site.description')).slice(0, 320)
  const origin = resolvePublicSiteOrigin(manifest, fallbackOrigin)
  const canonical = absoluteCanonical(origin, pathname, seo.canonical)
  const image = mediaUrl(manifest, field, seo)
  const noindex = Boolean(seo.noindex)
  const base = {
    title,
    description,
    canonical,
    robots: noindex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large',
    ogType: matched.route.collectionName === 'notes' ? 'article' : 'website',
    image: image || undefined,
    siteName,
    language: setting(manifest, 'seo.language', 'site.language') || 'en',
  }
  return { ...base, jsonLd: structuredData(manifest, matched.route, field, base) }
}

function encodeXml(value: unknown): string {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] || character))
}

function expandRoutePath(route: RuntimeRoute, item: any): string | null {
  if (!route.path.includes(':')) return normalizePath(route.path)
  let result = route.path
  for (const name of Array.from(route.path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)).map((match) => match[1])) {
    const value = item?.[name] ?? (name === 'slug' ? item?.slug : name === 'id' ? item?.id : undefined)
    if (value === undefined || value === null || value === '') return null
    result = result.replace(`:${name}`, encodeURIComponent(String(value)))
  }
  return normalizePath(result)
}

function safeIso(value: string | undefined): string | undefined {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined
}

export function buildSitemapXml(manifest: RuntimeManifest, fallbackOrigin = ''): string {
  const origin = resolvePublicSiteOrigin(manifest, fallbackOrigin)
  if (!origin) throw new Error('A public site URL is required to generate sitemap.xml')
  const entries = new Map<string, string | undefined>()
  for (const route of manifest.routes) {
    if (Boolean(route.seo?.noindex)) continue
    if (route.pageType === 'collection_detail' && route.collectionName) {
      for (const item of manifest.collections?.[route.collectionName] || []) {
        const path = expandRoutePath(route, item)
        if (!path) continue
        entries.set(new URL(path, `${origin}/`).href, stringValue((item as any)?.updated_at || (item as any)?.created_at) || undefined)
      }
    } else if (!route.path.includes(':')) {
      entries.set(new URL(normalizePath(route.path), `${origin}/`).href, manifest.generatedAt)
    }
  }
  const body = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([location, modified]) => {
    const lastModified = safeIso(modified)
    return `  <url><loc>${encodeXml(location)}</loc>${lastModified ? `<lastmod>${encodeXml(lastModified)}</lastmod>` : ''}</url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function buildRobotsTxt(manifest: RuntimeManifest, fallbackOrigin = ''): string {
  const origin = resolvePublicSiteOrigin(manifest, fallbackOrigin)
  const sitemap = origin ? `${origin}/sitemap.xml` : ''
  return ['User-agent: *', 'Allow: /', 'Disallow: /login', 'Disallow: /register', 'Disallow: /dashboard', sitemap ? `Sitemap: ${sitemap}` : ''].filter(Boolean).join('\n') + '\n'
}
