import { createBrowserSupabaseClient, type Session, type SupabaseClient } from '@platform/supabase'

export const STUDIO_SESSION_EXPIRED_MESSAGE = 'Your Studio session has expired. Please sign in again.'

export class StudioUnauthorizedError extends Error {
  readonly status = 401
  constructor() { super('Studio authentication is required.') }
}

export class StudioSessionExpiredError extends Error {
  readonly status = 401
  constructor() { super(STUDIO_SESSION_EXPIRED_MESSAGE) }
}

interface StudioAuthAdapter {
  getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
  refreshSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
}

let browserClient: SupabaseClient | null | undefined
const expirationListeners = new Set<() => void>()

export function getStudioSupabaseClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  browserClient = url && key ? createBrowserSupabaseClient(url, key) : null
  return browserClient
}

export function sessionNeedsRefresh(session: Pick<Session, 'expires_at'>, nowMs = Date.now(), refreshMarginSeconds = 60): boolean {
  return typeof session.expires_at === 'number' && session.expires_at <= Math.floor(nowMs / 1000) + refreshMarginSeconds
}

export async function resolveCurrentStudioSession(auth: StudioAuthAdapter, forceRefresh = false, nowMs = Date.now()): Promise<Session | null> {
  if (!forceRefresh) {
    const current = await auth.getSession()
    if (current.error) throw current.error
    if (!current.data.session) return null
    if (!sessionNeedsRefresh(current.data.session, nowMs)) return current.data.session
  }
  const refreshed = await auth.refreshSession()
  if (refreshed.error || !refreshed.data.session) throw new StudioSessionExpiredError()
  return refreshed.data.session
}

export async function getCurrentStudioSession(forceRefresh = false): Promise<Session | null> {
  const client = getStudioSupabaseClient()
  if (!client) return null
  try {
    return await resolveCurrentStudioSession(client.auth, forceRefresh)
  } catch (error) {
    if (error instanceof StudioSessionExpiredError) expireStudioSession()
    throw error
  }
}

export function onStudioSessionExpired(listener: () => void): () => void {
  expirationListeners.add(listener)
  return () => expirationListeners.delete(listener)
}

export function expireStudioSession(): void {
  expirationListeners.forEach((listener) => listener())
  const client = getStudioSupabaseClient()
  if (client) void client.auth.signOut({ scope: 'local' })
}
