import { StudioSessionExpiredError, StudioUnauthorizedError } from './auth'

export interface RequestSession {
  access_token: string
}

export type StudioSessionProvider = (forceRefresh: boolean) => Promise<RequestSession | null>
export type StudioFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({}))
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
}

export async function authenticatedJsonRequest<T>(url: string, options: RequestInit, sessionProvider: StudioSessionProvider, fetcher: StudioFetch = fetch): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await sessionProvider(attempt === 1)
    if (!session?.access_token) {
      if (attempt === 1) throw new StudioSessionExpiredError()
      throw new StudioUnauthorizedError()
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
      throw new StudioSessionExpiredError()
    }
    if (!response.ok) throw Object.assign(new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`), { status: response.status, payload })
    return payload as T
  }
  throw new StudioSessionExpiredError()
}
