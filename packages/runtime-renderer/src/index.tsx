import React, { Component, useEffect, useMemo, useRef } from 'react'
import {
  DEFAULT_DESIGN_TOKENS,
  type Binding,
  type CollectionBinding,
  type DesignTokens,
  type LayoutPageSchema,
  type ResponsiveMode,
  type RuntimeManifest,
  type RuntimeRoute,
  type StudioNode,
  type StyleMap,
} from '@platform/contracts'

export interface RuntimeRenderContext {
  content?: Record<string, unknown>
  settings?: Record<string, unknown>
  media?: Record<string, { id: string; url: string; alt?: string }>
  collections?: Record<string, unknown[]>
  fieldContext?: Record<string, unknown>
  currentCollection?: string
  linkMode?: 'hash' | 'browser' | 'disabled'
  onNavigate?: (href: string) => void
}

export type RuntimeNodeEditorProps = React.HTMLAttributes<HTMLElement> & { style?: React.CSSProperties }

export interface RuntimeRendererProps extends RuntimeRenderContext {
  schema: LayoutPageSchema
  designTokens?: DesignTokens
  mode?: ResponsiveMode
  className?: string
  style?: React.CSSProperties
  editable?: boolean
  selectedNodeId?: string | null
  onEditableClick?: (node: StudioNode, propertyKeys: string[]) => void
  onEditableDoubleClick?: (node: StudioNode, propertyKeys: string[]) => void
  onNodeClick?: (node: StudioNode) => void
  nodeEditorProps?: (node: StudioNode) => RuntimeNodeEditorProps
}

export const SAFE_RUNTIME_TAGS = new Set([
  'div', 'section', 'header', 'main', 'aside', 'footer', 'article', 'nav', 'details', 'summary',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a',
  'button', 'input', 'textarea', 'img', 'figure', 'figcaption', 'video', 'audio', 'hr', 'br', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'form', 'label', 'select', 'option', 'progress', 'meter',
  'dialog', 'mark', 'code', 'strong', 'em', 'small', 'time', 'address', 'picture', 'source',
])
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source'])
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li', 'summary', 'mark', 'code', 'figcaption', 'blockquote', 'pre', 'article', 'strong', 'em', 'small', 'time', 'address'])
const SAFE_PROP_KEYS = new Set(['href', 'src', 'alt', 'title', 'target', 'rel', 'type', 'placeholder', 'name', 'value', 'min', 'max', 'step', 'rows', 'cols', 'open', 'controls', 'poster', 'preload', 'loading', 'decoding', 'width', 'height'])

export function normalizeRuntimeTag(value: unknown): string {
  const tag = String(value || 'div').trim().toLowerCase()
  return SAFE_RUNTIME_TAGS.has(tag) ? tag : 'div'
}

function hasUnsafeUrlPrefix(value: string): boolean {
  const prefix = value.slice(0, Math.min(value.length, 96))
  return /[\u0000-\u001F\u007F]/.test(value) || /^[a-z][a-z0-9+.-]*\s*:/i.test(prefix) && /\s/.test(prefix.split(':', 1)[0] || '')
}

/** Runtime URL protocol allow-list. Invalid/active-content protocols are rejected, never rewritten. */
export function sanitizeRuntimeUrl(value: unknown, kind: 'href' | 'src' = 'href'): string | undefined {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw || hasUnsafeUrlPrefix(raw)) return undefined
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw
  let protocol = ''
  try { protocol = new URL(raw, 'https://runtime.invalid').protocol.toLowerCase() } catch { return undefined }
  if (kind === 'href') return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol) ? raw : undefined
  if (['http:', 'https:', 'blob:'].includes(protocol)) return raw
  // SVG data URLs are deliberately excluded: active SVG payloads are not runtime media.
  if (protocol === 'data:' && /^data:image\/(?:png|jpeg|jpg|gif|webp);(?:base64,|charset=)/i.test(raw)) return raw
  return undefined
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}


const CSS_URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
const BLOCKED_CSS_VALUE = /(?:javascript\s*:|vbscript\s*:|expression\s*\(|-moz-binding\s*:|behavior\s*:)/i

export function sanitizeRuntimeStyle(style: StyleMap | React.CSSProperties): React.CSSProperties {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(style || {})) {
    if (value === undefined || value === null || typeof value === 'boolean') continue
    if (typeof value === 'number') { safe[key] = Number.isFinite(value) ? value : undefined; continue }
    if (typeof value !== 'string' || value.length > 8192 || BLOCKED_CSS_VALUE.test(value)) continue
    let valid = true
    for (const match of value.matchAll(new RegExp(CSS_URL_RE.source, 'gi'))) {
      if (!sanitizeRuntimeUrl(match[2], 'src')) { valid = false; break }
    }
    if (valid) safe[key] = value
  }
  return safe as React.CSSProperties
}

