import React from 'react'
import { createBrowserSupabaseClient } from '@platform/supabase'
import { apiFetch } from './api'

function browserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && key ? createBrowserSupabaseClient(url, key) : null
}

async function hydrateStoredSession() {
  if (sessionStorage.getItem('portfolio-access-token')) return
  const client = browserClient()
  if (!client) return
  const { data } = await client.auth.getSession()
  if (data.session?.access_token) sessionStorage.setItem('portfolio-access-token', data.session.access_token)
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<'checking'|'allowed'|'login'|'denied'>('checking')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')

  const check = React.useCallback(async () => {
    try {
      await hydrateStoredSession()
      await apiFetch('/api/studio/me')
      setState('allowed')
    } catch (err: any) {
      setState(err.status === 403 ? 'denied' : 'login')
    }
  }, [])
  React.useEffect(() => { check() }, [check])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const client = browserClient()
      if (!client) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable DEV_BYPASS_AUTH in the API for local development.')
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError || !data.session) throw signInError || new Error('No session returned')
      sessionStorage.setItem('portfolio-access-token', data.session.access_token)
      await check()
    } catch (err: any) { setError(err.message || 'Sign in failed') }
  }

  if (state === 'checking') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)' }}>Checking Studio access…</div>
  if (state === 'allowed') return <>{children}</>
  if (state === 'denied') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><div><h2>Studio access required</h2><p style={{color:'var(--text-muted)'}}>This account is not an admin, designer, or editor.</p></div></div>
  return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><form onSubmit={signIn} style={{ width:360,padding:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}><h1 style={{marginTop:0}}>UI/UX Studio</h1><p style={{color:'var(--text-muted)'}}>Admin or designer access is required.</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required style={input}/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required style={input}/>{error&&<p style={{color:'var(--danger)',fontSize:13}}>{error}</p>}<button style={button}>Sign in</button></form></div>
}
const input: React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 12px',marginBottom:10,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button: React.CSSProperties={width:'100%',padding:'10px 12px',border:0,borderRadius:7,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
