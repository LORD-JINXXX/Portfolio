interface RuntimeNodeElement {
  getAttribute(name: string): string | null
}

interface RuntimeNodeTarget {
  closest(selector: string): RuntimeNodeElement | null
}

export function canvasNodeIdFromTarget(target: unknown): string | null {
  if (!target || typeof target !== 'object' || typeof (target as { closest?: unknown }).closest !== 'function') return null
  const nodeElement = (target as RuntimeNodeTarget).closest('[data-runtime-node-id]')
  return nodeElement?.getAttribute('data-runtime-node-id') || null
}
