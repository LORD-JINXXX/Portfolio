import type { ValidationResult } from '@platform/contracts'

export class LayoutPublishedRefreshError extends Error {
  constructor() {
    super('Layout version was published, but Studio could not refresh the layout list. Reload Studio before continuing.')
    this.name = 'LayoutPublishedRefreshError'
  }
}

export async function publishLayoutAndRefresh<T>({
  save,
  publish,
  markPublished,
  refresh,
}: {
  save: () => Promise<unknown>
  publish: () => Promise<T>
  markPublished: (result: T) => void
  refresh: () => Promise<boolean>
}): Promise<T> {
  await save()
  const result = await publish()
  try {
    markPublished(result)
    if (!await refresh()) throw new Error('Layout list refresh failed')
  } catch {
    throw new LayoutPublishedRefreshError()
  }
  return result
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function validationResultFromError(error: unknown): ValidationResult | null {
  const payload = asRecord(asRecord(error)?.payload)
  const data = asRecord(payload?.data)
  const validation = asRecord(payload?.validation) || asRecord(data?.validation)
  return typeof validation?.valid === 'boolean' && Array.isArray(validation.issues)
    ? validation as unknown as ValidationResult
    : null
}
