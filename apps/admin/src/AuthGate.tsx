import React from 'react'
import { createBrowserSupabaseClient } from '@platform/supabase'
import { ActionFeedback, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'

export interface AdminAuthControls {
  logout: () => void
  signingOut: boolean
}

export const AdminAuthContext = React.createContext<AdminAuthControls | null>(null)

let cachedBrowserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null
function browserClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!cachedBrowserClient) cachedBrowserClient = createBrowserSupabaseClient(url, key)
  return cachedBrowserClient
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
  const [authError, setAuthError] = React.useState('')
  const actions = useMutationActions()

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

  const login = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    void actions.run({
      key: 'admin-login',
      conflictKey: 'admin-auth',
      pending: 'Signing in...',
      success: 'Signed in successfully.',
      action: async () => {
        const supabase = browserClient()
        if (!supabase) throw new Error('Supabase frontend environment variables are missing.')
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session?.access_token) sessionStorage.setItem('portfolio-access-token', data.session.access_token)
        await check()
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'Sign in failed.'
        setAuthError(message)
        return message
      },
    })
  }

  const logout = React.useCallback(() => {
    setAuthError('')
    void actions.run({
      key: 'admin-logout',
      conflictKey: 'admin-auth',
      pending: 'Signing out...',
      success: 'Signed out successfully.',
      action: async () => {
        const supabase = browserClient()
        if (!supabase) throw new Error('Supabase frontend environment variables are missing.')
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        sessionStorage.removeItem('portfolio-access-token')
        setStatus('login')
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'Sign out failed.'
        setAuthError(message)
        return message
      },
    })
  }, [actions.run])

  const signingIn = actions.isPending('admin-login')
  const signingOut = actions.isPending('admin-logout')

  if (status === 'loading') return <Center>Checking Admin access…</Center>
  if (status === 'denied') return <Center><div><h2>Admin access required</h2><p style={{color:'var(--text-muted)'}}>This account does not have the admin role.</p></div></Center>
  if (status === 'login') return <Center><form onSubmit={login} aria-busy={signingIn} style={{width:340,padding:24,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}><h2>Admin CMS</h2><p style={{color:'var(--text-muted)'}}>Sign in with an admin account.</p><input required disabled={signingIn} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={input}/><input required disabled={signingIn} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={input}/>{authError&&<p role="alert" style={{color:'var(--danger)',fontSize:12}}>{authError}</p>}<button disabled={signingIn} aria-busy={signingIn} style={button}>{signingIn ? 'Signing in...' : 'Sign In'}</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></Center>
  return <AdminAuthContext.Provider value={{logout, signingOut}}>{children}<ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></AdminAuthContext.Provider>
}

function Center({children}:{children:React.ReactNode}){return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>{children}</div>}
const input:React.CSSProperties={display:'block',width:'100%',boxSizing:'border-box',margin:'10px 0',padding:10,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button:React.CSSProperties={width:'100%',padding:10,border:0,borderRadius:6,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
