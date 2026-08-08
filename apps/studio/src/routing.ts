export interface StudioEditorRoute {
  layoutId: string
  versionId: string
}

export function studioLayoutsPath(): string {
  return '/'
}

const EDITOR_ROUTE = /^\/layouts\/([^/]+)\/versions\/([^/]+)\/editor\/?$/

export function parseStudioEditorRoute(pathname: string): StudioEditorRoute | null {
  const match = EDITOR_ROUTE.exec(pathname)
  if (!match) return null
  try {
    const layoutId = decodeURIComponent(match[1])
    const versionId = decodeURIComponent(match[2])
    return layoutId && versionId ? { layoutId, versionId } : null
  } catch {
    return null
  }
}

export function studioEditorPath(layoutId: string, versionId: string, pageId?: string | null): string {
  const path = `/layouts/${encodeURIComponent(layoutId)}/versions/${encodeURIComponent(versionId)}/editor`
  return pageId ? `${path}?page=${encodeURIComponent(pageId)}` : path
}

export function selectedPageFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('page')
}
