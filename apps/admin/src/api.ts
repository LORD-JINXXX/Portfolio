import { authenticatedAdminJsonRequest } from './authenticated-request'
import { AdminSessionExpiredError, expireAdminSession, getCurrentAdminSession } from './auth'

const API_URL=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')

export async function apiFetch<T=any>(path:string,options:RequestInit={}):Promise<T>{
  try { return await authenticatedAdminJsonRequest<T>(`${API_URL}${path}`, options, getCurrentAdminSession) }
  catch (error) { if (error instanceof AdminSessionExpiredError) expireAdminSession(); throw error }
}
