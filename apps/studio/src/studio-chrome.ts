export type StudioPanel = 'left' | 'right'
export type StudioToolbarMode = 'wide' | 'compact' | 'narrow'

export interface StudioPanelVisibility {
  left: boolean
  right: boolean
}

export const DEFAULT_PANEL_VISIBILITY: StudioPanelVisibility = { left: true, right: true }

export function toggleStudioPanel(visibility: StudioPanelVisibility, panel: StudioPanel): StudioPanelVisibility {
  return { ...visibility, [panel]: !visibility[panel] }
}

export function toolbarModeForWidth(width: number): StudioToolbarMode {
  if (width >= 1500) return 'wide'
  if (width >= 900) return 'compact'
  return 'narrow'
}

export function backToLayoutsRequiresConfirmation(dirty: boolean): boolean {
  return dirty
}
export function canvasScaleForViewport(availableWidth: number, viewportWidth: number, zoom: number): number {
  const safeViewport = Math.max(1, viewportWidth)
  const safeAvailable = Math.max(1, availableWidth)
  const fit = Math.min(1, safeAvailable / safeViewport)
  return Math.max(0.1, fit * Math.max(0.1, zoom))
}
