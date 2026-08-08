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
  const [status, setStatus] = React.useState<'loading'|'ok'|'login'|'denied'>('loading')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [message, setMessage] = React.useState('')

  const check = React.useCallback(async () => {
    try {
      await hydrateStoredSession()
      await apiFetch('/api/admin/me')
      setStatus('ok')
    } catch (e: any) {
      setStatus(e.status === 403 ? 'denied' : 'login')
    }
  }, [])

  React.useEffect(() => { check() }, [check])

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage('')
    try {
      const supabase = browserClient()
      if (!supabase) throw new Error('Supabase frontend environment variables are missing.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.session?.access_token) sessionStorage.setItem('portfolio-access-token', data.session.access_token)
      await check()
    } catch (e: any) { setMessage(e.message) }
  }

  if (status === 'loading') return <Center>Checking Admin access…</Center>
  if (status === 'denied') return <Center><div><h2>Admin access required</h2><p style={{color:'var(--text-muted)'}}>This account does not have the admin role.</p></div></Center>
  if (status === 'login') return <Center><form onSubmit={login} style={{width:340,padding:24,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}><h2>Admin CMS</h2><p style={{color:'var(--text-muted)'}}>Sign in with an admin account.</p><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={input}/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={input}/>{message&&<p style={{color:'var(--danger)',fontSize:12}}>{message}</p>}<button style={button}>Sign in</button></form></Center>
  return <>{children}</>
}

function Center({children}:{children:React.ReactNode}){return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>{children}</div>}
const input:React.CSSProperties={display:'block',width:'100%',boxSizing:'border-box',margin:'10px 0',padding:10,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button:React.CSSProperties={width:'100%',padding:10,border:0,borderRadius:6,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
