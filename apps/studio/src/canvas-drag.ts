import type { NodeDropPosition } from '@platform/builder-core'

export function canvasDropPosition(pointerOffset: number, targetSize: number, canDropInside: boolean): NodeDropPosition {
  const ratio = targetSize > 0 ? Math.max(0, Math.min(1, pointerOffset / targetSize)) : 0.5
  if (ratio < 0.25) return 'before'
  if (ratio > 0.75) return 'after'
  if (canDropInside) return 'inside'
  return ratio < 0.5 ? 'before' : 'after'
}
