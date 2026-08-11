import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthedRequest } from './auth'

export type SecurityMode = 'development' | 'standard' | 'strict'
export type RateLimitStoreMode = 'memory' | 'supabase'

export interface SecurityConfig {
  mode: SecurityMode
  production: boolean
  trustProxyHops: number | false
  rateLimitStore: RateLimitStoreMode
  rateLimitHashSecret: string
  publicRequestsPerMinute: number
  privilegedRequestsPerMinute: number
  mutationRequestsPerMinute: number
  uploadRequestsPerTenMinutes: number
  requestTimeoutMs: number
  headersTimeoutMs: number
  keepAliveTimeoutMs: number
  publicCacheSeconds: number
  publicStaleSeconds: number
  memoryRateLimitMaxKeys: number
  publicSuccessLogSampleRate: number
  manifestMemoryCacheMs: number
  privilegedAal2Required: boolean
}

function positiveInt(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}


function boundedFraction(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback
}

function strongRateLimitSecret(value: string): boolean {
  if (value.length < 32) return false
  if (new Set(value).size < 12) return false
  if (/(replace|change[-_ ]?me|example|your[-_ ]?secret|placeholder)/i.test(value)) return false
  return true
}

export function loadSecurityConfig(env: NodeJS.ProcessEnv): SecurityConfig {
  const production = env.NODE_ENV === 'production'
  const requestedMode = String(env.SECURITY_MODE || (production ? 'strict' : 'development')).trim().toLowerCase()
  if (!['development', 'standard', 'strict'].includes(requestedMode)) throw new Error('SECURITY_MODE must be development, standard, or strict')
  const mode = requestedMode as SecurityMode
  const proxyRaw = String(env.TRUST_PROXY_HOPS || '').trim()
  let trustProxyHops: number | false = false
  if (proxyRaw) {
    const parsedProxyHops = Number(proxyRaw)
    if (!Number.isInteger(parsedProxyHops) || parsedProxyHops < 1 || parsedProxyHops > 10) throw new Error('TRUST_PROXY_HOPS must be an integer between 1 and 10')
    trustProxyHops = parsedProxyHops
  }
  const storeRaw = String(env.RATE_LIMIT_STORE || (production && mode === 'strict' ? 'supabase' : 'memory')).trim().toLowerCase()
  const rateLimitStore: RateLimitStoreMode = storeRaw === 'supabase' ? 'supabase' : 'memory'
  const rateLimitHashSecret = String(env.RATE_LIMIT_HASH_SECRET || '').trim()
  const privilegedAal2Required = env.REQUIRE_PRIVILEGED_AAL2 === 'true'

  if (production && mode === 'strict') {
    if (trustProxyHops === false) throw new Error('TRUST_PROXY_HOPS must be explicitly configured in strict production mode')
    if (rateLimitStore !== 'supabase') throw new Error('Strict production mode requires RATE_LIMIT_STORE=supabase so privileged limits are shared across API instances')
    if (!strongRateLimitSecret(rateLimitHashSecret)) throw new Error('RATE_LIMIT_HASH_SECRET must be a random high-entropy secret of at least 32 characters in strict production mode')
    if (!privilegedAal2Required) throw new Error('Strict production mode requires REQUIRE_PRIVILEGED_AAL2=true for Admin/Studio access')
  }

  return {
    mode,
    production,
    trustProxyHops,
    rateLimitStore,
    rateLimitHashSecret,
    publicRequestsPerMinute: positiveInt(env.PUBLIC_RATE_LIMIT_PER_MINUTE, 240, 20, 5000),
    privilegedRequestsPerMinute: positiveInt(env.PRIVILEGED_RATE_LIMIT_PER_MINUTE, 180, 20, 5000),
    mutationRequestsPerMinute: positiveInt(env.MUTATION_RATE_LIMIT_PER_MINUTE, 60, 5, 1000),
    uploadRequestsPerTenMinutes: positiveInt(env.UPLOAD_RATE_LIMIT_PER_10_MINUTES, 20, 2, 200),
    requestTimeoutMs: positiveInt(env.REQUEST_TIMEOUT_MS, 30_000, 5_000, 120_000),
    headersTimeoutMs: positiveInt(env.HEADERS_TIMEOUT_MS, 15_000, 5_000, 60_000),
    keepAliveTimeoutMs: positiveInt(env.KEEP_ALIVE_TIMEOUT_MS, 5_000, 1_000, 30_000),
    publicCacheSeconds: positiveInt(env.PUBLIC_CACHE_SECONDS, 60, 0, 3600),
    publicStaleSeconds: positiveInt(env.PUBLIC_STALE_SECONDS, 300, 0, 86_400),
    memoryRateLimitMaxKeys: positiveInt(env.MEMORY_RATE_LIMIT_MAX_KEYS, 50_000, 1_000, 500_000),
    publicSuccessLogSampleRate: boundedFraction(env.PUBLIC_SUCCESS_LOG_SAMPLE_RATE, production ? 0.05 : 1),
    manifestMemoryCacheMs: positiveInt(env.PUBLIC_MANIFEST_MEMORY_CACHE_MS, 5000, 0, 60000),
    privilegedAal2Required,
  }
}

