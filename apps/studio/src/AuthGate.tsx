import React from 'react'
import type { Session } from '@platform/supabase'
import { apiFetch } from './api'
import { getCurrentStudioSession, getStudioSupabaseClient, onStudioSessionExpired, STUDIO_SESSION_EXPIRED_MESSAGE, StudioSessionExpiredError } from './auth'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<'checking'|'allowed'|'login'|'denied'>('checking')
  const [session, setSession] = React.useState<Session | null>(null)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')

  const check = React.useCallback(async () => {
    try {
      const currentSession = await getCurrentStudioSession()
      if (!currentSession) { setSession(null); setState('login'); return }
      await apiFetch('/api/studio/me')
      setSession(currentSession)
      setState('allowed')
    } catch (caught: unknown) {
      const error = caught as { status?: number }
      setSession(null)
      setState(error.status === 403 ? 'denied' : 'login')
      if (caught instanceof StudioSessionExpiredError) setError(STUDIO_SESSION_EXPIRED_MESSAGE)
    }
  }, [])
  React.useEffect(() => {
    sessionStorage.removeItem('portfolio-access-token')
    const client = getStudioSupabaseClient()
    const unsubscribeExpired = onStudioSessionExpired(() => { setSession(null); setError(STUDIO_SESSION_EXPIRED_MESSAGE); setState('login') })
    const subscription = client?.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_OUT') setState('login')
    }).data.subscription
    void check()
    return () => { subscription?.unsubscribe(); unsubscribeExpired() }
  }, [check])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const client = getStudioSupabaseClient()
      if (!client) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable DEV_BYPASS_AUTH in the API for local development.')
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError || !data.session) throw signInError || new Error('No session returned')
      setSession(data.session)
      await check()
    } catch (err: any) { setError(err.message || 'Sign in failed') }
  }

  if (state === 'checking') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)' }}>Checking Studio access…</div>
  if (state === 'allowed' && session) return <>{children}</>
  if (state === 'denied') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><div><h2>Studio access required</h2><p style={{color:'var(--text-muted)'}}>This account is not an admin, designer, or editor.</p></div></div>
  return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><form onSubmit={signIn} style={{ width:360,padding:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}><h1 style={{marginTop:0}}>UI/UX Studio</h1><p style={{color:'var(--text-muted)'}}>Admin or designer access is required.</p><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" required style={input}/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required style={input}/>{error&&<p style={{color:'var(--danger)',fontSize:13}}>{error}</p>}<button style={button}>Sign in</button></form></div>
}
const input: React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 12px',marginBottom:10,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button: React.CSSProperties={width:'100%',padding:'10px 12px',border:0,borderRadius:7,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
