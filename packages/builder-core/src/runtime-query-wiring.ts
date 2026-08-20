import type {
  CollectionBinding,
  ConditionalStyleRule,
  PaginationPagesBinding,
  LayoutPageSchema,
  NodeInteraction,
  RuntimeAction,
  StudioNode,
} from '@platform/contracts'
import { createNode } from './editor-state'

export interface ProjectsQueryWiringReport {
  collectionNodeId?: string
  searchInputNodeId?: string
  previousButtonNodeId?: string
  nextButtonNodeId?: string
  pageButtonNodeIds: string[]
  pageNumbersWrapperNodeId?: string
  pageNumberTemplateNodeId?: string
  warnings: string[]
  changed: boolean
}

export interface ProjectsQueryWiringResult {
  schema: LayoutPageSchema
  report: ProjectsQueryWiringReport
}

const PROJECT_SEARCH_FIELDS = ['title', 'short_description', 'full_description', 'technologies']
const DEFAULT_PROJECTS_PAGE_SIZE = 12
const PROJECTS_STATE_KEYS = {
  search: 'projects.search',
  page: 'projects.page',
  total: 'projects.total',
  pageCount: 'projects.pageCount',
  hasNext: 'projects.hasNext',
  hasPrevious: 'projects.hasPrevious',
} as const

function nodeTag(node: StudioNode): string {
  return String(node.tag || node.type || '').toLowerCase()
}

function ownText(node: StudioNode): string {
  const values = [
    node.props?.text,
    node.props?.placeholder,
    node.props?.name,
    node.props?.value,
    node.meta?.label,
    node.meta?.adminLabel,
    node.meta?.sectionLabel,
    node.accessibility?.ariaLabel,
    node.accessibility?.title,
  ]
  return values.filter((value) => typeof value === 'string').join(' ')
}

function visibleText(node: StudioNode): string {
  return [ownText(node), ...(node.children || []).map(visibleText)].join(' ').replace(/\s+/g, ' ').trim()
}

function flattenNodes(nodes: readonly StudioNode[]): StudioNode[] {
  const result: StudioNode[] = []
  const visit = (node: StudioNode) => {
    result.push(node)
    for (const child of node.children || []) visit(child)
  }
  for (const node of nodes) visit(node)
  return result
}

function projectCollectionEntry(node: StudioNode): { property: string; binding: CollectionBinding } | undefined {
  for (const [property, binding] of Object.entries(node.bindings || {})) {
    if (binding.type !== 'collection') continue
    if ((binding.source === undefined || binding.source === 'collection') && binding.collection === 'projects') return { property, binding }
  }
  if ((node.type === 'collection' || nodeTag(node) === 'div') && node.props?.collection === 'projects') {
    return { property: 'items', binding: { type: 'collection', collection: 'projects' } }
  }
  return undefined
}

function isInputNode(node: StudioNode): boolean {
  const tag = nodeTag(node)
  return tag === 'input' || tag === 'textarea'
}

function isClickableNode(node: StudioNode): boolean {
  const tag = nodeTag(node)
  return tag === 'button' || tag === 'a'
}

function searchInputScore(node: StudioNode): number {
  if (!isInputNode(node)) return -1
  const text = visibleText(node).toLowerCase()
  let score = 1
  if (text.includes('search')) score += 100
  if (text.includes('project')) score += 30
  if (String(node.props?.type || '').toLowerCase() === 'search') score += 40
  return score
}


function pickSearchInput(nodes: readonly StudioNode[]): StudioNode | undefined {
  if (nodes.length === 1) return nodes[0]
  const best = pickBest(nodes, searchInputScore)
  return best && searchInputScore(best) > 1 ? best : undefined
}

function paginationButtonScore(node: StudioNode, direction: 'previous' | 'next'): number {
  if (!isClickableNode(node)) return -1
  const text = visibleText(node).toLowerCase()
  const previous = ['previous', 'prev', 'back', '←', '‹', '«']
  const next = ['next', 'forward', '→', '›', '»']
  const tokens = direction === 'previous' ? previous : next
  let score = 0
  for (const token of tokens) if (text.includes(token)) score += token.length > 2 ? 40 : 15
  if (text.includes('page')) score += 5
  return score || -1
}

