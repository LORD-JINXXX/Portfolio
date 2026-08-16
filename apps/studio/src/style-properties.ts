export type StudioStyleControl = 'text' | 'select'

export interface StudioStylePropertyDefinition {
  key: string
  label?: string
  placeholder?: string
  control?: StudioStyleControl
  options?: string[]
  wide?: boolean
  description?: string
}

export interface StudioStylePropertyGroup {
  title: string
  description?: string
  openByDefault?: boolean
  properties: StudioStylePropertyDefinition[]
}

const p = (
  key: string,
  placeholder = '',
  options?: string[],
  extra: Omit<StudioStylePropertyDefinition, 'key' | 'placeholder' | 'options' | 'control'> = {},
): StudioStylePropertyDefinition => ({
  key,
  placeholder,
  ...(options?.length ? { control: 'select' as const, options } : {}),
  ...extra,
})

/**
 * Curated authoring metadata only. Runtime styles remain open-ended and are
 * protected by the shared CSS property/value safety boundary.
 */
export const STYLE_PROPERTY_GROUPS: StudioStylePropertyGroup[] = [
  {
    title: 'Layout',
    openByDefault: true,
    properties: [
      p('boxSizing', '', ['border-box', 'content-box']),
      p('width', 'e.g. 100% / 48rem / clamp(20rem, 60vw, 72rem)'),
      p('height', 'e.g. auto / 100dvh / 420px'),
      p('minWidth', 'e.g. 0 / 20rem'), p('maxWidth', 'e.g. 72rem / none'),
      p('minHeight', 'e.g. 0 / 60vh'), p('maxHeight', 'e.g. 90dvh / none'),
      p('aspectRatio', 'e.g. 16 / 9'),
      p('overflow', '', ['visible', 'hidden', 'clip', 'auto', 'scroll']),
      p('overflowX', '', ['visible', 'hidden', 'clip', 'auto', 'scroll']),
      p('overflowY', '', ['visible', 'hidden', 'clip', 'auto', 'scroll']),
    ],
  },
  {
    title: 'Spacing',
    properties: [
      p('margin', 'e.g. 0 auto / 24px 0'),
      p('marginTop', 'e.g. 24px'), p('marginRight', 'e.g. auto'), p('marginBottom', 'e.g. 24px'), p('marginLeft', 'e.g. auto'),
      p('padding', 'e.g. 24px / clamp(16px, 4vw, 64px)'),
      p('paddingTop', 'e.g. 24px'), p('paddingRight', 'e.g. 24px'), p('paddingBottom', 'e.g. 24px'), p('paddingLeft', 'e.g. 24px'),
    ],
  },
  {
    title: 'Flexbox',
    properties: [
      p('flexDirection', '', ['row', 'row-reverse', 'column', 'column-reverse']),
      p('flexWrap', '', ['nowrap', 'wrap', 'wrap-reverse']),
      p('justifyContent', 'e.g. center / space-between'),
      p('alignItems', 'e.g. center / stretch'), p('alignContent', 'e.g. center / space-between'),
      p('justifyItems', 'e.g. center / stretch'), p('justifySelf', 'e.g. auto / center'), p('alignSelf', 'e.g. auto / center'),
      p('placeItems', 'e.g. center'), p('placeContent', 'e.g. center'), p('placeSelf', 'e.g. center'),
      p('gap', 'e.g. 24px'), p('rowGap', 'e.g. 16px'), p('columnGap', 'e.g. 24px'),
      p('flexGrow', 'e.g. 1'), p('flexShrink', 'e.g. 0'), p('flexBasis', 'e.g. 18rem / 40%'), p('order', 'e.g. 2'),
    ],
  },
  {
    title: 'Grid',
    properties: [
      p('gridTemplateColumns', 'e.g. repeat(3,minmax(0,1fr))', undefined, { wide: true }),
      p('gridTemplateRows', 'e.g. auto 1fr auto', undefined, { wide: true }),
      p('gridAutoColumns', 'e.g. minmax(16rem,1fr)'), p('gridAutoRows', 'e.g. minmax(0,auto)'),
      p('gridAutoFlow', '', ['row', 'column', 'dense', 'row dense', 'column dense']),
      p('gridColumn', 'e.g. 1 / -1'), p('gridRow', 'e.g. 2 / span 2'),
      p('gridColumnStart', 'e.g. 1'), p('gridColumnEnd', 'e.g. span 2'),
      p('gridRowStart', 'e.g. 1'), p('gridRowEnd', 'e.g. span 2'),
    ],
  },
  {
    title: 'Position',
    properties: [
      p('position', '', ['static', 'relative', 'absolute', 'fixed', 'sticky']),
      p('top', 'e.g. 0 / 50%'), p('right', 'e.g. 0'), p('bottom', 'e.g. 0'), p('left', 'e.g. 0'),
      p('inset', 'e.g. 0 / 10% 0 auto'),
      p('insetBlock', 'e.g. 0'), p('insetInline', 'e.g. 0'),
      p('zIndex', 'e.g. 10 / auto'),
    ],
  },
  {
    title: 'Typography',
    openByDefault: true,
    properties: [
      p('fontFamily', 'e.g. var(--font-body)'), p('fontSize', 'e.g. clamp(1rem, 2vw, 1.5rem)'), p('fontWeight', 'e.g. 600'), p('fontStyle', '', ['normal', 'italic', 'oblique']),
      p('lineHeight', 'e.g. 1.5'), p('letterSpacing', 'e.g. -0.02em'),
      p('textAlign', '', ['left', 'center', 'right', 'justify', 'start', 'end']), p('textTransform', '', ['none', 'uppercase', 'lowercase', 'capitalize']),
      p('textDecoration', 'e.g. none / underline'), p('textIndent', 'e.g. 2em'),
      p('whiteSpace', '', ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces']),
      p('wordBreak', '', ['normal', 'break-all', 'keep-all', 'break-word']), p('overflowWrap', '', ['normal', 'break-word', 'anywhere']),
      p('textOverflow', '', ['clip', 'ellipsis']), p('hyphens', '', ['none', 'manual', 'auto']),
      p('color', 'e.g. #fff / var(--text)'), p('textShadow', 'e.g. 0 0 24px rgba(255,255,255,.25)', undefined, { wide: true }),
      p('WebkitTextStroke', 'e.g. 1px rgba(255,255,255,.3)'),
      p('WebkitBackgroundClip', 'e.g. text'), p('WebkitTextFillColor', 'e.g. transparent'),
    ],
  },
  {
    title: 'Background',
    openByDefault: true,
    properties: [
      p('background', 'color / gradient / image', undefined, { wide: true }),
      p('backgroundColor', 'e.g. #0b0b0d / transparent'),
      p('backgroundImage', 'e.g. linear-gradient(...) / url(...)', undefined, { wide: true }),
      p('backgroundPosition', 'e.g. center / 0% 50%'), p('backgroundSize', 'e.g. cover / 200% 200%'),
      p('backgroundRepeat', '', ['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round']),
      p('backgroundAttachment', '', ['scroll', 'fixed', 'local']),
      p('backgroundOrigin', '', ['border-box', 'padding-box', 'content-box']),
      p('backgroundClip', 'e.g. padding-box / text'),
      p('backgroundBlendMode', 'e.g. screen / multiply / overlay'),
    ],
  },
  {
    title: 'Border / Outline',
    properties: [
      p('border', 'e.g. 1px solid rgba(255,255,255,.18)', undefined, { wide: true }),
      p('borderTop', 'e.g. 1px solid #232329'), p('borderRight', 'e.g. 1px solid #232329'), p('borderBottom', 'e.g. 1px solid #232329'), p('borderLeft', 'e.g. 1px solid #232329'),
      p('borderWidth', 'e.g. 1px'), p('borderStyle', 'e.g. solid'), p('borderColor', 'e.g. rgba(255,255,255,.15)'),
      p('borderRadius', 'e.g. 24px'), p('borderTopLeftRadius', 'e.g. 24px'), p('borderTopRightRadius', 'e.g. 24px'), p('borderBottomRightRadius', 'e.g. 24px'), p('borderBottomLeftRadius', 'e.g. 24px'),
      p('outline', 'e.g. 1px solid rgba(255,255,255,.2)'), p('outlineOffset', 'e.g. 4px'),
      p('borderImage', 'e.g. linear-gradient(90deg,#fff,#7c3aed) 1', undefined, { wide: true }),
      p('borderImageSource', 'e.g. conic-gradient(from 0deg,#fff,#7c3aed,#fff)', undefined, { wide: true }),
      p('borderImageSlice', 'e.g. 1'), p('borderImageWidth', 'e.g. 1'), p('borderImageOutset', 'e.g. 0'), p('borderImageRepeat', 'e.g. stretch / round'),
    ],
  },
  {
    title: 'Effects / Compositing',
    properties: [
      p('boxShadow', 'e.g. 0 20px 60px rgba(0,0,0,.35)', undefined, { wide: true }),
      p('opacity', 'e.g. 0.75'),
      p('filter', 'e.g. blur(8px) saturate(1.2)', undefined, { wide: true }),
      p('backdropFilter', 'e.g. blur(18px) saturate(1.2)', undefined, { wide: true }),
      p('WebkitBackdropFilter', 'e.g. blur(18px) saturate(1.2)', undefined, { wide: true }),
      p('mixBlendMode', 'e.g. normal / screen / multiply'),
      p('isolation', '', ['auto', 'isolate']),
    ],
  },
  {
    title: 'Transform / 3D',
    description: 'Use transform for ordered transform functions. Individual translate / rotate / scale properties are also available when you want independent transition channels.',
    properties: [
      p('transform', 'e.g. translate3d(0,-8px,0) rotateY(6deg)', undefined, { wide: true }),
      p('translate', 'e.g. 0 -8px / 10px 20px 0'), p('rotate', 'e.g. 6deg / x 15deg / 1 1 0 20deg'), p('scale', 'e.g. 1.04 / 1.04 1'),
      p('transformOrigin', 'e.g. 50% 50% / left center'),
      p('transformBox', 'e.g. border-box / fill-box / view-box'),
      p('transformStyle', '', ['flat', 'preserve-3d']),
      p('perspective', 'e.g. 1000px'), p('perspectiveOrigin', 'e.g. 50% 50%'),
      p('backfaceVisibility', '', ['visible', 'hidden']),
    ],
  },
  {
    title: 'Transition',
    description: 'Use the shorthand for complete control, or author individual longhands. Longhands are responsive and can use var(), cubic-bezier(), and steps().',
    properties: [
      p('transition', 'e.g. transform 300ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease', undefined, { wide: true }),
      p('transitionProperty', 'e.g. transform, opacity, box-shadow', undefined, { wide: true }),
      p('transitionDuration', 'e.g. 300ms, 220ms'),
      p('transitionTimingFunction', 'e.g. cubic-bezier(.2,.8,.2,1), ease', undefined, { wide: true }),
      p('transitionDelay', 'e.g. 0ms, 80ms'),
      p('transitionBehavior', 'e.g. normal / allow-discrete'),
    ],
  },
  {
    title: 'CSS Animation',
    description: 'Use reusable keyframes from the Animation tab for safe authored effects. These raw longhands remain available for advanced browser-native animation timelines and external/internal animation names.',
    properties: [
      p('animation', 'e.g. 1.2s ease-in-out infinite alternate', undefined, { wide: true }),
      p('animationName', 'e.g. none / internal keyframe name'),
      p('animationDuration', 'e.g. 1200ms'),
      p('animationTimingFunction', 'e.g. cubic-bezier(.2,.8,.2,1)', undefined, { wide: true }),
      p('animationDelay', 'e.g. 0ms'),
      p('animationIterationCount', 'e.g. 1 / infinite'),
      p('animationDirection', 'e.g. normal / reverse / alternate'),
      p('animationFillMode', 'e.g. none / forwards / both'),
      p('animationPlayState', 'e.g. running / paused'),
      p('animationTimeline', 'e.g. auto / view() / scroll()', undefined, { wide: true }),
      p('animationRange', 'e.g. entry 0% cover 40%', undefined, { wide: true }),
      p('animationRangeStart', 'e.g. entry 0%'),
      p('animationRangeEnd', 'e.g. cover 40%'),
      p('viewTimelineName', 'e.g. --card-view'),
      p('viewTimelineAxis', 'e.g. block / inline / x / y'),
      p('scrollTimelineName', 'e.g. --page-scroll'),
      p('scrollTimelineAxis', 'e.g. block / inline / x / y'),
      p('timelineScope', 'e.g. --card-view, --page-scroll', undefined, { wide: true }),
    ],
  },
  {
    title: 'Mask / Clip',
    properties: [
      p('clipPath', 'e.g. inset(0 round 24px) / polygon(...)', undefined, { wide: true }),
      p('mask', 'e.g. linear-gradient(#000 0 0) content-box', undefined, { wide: true }),
      p('maskImage', 'e.g. radial-gradient(circle,#000 55%,transparent 72%)', undefined, { wide: true }),
      p('maskPosition', 'e.g. center'), p('maskSize', 'e.g. cover / 200% 200%'), p('maskRepeat', 'e.g. no-repeat'),
      p('maskMode', 'e.g. match-source / alpha / luminance'), p('maskComposite', 'e.g. add / subtract / intersect / exclude'),
      p('WebkitMaskImage', 'e.g. linear-gradient(#000 0 0)', undefined, { wide: true }), p('WebkitMaskPosition', 'e.g. center'), p('WebkitMaskSize', 'e.g. cover'), p('WebkitMaskRepeat', 'e.g. no-repeat'), p('WebkitMaskComposite', 'e.g. xor / destination-out'),
    ],
  },
  {
    title: 'Motion Path',
    properties: [
      p('offsetPath', 'e.g. path("M 0 0 C 120 -80 220 80 360 0")', undefined, { wide: true }),
      p('offsetDistance', 'e.g. 0% / 50%'), p('offsetRotate', 'e.g. auto / 0deg'), p('offsetAnchor', 'e.g. center'), p('offsetPosition', 'e.g. normal / center'),
    ],
  },
  {
    title: 'Interaction',
    properties: [
      p('cursor', 'e.g. pointer / grab / crosshair'), p('pointerEvents', '', ['auto', 'none']),
      p('userSelect', '', ['auto', 'none', 'text', 'all']), p('touchAction', 'e.g. auto / pan-y / none'),
      p('resize', '', ['none', 'both', 'horizontal', 'vertical']), p('caretColor', 'e.g. auto / #fff'), p('accentColor', 'e.g. auto / #7c3aed'),
    ],
  },
  {
    title: 'Scroll CSS',
    properties: [
      p('scrollSnapType', 'e.g. x mandatory / y proximity'), p('scrollSnapAlign', 'e.g. start / center'), p('scrollSnapStop', 'e.g. normal / always'),
      p('overscrollBehavior', 'e.g. contain / none'), p('overscrollBehaviorX', 'e.g. contain'), p('overscrollBehaviorY', 'e.g. contain'),
      p('scrollBehavior', '', ['auto', 'smooth']), p('scrollMargin', 'e.g. 80px 0 0'), p('scrollPadding', 'e.g. 80px 0 0'),
      p('scrollbarColor', 'e.g. #666 transparent'), p('scrollbarWidth', 'e.g. auto / thin / none'),
    ],
  },
  {
    title: 'Performance',
    properties: [
      p('willChange', 'e.g. transform, opacity'), p('contain', 'e.g. layout paint / content / strict'), p('contentVisibility', 'e.g. auto / visible'), p('containIntrinsicSize', 'e.g. auto 600px'),
    ],
  },
  {
    title: 'Media',
    properties: [
      p('objectFit', '', ['fill', 'contain', 'cover', 'none', 'scale-down']), p('objectPosition', 'e.g. 50% 50%'), p('imageRendering', 'e.g. auto / crisp-edges / pixelated'),
    ],
  },
]

export const STYLE_PROPERTY_KEYS = new Set(STYLE_PROPERTY_GROUPS.flatMap((group) => group.properties.map((property) => property.key)))

export function stylePropertyPlaceholder(key: string): string {
  for (const group of STYLE_PROPERTY_GROUPS) {
    const property = group.properties.find((candidate) => candidate.key === key)
    if (property) return property.placeholder || ''
  }
  return ''
}
