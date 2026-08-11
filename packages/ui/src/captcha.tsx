import React from 'react'

export type CaptchaProvider = 'turnstile' | 'hcaptcha'

declare global {
  interface Window {
    turnstile?: { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id?: string) => void }
    hcaptcha?: { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id?: string) => void }
  }
}

const loadedScripts = new Map<CaptchaProvider, Promise<void>>()

export function normalizeCaptchaProvider(value: unknown): CaptchaProvider | null {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'turnstile' || raw === 'hcaptcha' ? raw : null
}

function loadCaptchaScript(provider: CaptchaProvider): Promise<void> {
  const existing = loadedScripts.get(provider)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const globalReady = provider === 'turnstile' ? window.turnstile : window.hcaptcha
    if (globalReady) { resolve(); return }
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.src = provider === 'turnstile'
      ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      : 'https://js.hcaptcha.com/1/api.js?render=explicit'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('CAPTCHA could not be loaded. Please refresh and try again.'))
    document.head.appendChild(script)
  })
  loadedScripts.set(provider, promise)
  return promise
}

export function Captcha({
  provider,
  siteKey,
  onToken,
  resetKey = 0,
}: {
  provider: CaptchaProvider | null
  siteKey: string
  onToken: (token: string) => void
  resetKey?: number
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const widgetId = React.useRef<string | null>(null)
  const [error, setError] = React.useState('')
  const configured = Boolean(provider && siteKey.trim())

  React.useEffect(() => {
    if (!configured || !provider || !containerRef.current) { onToken(''); return }
    let cancelled = false
    onToken('')
    setError('')
    void loadCaptchaScript(provider).then(() => {
      if (cancelled || !containerRef.current) return
      const api = provider === 'turnstile' ? window.turnstile : window.hcaptcha
      if (!api) throw new Error('CAPTCHA provider did not initialize.')
      widgetId.current = api.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setError('CAPTCHA verification failed. Please retry.') },
      })
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'CAPTCHA failed to load.'))
    return () => {
      cancelled = true
      const api = provider === 'turnstile' ? window.turnstile : window.hcaptcha
      if (api && widgetId.current) { try { api.remove(widgetId.current) } catch {} }
      widgetId.current = null
    }
  }, [configured, provider, siteKey, onToken, resetKey])

  if (!configured) return null
  return <div style={{ marginTop: 14 }}><div ref={containerRef} />{error && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}</div>
}
