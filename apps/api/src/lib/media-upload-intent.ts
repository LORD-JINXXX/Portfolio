import crypto from 'node:crypto'

export const PUBLIC_MEDIA_BUCKET = 'public-media'
export const TUS_CHUNK_BYTES = 6 * 1024 * 1024
export const DEFAULT_MAX_CMS_MEDIA_BYTES = 2 * 1024 * 1024 * 1024
export const SUPABASE_RESUMABLE_MAX_BYTES = 50 * 1024 * 1024 * 1024
export const MEDIA_UPLOAD_INTENT_TTL_MS = 2 * 60 * 60 * 1000

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

export const SUPPORTED_CMS_MEDIA_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION))

export interface MediaUploadIntentClaims {
  actorId: string
  bucket: typeof PUBLIC_MEDIA_BUCKET
  storagePath: string
  filename: string
  mimeType: string
  sizeBytes: number
  altText: string
  expiresAt: number
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function timingSafeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function sanitizeMediaFilename(value: unknown): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 180)
}

export function inferMediaMime(filename: string, declaredMime: unknown): string {
  const declared = String(declaredMime || '').trim().toLowerCase()
  if (declared === 'image/jpg') return 'image/jpeg'
  if (SUPPORTED_CMS_MEDIA_MIME_TYPES.has(declared)) return declared
  if (declared && declared !== 'application/octet-stream') throw new Error(`Unsupported media MIME type ${declared}`)
  const lower = filename.toLowerCase()
  const extension = Object.keys(MIME_BY_EXTENSION).find((candidate) => lower.endsWith(candidate))
  if (!extension) throw new Error('Unsupported media file type')
  return MIME_BY_EXTENSION[extension]
}

export function resolveCmsMediaMaxBytes(raw: unknown): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CMS_MEDIA_BYTES
  return Math.max(1, Math.min(Math.floor(parsed), SUPABASE_RESUMABLE_MAX_BYTES))
}

export function createCmsMediaStoragePath(filename: string, now = new Date(), id: string = crypto.randomUUID()): string {
  return `cms/${now.toISOString().slice(0, 10)}/${id}-${sanitizeMediaFilename(filename)}`
}

export function supabaseTusEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl)
  const directMatch = /^([^.]+)\.supabase\.co$/i.exec(url.hostname)
  if (directMatch) return `https://${directMatch[1]}.storage.supabase.co/storage/v1/upload/resumable`
  return `${url.origin}/storage/v1/upload/resumable`
}

export function signMediaUploadIntent(claims: MediaUploadIntentClaims, secret: string): string {
  if (!secret) throw new Error('Media upload intent signing secret is missing')
  const payload = base64Url(JSON.stringify(claims))
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyMediaUploadIntent(token: unknown, secret: string, actorId: string, now = Date.now()): MediaUploadIntentClaims {
  const raw = String(token || '')
  const [payload, signature, extra] = raw.split('.')
  if (!payload || !signature || extra) throw new Error('Invalid media upload intent')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!timingSafeEqualText(signature, expected)) throw new Error('Invalid media upload intent')
  let claims: MediaUploadIntentClaims
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MediaUploadIntentClaims }
  catch { throw new Error('Invalid media upload intent') }
  if (!claims || claims.actorId !== actorId || claims.bucket !== PUBLIC_MEDIA_BUCKET) throw new Error('Media upload intent does not belong to this Admin session')
  if (!claims.storagePath.startsWith('cms/') || !claims.filename || !SUPPORTED_CMS_MEDIA_MIME_TYPES.has(claims.mimeType)) throw new Error('Media upload intent contains invalid media metadata')
  if (!Number.isSafeInteger(claims.sizeBytes) || claims.sizeBytes <= 0 || !Number.isFinite(claims.expiresAt)) throw new Error('Media upload intent contains invalid size or expiry')
  if (claims.expiresAt <= now) throw new Error('Media upload authorization expired. Start the upload again.')
  return claims
}
