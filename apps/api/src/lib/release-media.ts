import type { EditorDocument } from '@platform/contracts'

export interface CollectableMedia {
  id: string
  storage_path: string
  public_url?: string | null
  url?: string | null
}

export interface MediaReferenceClassification {
  source: string
  value: unknown
  reason: string
}

export interface ReleaseMediaCollection {
  complete: boolean
  mediaIds: string[]
  resolved: Array<{ mediaId: string; sources: string[] }>
  external: MediaReferenceClassification[]
  unresolved: MediaReferenceClassification[]
}

export interface ReleaseMediaCollectionInput {
  document: EditorDocument
  content: Record<string, unknown>
  settings: Record<string, unknown>
  collections: Record<string, unknown[]>
  media: CollectableMedia[]
  managedPublicMediaOrigins?: string[]
  legacyResolutions?: Record<string, string>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PUBLIC_MEDIA_MARKER = '/storage/v1/object/public/public-media/'
const CSS_MEDIA_PROPERTIES = ['background', 'backgroundImage', 'maskImage'] as const

function addIndex(index: Map<string, Set<string>>, value: unknown, id: string) {
  if (typeof value !== 'string' || !value) return
  const ids = index.get(value) || new Set<string>()
  ids.add(id)
  index.set(value, ids)
}

function extractCssUrls(value: unknown): string[] {
  if (typeof value !== 'string' || !value.includes('url(')) return []
  return [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
    .map((match) => match[2])
    .filter(Boolean)
}

function sortClassifications(values: MediaReferenceClassification[]) {
  return values.sort((a, b) =>
    `${a.source}\u0000${String(a.value)}\u0000${a.reason}`.localeCompare(
      `${b.source}\u0000${String(b.value)}\u0000${b.reason}`,
    ),
  )
}

export function collectCanonicalReleaseMedia(input: ReleaseMediaCollectionInput): ReleaseMediaCollection {
  const mediaById = new Map(input.media.map((media) => [media.id, media]))
  const exact = new Map<string, Set<string>>()
  for (const media of input.media) {
    addIndex(exact, media.public_url, media.id)
    addIndex(exact, media.url, media.id)
    addIndex(exact, media.storage_path, media.id)
  }
  const managedOrigins = new Set((input.managedPublicMediaOrigins || []).map((value) => {
    try { return new URL(value).origin } catch { return value }
  }))
  const resolved = new Map<string, Set<string>>()
  const external: MediaReferenceClassification[] = []
  const unresolved: MediaReferenceClassification[] = []

  const resolve = (mediaId: string, source: string) => {
    const sources = resolved.get(mediaId) || new Set<string>()
    sources.add(source)
    resolved.set(mediaId, sources)
  }

  const inspect = (value: unknown, source: string) => {
    if (value === undefined || value === null || value === '') return
    if (typeof value !== 'string') {
      unresolved.push({ source, value, reason: 'media-reference-must-be-a-string' })
      return
    }
    const normalized = value.trim()
    if (!normalized) return
    const legacyResolution = input.legacyResolutions?.[normalized]
    if (legacyResolution) {
      if (mediaById.has(legacyResolution)) resolve(legacyResolution, source)
      else unresolved.push({ source, value: normalized, reason: 'legacy-resolution-media-not-found' })
      return
    }
    if (UUID.test(normalized)) {
      if (mediaById.has(normalized)) resolve(normalized, source)
      else unresolved.push({ source, value: normalized, reason: 'managed-media-id-not-found' })
      return
    }

    const candidates = exact.get(normalized)
    if (candidates?.size === 1) {
      resolve([...candidates][0], source)
      return
    }
    if (candidates && candidates.size > 1) {
      unresolved.push({ source, value: normalized, reason: 'ambiguous-managed-media-reference' })
      return
    }

    try {
      const url = new URL(normalized)
      if (managedOrigins.has(url.origin) && url.pathname.includes(PUBLIC_MEDIA_MARKER)) {
        let storagePath = ''
        try { storagePath = decodeURIComponent(url.pathname.split(PUBLIC_MEDIA_MARKER)[1] || '') }
        catch {
          unresolved.push({ source, value: normalized, reason: 'managed-public-media-path-is-invalid' })
          return
        }
        const pathCandidates = exact.get(storagePath)
        if (pathCandidates?.size === 1) resolve([...pathCandidates][0], source)
        else unresolved.push({ source, value: normalized, reason: pathCandidates?.size ? 'ambiguous-managed-public-media-path' : 'managed-public-media-path-not-found' })
        return
      }
      if (['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)) {
        external.push({ source, value: normalized, reason: 'external-or-unmanaged-media' })
        return
      }
    } catch {
      // A non-empty value in a known media-bearing field remains unresolved.
    }
    unresolved.push({ source, value: normalized, reason: 'unresolved-media-reference' })
  }

  const canonicalOrLegacy = (
    row: Record<string, unknown>,
    canonical: string,
    legacy: string,
    source: string,
  ) => {
    const canonicalValue = row[canonical]
    const useLegacy = canonicalValue === undefined || canonicalValue === null || canonicalValue === ''
    inspect(useLegacy ? row[legacy] : canonicalValue, `${source}.${useLegacy ? legacy : canonical}`)
  }

  for (const [index, value] of (input.collections.projects || []).entries()) {
    const project = value as Record<string, unknown>
    const source = `collections.projects[${index}]`
    canonicalOrLegacy(project, 'thumbnail_media_id', 'thumbnail', source)
    if (Object.prototype.hasOwnProperty.call(project, 'gallery_media')) {
      const gallery = Array.isArray(project.gallery_media) ? project.gallery_media : []
      gallery
        .map((entry, position) => ({ entry: entry as Record<string, unknown>, position }))
        .sort((a, b) => Number(a.entry.sort_order ?? a.position) - Number(b.entry.sort_order ?? b.position))
        .forEach(({ entry }, position) => inspect(entry.media_id, `${source}.gallery_media[${position}].media_id`))
    } else if (Object.prototype.hasOwnProperty.call(project, 'gallery_media_ids')) {
      const ids = Array.isArray(project.gallery_media_ids) ? project.gallery_media_ids : []
      ids.forEach((mediaId, position) => inspect(mediaId, `${source}.gallery_media_ids[${position}]`))
    } else {
      const gallery = Array.isArray(project.gallery) ? project.gallery : []
      gallery.forEach((entry, position) => inspect(entry, `${source}.gallery[${position}]`))
    }
  }
  for (const [index, value] of (input.collections.notes || []).entries()) {
    canonicalOrLegacy(value as Record<string, unknown>, 'cover_media_id', 'cover_image', `collections.notes[${index}]`)
  }
  for (const [index, value] of (input.collections.experience || []).entries()) {
    canonicalOrLegacy(value as Record<string, unknown>, 'logo_media_id', 'logo', `collections.experience[${index}]`)
  }
  for (const [index, value] of (input.collections.apps || []).entries()) {
    const app = value as Record<string, unknown>
    canonicalOrLegacy(app, 'icon_media_id', 'icon', `collections.apps[${index}]`)
    canonicalOrLegacy(app, 'cover_media_id', 'cover_image', `collections.apps[${index}]`)
  }

  // Generic collections deliberately use explicit media-bearing key names so arbitrary
  // UUID/text fields are never misclassified as managed media references.
  const inspectGenericMedia = (value: unknown, source: string, key = '') => {
    if (Array.isArray(value)) {
      if (key === 'media_ids' || key.endsWith('_media_ids')) value.forEach((entry, index) => inspect(entry, `${source}[${index}]`))
      else value.forEach((entry, index) => { if (entry && typeof entry === 'object') inspectGenericMedia(entry, `${source}[${index}]`) })
      return
    }
    if (!value || typeof value !== 'object') {
      if (key === 'media_id' || key.endsWith('_media_id')) inspect(value, source)
      return
    }
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) inspectGenericMedia(childValue, `${source}.${childKey}`, childKey)
  }
  const builtinCollections = new Set(['projects','notes','experience','apps'])
  for (const [collectionKey, rows] of Object.entries(input.collections)) {
    if (builtinCollections.has(collectionKey)) continue
    rows.forEach((row, index) => inspectGenericMedia(row, `collections.${collectionKey}[${index}]`))
  }

  const walk = (nodes: EditorDocument['pages'][number]['schema']['root'], pageId: string, parent = 'root') => {
    nodes.forEach((node, index) => {
      const source = `layout.${pageId}.${parent}[${index}].${node.id}`
      for (const [property, binding] of Object.entries(node.bindings || {})) {
        if (binding.type === 'media') inspect(binding.mediaId ?? binding.sampleUrl, `${source}.bindings.${property}`)
        if (binding.type === 'content' && binding.contentType === 'media') inspect(input.content[binding.key], `content.${binding.key}`)
        if (binding.type === 'setting' && property === 'src') inspect(input.settings[binding.key], `settings.${binding.key}`)
      }
      inspect(node.props?.src, `${source}.props.src`)
      if (node.type === 'ambient-field' && Array.isArray(node.props?.mediaIds)) node.props.mediaIds.forEach((mediaId, mediaIndex) => inspect(mediaId, `${source}.props.mediaIds[${mediaIndex}]`))
      for (const mode of ['desktop', 'tablet', 'mobile'] as const) {
        for (const property of CSS_MEDIA_PROPERTIES) {
          extractCssUrls(node.styles?.[mode]?.[property]).forEach((url, urlIndex) =>
            inspect(url, `${source}.styles.${mode}.${property}[${urlIndex}]`),
          )
        }
      }
      for (const [ruleIndex, rule] of (node.conditionalStyles || []).entries()) {
        for (const mode of ['desktop', 'tablet', 'mobile'] as const) {
          for (const property of CSS_MEDIA_PROPERTIES) {
            extractCssUrls(rule.styles?.[mode]?.[property]).forEach((url, urlIndex) =>
              inspect(url, `${source}.conditionalStyles[${ruleIndex}].styles.${mode}.${property}[${urlIndex}]`),
            )
          }
        }
      }
      if (node.children?.length) walk(node.children, pageId, `${parent}[${index}].children`)
    })
  }
  for (const page of [...input.document.pages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))) {
    walk(page.schema.root, page.id)
  }

  const resolvedRows = [...resolved.entries()]
    .map(([mediaId, sources]) => ({ mediaId, sources: [...sources].sort() }))
    .sort((a, b) => a.mediaId.localeCompare(b.mediaId))
  return {
    complete: unresolved.length === 0,
    mediaIds: resolvedRows.map((row) => row.mediaId),
    resolved: resolvedRows,
    external: sortClassifications(external),
    unresolved: sortClassifications(unresolved),
  }
}
