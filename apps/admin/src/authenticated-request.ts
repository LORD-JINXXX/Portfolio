import { AdminSessionExpiredError, AdminUnauthorizedError } from './auth'

export interface RequestSession { access_token: string }
export type AdminSessionProvider = (forceRefresh: boolean) => Promise<RequestSession | null>
export type AdminFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({}))
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
}

export async function authenticatedAdminJsonRequest<T>(url: string, options: RequestInit, sessionProvider: AdminSessionProvider, fetcher: AdminFetch = fetch): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await sessionProvider(attempt === 1)
    if (!session?.access_token) {
      if (attempt === 1) throw new AdminSessionExpiredError()
      throw new AdminUnauthorizedError()
    }
    const response = await fetcher(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const payload = await responsePayload(response)
    if (response.status === 401) {
      if (attempt === 0) continue
      throw new AdminSessionExpiredError()
    }
    if (!response.ok) throw Object.assign(new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`), { status: response.status, payload })
    return payload as T
  }
  throw new AdminSessionExpiredError()
}
