import React from 'react'
import { ActionFeedback, Captcha, normalizeCaptchaProvider, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'
import { ADMIN_SESSION_EXPIRED_MESSAGE, getAdminSupabaseClient, getCurrentAdminSession, onAdminSessionExpired } from './auth'

export interface AdminAuthControls {
  logout: () => void
  signingOut: boolean
}

type MfaEnrollment = {
  factorId: string
  qrCode: string
  secret: string
}

export const AdminAuthContext = React.createContext<AdminAuthControls | null>(null)

const CAPTCHA_PROVIDER = normalizeCaptchaProvider(import.meta.env.VITE_CAPTCHA_PROVIDER)
const CAPTCHA_SITE_KEY = String(import.meta.env.VITE_CAPTCHA_SITE_KEY || '').trim()
const CAPTCHA_CONFIGURED = Boolean(CAPTCHA_PROVIDER && CAPTCHA_SITE_KEY)
const CAPTCHA_REQUIRED = Boolean(import.meta.env.PROD || CAPTCHA_CONFIGURED)
const CAPTCHA_MISCONFIGURED = Boolean(import.meta.env.PROD && !CAPTCHA_CONFIGURED)

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<'loading'|'ok'|'login'|'mfa'|'mfa-setup'|'denied'>('loading')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [authError, setAuthError] = React.useState('')
  const [mfaCode, setMfaCode] = React.useState('')
  const [mfaEnrollment, setMfaEnrollment] = React.useState<MfaEnrollment | null>(null)
  const [captchaToken, setCaptchaToken] = React.useState('')
  const [captchaReset, setCaptchaReset] = React.useState(0)
  const onCaptchaToken = React.useCallback((token: string) => setCaptchaToken(token), [])
  const actions = useMutationActions()

  const prepareMfa = React.useCallback(async () => {
    const client = getAdminSupabaseClient()
    if (!client) throw new Error('Supabase frontend environment variables are missing.')
    const factors = await client.auth.mfa.listFactors()
    if (factors.error) throw factors.error
    const verified = factors.data.totp.find((item) => item.status === 'verified') || factors.data.phone.find((item) => item.status === 'verified')
    setMfaCode('')
    if (verified) {
      setMfaEnrollment(null)
      setStatus('mfa')
      return
    }
    const enrollment = await client.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollment.error) throw enrollment.error
    setMfaEnrollment({ factorId: enrollment.data.id, qrCode: enrollment.data.totp.qr_code, secret: enrollment.data.totp.secret })
    setStatus('mfa-setup')
  }, [])

  const check = React.useCallback(async () => {
    try {
      const currentSession = await getCurrentAdminSession()
      if (!currentSession) { setStatus('login'); return }
      await apiFetch('/api/admin/me')
      setStatus('ok')
    } catch (e: any) {
      if (e?.payload?.code === 'MFA_REQUIRED') {
        try { await prepareMfa() }
        catch (cause) {
          setAuthError(cause instanceof Error ? cause.message : 'Unable to prepare MFA.')
          setStatus('mfa-setup')
        }
      } else setStatus(e.status === 403 ? 'denied' : 'login')
    }
  }, [prepareMfa])

  React.useEffect(() => {
    const client = getAdminSupabaseClient()
    const unsubscribeExpired = onAdminSessionExpired(() => { setAuthError(ADMIN_SESSION_EXPIRED_MESSAGE); setStatus('login') })
    const subscription = client?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setStatus('login') }).data.subscription
    void check()
    return () => { subscription?.unsubscribe(); unsubscribeExpired() }
  }, [check])

  const login = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (CAPTCHA_MISCONFIGURED) { setAuthError('Admin authentication is unavailable until the production CAPTCHA provider is configured.'); return }
    if (CAPTCHA_REQUIRED && !captchaToken) { setAuthError('Complete the anti-bot check before signing in.'); return }
    void actions.run({
      key: 'admin-login',
      conflictKey: 'admin-auth',
      pending: 'Signing in...',
      success: 'Signed in successfully.',
      action: async () => {
        const supabase = getAdminSupabaseClient()
        if (!supabase) throw new Error('Supabase frontend environment variables are missing.')
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined })
          if (error) throw error
          await check()
        } finally {
          setCaptchaToken('')
          setCaptchaReset((value) => value + 1)
        }
      },
      error: () => {
        const message = 'Unable to sign in with those credentials.'
        setAuthError(message)
        return message
      },
    })
  }

  const verifyMfa = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    void actions.run({
      key: 'admin-mfa',
      conflictKey: 'admin-auth',
      pending: 'Verifying MFA...',
      success: 'MFA verified.',
      action: async () => {
        const client = getAdminSupabaseClient()
        if (!client) throw new Error('Supabase frontend environment variables are missing.')
        const factors = await client.auth.mfa.listFactors()
        if (factors.error) throw factors.error
        const factor = factors.data.totp.find((item) => item.status === 'verified') || factors.data.phone.find((item) => item.status === 'verified')
        if (!factor) throw new Error('No verified MFA factor is enrolled for this admin account.')
        const challenge = await client.auth.mfa.challenge({ factorId: factor.id })
        if (challenge.error) throw challenge.error
        const verification = await client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code: mfaCode.trim() })
        if (verification.error) throw verification.error
        await getCurrentAdminSession(true)
        setMfaCode('')
        await check()
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'MFA verification failed.'
        setAuthError(message)
        return message
      },
    })
  }

  const completeMfaEnrollment = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    void actions.run({
      key: 'admin-mfa-enroll',
      conflictKey: 'admin-auth',
      pending: 'Enabling MFA...',
      success: 'MFA enabled.',
      action: async () => {
        const client = getAdminSupabaseClient()
        if (!client) throw new Error('Supabase frontend environment variables are missing.')
        if (!mfaEnrollment) throw new Error('MFA enrollment is not ready. Sign out and try again.')
        const challenge = await client.auth.mfa.challenge({ factorId: mfaEnrollment.factorId })
        if (challenge.error) throw challenge.error
        const verification = await client.auth.mfa.verify({ factorId: mfaEnrollment.factorId, challengeId: challenge.data.id, code: mfaCode.trim() })
        if (verification.error) throw verification.error
        await getCurrentAdminSession(true)
        setMfaEnrollment(null)
        setMfaCode('')
        await check()
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'MFA enrollment failed.'
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
        const supabase = getAdminSupabaseClient()
        if (!supabase) throw new Error('Supabase frontend environment variables are missing.')
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setMfaEnrollment(null)
        setMfaCode('')
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
  const verifyingMfa = actions.isPending('admin-mfa')
  const enrollingMfa = actions.isPending('admin-mfa-enroll')
  const signingOut = actions.isPending('admin-logout')

  if (status === 'loading') return <Center>Checking Admin access…</Center>
  if (status === 'denied') return <Center><div><h2>Admin access required</h2><p style={{color:'var(--text-muted)'}}>This account does not have the admin role.</p></div></Center>
  if (status === 'mfa-setup') return <Center><form onSubmit={completeMfaEnrollment} aria-busy={enrollingMfa} style={{width:380,padding:24,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}><h2>Set up Admin MFA</h2><p style={{color:'var(--text-muted)'}}>Scan this QR code with an authenticator app, then enter the 6-digit code. This factor will also protect Studio when you use the same account.</p>{mfaEnrollment?.qrCode&&<img src={mfaEnrollment.qrCode} alt="Authenticator QR code" style={{display:'block',width:220,height:220,maxWidth:'100%',margin:'16px auto',background:'#fff',padding:8,borderRadius:8}}/>}{mfaEnrollment?.secret&&<p style={{fontSize:12,color:'var(--text-muted)',overflowWrap:'anywhere'}}>Can't scan? Enter this secret manually: <code style={{color:'var(--text)'}}>{mfaEnrollment.secret}</code></p>}<input required disabled={enrollingMfa} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" style={input}/>{authError&&<p role="alert" style={{color:'var(--danger)',fontSize:12}}>{authError}</p>}<button disabled={enrollingMfa||!mfaEnrollment||mfaCode.length!==6} style={button}>{enrollingMfa?'Enabling...':'Enable MFA'}</button><button type="button" disabled={signingOut||enrollingMfa} onClick={logout} style={secondaryButton}>Sign out</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></Center>
  if (status === 'mfa') return <Center><form onSubmit={verifyMfa} aria-busy={verifyingMfa} style={{width:340,padding:24,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}><h2>Admin MFA verification</h2><p style={{color:'var(--text-muted)'}}>Enter the code from your enrolled authenticator factor.</p><input required disabled={verifyingMfa} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" style={input}/>{authError&&<p role="alert" style={{color:'var(--danger)',fontSize:12}}>{authError}</p>}<button disabled={verifyingMfa||mfaCode.length!==6} style={button}>{verifyingMfa?'Verifying...':'Verify MFA'}</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></Center>
  if (status === 'login') return <Center><form onSubmit={login} aria-busy={signingIn} style={{width:340,padding:24,border:'1px solid var(--border)',borderRadius:12,background:'var(--surface)'}}><h2>Admin CMS</h2><p style={{color:'var(--text-muted)'}}>Sign in with an admin account.</p><input required disabled={signingIn} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={input}/><input required disabled={signingIn} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={input}/>{CAPTCHA_MISCONFIGURED&&<p role="alert" style={{color:'var(--danger)',fontSize:12}}>Production CAPTCHA configuration is required before Admin sign-in can be used.</p>}<Captcha provider={CAPTCHA_PROVIDER} siteKey={CAPTCHA_SITE_KEY} onToken={onCaptchaToken} resetKey={captchaReset}/>{authError&&<p role="alert" style={{color:'var(--danger)',fontSize:12}}>{authError}</p>}<button disabled={signingIn||CAPTCHA_MISCONFIGURED||(CAPTCHA_REQUIRED&&!captchaToken)} aria-busy={signingIn} style={button}>{signingIn ? 'Signing in...' : 'Sign In'}</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></Center>
  return <AdminAuthContext.Provider value={{logout, signingOut}}>{children}<ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></AdminAuthContext.Provider>
}

function Center({children}:{children:React.ReactNode}){return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui'}}>{children}</div>}
const input:React.CSSProperties={display:'block',width:'100%',boxSizing:'border-box',margin:'10px 0',padding:10,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button:React.CSSProperties={width:'100%',padding:10,border:0,borderRadius:6,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
const secondaryButton:React.CSSProperties={...button,marginTop:8,background:'transparent',border:'1px solid var(--border)',color:'var(--text)'}
