import React from 'react'
import { Captcha as SharedCaptcha, normalizeCaptchaProvider } from '@platform/ui'

function config() {
  const provider = normalizeCaptchaProvider(import.meta.env.VITE_CAPTCHA_PROVIDER)
  const siteKey = String(import.meta.env.VITE_CAPTCHA_SITE_KEY || '').trim()
  return { provider, siteKey }
}

export function captchaEnabled(): boolean {
  const value = config()
  return Boolean(value.provider && value.siteKey)
}

export function captchaRequired(): boolean {
  return Boolean(import.meta.env.PROD || captchaEnabled())
}

export function captchaConfigurationMissing(): boolean {
  return Boolean(import.meta.env.PROD && !captchaEnabled())
}

export function Captcha({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const value = config()
  return <SharedCaptcha provider={value.provider} siteKey={value.siteKey} onToken={onToken} resetKey={resetKey} />
}
