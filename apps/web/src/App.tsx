import React from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { RUNTIME_VERSION, type DesignTokens, type RuntimeManifest, type RuntimeRoute } from '@platform/contracts'
import { RuntimeSitePreview, isRuntimeManifestCompatible, matchRuntimeRoute, sanitizeRuntimeUrl } from '@platform/runtime-renderer'
import { createBrowserSupabaseClient } from '@platform/supabase'
import { Captcha, captchaConfigurationMissing, captchaRequired } from './Captcha'
import { publicFetch } from './api'

export default function App() {
  return <BrowserRouter><RuntimeApp /></BrowserRouter>
}

function RuntimeApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const [manifest, setManifest] = React.useState<RuntimeManifest | null>(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    publicFetch<{ data: RuntimeManifest }>('/api/public/runtime')
      .then((response) => { if (!cancelled) setManifest(response.data) })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the active release.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (location.pathname === '/login') return <AuthPage mode="login" />
  if (location.pathname === '/register') return <AuthPage mode="register" />
  if (location.pathname.startsWith('/dashboard')) return <Dashboard />
  if (loading) return <StatusPage title="Loading portfolio…" noindex />
  if (error || !manifest) return <StatusPage title="No active portfolio release" message={error || 'Create and activate a release from Admin.'} noindex />
  if (!isRuntimeManifestCompatible(manifest.runtimeMinVersion, RUNTIME_VERSION)) {
    return <StatusPage title="Portfolio runtime update required" message={`The active release requires runtime ${manifest.runtimeMinVersion}; this deployment is ${RUNTIME_VERSION}.`} noindex />
  }

  const match = matchRuntimeRoute(manifest.routes, location.pathname)
  if (!match) return <NotFound />
  return <RenderedRuntimeRoute manifest={manifest} route={match.route} params={match.params} onNavigate={navigate} />
}

function RenderedRuntimeRoute({ manifest, route, params, onNavigate }: {
  manifest: RuntimeManifest
  route: RuntimeRoute
  params: Record<string, string>
  onNavigate: (href: string) => void
}) {
  const fieldContext = getFieldContext(manifest, route, params)
  useSeo(manifest, route, fieldContext)
  const mode = useResponsiveMode(manifest.designTokens)
  if (route.pageType === 'collection_detail' && !fieldContext) return <NotFound />
  return <RuntimeSitePreview manifest={manifest} route={route} mode={mode} fieldContext={fieldContext} linkMode="browser" onNavigate={(href) => {
    const safe = sanitizeRuntimeUrl(href, 'href')
    if (safe?.startsWith('/')) onNavigate(safe)
    else if (safe) window.location.assign(safe)
  }} />
}

function getFieldContext(manifest: RuntimeManifest, route: RuntimeRoute, params: Record<string, string>) {
  if (route.pageType !== 'collection_detail' || !route.collectionName) return undefined
  const identifier = params.slug ?? params.id ?? Object.values(params)[0]
  return (manifest.collections[route.collectionName] || []).find((item: any) => String(item?.slug ?? item?.id) === String(identifier)) as Record<string, unknown> | undefined
}

function setting(manifest: RuntimeManifest, ...keys: string[]): string {
  for (const key of keys) {
    const value = manifest.settings?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function resolveSeoImage(manifest: RuntimeManifest, field: Record<string, unknown> | undefined, seo: Record<string, unknown>): string {
  const mediaId = field?.cover_media_id ?? field?.thumbnail_media_id ?? field?.icon_media_id ?? seo.ogMediaId ?? seo.og_media_id
  if (typeof mediaId === 'string' && manifest.media[mediaId]?.url) return manifest.media[mediaId].url
  const legacy = field?.cover_image ?? field?.thumbnail ?? field?.icon ?? seo.ogImage ?? seo.og_image ?? setting(manifest, 'seo.default_og_image')
  const safe = typeof legacy === 'string' ? sanitizeRuntimeUrl(legacy, 'src') || '' : ''
  if (!safe) return ''
  try { return new URL(safe, `${setting(manifest, 'seo.site_url', 'site.url', 'site.public_url') || window.location.origin}/`).href } catch { return safe }
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, value?: string) {
  let element = document.querySelector(selector) as HTMLMetaElement | null
  if (!value) { element?.remove(); return }
  if (!element) { element = document.createElement('meta'); element.setAttribute(attr, key); document.head.appendChild(element) }
  element.content = value
}

function setCanonical(value?: string) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!value) { canonical?.remove(); return }
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
  canonical.href = value
}

function setStructuredData(entries: Record<string, unknown>[]) {
  document.querySelectorAll('script[data-portfolio-jsonld="true"]').forEach((node) => node.remove())
  const nonce = (document.querySelector('meta[name="csp-nonce"]') as HTMLMetaElement | null)?.content || ''
  for (const entry of entries) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.portfolioJsonld = 'true'
    if (nonce) script.nonce = nonce
    script.text = JSON.stringify(entry).replace(/</g, '\\u003c')
    document.head.appendChild(script)
  }
}