function normalizePathname(pathname: string): string {
  const path = (`/${String(pathname || '/').split('?')[0].split('#')[0]}`).replace(/\/{2,}/g, '/')
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

export function isRuntimeManifestCompatible(minimum: string, current: string): boolean {
  const tuple = (value: string) => value.replace(/^v/, '').split('.').slice(0, 3).map((part) => Number(part) || 0)
  const min = tuple(minimum); const cur = tuple(current)
  for (let index = 0; index < 3; index += 1) {
    if ((cur[index] || 0) > (min[index] || 0)) return true
    if ((cur[index] || 0) < (min[index] || 0)) return false
  }
  return true
}

export interface RuntimeRouteMatch { route: RuntimeRoute; params: Record<string, string> }

function routeScore(pattern: string): number {
  const segments = normalizePathname(pattern).split('/').filter(Boolean)
  return segments.reduce((score, segment) => score + (segment.startsWith(':') ? 10 : 100) + segment.length, segments.length * 1000)
}

export function compileRuntimeRoute(pattern: string): { regex: RegExp; names: string[]; score: number } {
  const normalized = normalizePathname(pattern || '/')
  if (!normalized.startsWith('/')) throw new Error('Runtime route patterns must start with /.')
  const names: string[] = []
  const segments = normalized.split('/').filter(Boolean)
  const source = segments.map((segment) => {
    if (segment.startsWith(':')) {
      const name = segment.slice(1)
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Invalid route parameter: ${segment}`)
      if (names.includes(name)) throw new Error(`Duplicate route parameter: ${name}`)
      names.push(name)
      return '([^/]+)'
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('/')
  return { regex: new RegExp(`^/${source}${segments.length ? '' : ''}/?$`), names, score: routeScore(normalized) }
}

export function matchRuntimeRoute(routes: RuntimeRoute[], pathname: string): RuntimeRouteMatch | null {
  const compiled = routes.flatMap((route) => {
    try { return [{ route, compiled: compileRuntimeRoute(route.path || '/') }] } catch { return [] }
  })
  compiled.sort((a, b) => b.compiled.score - a.compiled.score || a.route.path.localeCompare(b.route.path) || a.route.pageId.localeCompare(b.route.pageId))
  const normalized = normalizePathname(pathname)
  for (const candidate of compiled) {
    const match = normalized.match(candidate.compiled.regex)
    if (!match) continue
    const params: Record<string, string> = {}
    for (let index = 0; index < candidate.compiled.names.length; index += 1) {
      try { params[candidate.compiled.names[index]] = decodeURIComponent(match[index + 1]) } catch { params[candidate.compiled.names[index]] = match[index + 1] }
    }
    return { route: candidate.route, params }
  }
  return null
}

export const RUNTIME_CSS = `
.rt-page{width:100%;position:relative}
.rt-node{box-sizing:border-box}
.rt-editable{cursor:pointer;outline:1px dashed rgba(37,99,235,.55);outline-offset:2px}
.rt-editable:hover{outline:2px solid #2563eb;outline-offset:2px}
.rt-editable.rt-selected{outline:2px solid #22d3ee;box-shadow:0 0 0 4px rgba(34,211,238,.12)}
.rt-empty-node{min-height:24px;min-width:24px}
.rt-anim{--rt-duration:700ms;--rt-delay:0ms;--rt-easing:ease-out;--rt-transform:none}
.rt-trigger-scroll{opacity:0;transition:opacity var(--rt-duration) var(--rt-easing) var(--rt-delay),transform var(--rt-duration) var(--rt-easing) var(--rt-delay),filter var(--rt-duration) var(--rt-easing) var(--rt-delay),clip-path var(--rt-duration) var(--rt-easing) var(--rt-delay)}
.rt-trigger-scroll.rt-visible{opacity:1;transform:none!important;filter:none!important;clip-path:none!important}
.rt-anim-fade.rt-trigger-scroll{opacity:0}
.rt-anim-fade-up.rt-trigger-scroll{transform:translateY(48px)}
.rt-anim-fade-down.rt-trigger-scroll{transform:translateY(-48px)}
.rt-anim-fade-left.rt-trigger-scroll{transform:translateX(48px)}
.rt-anim-fade-right.rt-trigger-scroll{transform:translateX(-48px)}
.rt-anim-zoom-in.rt-trigger-scroll{transform:scale(.86)}
.rt-anim-blur-in.rt-trigger-scroll{filter:blur(18px)}
.rt-anim-reveal.rt-trigger-scroll{clip-path:inset(0 100% 0 0)}
.rt-anim-flip-x.rt-trigger-scroll{transform:perspective(900px) rotateX(70deg)}
.rt-anim-flip-y.rt-trigger-scroll{transform:perspective(900px) rotateY(70deg)}
.rt-trigger-load.rt-anim-fade{animation:rtFade var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-up{animation:rtFadeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-down{animation:rtFadeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-left{animation:rtFadeLeft var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-right{animation:rtFadeRight var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-zoom-in{animation:rtZoomIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-blur-in{animation:rtBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-reveal{animation:rtReveal var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-flip-x{animation:rtFlipX var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-flip-y{animation:rtFlipY var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-typewriter{overflow:hidden;white-space:nowrap;animation:rtTypewriter var(--rt-duration) steps(24,end) var(--rt-delay) both}
.rt-trigger-continuous.rt-anim-float{animation:rtFloat var(--rt-duration) ease-in-out var(--rt-delay) infinite alternate}
.rt-trigger-continuous.rt-anim-spin{animation:rtSpin var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-orbit{animation:rtSpin var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-aurora{background-size:200% 200%!important;animation:rtAurora var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-hover.rt-anim-scale-hover{transition:transform var(--rt-duration) var(--rt-easing)}
.rt-trigger-hover.rt-anim-scale-hover:hover{transform:scale(1.035)}
.rt-trigger-hover.rt-anim-tilt-3d{transition:transform var(--rt-duration) var(--rt-easing);transform-style:preserve-3d}
.rt-trigger-hover.rt-anim-tilt-3d:hover{transform:perspective(800px) rotateX(3deg) rotateY(-3deg) translateY(-2px)}
.rt-trigger-hover.rt-anim-glitch:hover{animation:rtGlitch var(--rt-duration) linear 1}
.rt-trigger-tap.rt-anim-scale-hover{transition:transform var(--rt-duration) var(--rt-easing)}
.rt-trigger-tap.rt-anim-scale-hover.rt-active{transform:scale(.965)}
.rt-trigger-tap.rt-anim-tilt-3d{transition:transform var(--rt-duration) var(--rt-easing);transform-style:preserve-3d}
.rt-trigger-tap.rt-anim-tilt-3d.rt-active{transform:perspective(800px) rotateX(2deg) rotateY(-2deg) scale(.985)}
.rt-trigger-tap.rt-anim-glitch.rt-active{animation:rtGlitch var(--rt-duration) linear 1}
.rt-parallax{transform:translate3d(0,var(--rt-parallax-y,0px),0)}
.rt-anim-parallax-y{transform:translate3d(0,var(--rt-animation-parallax-y,0px),0)}
.rt-anim-parallax-x{transform:translate3d(var(--rt-animation-parallax-x,0px),0,0)}
.rt-horizontal{overflow-x:auto;scroll-snap-type:x proximity}
.rt-horizontal>*{scroll-snap-align:start}
.rt-scroll-reveal{opacity:0;clip-path:inset(0 0 12% 0);transform:translateY(24px);transition:opacity .7s ease-out,transform .7s ease-out,clip-path .7s ease-out}
.rt-scroll-reveal.rt-scroll-visible{opacity:1;clip-path:inset(0);transform:none}
.rt-scroll-sticky,.rt-scroll-pin,.rt-scroll-stack{will-change:auto}
@keyframes rtFade{from{opacity:0}to{opacity:1}}
@keyframes rtFadeUp{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes rtFadeDown{from{opacity:0;transform:translateY(-48px)}to{opacity:1;transform:none}}
@keyframes rtFadeLeft{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:none}}
@keyframes rtFadeRight{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:none}}
@keyframes rtZoomIn{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}
@keyframes rtBlurIn{from{opacity:0;filter:blur(18px)}to{opacity:1;filter:none}}
@keyframes rtReveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
@keyframes rtFlipX{from{opacity:0;transform:perspective(900px) rotateX(70deg)}to{opacity:1;transform:none}}
@keyframes rtFlipY{from{opacity:0;transform:perspective(900px) rotateY(70deg)}to{opacity:1;transform:none}}
@keyframes rtFloat{from{transform:translateY(-8px)}to{transform:translateY(10px)}}
@keyframes rtSpin{to{transform:rotate(360deg)}}
@keyframes rtAurora{0%{background-position:0 50%}100%{background-position:200% 50%}}
@keyframes rtTypewriter{from{max-width:0}to{max-width:100%}}
@keyframes rtGlitch{0%,100%{transform:translate(0)}20%{transform:translate(-3px,2px)}40%{transform:translate(3px,-2px)}60%{transform:translate(-2px,-1px)}80%{transform:translate(2px,1px)}}
@media (prefers-reduced-motion:reduce){.rt-anim,.rt-scroll-reveal{animation:none!important;transition:none!important;opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}.rt-parallax,.rt-anim-parallax-x,.rt-anim-parallax-y{transform:none!important}.rt-reduced-skip{position:relative!important;top:auto!important;transform:none!important}.rt-reduced-reduce{scroll-behavior:auto!important}}
`

export function resolveResponsiveStyles(styles: StudioNode['styles'] | undefined, mode: ResponsiveMode = 'desktop'): StyleMap {
  const desktop = styles?.desktop || {}
  if (mode === 'desktop') return { ...desktop }
  const tablet = styles?.tablet || {}
  if (mode === 'tablet') return { ...desktop, ...tablet }
  return { ...desktop, ...tablet, ...(styles?.mobile || {}) }
}

function applyLayoutStyle(style: StyleMap, node: StudioNode): StyleMap {
  const layout = node.layout
  if (!layout) return style
  const next: StyleMap = { ...style }
  if (layout.mode === 'absolute') {
    next.position = 'absolute'
    if (layout.x !== undefined) next.left = layout.x
    if (layout.y !== undefined) next.top = layout.y
    if (layout.width !== undefined) next.width = layout.width
    if (layout.height !== undefined) next.height = layout.height
  }
  if (layout.rotation !== undefined) next.transform = `${next.transform || ''} rotate(${layout.rotation}deg)`.trim()
  if (layout.zIndex !== undefined) next.zIndex = layout.zIndex
  return next
}

export function computeNodeStyle(node: StudioNode, mode: ResponsiveMode = 'desktop'): React.CSSProperties {
  let style = applyLayoutStyle(resolveResponsiveStyles(node.styles, mode), node)
  const behavior = node.scrollBehavior
  const effectiveMode = mode === 'mobile' && behavior?.mobileFallback ? behavior.mobileFallback : behavior?.mode
  if (effectiveMode === 'sticky' || effectiveMode === 'pin' || effectiveMode === 'stack-over-previous') {
    style = { ...style, position: 'sticky', top: behavior?.stickyTop ?? 0 }
    if (effectiveMode === 'stack-over-previous') style.zIndex = behavior?.stackOrder ?? Number(style.zIndex || 1)
  }
  if (effectiveMode === 'horizontal') style = { ...style, display: style.display || 'flex', flexWrap: 'nowrap' }
  return sanitizeRuntimeStyle(style)
}

function getObjectValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  return path.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, obj)
}

export function resolveBinding(binding: Binding | undefined, property: string, ctx: RuntimeRenderContext): unknown {
  if (!binding) return undefined
  if (binding.type === 'static') return binding.value
  if (binding.type === 'content') {
    const value = ctx.content?.[binding.key] ?? binding.fallback ?? binding.sample
    if (binding.contentType === 'media' && typeof value === 'string') return ctx.media?.[value]?.url ?? value
    if (binding.contentType === 'button' && value && typeof value === 'object' && !Array.isArray(value)) {
      const button = value as Record<string, unknown>
      if (property === 'href') return button.href ?? button.url ?? binding.fallback
      if (property === 'text') return button.label ?? button.text ?? binding.fallback
    }
    return value
  }
  if (binding.type === 'setting') return ctx.settings?.[binding.key] ?? binding.fallback ?? binding.sample
  if (binding.type === 'media') {
    if (binding.mediaId) return ctx.media?.[binding.mediaId]?.url ?? binding.sampleUrl
    return binding.sampleUrl
  }
  if (binding.type === 'field') {
    const value = getObjectValue(ctx.fieldContext, binding.field) ?? binding.fallback
    if (property === 'href' && binding.field === 'slug' && typeof value === 'string' && ctx.currentCollection && ['projects', 'notes'].includes(ctx.currentCollection)) return `/${ctx.currentCollection}/${value}`
    if ((property === 'src' || property === 'poster') && typeof value === 'string') return ctx.media?.[value]?.url ?? value
    return value
  }
  return undefined
}

function compareValue(actual: unknown, operator: CollectionBinding['filters'] extends Array<infer T> | undefined ? T extends { operator: infer O } ? O : never : never, expected: unknown): boolean {
  switch (operator) {
    case 'eq': return actual === expected
    case 'neq': return actual !== expected
    case 'in': return Array.isArray(expected) ? expected.includes(actual) : false
    case 'contains': return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected ?? ''))
    case 'gt': return Number(actual) > Number(expected)
    case 'gte': return Number(actual) >= Number(expected)
    case 'lt': return Number(actual) < Number(expected)
    case 'lte': return Number(actual) <= Number(expected)
    default: return true
  }
}

export function applyCollectionQuery(items: unknown[], binding: CollectionBinding): unknown[] {
  let result = [...items]
  for (const filter of binding.filters || []) result = result.filter((item) => compareValue(getObjectValue(item as Record<string, unknown>, filter.field), filter.operator as any, filter.value))
  for (const sort of [...(binding.sort || [])].reverse()) {
    result.sort((a, b) => {
      const av = getObjectValue(a as Record<string, unknown>, sort.field)
      const bv = getObjectValue(b as Record<string, unknown>, sort.field)
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
      return sort.direction === 'desc' ? -cmp : cmp
    })
  }
  if (binding.limit) result = result.slice(0, binding.limit)
  return result
}

function animationClass(node: StudioNode): string {
  if (!node.animation) return ''
  const parallax = node.animation.type === 'parallax-x' || node.animation.type === 'parallax-y'
  return `rt-anim rt-anim-${node.animation.type}${parallax ? '' : ` rt-trigger-${node.animation.trigger}`}`
}

function scrollClass(node: StudioNode, mode: ResponsiveMode): string {
  const behavior = node.scrollBehavior
  const effective = mode === 'mobile' && behavior?.mobileFallback ? behavior.mobileFallback : behavior?.mode
  const classes: string[] = []
  if (effective === 'parallax') classes.push('rt-parallax')
  if (effective === 'horizontal') classes.push('rt-horizontal')
  if (effective === 'reveal') classes.push('rt-scroll-reveal')
  if (effective === 'sticky') classes.push('rt-scroll-sticky')
  if (effective === 'pin') classes.push('rt-scroll-pin')
  if (effective === 'stack-over-previous') classes.push('rt-scroll-stack')
  if (behavior?.reducedMotionFallback === 'skip') classes.push('rt-reduced-skip')
  if (behavior?.reducedMotionFallback === 'reduce') classes.push('rt-reduced-reduce')
  return classes.join(' ')
}

function useRuntimeEffects(node: StudioNode, mode: ResponsiveMode) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const animation = node.animation
    const behavior = node.scrollBehavior
    const effective = mode === 'mobile' && behavior?.mobileFallback ? behavior.mobileFallback : behavior?.mode
    const observesVisibility = animation?.trigger === 'scroll' || effective === 'reveal'
    let observer: IntersectionObserver | undefined
    if (observesVisibility && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (animation?.trigger === 'scroll') element.classList.add('rt-visible')
          if (effective === 'reveal') element.classList.add('rt-scroll-visible')
        } else {
          if (animation?.trigger === 'scroll' && animation.repeat) element.classList.remove('rt-visible')
          if (effective === 'reveal' && behavior?.params?.repeat) element.classList.remove('rt-scroll-visible')
        }
      }), { threshold: Number(animation?.params?.threshold ?? behavior?.params?.threshold ?? 0.14) })
      observer.observe(element)
    } else if (observesVisibility) {
      if (animation?.trigger === 'scroll') element.classList.add('rt-visible')
      if (effective === 'reveal') element.classList.add('rt-scroll-visible')
    }

    const tapStart = () => element.classList.add('rt-active')
    const tapEnd = () => element.classList.remove('rt-active')
    if (animation?.trigger === 'tap') {
      element.addEventListener('pointerdown', tapStart)
      element.addEventListener('pointerup', tapEnd)
      element.addEventListener('pointercancel', tapEnd)
      element.addEventListener('pointerleave', tapEnd)
    }

    const animationParallax = animation?.type === 'parallax-x' || animation?.type === 'parallax-y'
    let ticking = false
    const onScroll = () => {
      if ((effective !== 'parallax' && !animationParallax) || ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect()
        const centerDelta = window.innerHeight / 2 - (rect.top + rect.height / 2)
        if (effective === 'parallax') {
          const strength = Number(behavior?.params?.speed ?? behavior?.params?.strength ?? 0.25)
          element.style.setProperty('--rt-parallax-y', `${Math.max(-120, Math.min(120, centerDelta * strength))}px`)
        }
        if (animationParallax) {
          const strength = Number(animation?.params?.speed ?? animation?.params?.strength ?? 0.18)
          const distance = Math.max(-160, Math.min(160, centerDelta * strength))
          element.style.setProperty(animation.type === 'parallax-x' ? '--rt-animation-parallax-x' : '--rt-animation-parallax-y', `${distance}px`)
        }
        ticking = false
      })
    }
    if (effective === 'parallax' || animationParallax) {
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', onScroll)
      element.removeEventListener('pointerdown', tapStart)
      element.removeEventListener('pointerup', tapEnd)
      element.removeEventListener('pointercancel', tapEnd)
      element.removeEventListener('pointerleave', tapEnd)
    }
  }, [node.animation, node.scrollBehavior, mode])
  return ref
}

function linkHref(value: unknown, mode: RuntimeRenderContext['linkMode']): string | undefined {
  const safe = sanitizeRuntimeUrl(value, 'href')
  if (!safe) return undefined
  if (mode === 'disabled') return '#'
  if (mode === 'hash' && safe.startsWith('/')) return `#${safe}`
  return safe
}

function fallbackImage(): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171720"/><stop offset="1" stop-color="#2b2142"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" fill="#94a3b8" font-family="system-ui" font-size="32" text-anchor="middle">Image</text></svg>`)
}

class RuntimeNodeBoundary extends Component<{ nodeId: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { if (typeof console !== 'undefined') console.error(`Runtime node ${this.props.nodeId} failed`, error) }
  render() { return this.state.failed ? <div className="rt-node-error" data-runtime-error-node={this.props.nodeId} /> : this.props.children }
}

function RuntimeNodeUnsafe({ node, ctx, mode = 'desktop', editable = false, selectedNodeId, onEditableClick, onEditableDoubleClick, onNodeClick, nodeEditorProps }: {
  node: StudioNode
  ctx: RuntimeRenderContext
  mode?: ResponsiveMode
  editable?: boolean
  selectedNodeId?: string | null
  onEditableClick?: RuntimeRendererProps['onEditableClick']
  onEditableDoubleClick?: RuntimeRendererProps['onEditableDoubleClick']
  onNodeClick?: RuntimeRendererProps['onNodeClick']
  nodeEditorProps?: RuntimeRendererProps['nodeEditorProps']
}) {
  const ref = useRuntimeEffects(node, mode)
  if (node.meta?.hidden) return null
  const style = computeNodeStyle(node, mode)
  const animation = node.animation
  if (animation) {
    ;(style as Record<string, unknown>)['--rt-duration'] = `${animation.duration ?? 700}ms`
    ;(style as Record<string, unknown>)['--rt-delay'] = `${animation.delay ?? 0}ms`
    ;(style as Record<string, unknown>)['--rt-easing'] = animation.easing ?? 'ease-out'
    style.willChange = style.willChange || 'transform, opacity'
  }
  const editableProperties = Object.entries(node.bindings || {})
    .filter(([, binding]) => binding.type === 'content' || binding.type === 'setting' || binding.type === 'collection')
    .map(([key]) => key)
  const classes = ['rt-node', animationClass(node), scrollClass(node, mode), editable && editableProperties.length ? 'rt-editable' : '', selectedNodeId === node.id ? 'rt-selected' : ''].filter(Boolean).join(' ')
  const resolvedProps: Record<string, unknown> = { ...(node.props || {}) }
  Object.entries(node.bindings || {}).forEach(([property, binding]) => {
    if (binding.type !== 'collection') {
      const value = resolveBinding(binding, property, ctx)
      if (value !== undefined) resolvedProps[property] = value
    }
  })

  const collectionBinding = Object.values(node.bindings || {}).find((binding): binding is CollectionBinding => binding.type === 'collection')
  let children: React.ReactNode = null
  if (collectionBinding) {
    const items = applyCollectionQuery(ctx.collections?.[collectionBinding.collection] || [], collectionBinding)
    children = items.length ? items.map((item, index) => (
      <React.Fragment key={String((item as any)?.id ?? index)}>
        {(node.children || []).map((child) => <RuntimeNodeSafe key={`${child.id}-${String((item as any)?.id ?? index)}`} node={child} ctx={{ ...ctx, fieldContext: item as Record<string, unknown>, currentCollection: collectionBinding.collection }} mode={mode} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} onNodeClick={onNodeClick} nodeEditorProps={nodeEditorProps} />)}
      </React.Fragment>
    )) : <div style={{ color: 'var(--site-muted)', padding: '20px', border: '1px dashed var(--site-border)' }}>{String(node.props?.emptyText || `No ${collectionBinding.collection} yet`)}</div>
  } else if (node.children?.length) {
    children = node.children.map((child) => <RuntimeNodeSafe key={child.id} node={child} ctx={ctx} mode={mode} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} onNodeClick={onNodeClick} nodeEditorProps={nodeEditorProps} />)
  } else if (TEXT_TAGS.has(node.tag || node.type) || resolvedProps.text !== undefined) {
    const value = resolvedProps.text ?? node.meta?.label ?? ''
    children = Array.isArray(value) ? value.join(' • ') : String(value ?? '')
  }

  const requestedTag = (node.tag || node.type || 'div').toLowerCase()
  const tag = normalizeRuntimeTag(requestedTag)
  const domProps: Record<string, unknown> = {}
  Object.entries(resolvedProps).forEach(([key, value]) => {
    if (!SAFE_PROP_KEYS.has(key) || value === undefined || value === null) return
    if (key === 'href') {
      const safe = linkHref(value, ctx.linkMode)
      if (safe) domProps[key] = safe
    }
    else if (key === 'src' || key === 'poster') {
      const safe = sanitizeRuntimeUrl(value, 'src')
      if (safe) domProps[key] = safe
    }
    else if (key === 'value' && ['input', 'textarea'].includes(tag)) { domProps.defaultValue = value; domProps.readOnly = true }
    else domProps[key] = value
  })
  if ((tag === 'img') && !domProps.src) domProps.src = fallbackImage()
  if (domProps.target && !['_blank','_self','_parent','_top'].includes(String(domProps.target))) delete domProps.target
  if (domProps.target === '_blank') domProps.rel = 'noopener noreferrer'
  if (requestedTag !== tag) domProps['data-runtime-sanitized-tag'] = requestedTag
  if (node.accessibility?.ariaLabel) domProps['aria-label'] = node.accessibility.ariaLabel
  if (node.accessibility?.role) domProps.role = node.accessibility.role
  if (node.accessibility?.title) domProps.title = node.accessibility.title
  const click = (event: React.MouseEvent) => {
    const rawHref = resolvedProps.href
    if (tag === 'a' && ctx.linkMode === 'disabled') event.preventDefault()
    const navigationHref = sanitizeRuntimeUrl(rawHref, 'href')
    if (!editable && tag === 'a' && ctx.onNavigate && navigationHref) { event.preventDefault(); event.stopPropagation(); ctx.onNavigate(navigationHref); return }
    if (editable && editableProperties.length) { event.preventDefault(); event.stopPropagation(); onEditableClick?.(node, editableProperties) }
    onNodeClick?.(node)
  }
  const doubleClick = (event: React.MouseEvent) => {
    if (editable && editableProperties.length) { event.preventDefault(); event.stopPropagation(); onEditableDoubleClick?.(node, editableProperties) }
  }

  const editorProps = nodeEditorProps?.(node) || {}
  const commonProps: Record<string, unknown> = {
    ...domProps,
    ...editorProps,
    ref,
    className: [classes, editorProps.className].filter(Boolean).join(' '),
    style: sanitizeRuntimeStyle({ ...style, ...(editorProps.style || {}) }),
    'data-runtime-node-id': node.id,
    onClick: click,
    onDoubleClick: doubleClick,
  }
  // Runtime layouts are presentation-only. Forms cannot submit/exfiltrate data.
  if (tag === 'form') commonProps.onSubmit = (event: React.FormEvent) => event.preventDefault()

  if (VOID_TAGS.has(tag)) return React.createElement(tag, commonProps)
  return React.createElement(tag, commonProps, children)
}

export function RuntimeNode(props: React.ComponentProps<typeof RuntimeNodeUnsafe>) {
  return <RuntimeNodeBoundary nodeId={props.node.id}><RuntimeNodeUnsafe {...props} /></RuntimeNodeBoundary>
}
const RuntimeNodeSafe = RuntimeNode

export function RuntimeRenderer({ schema, designTokens = DEFAULT_DESIGN_TOKENS, mode = 'desktop', className, style, editable, selectedNodeId, onEditableClick, onEditableDoubleClick, onNodeClick, nodeEditorProps, ...ctx }: RuntimeRendererProps) {
  const tokenStyle = useMemo(() => ({ ...(designTokens.variables || {}) }) as React.CSSProperties, [designTokens])
  return (
    <div className={`rt-page ${className || ''}`} style={{ ...tokenStyle, fontFamily: designTokens.fonts?.body || 'system-ui, sans-serif', background: 'var(--site-bg)', color: 'var(--site-text)', ...style }}>
      <style>{RUNTIME_CSS}</style>
      {schema.root.map((node) => <RuntimeNodeSafe key={node.id} node={node} ctx={ctx} mode={mode} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} onNodeClick={onNodeClick} nodeEditorProps={nodeEditorProps} />)}
    </div>
  )
}

export function RuntimeSitePreview({ manifest, route, mode = 'desktop', editable = false, selectedNodeId, onEditableClick, onEditableDoubleClick, fieldContext, linkMode, onNavigate }: {
  manifest: RuntimeManifest
  route: RuntimeManifest['routes'][number]
  mode?: ResponsiveMode
  editable?: boolean
  selectedNodeId?: string | null
  onEditableClick?: RuntimeRendererProps['onEditableClick']
  onEditableDoubleClick?: RuntimeRendererProps['onEditableDoubleClick']
  fieldContext?: Record<string, unknown>
  linkMode?: RuntimeRenderContext['linkMode']
  onNavigate?: RuntimeRenderContext['onNavigate']
}) {
  const previewFallbackFieldContext = !fieldContext && route.pageType === 'collection_detail' && route.collectionName
    ? manifest.collections?.[route.collectionName]?.[0] as Record<string, unknown> | undefined
    : undefined
  const resolvedFieldContext = fieldContext || previewFallbackFieldContext
  const ctx: RuntimeRenderContext = { content: manifest.content, settings: manifest.settings, media: manifest.media, collections: manifest.collections, fieldContext: resolvedFieldContext, currentCollection: route.collectionName, onNavigate, linkMode: editable || onNavigate ? 'disabled' : (linkMode || 'hash') }
  return (
    <div style={{ background: 'var(--site-bg)' }}>
      {manifest.globals.header && <RuntimeRenderer schema={manifest.globals.header} designTokens={manifest.designTokens} mode={mode} {...ctx} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} />}
      <RuntimeRenderer schema={route.schema} designTokens={manifest.designTokens} mode={mode} {...ctx} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} />
      {manifest.globals.footer && <RuntimeRenderer schema={manifest.globals.footer} designTokens={manifest.designTokens} mode={mode} {...ctx} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} />}
    </div>
  )
}

// Kept for non-React tooling and snapshot tests. This intentionally uses only static/sample props.
export function renderNodeToHtml(node: StudioNode, mode: ResponsiveMode = 'desktop'): string {
  const tag = normalizeRuntimeTag(node.tag || node.type || 'div')
  const style = sanitizeRuntimeStyle(computeNodeStyle(node, mode))
  const styleString = Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${escapeHtml(String(value))}`)
    .join(';')
  const textBinding = node.bindings?.text
  const text = textBinding?.type === 'static' ? textBinding.value : textBinding?.type === 'content' ? textBinding.sample ?? textBinding.fallback : node.props?.text
  const attrs = styleString ? ` style="${styleString}"` : ''
  if (VOID_TAGS.has(tag)) return `<${tag}${attrs}>`
  const children = node.children?.map((child) => renderNodeToHtml(child, mode)).join('') || (text === undefined ? '' : escapeHtml(text))
  return `<${tag}${attrs}>${children}</${tag}>`
}

export const renderNode = renderNodeToHtml
