import React from 'react'
import type { Session } from '@platform/supabase'
import { ActionFeedback, Captcha, normalizeCaptchaProvider, useMutationActions } from '@platform/ui'
import { apiFetch } from './api'
import { getCurrentStudioSession, getStudioSupabaseClient, onStudioSessionExpired, STUDIO_SESSION_EXPIRED_MESSAGE, StudioSessionExpiredError } from './auth'

export interface StudioAuthControls {
  logout: () => void
  signingOut: boolean
}

type MfaEnrollment = {
  factorId: string
  qrCode: string
  secret: string
}

export const StudioAuthContext = React.createContext<StudioAuthControls | null>(null)

const CAPTCHA_PROVIDER = normalizeCaptchaProvider(import.meta.env.VITE_CAPTCHA_PROVIDER)
const CAPTCHA_SITE_KEY = String(import.meta.env.VITE_CAPTCHA_SITE_KEY || '').trim()
const CAPTCHA_CONFIGURED = Boolean(CAPTCHA_PROVIDER && CAPTCHA_SITE_KEY)
const CAPTCHA_REQUIRED = Boolean(import.meta.env.PROD || CAPTCHA_CONFIGURED)
const CAPTCHA_MISCONFIGURED = Boolean(import.meta.env.PROD && !CAPTCHA_CONFIGURED)

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<'checking'|'allowed'|'login'|'mfa'|'mfa-setup'|'denied'>('checking')
  const [session, setSession] = React.useState<Session | null>(null)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [sessionError, setSessionError] = React.useState('')
  const [mfaCode, setMfaCode] = React.useState('')
  const [mfaEnrollment, setMfaEnrollment] = React.useState<MfaEnrollment | null>(null)
  const [captchaToken, setCaptchaToken] = React.useState('')
  const [captchaReset, setCaptchaReset] = React.useState(0)
  const onCaptchaToken = React.useCallback((token: string) => setCaptchaToken(token), [])
  const actions = useMutationActions()

  const prepareMfa = React.useCallback(async () => {
    const client = getStudioSupabaseClient()
    if (!client) throw new Error('Supabase frontend environment variables are missing.')
    const factors = await client.auth.mfa.listFactors()
    if (factors.error) throw factors.error
    const verified = factors.data.totp.find((item) => item.status === 'verified') || factors.data.phone.find((item) => item.status === 'verified')
    setMfaCode('')
    if (verified) {
      setMfaEnrollment(null)
      setState('mfa')
      return
    }
    const enrollment = await client.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollment.error) throw enrollment.error
    setMfaEnrollment({ factorId: enrollment.data.id, qrCode: enrollment.data.totp.qr_code, secret: enrollment.data.totp.secret })
    setState('mfa-setup')
  }, [])

  const check = React.useCallback(async () => {
    try {
      const currentSession = await getCurrentStudioSession()
      if (!currentSession) { setSession(null); setState('login'); return }
      await apiFetch('/api/studio/me')
      setSession(currentSession)
      setState('allowed')
    } catch (caught: unknown) {
      const error = caught as { status?: number }
      if ((caught as any)?.payload?.code === 'MFA_REQUIRED') {
        try { await prepareMfa() }
        catch (cause) {
          setSessionError(cause instanceof Error ? cause.message : 'Unable to prepare MFA.')
          setState('mfa-setup')
        }
      } else { setSession(null); setState(error.status === 403 ? 'denied' : 'login') }
      if (caught instanceof StudioSessionExpiredError) setSessionError(STUDIO_SESSION_EXPIRED_MESSAGE)
    }
  }, [prepareMfa])

  React.useEffect(() => {
    sessionStorage.removeItem('portfolio-access-token')
    const client = getStudioSupabaseClient()
    const unsubscribeExpired = onStudioSessionExpired(() => { setSession(null); setSessionError(STUDIO_SESSION_EXPIRED_MESSAGE); setState('login') })
    const subscription = client?.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'SIGNED_OUT') setState('login')
    }).data.subscription
    void check()
    return () => { subscription?.unsubscribe(); unsubscribeExpired() }
  }, [check])

  const signIn = (e: React.FormEvent) => {
    e.preventDefault()
    setSessionError('')
    if (CAPTCHA_MISCONFIGURED) { setSessionError('Studio authentication is unavailable until the production CAPTCHA provider is configured.'); return }
    if (CAPTCHA_REQUIRED && !captchaToken) { setSessionError('Complete the anti-bot check before signing in.'); return }
    void actions.run({
      key: 'studio-login',
      conflictKey: 'studio-auth',
      pending: 'Signing in...',
      success: 'Signed in successfully.',
      action: async () => {
        const client = getStudioSupabaseClient()
        if (!client) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable DEV_BYPASS_AUTH in the API for local development.')
        try {
          const { data, error: signInError } = await client.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined })
          if (signInError || !data.session) throw signInError || new Error('No session returned')
          setSession(data.session)
          await check()
        } finally {
          setCaptchaToken('')
          setCaptchaReset((value) => value + 1)
        }
      },
      error: () => 'Unable to sign in with those credentials.',
    })
  }

  const verifyMfa = (e: React.FormEvent) => {
    e.preventDefault()
    setSessionError('')
    void actions.run({
      key: 'studio-mfa',
      conflictKey: 'studio-auth',
      pending: 'Verifying MFA...',
      success: 'MFA verified.',
      action: async () => {
        const client = getStudioSupabaseClient()
        if (!client) throw new Error('Supabase frontend environment variables are missing.')
        const factors = await client.auth.mfa.listFactors()
        if (factors.error) throw factors.error
        const factor = factors.data.totp.find((item) => item.status === 'verified') || factors.data.phone.find((item) => item.status === 'verified')
        if (!factor) throw new Error('No verified MFA factor is enrolled for this privileged account.')
        const challenge = await client.auth.mfa.challenge({ factorId: factor.id })
        if (challenge.error) throw challenge.error
        const verification = await client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code: mfaCode.trim() })
        if (verification.error) throw verification.error
        const currentSession = await getCurrentStudioSession(true)
        setSession(currentSession)
        setMfaCode('')
        await check()
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'MFA verification failed.'
        setSessionError(message)
        return message
      },
    })
  }

  const completeMfaEnrollment = (e: React.FormEvent) => {
    e.preventDefault()
    setSessionError('')
    void actions.run({
      key: 'studio-mfa-enroll',
      conflictKey: 'studio-auth',
      pending: 'Enabling MFA...',
      success: 'MFA enabled.',
      action: async () => {
        const client = getStudioSupabaseClient()
        if (!client) throw new Error('Supabase frontend environment variables are missing.')
        if (!mfaEnrollment) throw new Error('MFA enrollment is not ready. Sign out and try again.')
        const challenge = await client.auth.mfa.challenge({ factorId: mfaEnrollment.factorId })
        if (challenge.error) throw challenge.error
        const verification = await client.auth.mfa.verify({ factorId: mfaEnrollment.factorId, challengeId: challenge.data.id, code: mfaCode.trim() })
        if (verification.error) throw verification.error
        const currentSession = await getCurrentStudioSession(true)
        setSession(currentSession)
        setMfaEnrollment(null)
        setMfaCode('')
        await check()
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'MFA enrollment failed.'
        setSessionError(message)
        return message
      },
    })
  }

  const logout = React.useCallback(() => {
    void actions.run({
      key: 'studio-logout',
      conflictKey: 'studio-auth',
      pending: 'Signing out...',
      success: 'Signed out successfully.',
      action: async () => {
        const client = getStudioSupabaseClient()
        if (!client) throw new Error('Supabase frontend environment variables are missing.')
        const { error } = await client.auth.signOut()
        if (error) throw error
        sessionStorage.removeItem('portfolio-access-token')
        setMfaEnrollment(null)
        setMfaCode('')
        setSession(null)
        setState('login')
      },
      error: (cause) => {
        const message = cause instanceof Error ? cause.message : 'Sign out failed.'
        setSessionError(message)
        return message
      },
    })
  }, [actions.run])

  const signingIn = actions.isPending('studio-login')
  const verifyingMfa = actions.isPending('studio-mfa')
  const enrollingMfa = actions.isPending('studio-mfa-enroll')
  const signingOut = actions.isPending('studio-logout')

  if (state === 'checking') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)' }}>Checking Studio access…</div>
  if (state === 'allowed' && session) return <StudioAuthContext.Provider value={{logout, signingOut}}>{children}<ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></StudioAuthContext.Provider>
  if (state === 'denied') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><div><h2>Studio access required</h2><p style={{color:'var(--text-muted)'}}>This account is not an admin, designer, or editor.</p></div></div>
  if (state === 'mfa-setup') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><form onSubmit={completeMfaEnrollment} aria-busy={enrollingMfa} style={{ width:400,padding:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}><h1 style={{marginTop:0}}>Set up Studio MFA</h1><p style={{color:'var(--text-muted)'}}>Scan this QR code with an authenticator app, then enter the 6-digit code. If you already enrolled this account through Admin, sign out and sign back in so Studio can use the verified factor.</p>{mfaEnrollment?.qrCode&&<img src={mfaEnrollment.qrCode} alt="Authenticator QR code" style={{display:'block',width:220,height:220,maxWidth:'100%',margin:'16px auto',background:'#fff',padding:8,borderRadius:8}}/>}{mfaEnrollment?.secret&&<p style={{fontSize:12,color:'var(--text-muted)',overflowWrap:'anywhere'}}>Can't scan? Enter this secret manually: <code style={{color:'var(--text)'}}>{mfaEnrollment.secret}</code></p>}<input disabled={enrollingMfa} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" required style={input}/>{sessionError&&<p role="alert" style={{color:'var(--danger)',fontSize:13}}>{sessionError}</p>}<button disabled={enrollingMfa||!mfaEnrollment||mfaCode.length!==6} style={button}>{enrollingMfa?'Enabling...':'Enable MFA'}</button><button type="button" disabled={signingOut||enrollingMfa} onClick={logout} style={secondaryButton}>Sign out</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></div>
  if (state === 'mfa') return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><form onSubmit={verifyMfa} aria-busy={verifyingMfa} style={{ width:360,padding:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}><h1 style={{marginTop:0}}>Studio MFA verification</h1><p style={{color:'var(--text-muted)'}}>Enter the code from your enrolled authenticator factor.</p><input disabled={verifyingMfa} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" required style={input}/>{sessionError&&<p role="alert" style={{color:'var(--danger)',fontSize:13}}>{sessionError}</p>}<button disabled={verifyingMfa||mfaCode.length!==6} style={button}>{verifyingMfa?'Verifying...':'Verify MFA'}</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></div>
  return <div style={{ minHeight:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',color:'var(--text)',fontFamily:'system-ui' }}><form onSubmit={signIn} aria-busy={signingIn} style={{ width:360,padding:28,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14 }}><h1 style={{marginTop:0}}>UI/UX Studio</h1><p style={{color:'var(--text-muted)'}}>Admin or designer access is required.</p><input disabled={signingIn} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" required style={input}/><input disabled={signingIn} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" required style={input}/>{CAPTCHA_MISCONFIGURED&&<p role="alert" style={{color:'var(--danger)',fontSize:13}}>Production CAPTCHA configuration is required before Studio sign-in can be used.</p>}<Captcha provider={CAPTCHA_PROVIDER} siteKey={CAPTCHA_SITE_KEY} onToken={onCaptchaToken} resetKey={captchaReset}/>{sessionError&&<p role="alert" style={{color:'var(--danger)',fontSize:13}}>{sessionError}</p>}<button disabled={signingIn||CAPTCHA_MISCONFIGURED||(CAPTCHA_REQUIRED&&!captchaToken)} aria-busy={signingIn} style={button}>{signingIn ? 'Signing in...' : 'Sign In'}</button><ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/></form></div>
}
const input: React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 12px',marginBottom:10,borderRadius:7,border:'1px solid var(--border)',background:'var(--surface-alt)',color:'var(--text)'}
const button: React.CSSProperties={width:'100%',padding:'10px 12px',border:0,borderRadius:7,background:'var(--primary)',color:'var(--primary-text)',fontWeight:700,cursor:'pointer'}
const secondaryButton: React.CSSProperties={...button,marginTop:8,background:'transparent',border:'1px solid var(--border)',color:'var(--text)'}
