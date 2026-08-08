import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AiApp, Experience, Media, Note, Profile, Project, SiteContent } from '@platform/contracts'

export function createBrowserSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) throw new Error('Supabase URL and publishable/anon key are required')
  return createClient(url, anonKey)
}

export function createServerSupabaseClients(env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string }) {
  const url = env.SUPABASE_URL
  const anonKey = env.SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in API environment')
  }
  return {
    supabase: createClient(url, anonKey, { auth: { persistSession: false } }),
    supabaseAdmin: createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

export type { Profile, Media, SiteContent, Project, Note, Experience, AiApp }