function absoluteCanonical(manifest: RuntimeManifest, seo: Record<string, unknown>): string {
  const configuredOrigin = setting(manifest, 'seo.site_url', 'site.url', 'site.public_url')
  let origin = window.location.origin
  try { if (configuredOrigin) origin = new URL(configuredOrigin).origin } catch {}
  const requested = typeof seo.canonical === 'string' ? sanitizeRuntimeUrl(seo.canonical, 'href') : undefined
  try {
    if (requested) {
      const parsed = new URL(requested, `${origin}/`)
      return new URL(`${parsed.pathname}${parsed.search}`, `${origin}/`).href
    }
    return new URL(window.location.pathname, `${origin}/`).href
  } catch { return `${window.location.origin}${window.location.pathname}` }
}

function buildClientStructuredData(manifest: RuntimeManifest, route: RuntimeRoute, field: Record<string, unknown> | undefined, title: string, description: string, canonical: string, image: string) {
  const siteName = setting(manifest, 'seo.site_name', 'site.name') || 'Portfolio'
  const ownerName = setting(manifest, 'site.owner_name', 'person.name', 'site.name')
  const entries: Record<string, unknown>[] = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: new URL('/', canonical).href }]
  if (ownerName) entries.push({ '@context': 'https://schema.org', '@type': 'Person', name: ownerName, url: canonical })
  if (!field) return entries
  const base = { '@context': 'https://schema.org', name: String(field.title || field.name || title), description, url: canonical, ...(image ? { image } : {}) }
  if (route.collectionName === 'notes') entries.push({ ...base, '@type': 'BlogPosting', datePublished: field.published_at || field.created_at, dateModified: field.updated_at })
  else if (route.collectionName === 'projects') entries.push({ ...base, '@type': field.github_url ? 'SoftwareSourceCode' : 'CreativeWork', codeRepository: field.github_url || undefined })
  else if (route.collectionName === 'apps') entries.push({ ...base, '@type': 'SoftwareApplication', applicationCategory: field.category || 'WebApplication', operatingSystem: 'Web' })
  return entries
}

function useSeo(manifest: RuntimeManifest, route: RuntimeRoute, field?: Record<string, unknown>) {
  React.useEffect(() => {
    const seo = route.seo || {}
    const siteName = setting(manifest, 'seo.site_name', 'site.name') || 'Portfolio'
    const itemTitle = String(field?.title || field?.name || seo.title || route.name || siteName)
    const template = setting(manifest, 'seo.title_template')
    const title = template && itemTitle !== siteName ? template.replace(/%site%/g, siteName).replace(/%s/g, itemTitle) : itemTitle
    const description = String(field?.summary || field?.short_description || seo.description || setting(manifest, 'seo.default_description', 'site.description') || '').slice(0, 320)
    const image = resolveSeoImage(manifest, field, seo)
    const canonical = absoluteCanonical(manifest, seo)
    const robots = seo.noindex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large'
    const ogType = route.collectionName === 'notes' ? 'article' : 'website'

    document.title = title
    document.documentElement.lang = setting(manifest, 'seo.language', 'site.language') || 'en'
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[name="robots"]', 'name', 'robots', robots)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:type"]', 'property', 'og:type', ogType)
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', siteName)
    setMeta('meta[property="og:image"]', 'property', 'og:image', image || undefined)
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', image ? 'summary_large_image' : 'summary')
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image || undefined)
    setCanonical(canonical)
    setStructuredData(buildClientStructuredData(manifest, route, field, title, description, canonical, image))
  }, [manifest, route, field])
}

function useStaticSeo(title: string, noindex = true) {
  React.useEffect(() => {
    document.title = title
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex,nofollow,noarchive' : 'index,follow')
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', undefined)
    setMeta('meta[property="og:image"]', 'property', 'og:image', undefined)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', undefined)
    setCanonical(noindex ? undefined : `${window.location.origin}${window.location.pathname}`)
    setStructuredData([])
  }, [title, noindex])
}

function useResponsiveMode(tokens: DesignTokens) {
  const breakpoints = tokens.breakpoints || {}
  const mobileMax = Number(breakpoints.mobile || 600)
  const tabletMax = Number(breakpoints.tablet || 1000)
  const calculate = (): 'desktop' | 'tablet' | 'mobile' => window.innerWidth <= mobileMax ? 'mobile' : window.innerWidth <= tabletMax ? 'tablet' : 'desktop'
  const [mode, setMode] = React.useState<'desktop' | 'tablet' | 'mobile'>(calculate)
  React.useEffect(() => { const handler = () => setMode(calculate()); window.addEventListener('resize', handler, { passive: true }); handler(); return () => window.removeEventListener('resize', handler) }, [mobileMax, tabletMax])
  return mode
}

