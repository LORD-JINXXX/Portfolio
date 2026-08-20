import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { LayoutPageSchema, RuntimeAction } from '@platform/contracts'
import { RuntimeRenderer, executeRuntimeActions, resolveRuntimeValue } from '@platform/runtime-renderer'

test('runtime event references resolve value and checked payloads', () => {
  const ctx = { runtimeEvent: { value: 'portfolio', checked: false } }
  assert.equal(resolveRuntimeValue({ source: 'event', key: 'value' }, ctx), 'portfolio')
  assert.equal(resolveRuntimeValue({ source: 'event', key: 'checked', fallback: true }, ctx), false)
  assert.equal(resolveRuntimeValue({ source: 'event', key: 'value', fallback: 'fallback' }, {}), 'fallback')
})

test('runtime actions can write interaction values into state', () => {
  const state: Record<string, unknown> = {}
  const actions: RuntimeAction[] = [
    { type: 'set-state', key: 'projectsSearch', value: { source: 'event', key: 'value' } },
    { type: 'set-state', key: 'featuredOnly', value: { source: 'event', key: 'checked' } },
  ]
  executeRuntimeActions(actions, {
    runtimeState: state,
    setRuntimeStateValue: (key, value) => { state[key] = value },
  }, { value: 'react', checked: true })

  assert.deepEqual(state, { projectsSearch: 'react', featuredOnly: true })
})

test('runtime inputs are editable while Studio editor inputs stay read-only', () => {
  const schema: LayoutPageSchema = {
    schemaVersion: 1,
    pageId: 'projects',
    initialState: { projectsSearch: '' },
    root: [{
      id: 'search',
      type: 'input',
      tag: 'input',
      styles: { desktop: {} },
      props: { type: 'search', placeholder: 'Search projects' },
      bindings: { value: { type: 'state', key: 'projectsSearch', fallback: '' } },
      interactions: [{
        event: 'input',
        actions: [{ type: 'set-state', key: 'projectsSearch', value: { source: 'event', key: 'value' } }],
      }],
    }],
  }

  const runtimeHtml = renderToStaticMarkup(React.createElement(RuntimeRenderer, { schema }))
  const editorHtml = renderToStaticMarkup(React.createElement(RuntimeRenderer, { schema, editable: true }))

  assert.match(runtimeHtml, /type="search"/)
  assert.doesNotMatch(runtimeHtml, /readonly=""/)
  assert.match(editorHtml, /readonly=""/)

  const staticSchema: LayoutPageSchema = {
    ...schema,
    pageId: 'static-input',
    root: [{ ...schema.root[0], interactions: undefined, bindings: undefined, props: { type: 'text', value: 'Display only' } }],
  }
  const staticHtml = renderToStaticMarkup(React.createElement(RuntimeRenderer, { schema: staticSchema }))
  assert.match(staticHtml, /readonly=""/)
})