function safeRequestId(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value.trim() : ''
  return /^[A-Za-z0-9._:-]{8,96}$/.test(candidate) ? candidate : null
}

export function requestIdentity(req: Request, res: Response, next: NextFunction) {
  const requestId = safeRequestId(req.header('x-request-id')) || crypto.randomUUID()
  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

export function apiSecurityHeaders(config: SecurityConfig) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    next()
  }
}

export function privateNoStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  next()
}

export function publicEdgeCache(config: SecurityConfig, etag?: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${config.publicCacheSeconds}, stale-while-revalidate=${config.publicStaleSeconds}`)
    if (etag) res.setHeader('ETag', etag)
    next()
  }
}

export function enforceRequestShape(req: Request, res: Response, next: NextFunction) {
  if (req.originalUrl.length > 4096) return res.status(414).json({ error: 'Request URI is too long', code: 'REQUEST_URI_TOO_LONG' })
  let parameterCount = 0
  for (const [key, rawValue] of Object.entries(req.query)) {
    parameterCount += 1
    if (parameterCount > 30 || key.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(key)) {
      return res.status(400).json({ error: 'Invalid query parameters', code: 'INVALID_QUERY' })
    }
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    if (values.length > 20 || values.some((value) => String(value ?? '').length > 2048)) {
      return res.status(400).json({ error: 'Invalid query parameters', code: 'INVALID_QUERY' })
    }
  }
  next()
}


export function enforceParsedBodyShape(req: Request, res: Response, next: NextFunction) {
  if (req.body === undefined || req.body === null) return next()
  const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
  let visited = 0
  let invalid = false
  const walk = (value: unknown, depth: number) => {
    if (invalid || value === null || value === undefined) return
    if (depth > 16 || ++visited > 5000) { invalid = true; return }
    if (Array.isArray(value)) {
      if (value.length > 1000) { invalid = true; return }
      value.forEach((item) => walk(item, depth + 1))
      return
    }
    if (typeof value !== 'object') return
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 1000) { invalid = true; return }
    for (const [key, child] of entries) {
      if (key.length > 256 || forbidden.has(key)) { invalid = true; return }
      walk(child, depth + 1)
    }
  }
  walk(req.body, 0)
  if (invalid) return res.status(400).json({ error: 'Request body structure is too complex or invalid', code: 'INVALID_BODY_SHAPE' })
  next()
}

export function structuredRequestLogger(config: SecurityConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now()
    res.on('finish', () => {
      const isPublicSuccess = req.path.startsWith('/api/public') && res.statusCode < 400
      if (isPublicSuccess && config.publicSuccessLogSampleRate < 1 && Math.random() > config.publicSuccessLogSampleRate) return
      const actor = (req as AuthedRequest).actor
      const entry = {
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        event: 'http_request',
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        actorId: actor?.id || undefined,
        actorRole: actor?.role || undefined,
      }
      console.log(JSON.stringify(entry))
    })
    next()
  }
}

export interface RateLimitSpec {
  id: string
  limit: number
  windowSeconds: number
  message: string
  key?: (req: AuthedRequest) => string
  distributed?: boolean
  failClosed?: boolean
}

interface MemoryCounter { used: number; resetAt: number }
const memoryCounters = new Map<string, MemoryCounter>()
let lastMemorySweep = 0

function sweepMemory(now: number) {
  if (now - lastMemorySweep < 60_000 || memoryCounters.size < 1000) return
  lastMemorySweep = now
  for (const [key, counter] of memoryCounters) if (counter.resetAt <= now) memoryCounters.delete(key)
}

function clientIdentity(req: AuthedRequest): string {
  return req.actor?.id ? `user:${req.actor.id}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`
}

export function hashRateLimitKey(secret: string, input: string): string {
  return secret
    ? crypto.createHmac('sha256', secret).update(input).digest('hex')
    : crypto.createHash('sha256').update(input).digest('hex')
}

function setRateLimitHeaders(res: Response, limit: number, remaining: number, resetAt: Date) {
  res.setHeader('RateLimit-Limit', String(limit))
  res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining)))
  res.setHeader('RateLimit-Reset', String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))))
}

function rejectRateLimited(res: Response, spec: RateLimitSpec, resetAt: Date) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))
  res.setHeader('Retry-After', String(retryAfterSeconds))
  return res.status(429).json({ error: spec.message, code: 'RATE_LIMITED', retryAfterSeconds })
}

export function createMemoryRateLimiter(config: SecurityConfig, spec: RateLimitSpec) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const now = Date.now()
    sweepMemory(now)
    const identity = spec.key?.(req) || clientIdentity(req)
    const key = `${spec.id}:${hashRateLimitKey(config.rateLimitHashSecret, identity)}`
    const existing = memoryCounters.get(key)
    if (!existing && memoryCounters.size >= config.memoryRateLimitMaxKeys) {
      // A rotating-IP flood must not be able to grow the process heap without bound.
      // Edge/WAF protection is still the primary DDoS control; this is origin self-protection.
      const resetAt = new Date(now + Math.min(spec.windowSeconds, 60) * 1000)
      setRateLimitHeaders(res, spec.limit, 0, resetAt)
      return rejectRateLimited(res, spec, resetAt)
    }
    const counter = !existing || existing.resetAt <= now ? { used: 0, resetAt: now + spec.windowSeconds * 1000 } : existing
    counter.used += 1
    memoryCounters.set(key, counter)
    const remaining = spec.limit - counter.used
    const resetAt = new Date(counter.resetAt)
    setRateLimitHeaders(res, spec.limit, remaining, resetAt)
    if (counter.used > spec.limit) return rejectRateLimited(res, spec, resetAt)
    next()
  }
}

export function createDistributedRateLimiter(db: SupabaseClient, config: SecurityConfig, spec: RateLimitSpec) {
  if (config.rateLimitStore !== 'supabase' || spec.distributed === false) {
    return (_req: AuthedRequest, _res: Response, next: NextFunction) => next()
  }
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const identity = spec.key?.(req) || clientIdentity(req)
    const bucketKey = `${spec.id}:${hashRateLimitKey(config.rateLimitHashSecret, identity)}`
    try {
      const { data, error } = await db.rpc('consume_security_rate_limit', {
        bucket_key: bucketKey,
        window_seconds: spec.windowSeconds,
        request_limit: spec.limit,
      })
      if (error) throw error
      const result = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; remaining?: number; reset_at?: string } | null
      const resetAt = result?.reset_at ? new Date(result.reset_at) : new Date(Date.now() + spec.windowSeconds * 1000)
      setRateLimitHeaders(res, spec.limit, Number(result?.remaining ?? 0), resetAt)
      if (!result?.allowed) return rejectRateLimited(res, spec, resetAt)
      next()
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'rate_limit_store_failure', requestId: res.locals.requestId, limiter: spec.id, error: error instanceof Error ? error.message : String(error) }))
      if (spec.failClosed !== false || config.mode === 'strict') return res.status(503).json({ error: 'Request protection service is temporarily unavailable', code: 'RATE_LIMIT_STORE_UNAVAILABLE' })
      next()
    }
  }
}

export function requireJsonContentType(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next()
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type application/json is required', code: 'UNSUPPORTED_CONTENT_TYPE' })
  next()
}

export function mutationOnly(middleware: (req: AuthedRequest, res: Response, next: NextFunction) => unknown) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
    return middleware(req, res, next)
  }
}
