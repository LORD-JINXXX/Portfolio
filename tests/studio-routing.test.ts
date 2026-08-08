import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStudioEditorRoute, selectedPageFromSearch, studioEditorPath } from '../apps/studio/src/routing'

test('Studio editor route contains durable layout and version identity', () => {
  const path = studioEditorPath('layout-123', 'version-456', 'page-789')
  assert.equal(path, '/layouts/layout-123/versions/version-456/editor?page=page-789')
  assert.deepEqual(parseStudioEditorRoute(path.split('?')[0]), { layoutId: 'layout-123', versionId: 'version-456' })
  assert.equal(selectedPageFromSearch('?page=page-789'), 'page-789')
})

test('Studio editor routing rejects invalid paths and safely encodes identity', () => {
  assert.equal(parseStudioEditorRoute('/layouts/layout-123/editor'), null)
  const path = studioEditorPath('layout/id', 'version id')
  assert.deepEqual(parseStudioEditorRoute(path), { layoutId: 'layout/id', versionId: 'version id' })
})
