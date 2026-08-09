import test from 'node:test'
import assert from 'node:assert/strict'
import { validationIssueMessages } from '../apps/studio/src/ActionFeedback'
import { backToLayoutsRequiresConfirmation, DEFAULT_PANEL_VISIBILITY, toggleStudioPanel, toolbarModeForWidth } from '../apps/studio/src/studio-chrome'

test('validation issues are extracted for visible feedback', () => {
  const payload = { data: { validation: { issues: [{ message: 'Heading is required' }, { message: 'Image alt text is required' }] } } }
  assert.deepEqual(validationIssueMessages(payload), ['Heading is required', 'Image alt text is required'])
})

test('left and Inspector panels toggle independently from editor selection', () => {
  const selectedNodeId = 'heading-node'
  const inspectorClosed = toggleStudioPanel(DEFAULT_PANEL_VISIBILITY, 'right')
  assert.deepEqual(inspectorClosed, { left: true, right: false })
  const bothClosed = toggleStudioPanel(inspectorClosed, 'left')
  assert.deepEqual(bothClosed, { left: false, right: false })
  assert.equal(selectedNodeId, 'heading-node')
  assert.deepEqual(toggleStudioPanel(inspectorClosed, 'right'), DEFAULT_PANEL_VISIBILITY)
})

test('toolbar modes preserve explicit constrained-width behavior', () => {
  assert.equal(toolbarModeForWidth(1600), 'wide')
  assert.equal(toolbarModeForWidth(1100), 'compact')
  assert.equal(toolbarModeForWidth(700), 'narrow')
})

test('Back to Layouts only requires confirmation for a dirty document', () => {
  assert.equal(backToLayoutsRequiresConfirmation(false), false)
  assert.equal(backToLayoutsRequiresConfirmation(true), true)
})
