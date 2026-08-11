import React from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { RUNTIME_VERSION, type DesignTokens, type RuntimeManifest, type RuntimeRoute } from '@platform/contracts'
import { RuntimeSitePreview, isRuntimeManifestCompatible, matchRuntimeRoute, sanitizeRuntimeUrl } from '@platform/runtime-renderer'
import { createBrowserSupabaseClient } from '@platform/supabase'
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
    publicFetch<{ data: RuntimeManifest }>('/api/public/runtime')
      .then((response) => setManifest(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load the active release.'))
      .finally(() => setLoading(false))
  }, [])

  if (location.pathname === '/login') return <AuthPage mode="login" />
  if (location.pathname === '/register') return <AuthPage mode="register" />
  if (location.pathname.startsWith('/dashboard')) return <Dashboard />
  if (loading) return <Fallback>Loading portfolio…</Fallback>
  if (error || !manifest) return <Fallback><div><h1>No active portfolio release</h1><p>{error || 'Create and activate a release from Admin.'}</p></div></Fallback>
  if (!isRuntimeManifestCompatible(manifest.runtimeMinVersion, RUNTIME_VERSION)) {
    return <Fallback><div><h1>Portfolio runtime update required</h1><p>The active release requires runtime {manifest.runtimeMinVersion}; this deployment is {RUNTIME_VERSION}.</p></div></Fallback>
  }

  const match = matchRuntimeRoute(manifest.routes, location.pathname)
  if (!match) return <Fallback><div><h1>404</h1><p>This route is not part of the active layout.</p></div></Fallback>
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
  if (route.pageType === 'collection_detail' && !fieldContext) return <Fallback><div><h1>404</h1><p>This item is not available in the active release.</p></div></Fallback>
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

function resolveSeoImage(manifest: RuntimeManifest, field: Record<string, unknown> | undefined, seo: Record<string, unknown>): string {
  const mediaId = field?.cover_media_id ?? field?.thumbnail_media_id ?? field?.icon_media_id ?? seo.ogMediaId ?? seo.og_media_id
  if (typeof mediaId === 'string' && manifest.media[mediaId]?.url) return manifest.media[mediaId].url
  const legacy = field?.cover_image ?? field?.thumbnail ?? field?.icon ?? seo.ogImage ?? seo.og_image
  return typeof legacy === 'string' ? sanitizeRuntimeUrl(legacy, 'src') || '' : ''
}

function useSeo(manifest: RuntimeManifest, route: RuntimeRoute, field?: Record<string, unknown>) {
  React.useEffect(() => {
    const seo = route.seo || {}
    const title = String(field?.title || field?.name || seo.title || route.name || 'Portfolio')
    const description = String(field?.summary || field?.short_description || seo.description || '')
    const image = resolveSeoImage(manifest, field, seo)
    document.title = title
    const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null
      if (!element) { element = document.createElement('meta'); element.setAttribute(attr, key); document.head.appendChild(element) }
      element.content = value
    }
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    if (image) setMeta('meta[property="og:image"]', 'property', 'og:image', image)
    setMeta('meta[name="robots"]', 'name', 'robots', seo.noindex ? 'noindex,nofollow' : 'index,follow')
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    const requestedCanonical = typeof seo.canonical === 'string' ? sanitizeRuntimeUrl(seo.canonical, 'href') : undefined
    let canonicalUrl = `${window.location.origin}${window.location.pathname}`
    if (requestedCanonical) {
      try {
        const parsed = new URL(requestedCanonical, window.location.origin)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') canonicalUrl = parsed.href
      } catch {}
    }
    canonical.href = canonicalUrl
  }, [manifest, route, field])
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
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [message, setMessage] = React.useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const client = supabase()
      if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error; navigate('/dashboard')
      } else {
        const { error } = await client.auth.signUp({ email, password }); if (error) throw error; setMessage('Registration created. Verify your email if verification is enabled.')
      }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Authentication failed') }
  }
  return <Fallback><form onSubmit={submit} style={card}><h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1><input style={input} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" /><input style={input} type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />{message && <p>{message}</p>}<div style={authActions}><button style={button}>{mode === 'login' ? 'Sign in' : 'Register'}</button><a style={authLink} href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create account' : 'Already registered?'}</a></div></form></Fallback>
}

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = React.useState<any>(null)
  React.useEffect(() => { try { supabase().auth.getUser().then(({ data }) => { if (!data.user) navigate('/login'); else setUser(data.user) }) } catch { navigate('/login') } }, [navigate])
  return <Fallback><div style={{ ...card, width: 'min(720px,90vw)' }}><h1>User Dashboard</h1><p>Signed in as {user?.email || '…'}</p><nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span style={pill}>Resumes</span><span style={pill}>History</span><span style={pill}>Settings</span></nav><p style={{ color: '#64748b' }}>AI execution remains deferred; this authenticated shell is ready for the future agent platform.</p><button style={button} onClick={async () => { await supabase().auth.signOut(); navigate('/login') }}>Sign out</button></div></Fallback>
}

function Fallback({ children }: { children: React.ReactNode }) { return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif', background: '#07070a', color: '#f8fafc' }}>{children}</div> }
const card: React.CSSProperties = { width: 360, padding: 24, border: '1px solid #27272f', borderRadius: 14, background: '#101016' }
const input: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '10px 0', padding: 11, border: '1px solid #333', borderRadius: 7, background: '#181822', color: 'white' }
const button: React.CSSProperties = { padding: '10px 14px', border: 0, borderRadius: 7, background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer' }
const authActions: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 14 }
const authLink: React.CSSProperties = { color: '#a78bfa', lineHeight: 1.4 }
const pill: React.CSSProperties = { padding: '7px 10px', border: '1px solid #333', borderRadius: 999 }
