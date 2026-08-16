import React from 'react'

const dirtyTokens = new Set<symbol>()
let unloadAttached = false

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirtyTokens.size) return
  event.preventDefault()
  event.returnValue = ''
}

function syncBeforeUnloadListener() {
  if (typeof window === 'undefined') return
  if (dirtyTokens.size > 0 && !unloadAttached) {
    window.addEventListener('beforeunload', beforeUnload)
    unloadAttached = true
  } else if (dirtyTokens.size === 0 && unloadAttached) {
    window.removeEventListener('beforeunload', beforeUnload)
    unloadAttached = false
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, next]) => [key, canonicalize(next)]),
    )
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  return value
}

export function draftFingerprint(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function hasUnsavedAdminChanges(): boolean {
  return dirtyTokens.size > 0
}


export function confirmDiscardDraft(
  dirty: boolean,
  message = 'You have unsaved changes. Discard them?',
): boolean {
  if (!dirty) return true
  if (typeof window === 'undefined') return false
  return window.confirm(message)
}

export function confirmDiscardAdminChanges(
  message = 'You have unsaved changes. Discard them?',
): boolean {
  if (!hasUnsavedAdminChanges()) return true
  if (typeof window === 'undefined') return false
  return window.confirm(message)
}

export function useUnsavedAdminChanges(dirty: boolean) {
  const tokenRef = React.useRef<symbol | null>(null)
  if (!tokenRef.current) tokenRef.current = Symbol('admin-dirty-form')
  React.useEffect(() => {
    const token = tokenRef.current!
    if (dirty) dirtyTokens.add(token)
    else dirtyTokens.delete(token)
    syncBeforeUnloadListener()
    return () => {
      dirtyTokens.delete(token)
      syncBeforeUnloadListener()
    }
  }, [dirty])
}

export function useDraftBaseline() {
  const baselineRef = React.useRef<string | null>(null)
  const begin = React.useCallback((value: unknown) => {
    baselineRef.current = draftFingerprint(value)
  }, [])
  const clear = React.useCallback(() => {
    baselineRef.current = null
  }, [])
  const isDirty = React.useCallback((value: unknown) => (
    baselineRef.current !== null && draftFingerprint(value) !== baselineRef.current
  ), [])
  return { begin, clear, isDirty }
}
