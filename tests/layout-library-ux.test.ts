import test from 'node:test'
import assert from 'node:assert/strict'
import { feedbackAutoDismissDelay, type StudioFeedbackMessage } from '../apps/studio/src/ActionFeedback'
import { createLifecycleActionGate, isOutsideMenu } from '../apps/studio/src/layout-library-state'

test('layout menu outside-target detection preserves inside clicks', () => {
  const inside = { id: 'inside' }
  const root = { contains: (target: unknown) => target === inside }
  assert.equal(isOutsideMenu(root, inside), false)
  assert.equal(isOutsideMenu(root, { id: 'outside' }), true)
  assert.equal(isOutsideMenu(null, inside), true)
})

test('lifecycle action gate synchronously rejects duplicate destructive requests', () => {
  const gate = createLifecycleActionGate()
  assert.equal(gate.start('delete-layout'), true)
  assert.equal(gate.start('delete-layout'), false)
  assert.equal(gate.start('archive-layout'), false)
  gate.finish('unrelated-action')
  assert.equal(gate.current(), 'delete-layout')
  gate.finish('delete-layout')
  assert.equal(gate.start('archive-layout'), true)
})

test('only successful lifecycle feedback auto-dismisses after the configured delay', () => {
  const success: StudioFeedbackMessage = { tone: 'success', title: 'Deleted.' }
  const pending: StudioFeedbackMessage = { tone: 'info', title: 'Deleting...' }
  const error: StudioFeedbackMessage = { tone: 'error', title: 'Delete failed.' }
  assert.equal(feedbackAutoDismissDelay(success, 3000), 3000)
  assert.equal(feedbackAutoDismissDelay(pending, 3000), null)
  assert.equal(feedbackAutoDismissDelay(error, 3000), null)
})
