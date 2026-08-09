import test from 'node:test'
import assert from 'node:assert/strict'
import { feedbackAutoDismissDelay, MutationActionGate, runMutationAction, type ActionFeedbackMessage } from '../packages/ui/src/mutation-feedback'
import { isOutsideMenu } from '../apps/studio/src/layout-library-state'

test('layout menu outside-target detection preserves inside clicks', () => {
  const inside = { id: 'inside' }
  const root = { contains: (target: unknown) => target === inside }
  assert.equal(isOutsideMenu(root, inside), false)
  assert.equal(isOutsideMenu(root, { id: 'outside' }), true)
  assert.equal(isOutsideMenu(null, inside), true)
})

test('only successful lifecycle feedback auto-dismisses after the configured delay', () => {
  const success: ActionFeedbackMessage = { tone: 'success', title: 'Deleted.' }
  const pending: ActionFeedbackMessage = { tone: 'info', title: 'Deleting...' }
  const error: ActionFeedbackMessage = { tone: 'error', title: 'Delete failed.' }
  assert.equal(feedbackAutoDismissDelay(success, 3000), 3000)
  assert.equal(feedbackAutoDismissDelay(pending, 3000), null)
  assert.equal(feedbackAutoDismissDelay(error, 3000), null)
})

function runtime() {
  const gate = new MutationActionGate()
  const pending = new Set<string>()
  const feedback: ActionFeedbackMessage[] = []
  return { gate, pending, feedback, runtime: { gate, isMounted: () => true, setPending: (key: string, value: boolean) => value ? pending.add(key) : pending.delete(key), show: (message: ActionFeedbackMessage) => feedback.push(message) } }
}

for (const [key, conflictKey, label] of [
  ['create-blank', 'layout-creation', 'Creating blank layout...'],
  ['create-cosmic', 'layout-creation', 'Creating Cosmic Portfolio...'],
  ['rename-layout-1', 'layout-layout-1', 'Saving "Layout"...'],
  ['duplicate-layout-1', 'layout-layout-1', 'Duplicating "Layout"...'],
  ['archive-layout-1', 'layout-layout-1', 'Archiving "Layout"...'],
  ['delete-layout-1', 'layout-layout-1', 'Deleting "Layout"...'],
  ['discard-version-1', 'layout-layout-1', 'Discarding draft v2 from "Layout"...'],
] as const) test(`${key} synchronously blocks duplicates and clears after settle`, async () => {
  const state = runtime()
  let requests = 0
  let settle: (() => void) | undefined
  const options = { key, conflictKey, pending: label, success: 'Completed.', action: () => new Promise<void>((resolve) => { requests += 1; settle = resolve }) }
  const first = runMutationAction(options, state.runtime)
  const duplicate = runMutationAction(options, state.runtime)
  assert.equal(requests, 1)
  assert.equal(state.pending.has(key), true)
  settle?.()
  await Promise.all([first, duplicate])
  assert.equal(state.pending.has(key), false)
  assert.equal(state.gate.isPending(conflictKey), false)
})

test('layout lifecycle failure persists and releases its gate for retry', async () => {
  const state = runtime()
  let requests = 0
  const options = { key: 'rename-layout-1', conflictKey: 'layout-layout-1', pending: 'Saving "Layout"...', success: 'Renamed.', error: 'Layout could not be renamed. Check the name and try again.', action: async () => { requests += 1; if (requests === 1) throw new Error('database internals') } }
  await runMutationAction(options, state.runtime)
  assert.deepEqual(state.feedback.at(-1), { tone: 'error', title: options.error })
  assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), null)
  assert.equal(state.gate.isPending(options.conflictKey), false)
  await runMutationAction(options, state.runtime)
  assert.equal(requests, 2)
})
