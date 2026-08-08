import test from 'node:test'
import assert from 'node:assert/strict'
import type { Session } from '@platform/supabase'
import { authenticatedJsonRequest } from '../apps/studio/src/authenticated-request'
import { resolveCurrentStudioSession, sessionNeedsRefresh, STUDIO_SESSION_EXPIRED_MESSAGE, StudioSessionExpiredError, StudioUnauthorizedError } from '../apps/studio/src/auth'

function session(accessToken: string, expiresAt: number): Session {
  return { access_token: accessToken, refresh_token: `refresh-${accessToken}`, expires_in: 3600, expires_at: expiresAt, token_type: 'bearer', user: { id: 'user-1' } } as Session
}

test('protected session resolution uses the current Supabase access token without caching login state', async () => {
  let currentToken = 'token-one'
  const auth = {
    async getSession() { return { data: { session: session(currentToken, 4_000_000_000) }, error: null } },
    async refreshSession() { return { data: { session: session('refreshed', 4_000_000_000) }, error: null } },
  }
  assert.equal((await resolveCurrentStudioSession(auth))?.access_token, 'token-one')
  currentToken = 'token-two'
  assert.equal((await resolveCurrentStudioSession(auth))?.access_token, 'token-two')
})

test('expired or near-expiry sessions are replaced through Supabase refreshSession', async () => {
  const now = 2_000_000_000_000
  const stale = session('expired', Math.floor(now / 1000) + 10)
  const fresh = session('fresh', Math.floor(now / 1000) + 3600)
  let refreshCalls = 0
  const auth = {
    async getSession() { return { data: { session: stale }, error: null } },
    async refreshSession() { refreshCalls += 1; return { data: { session: fresh }, error: null } },
  }
  assert.equal(sessionNeedsRefresh(stale, now), true)
  assert.equal((await resolveCurrentStudioSession(auth, false, now))?.access_token, 'fresh')
  assert.equal(refreshCalls, 1)
})

test('protected request retries once with the refreshed token', async () => {
  const providerCalls: boolean[] = []
  const authorization: string[] = []
  let fetchCalls = 0
  const result = await authenticatedJsonRequest<{ ok: boolean }>('/protected', { method: 'POST' }, async (forceRefresh) => {
    providerCalls.push(forceRefresh)
    return { access_token: forceRefresh ? 'fresh-token' : 'expired-token' }
  }, async (_input, init) => {
    fetchCalls += 1
    authorization.push(new Headers(init?.headers).get('Authorization') || '')
    return new Response(JSON.stringify(fetchCalls === 1 ? { error: 'Invalid or expired session' } : { ok: true }), { status: fetchCalls === 1 ? 401 : 200, headers: { 'Content-Type': 'application/json' } })
  })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(providerCalls, [false, true])
  assert.deepEqual(authorization, ['Bearer expired-token', 'Bearer fresh-token'])
})

test('Save, Validate and Publish requests all use the refreshed-token request path', async () => {
  for (const path of ['/api/studio/versions/version-1/document', '/api/studio/versions/version-1/validate', '/api/studio/versions/version-1/publish']) {
    const authorization: string[] = []
    await authenticatedJsonRequest(path, { method: 'POST' }, async (forceRefresh) => ({ access_token: forceRefresh ? 'fresh-token' : 'expired-token' }), async (_input, init) => {
      authorization.push(new Headers(init?.headers).get('Authorization') || '')
      return new Response(JSON.stringify(authorization.length === 1 ? { error: 'Invalid or expired session' } : { data: {} }), { status: authorization.length === 1 ? 401 : 200 })
    })
    assert.deepEqual(authorization, ['Bearer expired-token', 'Bearer fresh-token'])
  }
})

test('refresh failure produces the controlled session-expired state', async () => {
  const auth = {
    async getSession() { return { data: { session: session('expired', 1) }, error: null } },
    async refreshSession() { return { data: { session: null }, error: new Error('refresh rejected') } },
  }
  await assert.rejects(() => resolveCurrentStudioSession(auth, true), (error: unknown) => error instanceof StudioSessionExpiredError && error.message === STUDIO_SESSION_EXPIRED_MESSAGE)
})

test('request retry is bounded to one refresh attempt', async () => {
  let fetchCalls = 0
  let providerCalls = 0
  await assert.rejects(() => authenticatedJsonRequest('/protected', {}, async () => { providerCalls += 1; return { access_token: `token-${providerCalls}` } }, async () => { fetchCalls += 1; return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 }) }), StudioSessionExpiredError)
  assert.equal(fetchCalls, 2)
  assert.equal(providerCalls, 2)
})

test('missing session remains unauthorized and performs no request', async () => {
  let fetchCalls = 0
  await assert.rejects(() => authenticatedJsonRequest('/protected', {}, async () => null, async () => { fetchCalls += 1; return new Response('{}') }), StudioUnauthorizedError)
  assert.equal(fetchCalls, 0)
})
