import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('shared data states expose loading, empty, error, retry and refresh semantics', () => {
  const source = read('packages/ui/src/data-state.tsx')
  const entry = read('packages/ui/src/index.ts')
  assert.match(source, /DataStateKind = 'loading' \| 'empty' \| 'error'/)
  assert.match(source, /data-data-state=\{kind\}/)
  assert.match(source, /onAction && !isLoading/)
  assert.match(source, /export function DataRefreshStatus/)
  assert.match(entry, /export \* from '\.\/data-state'/)
})

test('Admin keeps existing data visible while refreshes fail or remain pending', () => {
  const source = read('apps/admin/src/App.tsx')
  assert.match(source, /loading && rows\.length > 0[\s\S]*DataRefreshStatus/)
  assert.match(source, /err && rows\.length > 0[\s\S]*refresh failed/)
  assert.match(source, /kind="error"[\s\S]*onAction=\{\(\) => void load\(\)\}/)
  assert.match(source, /kind="empty"/)
})

test('Studio and public runtime use explicit loading and retry-capable data states', () => {
  const studio = read('apps/studio/src/App.tsx')
  const library = read('apps/studio/src/LayoutLibrary.tsx')
  const web = read('apps/web/src/App.tsx')
  assert.match(studio, /DataStatePanel kind="loading"/)
  assert.match(library, /Layout Library refresh failed/)
  assert.match(library, /actionLabel="Retry"/)
  assert.match(web, /PortfolioLoadingState/)
  assert.match(web, /Portfolio could not be loaded/)
  assert.match(web, /setReloadToken\(\(value\) => value \+ 1\)/)
})
