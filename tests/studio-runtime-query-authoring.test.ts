import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const inspector = fs.readFileSync(new URL('../apps/studio/src/Inspector.tsx', import.meta.url), 'utf8')
const controls = fs.readFileSync(new URL('../apps/studio/src/RuntimeQueryControls.tsx', import.meta.url), 'utf8')

test('Studio collection Inspector wires the visual query authoring controls', () => {
  assert.match(inspector, /CollectionQueryControls/)
  assert.match(inspector, /collectionQueryFieldOptions/)
  assert.match(controls, /Enable collection search/)
  assert.match(controls, /Search state key/)
  assert.match(controls, /Search fields \(comma separated\)/)
  assert.match(controls, /\+ Filter/)
  assert.match(controls, /Value state key/)
  assert.match(controls, /Active when…/)
  assert.match(controls, /\+ Sort rule/)
  assert.match(controls, /Enable page-based pagination/)
  assert.match(controls, /Current page state key/)
  assert.match(controls, /Page count → state key/)
  assert.match(controls, /Advanced query JSON/)
})

test('Studio Logic tab exposes visual event-to-state and pagination actions', () => {
  assert.match(inspector, /RuntimeInteractionsEditor/)
  assert.match(controls, /\+ Interaction/)
  assert.match(controls, /input/)
  assert.match(controls, /change/)
  assert.match(controls, /Set state/)
  assert.match(controls, /Toggle state/)
  assert.match(controls, /Increment state/)
  assert.match(controls, /Event value/)
  assert.match(controls, /checked/)
  assert.match(controls, /Advanced interactions JSON/)
})

test('Studio keeps advanced JSON escape hatches for backward compatibility', () => {
  for (const label of ['Search JSON', 'Filters JSON', 'Sort JSON', 'Pagination JSON', 'Interactions JSON']) {
    assert.match(controls, new RegExp(label))
  }
  assert.match(inspector, /Conditional styles JSON/)
})
