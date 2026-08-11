import { fetchPlatform, htmlSecurityHeaders, publicSiteOrigin, setHeaders } from './_shared.mjs'

export default async function handler(req, res) {
  setHeaders(res, htmlSecurityHeaders(req))
  try {
    const origin = publicSiteOrigin(req)
    const upstream = await fetchPlatform(`/api/public/sitemap.xml${origin ? `?origin=${encodeURIComponent(origin)}` : ''}`, { headers: { Accept: 'application/xml,text/xml' } })
    const body = await upstream.text()
    res.statusCode = upstream.status
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800')
    res.end(body)
  } catch {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end('Sitemap temporarily unavailable\n')
  }
}