function numericButtonPage(node: StudioNode): number | undefined {
  if (!isClickableNode(node)) return undefined
  const candidates = [node.props?.text, node.props?.value, visibleText(node)]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue
    const match = String(candidate).trim().match(/^(?:page\s*)?(\d{1,4})$/i)
    if (!match) continue
    const page = Number(match[1])
    if (Number.isInteger(page) && page >= 1) return page
  }
  return undefined
}

function pageNumberTemplateScore(node: StudioNode): number {
  if (!isClickableNode(node)) return -1
  const own = ownText(node).toLowerCase()
  const visible = visibleText(node).toLowerCase()
  let score = 0
  if (own.includes('page number')) score += 120
  if (numericButtonPage(node)) score += 60
  if (/\bpage\s*\d+\b/.test(visible)) score += 20
  return score || -1
}

function parentByChildId(nodes: readonly StudioNode[]): Map<string, StudioNode> {
  const parents = new Map<string, StudioNode>()
  const visit = (node: StudioNode) => {
    for (const child of node.children || []) {
      parents.set(child.id, node)
      visit(child)
    }
  }
  for (const node of nodes) visit(node)
  return parents
}

const GENERATED_RULE_IDS = {
  previousDisabled: 'projects-pagination-previous-disabled',
  nextDisabled: 'projects-pagination-next-disabled',
  pageActive: 'projects-pagination-page-active',
  pageEllipsis: 'projects-pagination-page-ellipsis',
} as const

function mergeGeneratedConditionalStyles(node: StudioNode, rules: ConditionalStyleRule[]): StudioNode {
  const generatedIds = new Set(rules.map((rule) => rule.id).filter(Boolean))
  const retained = (node.conditionalStyles || []).filter((rule) => !rule.id || !generatedIds.has(rule.id))
  return { ...node, conditionalStyles: [...retained, ...rules] }
}

function paginationDisabledRule(id: string, stateKey: string): ConditionalStyleRule {
  return {
    id,
    when: { left: { source: 'state', key: stateKey }, operator: 'falsy' },
    styles: { desktop: { opacity: 0.38, cursor: 'not-allowed', pointerEvents: 'none' } },
  }
}

function pageTemplateRules(): ConditionalStyleRule[] {
  return [
    {
      id: GENERATED_RULE_IDS.pageActive,
      when: { left: { source: 'field', key: 'isActive' }, operator: 'truthy' },
      styles: { desktop: { background: 'var(--site-accent, var(--site-primary))', color: 'var(--site-bg)', borderColor: 'var(--site-accent, var(--site-primary))', opacity: 1, fontWeight: 800 } },
    },
    {
      id: GENERATED_RULE_IDS.pageEllipsis,
      when: { left: { source: 'field', key: 'isEllipsis' }, operator: 'truthy' },
      styles: { desktop: { background: 'transparent', color: 'var(--site-muted)', borderColor: 'transparent', cursor: 'default', pointerEvents: 'none' } },
    },
  ]
}

