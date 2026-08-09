import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequireAdmin } from '../apps/api/src/lib/auth'
import {
  LAYOUT_HISTORY_DELETE_ERROR,
  LAYOUT_WORKSPACE_DELETE_ERROR,
  evaluateLayoutLifecycle,
  type LayoutVersionLifecycleInput,
} from '../apps/api/src/lib/layout-lifecycle'

const draft: LayoutVersionLifecycleInput = { id: 'draft-version', version_number: 2, status: 'draft' }
const published: LayoutVersionLifecycleInput = { id: 'published-version', version_number: 1, status: 'published' }

test('draft-only unreferenced layout is permanently deletable even with an empty page set', () => {
  const state = evaluateLayoutLifecycle({ versions: [draft], releaseVersionIds: new Set(), workspaceVersionId: null, pageCounts: new Map([[draft.id, 0]]) })
  assert.equal(state.canDeletePermanently, true)
  assert.equal(state.deleteBlockReason, null)
  assert.equal(state.versions[0].pageCount, 0)
})

test('published layout history blocks permanent deletion', () => {
  const state = evaluateLayoutLifecycle({ versions: [published], releaseVersionIds: new Set(), workspaceVersionId: null })
  assert.equal(state.canDeletePermanently, false)
  assert.equal(state.deleteBlockReason, LAYOUT_HISTORY_DELETE_ERROR)
  assert.equal(state.versions[0].canDiscard, false)
})

test('release references independently block permanent deletion', () => {
  const state = evaluateLayoutLifecycle({ versions: [draft], releaseVersionIds: new Set([draft.id]), workspaceVersionId: null })
  assert.equal(state.canDeletePermanently, false)
  assert.equal(state.hasReleaseHistory, true)
  assert.equal(state.deleteBlockReason, LAYOUT_HISTORY_DELETE_ERROR)
})

test('Admin workspace references block permanent deletion and draft discard', () => {
  const state = evaluateLayoutLifecycle({ versions: [draft, { ...draft, id: 'other-draft', version_number: 1 }], releaseVersionIds: new Set(), workspaceVersionId: draft.id })
  assert.equal(state.canDeletePermanently, false)
  assert.equal(state.deleteBlockReason, LAYOUT_WORKSPACE_DELETE_ERROR)
  assert.equal(state.versions.find((version) => version.id === draft.id)?.canDiscard, false)
})

test('only a safe non-sole draft can be discarded from a historical layout', () => {
  const state = evaluateLayoutLifecycle({ versions: [draft, published], releaseVersionIds: new Set([published.id]), workspaceVersionId: null })
  assert.equal(state.canDeletePermanently, false)
  assert.equal(state.versions.find((version) => version.id === draft.id)?.canDiscard, true)
  assert.equal(state.versions.find((version) => version.id === published.id)?.canDiscard, false)
})

test('the only draft is removed by deleting its layout rather than creating a zero-version orphan', () => {
  const state = evaluateLayoutLifecycle({ versions: [draft], releaseVersionIds: new Set(), workspaceVersionId: null })
  assert.equal(state.canDeletePermanently, true)
  assert.equal(state.versions[0].canDiscard, false)
  assert.match(state.versions[0].discardBlockReason || '', /only layout version/)
})

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {}
  return {
    state,
    response: {
      status(code: number) { state.status = code; return this },
      json(body: unknown) { state.body = body; return this },
    },
  }
}

test('admin middleware rejects missing authentication', async () => {
  const middleware = createRequireAdmin({} as any, false)
  const { state, response } = responseRecorder()
  let nextCalled = false
  await middleware({ headers: {} } as any, response as any, () => { nextCalled = true })
  assert.equal(state.status, 401)
  assert.equal(nextCalled, false)
})

test('admin middleware rejects authenticated non-admin users', async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'editor@example.invalid' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'user-1', role: 'editor' }, error: null }) }) }) }),
  }
  const middleware = createRequireAdmin(db as any, false)
  const { state, response } = responseRecorder()
  let nextCalled = false
  await middleware({ headers: { authorization: 'Bearer test-token' } } as any, response as any, () => { nextCalled = true })
  assert.equal(state.status, 403)
  assert.equal(nextCalled, false)
})
