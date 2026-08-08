import { authenticatedJsonRequest } from './authenticated-request'
import { expireStudioSession, getCurrentStudioSession, StudioSessionExpiredError } from './auth'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await authenticatedJsonRequest<T>(`${API_URL}${path}`, options, getCurrentStudioSession)
  } catch (error) {
    if (error instanceof StudioSessionExpiredError) expireStudioSession()
    throw error
  }
}