let browserSupabase: ReturnType<typeof createBrowserSupabaseClient> | null = null
function supabase() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase frontend environment variables are missing.')
  if (!browserSupabase) browserSupabase = createBrowserSupabaseClient(url, key)
  return browserSupabase
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  useStaticSeo(mode === 'login' ? 'Sign in' : 'Create account')
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [captchaToken, setCaptchaToken] = React.useState('')
  const [captchaReset, setCaptchaReset] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const requireCaptcha = captchaRequired()
  const captchaMisconfigured = captchaConfigurationMissing()
  const onCaptchaToken = React.useCallback((token: string) => setCaptchaToken(token), [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (captchaMisconfigured) { setMessage('Authentication is temporarily unavailable because anti-bot protection is not configured.'); return }
    if (requireCaptcha && !captchaToken) { setMessage('Complete the anti-bot check before continuing.'); return }
    setSubmitting(true)
    setMessage('')
    try {
      const client = supabase()
      if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: captchaToken ? { captchaToken } : undefined })
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await client.auth.signUp({ email: email.trim().toLowerCase(), password, options: captchaToken ? { captchaToken } : undefined })
        if (error) throw error
        setMessage('Registration request accepted. Check your email for the verification step if email confirmation is enabled.')
      }
    } catch (reason) {
      // Keep public auth feedback intentionally generic to reduce account enumeration.
      console.warn('Authentication request was rejected', reason)
      setMessage(mode === 'login' ? 'Unable to sign in with those credentials.' : 'Registration could not be completed with those details.')
    } finally {
      setSubmitting(false)
      setCaptchaToken('')
      setCaptchaReset((value) => value + 1)
    }
  }
  return <Fallback><form onSubmit={submit} style={card}><h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1><input style={input} type="email" autoComplete="email" required disabled={submitting} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" /><input style={input} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : undefined} maxLength={128} required disabled={submitting} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Password' : 'Password (12+ characters)'} />{captchaMisconfigured && <p role="alert" style={{ color: '#f87171', lineHeight: 1.5 }}>Anti-bot protection must be configured before production authentication can be used.</p>}<Captcha onToken={onCaptchaToken} resetKey={captchaReset} />{message && <p role="status" style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{message}</p>}<div style={authActions}><button disabled={submitting || captchaMisconfigured || (requireCaptcha && !captchaToken)} style={{ ...button, opacity: submitting ? .65 : 1 }}>{submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}</button><a style={authLink} href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create account' : 'Already registered?'}</a></div></form></Fallback>
}

function Dashboard() {
  useStaticSeo('User Dashboard')
  const navigate = useNavigate()
  const [user, setUser] = React.useState<any>(null)
  React.useEffect(() => { try { supabase().auth.getUser().then(({ data }) => { if (!data.user) navigate('/login'); else setUser(data.user) }) } catch { navigate('/login') } }, [navigate])
  return <Fallback><div style={{ ...card, width: 'min(720px,90vw)' }}><h1>User Dashboard</h1><p>Signed in as {user?.email || '…'}</p><nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span style={pill}>Resumes</span><span style={pill}>History</span><span style={pill}>Settings</span></nav><p style={{ color: '#94a3b8' }}>AI execution remains deferred; authenticated usage controls are ready for future agents.</p><button style={button} onClick={async () => { await supabase().auth.signOut(); navigate('/login') }}>Sign out</button></div></Fallback>
}

function NotFound() { useStaticSeo('404 — Page not found'); return <Fallback><div><h1>404</h1><p>This route is not part of the active layout.</p></div></Fallback> }
function StatusPage({ title, message, noindex = true }: { title: string; message?: string; noindex?: boolean }) { useStaticSeo(title, noindex); return <Fallback><div><h1>{title}</h1>{message && <p>{message}</p>}</div></Fallback> }
function Fallback({ children }: { children: React.ReactNode }) { return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif', background: '#07070a', color: '#f8fafc' }}>{children}</div> }
const card: React.CSSProperties = { width: 360, maxWidth: 'calc(100vw - 48px)', padding: 24, border: '1px solid #27272f', borderRadius: 14, background: '#101016' }
const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '10px 0', padding: 11, border: '1px solid #333', borderRadius: 7, background: '#181822', color: 'white' }
const button: React.CSSProperties = { padding: '10px 14px', border: 0, borderRadius: 7, background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer' }
const authActions: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 18 }
const authLink: React.CSSProperties = { color: '#a78bfa', lineHeight: 1.5, padding: '6px 2px' }
const pill: React.CSSProperties = { padding: '7px 10px', border: '1px solid #333', borderRadius: 999 }
