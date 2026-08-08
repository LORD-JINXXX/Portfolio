const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('portfolio-access-token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.error || `Request failed (${response.status})`), { status: response.status, payload })
  return payload
}
