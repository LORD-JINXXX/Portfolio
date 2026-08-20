import { blogManagedMediaIds, type BlogBlock } from './blog-content'
type SupabaseLike = any

export const STRUCTURED_MEDIA_FIELDS: Record<string, Record<string, string | null>> = {
  projects: { thumbnail_media_id: 'thumbnail' },
  notes: { cover_media_id: 'cover_image' },
  experience: { logo_media_id: 'logo' },
  apps: { icon_media_id: 'icon', cover_media_id: 'cover_image' },
  blogs: { cover_media_id: null },
}

export async function normalizeStructuredMediaInput(
  db: SupabaseLike,
  resource: string,
  input: Record<string, unknown>,
) {
  const body = { ...input }
  for (const [idField, legacyField] of Object.entries(STRUCTURED_MEDIA_FIELDS[resource] || {})) {
    if (!(idField in body)) continue
    const mediaId = body[idField]
    if (mediaId === null || mediaId === '') {
      body[idField] = null
      if (legacyField) body[legacyField] = null
      continue
    }
    const { data, error } = await db.from('media').select('id,public_url').eq('id', mediaId).maybeSingle()
    if (error || !data) throw new Error(`Managed media not found for ${idField}`)
    body[idField] = data.id
    if (legacyField) body[legacyField] = data.public_url
  }
  return body
}

export async function assertBlogBlockMedia(db: SupabaseLike, blocks: unknown) {
  if (!Array.isArray(blocks)) return
  const ids = blogManagedMediaIds(blocks as BlogBlock[])
  if (!ids.length) return
  const { data, error } = await db.from('media').select('id').in('id', ids)
  if (error) throw new Error(error.message || 'Blog managed media validation failed')
  const found = new Set((data || []).map((row: any) => String(row.id)))
  const missing = ids.find((id) => !found.has(id))
  if (missing) throw new Error(`Managed media not found for blog content block: ${missing}`)
}

export async function loadProjectGallery(db: SupabaseLike, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, any[]>()
  const { data, error } = await db.from('project_gallery_media').select('project_id,media_id,sort_order,media(id,filename,storage_path,public_url,mime_type,size,kind,alt_text)').in('project_id', projectIds).order('sort_order')
  if (error) throw error
  const grouped = new Map<string, any[]>()
  for (const row of data || []) grouped.set(row.project_id, [...(grouped.get(row.project_id) || []), { media_id: row.media_id, sort_order: row.sort_order, media: row.media }])
  return grouped
}

export async function replaceProjectGallery(db: SupabaseLike, projectId: string, mediaIds: unknown) {
  if (!Array.isArray(mediaIds)) return
  if (mediaIds.length > 60) throw new Error('Project gallery cannot exceed 60 managed media items')
  const ids = mediaIds.map(String)
  if (new Set(ids).size !== ids.length) throw new Error('Project gallery cannot contain duplicate media')
  const { data, error } = await db.rpc('replace_project_gallery_media', { target_project_id: projectId, media_ids: ids })
  if (error) throw new Error(error.message || 'Project gallery update failed')
  return (data || []).map((row: any) => row.public_url).filter(Boolean)
}
