import test from 'node:test'
import assert from 'node:assert/strict'
import type { ValidationResult } from '../packages/contracts/src/index'
import { feedbackAutoDismissDelay, MutationActionGate, runMutationAction, type ActionFeedbackMessage } from '../packages/ui/src/mutation-feedback'
import { LayoutPublishedRefreshError, publishLayoutAndRefresh, validationResultFromError } from '../apps/studio/src/editor-actions'

function createRuntime() {
  const gate = new MutationActionGate()
  const pending = new Set<string>()
  const feedback: ActionFeedbackMessage[] = []
  return {
    gate,
    pending,
    feedback,
    runtime: {
      gate,
      isMounted: () => true,
      setPending: (key: string, value: boolean) => value ? pending.add(key) : pending.delete(key),
      show: (message: ActionFeedbackMessage) => feedback.push(message),
    },
  }
}

for (const [key, label] of [
  ['editor-save', 'Saving layout...'],
  ['editor-validate', 'Validating layout...'],
  ['editor-publish', 'Publishing layout...'],
  ['editor-create-draft', 'Creating draft...'],
  ['editor-create-blank', 'Creating blank layout...'],
  ['editor-create-cosmic', 'Creating Cosmic Portfolio...'],
  ['editor-duplicate-layout', 'Duplicating layout...'],
  ['editor-archive-layout', 'Archiving layout...'],
] as const) {
  test(`${key} exposes pending state, blocks rapid repeats, and settles`, async () => {
    const state = createRuntime()
    let requests = 0
    let settle: (() => void) | undefined
    const options = {
      key,
      conflictKey: 'studio-editor-api-action',
      pending: label,
      success: 'Completed successfully.',
      action: () => new Promise<void>((resolve) => { requests += 1; settle = resolve }),
    }
    const first = runMutationAction(options, state.runtime)
    const duplicate = runMutationAction(options, state.runtime)
    assert.equal(requests, 1)
    assert.equal(state.pending.has(key), true)
    settle?.()
    await Promise.all([first, duplicate])
    assert.equal(state.pending.has(key), false)
    assert.equal(state.gate.isPending(options.conflictKey), false)
    assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), 3000)
  })
}

test('Save failure persists, releases the editor gate, and retries', async () => {
  const state = createRuntime()
  let requests = 0
  const options = {
    key: 'editor-save',
    conflictKey: 'studio-editor-api-action',
    pending: 'Saving layout...',
    success: 'Layout saved successfully.',
    error: 'Layout could not be saved. Review the document and try again.',
    action: async () => { requests += 1; if (requests === 1) throw new Error('database internals') },
  }
  await runMutationAction(options, state.runtime)
  assert.equal(state.pending.size, 0)
  assert.deepEqual(state.feedback.at(-1), { tone: 'error', title: options.error })
  assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), null)
  await runMutationAction(options, state.runtime)
  assert.equal(requests, 2)
})

test('Save blocks incompatible Validate and Publish operations', async () => {
  const state = createRuntime()
  let saveRequests = 0
  let validateRequests = 0
  let publishRequests = 0
  let settle: (() => void) | undefined
  const save = runMutationAction({ key: 'editor-save', conflictKey: 'studio-editor-api-action', pending: 'Saving layout...', success: 'Saved.', action: () => new Promise<void>((resolve) => { saveRequests += 1; settle = resolve }) }, state.runtime)
  const validate = runMutationAction({ key: 'editor-validate', conflictKey: 'studio-editor-api-action', pending: 'Validating layout...', success: 'Validated.', action: async () => { validateRequests += 1 } }, state.runtime)
  const publish = runMutationAction({ key: 'editor-publish', conflictKey: 'studio-editor-api-action', pending: 'Publishing layout...', success: 'Published.', action: async () => { publishRequests += 1 } }, state.runtime)
  assert.deepEqual([saveRequests, validateRequests, publishRequests], [1, 0, 0])
  settle?.()
  await Promise.all([save, validate, publish])
})

test('validation issues are recovered as an expected application result', () => {
  const result: ValidationResult = {
    valid: false,
    issues: [{ severity: 'error', code: 'page.empty', message: 'Layout document must contain at least one page.' }],
    errors: [{ severity: 'error', code: 'page.empty', message: 'Layout document must contain at least one page.' }],
    warnings: [],
    infos: [],
  }
  const error = Object.assign(new Error('Publishing blocked'), { payload: { data: { validation: result } } })
  assert.deepEqual(validationResultFromError(error), result)
})

test('post-publish refresh failure never repeats the irreversible publication', async () => {
  let saves = 0
  let publications = 0
  let applied = 0
  let refreshes = 0
  await assert.rejects(
    publishLayoutAndRefresh({
      save: async () => { saves += 1 },
      publish: async () => { publications += 1; return { id: 'published-version' } },
      markPublished: () => { applied += 1 },
      refresh: async () => { refreshes += 1; return false },
    }),
    LayoutPublishedRefreshError,
  )
  assert.deepEqual({ saves, publications, applied, refreshes }, { saves: 1, publications: 1, applied: 1, refreshes: 1 })
})
