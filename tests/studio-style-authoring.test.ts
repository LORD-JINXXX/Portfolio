import assert from 'node:assert/strict'
import test from 'node:test'
import { STYLE_PROPERTY_GROUPS, STYLE_PROPERTY_KEYS, stylePropertyPlaceholder } from '../apps/studio/src/style-properties.ts'

test('advanced Studio style registry keeps every property key unique', () => {
  const keys = STYLE_PROPERTY_GROUPS.flatMap((group) => group.properties.map((property) => property.key))
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(STYLE_PROPERTY_KEYS.size, keys.length)
})

test('advanced Studio style registry preserves legacy controls and adds production CSS primitives', () => {
  const required = [
    'display',
    'width', 'height', 'margin', 'padding',
    'flexDirection', 'gridTemplateColumns', 'position', 'zIndex',
    'fontFamily', 'fontSize', 'color', 'background', 'backgroundImage',
    'border', 'borderRadius', 'boxShadow', 'opacity',
    'objectFit', 'transform', 'transformOrigin', 'perspective',
    'filter', 'backdropFilter', 'mixBlendMode', 'clipPath', 'maskImage',
    'offsetPath', 'transition', 'willChange', 'contain', 'contentVisibility',
    'scrollSnapType', 'scrollSnapAlign', 'cursor', 'pointerEvents',
    'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'transitionDelay',
    'borderImageSource', 'maskComposite', 'WebkitMaskComposite', 'isolation',
    'translate', 'rotate', 'scale', 'offsetDistance', 'offsetRotate',
    'overscrollBehavior', 'userSelect', 'touchAction', 'outlineOffset',
  ]
  for (const key of required) {
    if (key === 'display') continue // visibility/display remains the dedicated top-level responsive control.
    assert.equal(STYLE_PROPERTY_KEYS.has(key), true, `missing Studio style property ${key}`)
  }
})

test('style property metadata provides useful authoring hints for advanced values', () => {
  assert.match(stylePropertyPlaceholder('transition'), /transform/)
  assert.match(stylePropertyPlaceholder('backgroundImage'), /gradient/)
  assert.match(stylePropertyPlaceholder('maskImage'), /gradient/)
  assert.match(stylePropertyPlaceholder('offsetPath'), /path/)
})
