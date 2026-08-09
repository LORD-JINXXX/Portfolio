export const LAYOUT_HISTORY_DELETE_ERROR = 'This layout has published or release history and cannot be permanently deleted. Archive it instead.'
export const LAYOUT_WORKSPACE_DELETE_ERROR = 'This layout is selected in Admin workspace and cannot be permanently deleted.'

export interface LayoutVersionLifecycleInput {
  id: string
  version_number: number
  status: string
}

export interface LayoutVersionLifecycle extends LayoutVersionLifecycleInput {
  pageCount: number
  validationCount: number
  releaseReferenced: boolean
  workspaceReferenced: boolean
  canDiscard: boolean
  discardBlockReason: string | null
}

export interface LayoutLifecycleState {
  canDeletePermanently: boolean
  deleteBlockReason: string | null
  hasPublishedHistory: boolean
  hasReleaseHistory: boolean
  versions: LayoutVersionLifecycle[]
}

export function evaluateLayoutLifecycle(input: {
  versions: LayoutVersionLifecycleInput[]
  releaseVersionIds: ReadonlySet<string>
  workspaceVersionId: string | null
  pageCounts?: ReadonlyMap<string, number>
  validationCounts?: ReadonlyMap<string, number>
}): LayoutLifecycleState {
  const hasPublishedHistory = input.versions.some((version) => version.status !== 'draft')
  const hasReleaseHistory = input.versions.some((version) => input.releaseVersionIds.has(version.id))
  const hasWorkspaceReference = input.versions.some((version) => version.id === input.workspaceVersionId)
  const deleteBlockReason = hasPublishedHistory || hasReleaseHistory
    ? LAYOUT_HISTORY_DELETE_ERROR
    : hasWorkspaceReference ? LAYOUT_WORKSPACE_DELETE_ERROR : null

  const versions = input.versions.map((version): LayoutVersionLifecycle => {
    const releaseReferenced = input.releaseVersionIds.has(version.id)
    const workspaceReferenced = version.id === input.workspaceVersionId
    let discardBlockReason: string | null = null
    if (version.status !== 'draft') discardBlockReason = 'Only draft layout versions can be discarded. Published history is immutable.'
    else if (releaseReferenced) discardBlockReason = 'A release-referenced layout version cannot be discarded.'
    else if (workspaceReferenced) discardBlockReason = 'The Admin workspace is using this draft and it cannot be discarded.'
    else if (input.versions.length <= 1) discardBlockReason = 'The only layout version cannot be discarded. Delete the draft-only layout instead.'
    return {
      ...version,
      pageCount: input.pageCounts?.get(version.id) || 0,
      validationCount: input.validationCounts?.get(version.id) || 0,
      releaseReferenced,
      workspaceReferenced,
      canDiscard: discardBlockReason === null,
      discardBlockReason,
    }
  })

  return {
    canDeletePermanently: deleteBlockReason === null,
    deleteBlockReason,
    hasPublishedHistory,
    hasReleaseHistory,
    versions,
  }
}
