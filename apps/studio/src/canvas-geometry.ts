export interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

export interface RuntimeNodeElementLike {
  getAttribute(name: string): string | null
}

export function canvasBoundsFromRects(nodeRect: CanvasRect, surfaceRect: CanvasRect, surfaceWidth: number, surfaceHeight: number): CanvasRect {
  const scaleX = surfaceWidth > 0 && surfaceRect.width > 0 ? surfaceRect.width / surfaceWidth : 1
  const scaleY = surfaceHeight > 0 && surfaceRect.height > 0 ? surfaceRect.height / surfaceHeight : scaleX
  return {
    left: (nodeRect.left - surfaceRect.left) / scaleX,
    top: (nodeRect.top - surfaceRect.top) / scaleY,
    width: nodeRect.width / scaleX,
    height: nodeRect.height / scaleY,
  }
}

export function findRuntimeNodeElement<T extends RuntimeNodeElementLike>(root: { querySelectorAll(selector: string): ArrayLike<T> }, nodeId: string | null): T | null {
  if (!nodeId) return null
  return Array.from(root.querySelectorAll('[data-runtime-node-id]')).find((element) => element.getAttribute('data-runtime-node-id') === nodeId) || null
}
