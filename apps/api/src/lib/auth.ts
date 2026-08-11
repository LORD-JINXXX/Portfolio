import type { NextFunction, Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@platform/contracts'

export interface Actor { id: string | null; email?: string; role: UserRole }
export interface AuthedRequest extends Request { actor?: Actor }


function verifiedJwtAal(token: string): 'aal1' | 'aal2' | null {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return null
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { aal?: unknown }
    return payload.aal === 'aal2' ? 'aal2' : payload.aal === 'aal1' ? 'aal1' : null
  } catch { return null }
}

export function createRequireRoles(supabaseAdmin: SupabaseClient, bypass: boolean, roles: UserRole[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (bypass && process.env.NODE_ENV !== 'production') { req.actor = { id: null, email: 'local-dev', role: 'admin' }; return next() }
    const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return res.status(401).json({error:'Authentication required',code:'AUTH_REQUIRED'})
    const {data:userData,error:userError}=await supabaseAdmin.auth.getUser(token)
    if(userError||!userData.user)return res.status(401).json({error:'Invalid or expired session',code:'AUTH_SESSION_INVALID'})
    const {data:profile,error:profileError}=await supabaseAdmin.from('profiles').select('id,email,role').eq('id',userData.user.id).single()
    if(profileError||!profile)return res.status(403).json({error:'Profile not found',code:'PROFILE_NOT_FOUND'})
    if(!roles.includes(profile.role as UserRole))return res.status(403).json({error:'Insufficient platform role',code:'ROLE_FORBIDDEN'})
    if (process.env.REQUIRE_PRIVILEGED_AAL2 === 'true' && verifiedJwtAal(token) !== 'aal2') {
      // Resolve authorization before MFA so ordinary users never receive a
      // privileged MFA challenge for a role they do not have. getUser(token)
      // above has already verified the Supabase access token carrying the AAL.
      return res.status(403).json({ error:'Multi-factor authentication is required for privileged access', code:'MFA_REQUIRED' })
    }
    req.actor={id:profile.id,email:profile.email||userData.user.email,role:profile.role as UserRole};next()
  }
}
export const createRequireAdmin=(db:SupabaseClient,bypass:boolean)=>createRequireRoles(db,bypass,['admin'])
export const createRequireStudio=(db:SupabaseClient,bypass:boolean)=>createRequireRoles(db,bypass,['admin','designer','editor'])
