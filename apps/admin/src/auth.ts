import { createBrowserSupabaseClient, type Session, type SupabaseClient } from '@platform/supabase'

export const ADMIN_SESSION_EXPIRED_MESSAGE = 'Your Admin session has expired. Please sign in again.'

export class AdminUnauthorizedError extends Error {
  readonly status = 401
  constructor() { super('Admin authentication is required.') }
}

export class AdminSessionExpiredError extends Error {
  readonly status = 401
  constructor() { super(ADMIN_SESSION_EXPIRED_MESSAGE) }
}

interface AdminAuthAdapter {
  getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
  refreshSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
}

let browserClient: SupabaseClient | null | undefined
const expirationListeners = new Set<() => void>()

export function getAdminSupabaseClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  browserClient = url && key ? createBrowserSupabaseClient(url, key) : null
  return browserClient
}

export function adminSessionNeedsRefresh(session: Pick<Session, 'expires_at'>, nowMs = Date.now(), refreshMarginSeconds = 60): boolean {
  return typeof session.expires_at === 'number' && session.expires_at <= Math.floor(nowMs / 1000) + refreshMarginSeconds
}

export async function resolveCurrentAdminSession(auth: AdminAuthAdapter, forceRefresh = false, nowMs = Date.now()): Promise<Session | null> {
  if (!forceRefresh) {
    const current = await auth.getSession()
    if (current.error) throw current.error
    if (!current.data.session) return null
    if (!adminSessionNeedsRefresh(current.data.session, nowMs)) return current.data.session
  }
  const refreshed = await auth.refreshSession()
  if (refreshed.error || !refreshed.data.session) throw new AdminSessionExpiredError()
  return refreshed.data.session
}

export async function getCurrentAdminSession(forceRefresh = false): Promise<Session | null> {
  const client = getAdminSupabaseClient()
  if (!client) return null
  try { return await resolveCurrentAdminSession(client.auth, forceRefresh) }
  catch (error) {
    if (error instanceof AdminSessionExpiredError) expireAdminSession()
    throw error
  }
}

export function onAdminSessionExpired(listener: () => void): () => void {
  expirationListeners.add(listener)
  return () => expirationListeners.delete(listener)
}

export function expireAdminSession(): void {
  expirationListeners.forEach((listener) => listener())
  const client = getAdminSupabaseClient()
  if (client) void client.auth.signOut({ scope: 'local' })
}
