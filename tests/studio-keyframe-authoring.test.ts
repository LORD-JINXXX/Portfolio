import assert from 'node:assert/strict'
import test from 'node:test'
import { DesignTokensSchema, DEFAULT_DESIGN_TOKENS } from '../packages/contracts/src/index.ts'
import { createBlankDocument, createNode } from '../packages/builder-core/src/editor-state.ts'
import { validateEditorDocument } from '../packages/validation/src/index.ts'
import { STYLE_PROPERTY_KEYS } from '../apps/studio/src/style-properties.ts'

const floatKeyframe = {
  id: 'kf-float',
  label: 'Float',
  reducedMotion: 'disable' as const,
  steps: [
    { offset: 0, styles: { transform: 'translateY(0px)' } },
    { offset: 0.5, styles: { transform: 'translateY(-12px)' } },
    { offset: 1, styles: { transform: 'translateY(0px)' } },
  ],
}

test('DesignTokensSchema accepts structured keyframes and typed CSS property registrations', () => {
  const result = DesignTokensSchema.safeParse({
    ...DEFAULT_DESIGN_TOKENS,
    keyframes: [floatKeyframe],
    propertyRegistrations: [{ name: '--angle', syntax: '<angle>', inherits: false, initialValue: '0deg' }],
  })
  assert.equal(result.success, true)
})

test('DesignTokensSchema rejects duplicate keyframe IDs and invalid registered property names', () => {
  assert.equal(DesignTokensSchema.safeParse({ ...DEFAULT_DESIGN_TOKENS, keyframes: [floatKeyframe, { ...floatKeyframe }] }).success, false)
  assert.equal(DesignTokensSchema.safeParse({
    ...DEFAULT_DESIGN_TOKENS,
    propertyRegistrations: [{ name: 'angle', syntax: '<angle>', inherits: false, initialValue: '0deg' }],
  }).success, false)
})

test('editor validation rejects stylesheet-breaking keyframe declarations', () => {
  const document = createBlankDocument('Keyframes')
  document.designTokens = {
    ...document.designTokens,
    keyframes: [{
      ...floatKeyframe,
      steps: [
        { offset: 0, styles: { opacity: 0 } },
        { offset: 1, styles: { background: 'red;}body{display:none' } },
      ],
    }],
  }
  const result = validateEditorDocument(document)
  assert.equal(result.valid, false)
  assert.ok(result.issues.some((issue) => issue.code === 'keyframe.style-value-unsafe'))
})

test('custom keyframe references are validated and Decoration nodes remain generic div layers', () => {
  const document = createBlankDocument('Keyframes')
  const decoration = createNode('decoration')
  decoration.animation = { type: 'custom-keyframe', keyframeId: 'kf-float', trigger: 'continuous', duration: 1600, easing: 'linear' }
  document.pages[0].schema.root.push(decoration)
  document.designTokens = { ...document.designTokens, keyframes: [floatKeyframe] }

  const valid = validateEditorDocument(document)
  assert.equal(valid.valid, true, valid.issues.map((issue) => issue.message).join('\n'))
  assert.equal(decoration.tag, 'div')
  assert.equal(decoration.styles.desktop.position, 'absolute')
  assert.equal(decoration.styles.desktop.pointerEvents, 'none')
  assert.equal(decoration.accessibility?.role, 'presentation')

  decoration.animation.keyframeId = 'missing-keyframe'
  const invalid = validateEditorDocument(document)
  assert.equal(invalid.valid, false)
  assert.ok(invalid.issues.some((issue) => issue.code === 'animation.keyframe-unknown'))
})

test('advanced Studio style registry exposes CSS animation longhands and timeline primitives', () => {
  for (const key of [
    'animation', 'animationName', 'animationDuration', 'animationTimingFunction', 'animationDelay',
    'animationIterationCount', 'animationDirection', 'animationFillMode', 'animationPlayState',
    'animationTimeline', 'animationRange', 'viewTimelineName', 'scrollTimelineName', 'timelineScope',
  ]) assert.equal(STYLE_PROPERTY_KEYS.has(key), true, `missing ${key}`)
})
