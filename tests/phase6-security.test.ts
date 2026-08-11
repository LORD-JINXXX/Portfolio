import assert from 'node:assert/strict'
import test from 'node:test'
import { hashRateLimitKey, loadSecurityConfig } from '../apps/api/src/lib/security'

test('strict production security refuses ambiguous proxy/rate-limit configuration', () => {
  assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', SECURITY_MODE: 'strict' } as NodeJS.ProcessEnv), /TRUST_PROXY_HOPS/)
  assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', SECURITY_MODE: 'strict', TRUST_PROXY_HOPS: '1', RATE_LIMIT_STORE: 'memory', RATE_LIMIT_HASH_SECRET: 'x'.repeat(40) } as NodeJS.ProcessEnv), /RATE_LIMIT_STORE=supabase/)
  assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', SECURITY_MODE: 'strict', TRUST_PROXY_HOPS: '1', RATE_LIMIT_STORE: 'supabase', RATE_LIMIT_HASH_SECRET: 'short', REQUIRE_PRIVILEGED_AAL2: 'true' } as NodeJS.ProcessEnv), /random high-entropy secret/)
  assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', SECURITY_MODE: 'strict', TRUST_PROXY_HOPS: '1', RATE_LIMIT_STORE: 'supabase', RATE_LIMIT_HASH_SECRET: 'L8k9qT3vP7mN2xR5cY1sW6dF4jH0bZ!u', REQUIRE_PRIVILEGED_AAL2: 'false' } as NodeJS.ProcessEnv), /REQUIRE_PRIVILEGED_AAL2=true/)
  assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', SECURITY_MODE: 'typo', TRUST_PROXY_HOPS: '1' } as NodeJS.ProcessEnv), /SECURITY_MODE/)
})

test('strict production security accepts explicit horizontally-safe settings', () => {
  const config = loadSecurityConfig({
    NODE_ENV: 'production',
    SECURITY_MODE: 'strict',
    TRUST_PROXY_HOPS: '1',
    RATE_LIMIT_STORE: 'supabase',
    RATE_LIMIT_HASH_SECRET: 'L8k9qT3vP7mN2xR5cY1sW6dF4jH0bZ!u',
    REQUIRE_PRIVILEGED_AAL2: 'true',
  } as NodeJS.ProcessEnv)
  assert.equal(config.mode, 'strict')
  assert.equal(config.production, true)
  assert.equal(config.rateLimitStore, 'supabase')
  assert.equal(config.trustProxyHops, 1)
  assert.equal(config.publicSuccessLogSampleRate, 0.05)
  assert.equal(config.privilegedAal2Required, true)
})

test('rate-limit identities are one-way keyed rather than stored as raw emails/IPs', () => {
  const secret = 'b'.repeat(40)
  const raw = 'user:user@example.com'
  const first = hashRateLimitKey(secret, raw)
  const second = hashRateLimitKey(secret, raw)
  assert.equal(first, second)
  assert.equal(first.length, 64)
  assert.equal(first.includes('user@example.com'), false)
})
