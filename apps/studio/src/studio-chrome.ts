export type StudioAction = 'save' | 'validate' | 'publish'
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

export class StudioActionGate {
  private readonly pending = new Set<StudioAction>()

  begin(action: StudioAction): boolean {
    if (this.pending.has(action)) return false
    this.pending.add(action)
    return true
  }

  end(action: StudioAction): void {
    this.pending.delete(action)
  }

  isPending(action: StudioAction): boolean {
    return this.pending.has(action)
  }
}