function pickBest(nodes: readonly StudioNode[], score: (node: StudioNode) => number): StudioNode | undefined {
  return nodes
    .map((node, index) => ({ node, index, score: score(node) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.node
}

function actionTargetsState(action: RuntimeAction, key: string): boolean {
  return (action.type === 'set-state' || action.type === 'toggle-state' || action.type === 'increment-state') && action.key === key
}

function mergeInteraction(node: StudioNode, event: NodeInteraction['event'], actions: RuntimeAction[], replacedStateKeys: readonly string[]): StudioNode {
  const existing = (node.interactions || []).find((interaction) => interaction.event === event)
  const retainedActions = (existing?.actions || []).filter((action) => !replacedStateKeys.some((key) => actionTargetsState(action, key)))
  const nextInteraction: NodeInteraction = { event, actions: [...retainedActions, ...actions] }
  const nextInteractions = [...(node.interactions || []).filter((interaction) => interaction.event !== event), nextInteraction]
  return { ...node, interactions: nextInteractions }
}

function mapNodes(nodes: readonly StudioNode[], updates: ReadonlyMap<string, (node: StudioNode) => StudioNode>): StudioNode[] {
  return nodes.map((node) => {
    const children = node.children ? mapNodes(node.children, updates) : node.children
    const withChildren = children === node.children ? node : { ...node, children }
    const update = updates.get(node.id)
    return update ? update(withChildren) : withChildren
  })
}

function withInitialStateDefault(state: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  return Object.prototype.hasOwnProperty.call(state, key) ? state : { ...state, [key]: value }
}

/**
 * Wires an existing database-authored Projects index page to the generic runtime query engine.
 * The function is intentionally heuristic only for locating already-authored controls; all
 * persisted behavior it writes is explicit runtime contract data and can be inspected/edited in Studio.
 */
export function wireProjectsPageQuery(schema: LayoutPageSchema): ProjectsQueryWiringResult {
  const nodes = flattenNodes(schema.root)
  const collectionCandidate = nodes.map((node) => ({ node, entry: projectCollectionEntry(node) })).find((candidate) => candidate.entry)
  const report: ProjectsQueryWiringReport = { pageButtonNodeIds: [], warnings: [], changed: false }

  if (!collectionCandidate?.entry) {
    report.warnings.push('No Projects collection binding was found on this page.')
    return { schema, report }
  }

  const { node: collectionNode, entry } = collectionCandidate
  report.collectionNodeId = collectionNode.id

  const existingBinding = entry.binding
  const searchKey = existingBinding.search?.query.source === 'state' ? existingBinding.search.query.key : PROJECTS_STATE_KEYS.search
  const pageKey = existingBinding.pagination?.pageStateKey || PROJECTS_STATE_KEYS.page
  const totalKey = existingBinding.pagination?.totalStateKey || PROJECTS_STATE_KEYS.total
  const pageCountKey = existingBinding.pagination?.pageCountStateKey || PROJECTS_STATE_KEYS.pageCount
  const hasNextKey = existingBinding.pagination?.hasNextStateKey || PROJECTS_STATE_KEYS.hasNext
  const hasPreviousKey = existingBinding.pagination?.hasPreviousStateKey || PROJECTS_STATE_KEYS.hasPrevious
  const pageSize = existingBinding.pagination?.pageSize || existingBinding.limit || DEFAULT_PROJECTS_PAGE_SIZE

  const nextCollectionBinding: CollectionBinding = {
    ...existingBinding,
    source: existingBinding.source,
    collection: 'projects',
    search: {
      query: { source: 'state', key: searchKey },
      fields: existingBinding.search?.fields?.length ? existingBinding.search.fields : PROJECT_SEARCH_FIELDS,
      mode: existingBinding.search?.mode || 'contains',
      caseSensitive: existingBinding.search?.caseSensitive,
    },
    pagination: {
      pageStateKey: pageKey,
      pageSize,
      totalStateKey: totalKey,
      pageCountStateKey: pageCountKey,
      hasNextStateKey: hasNextKey,
      hasPreviousStateKey: hasPreviousKey,
    },
    // A legacy collection limit would cap the collection before pagination. When explicitly
    // converting a page to pagination, treat that limit as pageSize and remove the cap.
    limit: undefined,
  }

  const updates = new Map<string, (node: StudioNode) => StudioNode>()
  updates.set(collectionNode.id, (node) => ({
    ...node,
    bindings: { ...(node.bindings || {}), [entry.property]: nextCollectionBinding },
  }))

  const inputCandidates = nodes.filter(isInputNode)
  const searchInput = pickSearchInput(inputCandidates)
  if (searchInput) {
    report.searchInputNodeId = searchInput.id
    updates.set(searchInput.id, (node) => mergeInteraction(node, 'input', [
      { type: 'set-state', key: searchKey, value: { source: 'event', key: 'value' } },
      { type: 'set-state', key: pageKey, value: { source: 'literal', value: 1 } },
    ], [searchKey, pageKey]))
  } else {
    report.warnings.push('Projects query is configured, but no search input was found to bind.')
  }

  const clickable = nodes.filter(isClickableNode)
  const previousButton = pickBest(clickable, (node) => paginationButtonScore(node, 'previous'))
  const nextButton = pickBest(clickable.filter((node) => node.id !== previousButton?.id), (node) => paginationButtonScore(node, 'next'))

  if (previousButton) {
    report.previousButtonNodeId = previousButton.id
    updates.set(previousButton.id, (node) => {
      const wired = mergeInteraction(node, 'click', [
        { type: 'increment-state', key: pageKey, amount: -1 },
      ], [pageKey])
      return mergeGeneratedConditionalStyles({
        ...wired,
        disabledWhen: { left: { source: 'state', key: hasPreviousKey }, operator: 'falsy' },
      }, [paginationDisabledRule(GENERATED_RULE_IDS.previousDisabled, hasPreviousKey)])
    })
  } else report.warnings.push('No Previous pagination button was found.')

  if (nextButton) {
    report.nextButtonNodeId = nextButton.id
    updates.set(nextButton.id, (node) => {
      const wired = mergeInteraction(node, 'click', [
        { type: 'increment-state', key: pageKey, amount: 1 },
      ], [pageKey])
      return mergeGeneratedConditionalStyles({
        ...wired,
        disabledWhen: { left: { source: 'state', key: hasNextKey }, operator: 'falsy' },
      }, [paginationDisabledRule(GENERATED_RULE_IDS.nextDisabled, hasNextKey)])
    })
  } else report.warnings.push('No Next pagination button was found.')

  const parents = parentByChildId(schema.root)
  const pageTemplate = pickBest(
    clickable.filter((node) => node.id !== previousButton?.id && node.id !== nextButton?.id),
    pageNumberTemplateScore,
  )

  if (pageTemplate) {
    report.pageNumberTemplateNodeId = pageTemplate.id
    const pageParent = parents.get(pageTemplate.id)
    const pageSiblings = (pageParent?.children || []).filter((node) => node.id !== previousButton?.id && node.id !== nextButton?.id && pageNumberTemplateScore(node) >= 0)
    report.pageButtonNodeIds = pageSiblings.map((node) => node.id)

    updates.set(pageTemplate.id, (node) => {
      const wired = mergeInteraction(node, 'click', [
        { type: 'set-state', key: pageKey, value: { source: 'field', key: 'pageNumber', fallback: 1 } },
      ], [pageKey])
      return mergeGeneratedConditionalStyles({
        ...wired,
        bindings: {
          ...(wired.bindings || {}),
          text: { type: 'field', field: 'label', fallback: String(wired.props?.text || '1') },
          disabled: { type: 'field', field: 'disabled', fallback: false },
        },
      }, pageTemplateRules())
    })

    if (pageParent) {
      const parentContainsPrevNext = (pageParent.children || []).some((child) => child.id === previousButton?.id || child.id === nextButton?.id)
      if (parentContainsPrevNext) {
        const wrapper = createNode('div', {
          meta: { label: 'Page Numbers Wrapper' },
          styles: { desktop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        })
        report.pageNumbersWrapperNodeId = wrapper.id
        updates.set(pageParent.id, (node) => {
          const children = node.children || []
          const pageIds = new Set(children.filter((child) => child.id !== previousButton?.id && child.id !== nextButton?.id && pageNumberTemplateScore(child) >= 0).map((child) => child.id))
          const template = children.find((child) => child.id === pageTemplate.id)
          let inserted = false
          const nextChildren: StudioNode[] = []
          for (const child of children) {
            if (!pageIds.has(child.id)) { nextChildren.push(child); continue }
            if (inserted) continue
            inserted = true
            nextChildren.push({
              ...wrapper,
              bindings: { items: { type: 'pagination-pages', pageStateKey: pageKey, pageCountStateKey: pageCountKey, maxVisiblePages: 7, showFirstLast: true, showEllipsis: true } },
              children: template ? [template] : [],
            })
          }
          return { ...node, children: nextChildren }
        })
      } else {
        report.pageNumbersWrapperNodeId = pageParent.id
        updates.set(pageParent.id, (node) => {
          const existingRepeat = Object.values(node.bindings || {}).find((binding): binding is PaginationPagesBinding => binding.type === 'pagination-pages')
          const pageIds = new Set((node.children || []).filter((child) => pageNumberTemplateScore(child) >= 0).map((child) => child.id))
          const template = (node.children || []).find((child) => child.id === pageTemplate.id)
          return {
            ...node,
            bindings: {
              ...(node.bindings || {}),
              items: {
                type: 'pagination-pages',
                pageStateKey: pageKey,
                pageCountStateKey: pageCountKey,
                maxVisiblePages: existingRepeat?.maxVisiblePages ?? 7,
                showFirstLast: existingRepeat?.showFirstLast ?? true,
                showEllipsis: existingRepeat?.showEllipsis ?? true,
              },
            },
            children: (node.children || []).filter((child) => !pageIds.has(child.id) || child.id === pageTemplate.id).map((child) => child.id === pageTemplate.id && template ? template : child),
          }
        })
      }
    } else report.warnings.push('A Page Number control was found, but its wrapper could not be determined.')
  } else {
    report.warnings.push('No Page Number template button was found. Previous/Next still work, but numbered pages will not render dynamically.')
  }

  let initialState = { ...(schema.initialState || {}) }
  initialState = withInitialStateDefault(initialState, searchKey, '')
  initialState = withInitialStateDefault(initialState, pageKey, 1)
  initialState = withInitialStateDefault(initialState, totalKey, 0)
  initialState = withInitialStateDefault(initialState, pageCountKey, 0)
  initialState = withInitialStateDefault(initialState, hasNextKey, false)
  initialState = withInitialStateDefault(initialState, hasPreviousKey, false)

  const nextSchema: LayoutPageSchema = {
    ...schema,
    collectionName: schema.collectionName || 'projects',
    initialState,
    root: mapNodes(schema.root, updates),
  }
  report.changed = true
  return { schema: nextSchema, report }
}

/**
 * Reusable Projects search/pagination controls for starter layouts. Existing layouts are not
 * rewritten automatically; Studio's page action runs wireProjectsPageQuery against the draft.
 */
export function createProjectsQueryControls(): StudioNode {
  const search = createNode('input', {
    props: { type: 'search', placeholder: 'Search projects…' },
    meta: { label: 'Search Projects' },
    accessibility: { ariaLabel: 'Search projects' },
    styles: { desktop: { flex: '1 1 260px', minWidth: '220px', padding: '12px 14px', border: '1px solid var(--site-border)', borderRadius: '10px', background: 'var(--site-surface)', color: 'var(--site-text)' } },
  })
  const previous = createNode('button', {
    props: { text: 'Previous' },
    meta: { label: 'Previous Page' },
    styles: { desktop: { padding: '10px 14px', border: '1px solid var(--site-border)', borderRadius: '10px', background: 'var(--site-surface)', color: 'var(--site-text)', cursor: 'pointer' } },
  })
  const next = createNode('button', {
    props: { text: 'Next' },
    meta: { label: 'Next Page' },
    styles: { desktop: { padding: '10px 14px', border: '1px solid var(--site-border)', borderRadius: '10px', background: 'var(--site-surface)', color: 'var(--site-text)', cursor: 'pointer' } },
  })
  const pageNumber = createNode('button', {
    props: { text: '1' },
    meta: { label: 'Page Number' },
    styles: { desktop: { minWidth: '40px', padding: '10px', border: '1px solid var(--site-border)', borderRadius: '10px', background: 'transparent', color: 'var(--site-text)', cursor: 'pointer' } },
  })
  const pageNumbers = createNode('div', {
    meta: { label: 'Page Numbers Wrapper' },
    styles: { desktop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
    children: [pageNumber],
  })
  const pagination = createNode('div', {
    meta: { label: 'Projects Pagination' },
    styles: { desktop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
    children: [previous, pageNumbers, next],
  })
  return createNode('div', {
    meta: { label: 'Projects Query Controls', sectionLabel: 'Projects Query Controls' },
    styles: { desktop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', margin: '28px 0 0' } },
    children: [search, pagination],
  })
}
