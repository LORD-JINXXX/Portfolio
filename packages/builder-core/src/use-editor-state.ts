import { useCallback, useMemo, useState } from 'react'
import type {
  EditorDocument,
  EditorPage,
  LayoutPageSchema,
  LayoutVersionStatus,
  PageType,
  ResponsiveMode,
  StudioNode,
} from '@platform/contracts'
import {
  canChangeNodeLock,
  canEditNode,
  canNodeContainChildren,
  cloneNode,
  cloneNodeWithFreshIds,
  commitNodeMove,
  createBlankDocument,
  createEmptyPage,
  createNode,
  defaultRouteForPage,
  findNodeById,
  findParentById,
  genId,
  insertNode,
  isDescendant,
  nodeHasLockedAncestor,
  normalizeEditorDocument,
  removeNodeById,
  slugify,
  uniquePageSlug,
  uniqueRoutePattern,
  updateNodeInArray,
  type EditorState,
  type EditorTool,
} from './editor-state'

export function useEditorState(initialDocument?: EditorDocument) {
  const initial = normalizeEditorDocument(initialDocument || createBlankDocument())
  const initialPage = initial.pages.find((page) => page.pageType === 'home') || initial.pages[0]
  const [state, setState] = useState<EditorState>(() => ({
    ...initial,
    layoutSlug: initial.layoutSlug || slugify(initial.layoutName),
    layoutDescription: initial.layoutDescription || '',
    pageId: initialPage.id,
    pageName: initialPage.name,
    schema: cloneNode(initialPage.schema),
    selectedNodeId: null,
    hoveredNodeId: null,
    tool: 'select',
    mode: 'desktop',
    zoom: 1,
    history: [cloneNode(initialPage.schema)],
    historyIndex: 0,
    clipboard: null,
    isDragging: false,
    dragOverId: null,
    dragPosition: null,
    dirty: false,
  }))

  const currentPage = useMemo(() => state.pages.find((page) => page.id === state.pageId), [state.pages, state.pageId])

  const syncCurrentSchema = useCallback((prev: EditorState, newSchema: LayoutPageSchema, pushHistory = true): EditorState => {
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema: newSchema } : page)
    const history = pushHistory ? [...prev.history.slice(0, prev.historyIndex + 1), cloneNode(newSchema)] : prev.history
    return { ...prev, pages, schema: newSchema, history, historyIndex: pushHistory ? history.length - 1 : prev.historyIndex, dirty: true }
  }, [])

  const loadDocument = useCallback((document: EditorDocument, preferredPageId?: string) => {
    const normalized = normalizeEditorDocument(document)
    const page = normalized.pages.find((item) => item.id === preferredPageId) || normalized.pages.find((item) => item.pageType === 'home') || normalized.pages[0]
    setState((prev) => ({
      ...prev,
      ...cloneNode(normalized),
      layoutSlug: normalized.layoutSlug || slugify(normalized.layoutName),
      layoutDescription: normalized.layoutDescription || '',
      pageId: page.id,
      pageName: page.name,
      schema: cloneNode(page.schema),
      selectedNodeId: null,
      hoveredNodeId: null,
      history: [cloneNode(page.schema)],
      historyIndex: 0,
      dirty: false,
    }))
  }, [])

  const setDocumentMeta = useCallback((patch: Partial<Pick<EditorState, 'layoutName' | 'layoutSlug' | 'layoutDescription' | 'designTokens'>>) => {
    setState((prev) => ({ ...prev, ...patch, dirty: true }))
  }, [])

  const updateSchema = useCallback((updater: (schema: LayoutPageSchema) => LayoutPageSchema) => {
    setState((prev) => syncCurrentSchema(prev, updater(prev.schema)))
  }, [syncCurrentSchema])

  const updateNode = useCallback((nodeId: string, updater: (node: StudioNode) => StudioNode) => {
    setState((prev) => {
      if (!canEditNode(prev.schema.root, nodeId)) return prev
      const next = { ...prev.schema, root: updateNodeInArray(prev.schema.root, nodeId, updater) }
      return syncCurrentSchema(prev, next)
    })
  }, [syncCurrentSchema])

  const setNodeLocked = useCallback((nodeId: string, locked: boolean) => {
    setState((prev) => {
      if (!canChangeNodeLock(prev.schema.root, nodeId)) return prev
      const next = { ...prev.schema, root: updateNodeInArray(prev.schema.root, nodeId, (node) => ({ ...node, meta: { ...(node.meta || {}), locked } })) }
      return syncCurrentSchema(prev, next)
    })
  }, [syncCurrentSchema])

  const addNode = useCallback((type: EditorTool, parentId: string | null = null, index?: number) => {
    const node = createNode(type)
    let inserted = false
    setState((prev) => {
      if (parentId) {
        const parent = findNodeById(prev.schema.root, parentId)
        if (!parent || parent.meta?.locked || nodeHasLockedAncestor(prev.schema.root, parentId) || !canNodeContainChildren(parent)) return prev
      }
      inserted = true
      const next = { ...prev.schema, root: insertNode(prev.schema.root, parentId, node, index) }
      return { ...syncCurrentSchema(prev, next), selectedNodeId: node.id }
    })
    return inserted ? node.id : ''
  }, [syncCurrentSchema])

  const deleteNode = useCallback((nodeId: string) => {
    setState((prev) => {
      if (!canEditNode(prev.schema.root, nodeId)) return prev
      const next = { ...prev.schema, root: removeNodeById(prev.schema.root, nodeId) }
      const selectedGone = prev.selectedNodeId === nodeId || Boolean(prev.selectedNodeId && isDescendant(prev.schema.root, nodeId, prev.selectedNodeId))
      return { ...syncCurrentSchema(prev, next), selectedNodeId: selectedGone ? null : prev.selectedNodeId }
    })
  }, [syncCurrentSchema])

  const deleteSelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId || !canEditNode(prev.schema.root, prev.selectedNodeId)) return prev
    const next = { ...prev.schema, root: removeNodeById(prev.schema.root, prev.selectedNodeId) }
    return { ...syncCurrentSchema(prev, next), selectedNodeId: null }
  }), [syncCurrentSchema])

  const copySelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId) return prev
    const node = findNodeById(prev.schema.root, prev.selectedNodeId)
    return node ? { ...prev, clipboard: cloneNode(node) } : prev
  }), [])

  const pasteClipboard = useCallback(() => setState((prev) => {
    if (!prev.clipboard) return prev
    let parentId: string | null = null
    if (prev.selectedNodeId) {
      const selected = findNodeById(prev.schema.root, prev.selectedNodeId)
      if (selected && canNodeContainChildren(selected)) {
        if (selected.meta?.locked || nodeHasLockedAncestor(prev.schema.root, selected.id)) return prev
        parentId = selected.id
      }
    }
    const cloned = cloneNodeWithFreshIds(prev.clipboard)
    const nextRoot = insertNode(prev.schema.root, parentId, cloned)
    return { ...syncCurrentSchema(prev, { ...prev.schema, root: nextRoot }), selectedNodeId: cloned.id }
  }), [syncCurrentSchema])

  const duplicateSelected = useCallback(() => setState((prev) => {
    if (!prev.selectedNodeId || !canEditNode(prev.schema.root, prev.selectedNodeId)) return prev
    const node = findNodeById(prev.schema.root, prev.selectedNodeId)
    if (!node) return prev
    const location = findParentById(prev.schema.root, node.id)
    if (location.parent?.meta?.locked) return prev
    const cloned = cloneNodeWithFreshIds(node)
    const nextRoot = insertNode(prev.schema.root, location.parent?.id || null, cloned, location.index + 1)
    return { ...syncCurrentSchema(prev, { ...prev.schema, root: nextRoot }), selectedNodeId: cloned.id }
  }), [syncCurrentSchema])

  const moveNode = useCallback((nodeId: string, targetParentId: string | null, targetIndex: number) => {
    setState((prev) => {
      const committed = commitNodeMove(prev.schema, prev.history, prev.historyIndex, nodeId, targetParentId, targetIndex)
      if (!committed.moved) return prev
      const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema: committed.schema } : page)
      return { ...prev, pages, schema: committed.schema, history: committed.history, historyIndex: committed.historyIndex, selectedNodeId: nodeId, dirty: true }
    })
  }, [])

  const undo = useCallback(() => setState((prev) => {
    if (prev.historyIndex <= 0) return prev
    const index = prev.historyIndex - 1
    const schema = cloneNode(prev.history[index])
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema } : page)
    return { ...prev, schema, pages, historyIndex: index, selectedNodeId: null, dirty: true }
  }), [])

  const redo = useCallback(() => setState((prev) => {
    if (prev.historyIndex >= prev.history.length - 1) return prev
    const index = prev.historyIndex + 1
    const schema = cloneNode(prev.history[index])
    const pages = prev.pages.map((page) => page.id === prev.pageId ? { ...page, schema } : page)
    return { ...prev, schema, pages, historyIndex: index, selectedNodeId: null, dirty: true }
  }), [])

  const switchPage = useCallback((pageId: string) => setState((prev) => {
    const page = prev.pages.find((item) => item.id === pageId)
    if (!page) return prev
    return { ...prev, pageId, pageName: page.name, schema: cloneNode(page.schema), history: [cloneNode(page.schema)], historyIndex: 0, selectedNodeId: null }
  }), [])

  const addPage = useCallback((name: string, pageType: PageType = 'standard') => {
    const requestedType = pageType
    const page = createEmptyPage(name, requestedType)
    setState((prev) => {
      const effectiveType: PageType = requestedType === 'home' && prev.pages.some((item) => item.pageType === 'home') ? 'standard' : requestedType
      page.pageType = effectiveType
      page.slug = effectiveType === 'home' ? 'home' : uniquePageSlug(page.slug, prev.pages)
      page.routePattern = uniqueRoutePattern(defaultRouteForPage(page.slug, effectiveType), prev.pages, effectiveType)
      page.sortOrder = Math.max(0, ...prev.pages.filter((item) => item.pageType !== 'system').map((item) => item.sortOrder)) + 1
      return { ...prev, pages: [...prev.pages, page], pageId: page.id, pageName: page.name, schema: cloneNode(page.schema), history: [cloneNode(page.schema)], historyIndex: 0, selectedNodeId: null, dirty: true }
    })
    return page.id
  }, [])

  const duplicatePage = useCallback((pageId: string) => setState((prev) => {
    const source = prev.pages.find((page) => page.id === pageId)
    if (!source || source.pageType === 'system') return prev
    const id = genId()
    const clonedSchema = cloneNode(source.schema)
    const refreshTree = (node: StudioNode): StudioNode => ({ ...node, id: genId(), children: node.children?.map(refreshTree) })
    clonedSchema.pageId = id
    clonedSchema.root = clonedSchema.root.map(refreshTree)
    const duplicateSlug = uniquePageSlug(`${source.slug}-copy`, prev.pages)
    const duplicateType: PageType = source.pageType === 'home' ? 'standard' : source.pageType
    const sourceParams = [...source.routePattern.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => `:${match[1]}`)
    const duplicateBase = sourceParams.length ? `/${duplicateSlug}/${sourceParams.join('/')}` : `/${duplicateSlug}`
    const page: EditorPage = { ...cloneNode(source), id, name: `${source.name} Copy`, slug: duplicateSlug, pageType: duplicateType, routePattern: uniqueRoutePattern(duplicateBase, prev.pages, duplicateType), sortOrder: source.sortOrder + 1, schema: clonedSchema }
    const shifted = prev.pages.map((item) => item.pageType !== 'system' && item.sortOrder > source.sortOrder ? { ...item, sortOrder: item.sortOrder + 1 } : item)
    return { ...prev, pages: [...shifted, page], pageId: id, pageName: page.name, schema: clonedSchema, history: [clonedSchema], historyIndex: 0, selectedNodeId: null, dirty: true }
  }), [])

  const deletePage = useCallback((pageId: string) => setState((prev) => {
    const target = prev.pages.find((page) => page.id === pageId)
    // Header/footer and the single canonical Home route are structural anchors.
    if (!target || target.pageType === 'system' || target.pageType === 'home') return prev
    const nonSystem = prev.pages.filter((page) => page.pageType !== 'system')
    if (nonSystem.length <= 1) return prev
    const pages = prev.pages.filter((page) => page.id !== pageId)
    const nextPage = pages.find((page) => page.pageType === 'home') || pages.find((page) => page.pageType !== 'system') || pages[0]
    return { ...prev, pages, pageId: nextPage.id, pageName: nextPage.name, schema: cloneNode(nextPage.schema), history: [cloneNode(nextPage.schema)], historyIndex: 0, selectedNodeId: null, dirty: true }
  }), [])

  const updatePage = useCallback((pageId: string, patch: Partial<Omit<EditorPage, 'id' | 'schema'>>) => setState((prev) => {
    const target = prev.pages.find((page) => page.id === pageId)
    if (!target) return prev
    const requestedType = patch.pageType ?? target.pageType
    const pageType: PageType = target.pageType === 'home'
      ? 'home'
      : requestedType === 'home'
        ? 'standard'
        : target.pageType === 'system' ? 'system' : requestedType
    const requestedName = typeof patch.name === 'string' ? patch.name : target.name
    const requestedSlug = typeof patch.slug === 'string' ? patch.slug : (typeof patch.name === 'string' ? requestedName : target.slug)
    const slug = pageType === 'home' ? 'home' : pageType === 'system' ? target.slug : uniquePageSlug(requestedSlug, prev.pages, pageId)
    const rawRoute = pageType === 'home'
      ? '/'
      : pageType === 'system'
        ? target.routePattern
        : typeof patch.routePattern === 'string'
          ? patch.routePattern
          : (typeof patch.slug === 'string' || typeof patch.name === 'string' || patch.pageType !== undefined)
            ? defaultRouteForPage(slug, pageType)
            : target.routePattern
    const routePattern = pageType === 'system' ? rawRoute : uniqueRoutePattern(rawRoute, prev.pages, pageType, pageId)
    const safePatch = { ...patch, name: requestedName, pageType, slug, routePattern }
    const pages = prev.pages.map((page) => page.id === pageId ? { ...page, ...safePatch } : page)
    const current = pages.find((page) => page.id === prev.pageId)
    return { ...prev, pages, pageName: current?.name || prev.pageName, dirty: true }
  }), [])

  const updatePageName = useCallback((pageId: string, name: string) => {
    updatePage(pageId, { name })
  }, [updatePage])

  const reorderPage = useCallback((pageId: string, direction: -1 | 1) => setState((prev) => {
    const ordinary = prev.pages.filter((page) => page.pageType !== 'system').sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordinary.findIndex((page) => page.id === pageId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordinary.length) return prev
    const a = ordinary[index]
    const b = ordinary[target]
    const pages = prev.pages.map((page) => page.id === a.id ? { ...page, sortOrder: b.sortOrder } : page.id === b.id ? { ...page, sortOrder: a.sortOrder } : page)
    return { ...prev, pages, dirty: true }
  }), [])

  const exportDocument = useCallback((): EditorDocument => ({
    layoutId: state.layoutId,
    layoutName: state.layoutName,
    layoutSlug: state.layoutSlug,
    layoutDescription: state.layoutDescription,
    versionId: state.versionId,
    versionNumber: state.versionNumber,
    versionStatus: state.versionStatus,
    designTokens: cloneNode(state.designTokens),
    pages: cloneNode(state.pages),
  }), [state])

  const markSaved = useCallback((ids?: { layoutId?: string; versionId?: string; versionNumber?: number; versionStatus?: LayoutVersionStatus }) => {
    setState((prev) => ({ ...prev, ...ids, dirty: false }))
  }, [])

  return {
    state,
    setState,
    currentPage,
    loadDocument,
    exportDocument,
    markSaved,
    setDocumentMeta,
    selectNode: (id: string | null) => setState((prev) => ({ ...prev, selectedNodeId: id })),
    updateSchema,
    updateNode,
    setNodeLocked,
    addNode,
    deleteSelected,
    deleteNode,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    moveNode,
    undo,
    redo,
    setTool: (tool: EditorTool) => setState((prev) => ({ ...prev, tool })),
    setMode: (mode: ResponsiveMode) => setState((prev) => ({ ...prev, mode })),
    setZoom: (zoom: number) => setState((prev) => ({ ...prev, zoom: Math.max(0.25, Math.min(2, zoom)) })),
    pushHistory: (schema: LayoutPageSchema) => setState((prev) => syncCurrentSchema(prev, schema)),
    addPage,
    duplicatePage,
    switchPage,
    deletePage,
    updatePage,
    updatePageName,
    reorderPage,
  }
}
