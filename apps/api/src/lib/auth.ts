import type { NextFunction, Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@platform/contracts'

export interface Actor { id: string | null; email?: string; role: UserRole }
export interface AuthedRequest extends Request { actor?: Actor }

export function createRequireRoles(supabaseAdmin: SupabaseClient, bypass: boolean, roles: UserRole[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (bypass && process.env.NODE_ENV !== 'production') { req.actor = { id: null, email: 'local-dev', role: 'admin' }; return next() }
    const auth=req.headers.authorization||'';const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)return res.status(401).json({error:'Authentication required'})
    const {data:userData,error:userError}=await supabaseAdmin.auth.getUser(token)
    if(userError||!userData.user)return res.status(401).json({error:'Invalid or expired session'})
    const {data:profile,error:profileError}=await supabaseAdmin.from('profiles').select('id,email,role').eq('id',userData.user.id).single()
    if(profileError||!profile)return res.status(403).json({error:'Profile not found'})
    if(!roles.includes(profile.role as UserRole))return res.status(403).json({error:'Insufficient platform role'})
    req.actor={id:profile.id,email:profile.email||userData.user.email,role:profile.role as UserRole};next()
  }
}
export const createRequireAdmin=(db:SupabaseClient,bypass:boolean)=>createRequireRoles(db,bypass,['admin'])
export const createRequireStudio=(db:SupabaseClient,bypass:boolean)=>createRequireRoles(db,bypass,['admin','designer','editor'])
