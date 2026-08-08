export function cn(...classes: (string | boolean | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export * from './theme'
