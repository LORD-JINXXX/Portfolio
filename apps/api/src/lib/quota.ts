import type { SupabaseClient } from '@supabase/supabase-js'

export interface DailyQuotaResult {
  allowed: boolean
  remaining: number
  used: number
  usageDate: string
}

/**
 * Shared, transaction-safe per-user daily quota primitive for Phase 6 and
 * future AI applications. It deliberately lives behind the service-role API;
 * browser clients cannot consume or reset quota counters directly.
 */
export async function consumeDailyQuota(
  db: SupabaseClient,
  userId: string,
  featureKey: string,
  limit: number,
  amount = 1,
): Promise<DailyQuotaResult> {
  const { data, error } = await db.rpc('consume_security_daily_quota', {
    target_user_id: userId,
    target_feature_key: featureKey,
    quota_limit: limit,
    amount,
  })
  if (error) throw new Error(`Quota check failed: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; remaining?: number; used?: number; usage_date?: string } | null
  if (!row || typeof row.allowed !== 'boolean') throw new Error('Quota check returned an invalid result')
  return {
    allowed: row.allowed,
    remaining: Number(row.remaining || 0),
    used: Number(row.used || 0),
    usageDate: String(row.usage_date || ''),
  }
}
