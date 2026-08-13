import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_DESIGN_TOKENS,
  type Binding,
  type CollectionBinding,
  type DesignTokens,
  type LayoutPageSchema,
  type ResponsiveMode,
  type RuntimeAction,
  type RuntimeCondition,
  type RuntimeManifest,
  type RuntimeRoute,
  type RuntimeValueReference,
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
  collectionIndex?: number
  collectionPosition?: number
  collectionCount?: number
  runtimeState?: Record<string, unknown>
  setRuntimeStateValue?: (key: string, value: unknown) => void
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

type ParticleDirection = 'random' | 'up' | 'down' | 'left' | 'right'

interface ParticleFieldConfig {
  count: number
  minSize: number
  maxSize: number
  speed: number
  drift: number
  opacity: number
  glow: number
  direction: ParticleDirection
  colors: string[]
  seed: number
  motion: 'continuous' | 'static'
}

function clampParticleNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function safeParticleColors(value: unknown): string[] {
  const defaults = ['#dce8ff', '#91afff', '#646eff']
  if (typeof value !== 'string') return defaults
  const colors = value.split(/[\s,]+/).map((item) => item.trim()).filter((item) => /^#[0-9a-f]{3,8}$/i.test(item)).slice(0, 8)
  return colors.length ? colors : defaults
}

function particleFieldConfig(node: StudioNode): ParticleFieldConfig {
  const minSize = clampParticleNumber(node.props?.minSize, 2, 1, 20)
  const maxSize = Math.max(minSize, clampParticleNumber(node.props?.maxSize, 5, 1, 24))
  const directionRaw = String(node.props?.direction || 'random') as ParticleDirection
  const motionRaw = String(node.props?.motion || 'continuous')
  return {
    count: Math.round(clampParticleNumber(node.props?.count, 20, 1, 200)),
    minSize,
    maxSize,
    speed: clampParticleNumber(node.props?.speed, .25, .05, 3),
    drift: clampParticleNumber(node.props?.drift, 30, 0, 300),
    opacity: clampParticleNumber(node.props?.opacity, .5, 0, 1),
    glow: clampParticleNumber(node.props?.glow, .6, 0, 1),
    direction: ['random', 'up', 'down', 'left', 'right'].includes(directionRaw) ? directionRaw : 'random',
    colors: safeParticleColors(node.props?.colors),
    seed: Math.trunc(clampParticleNumber(node.props?.seed, 1, -2147483647, 2147483647)),
    motion: motionRaw === 'static' ? 'static' : 'continuous',
  }
}

function hashParticleSeed(value: string): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function particleRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function particleVector(direction: ParticleDirection, drift: number, random: () => number): [number, number] {
  const amplitude = drift * (.65 + random() * .35)
  if (direction === 'up') return [(random() - .5) * drift * .55, -amplitude]
  if (direction === 'down') return [(random() - .5) * drift * .55, amplitude]
  if (direction === 'left') return [-amplitude, (random() - .5) * drift * .55]
  if (direction === 'right') return [amplitude, (random() - .5) * drift * .55]
  const angle = random() * Math.PI * 2
  return [Math.cos(angle) * amplitude, Math.sin(angle) * amplitude]
}

function renderParticleField(node: StudioNode): React.ReactNode[] {
  const config = particleFieldConfig(node)
  const random = particleRandom(hashParticleSeed(`${node.id}:${config.seed}`))
  return Array.from({ length: config.count }, (_, index) => {
    const size = config.minSize + random() * (config.maxSize - config.minSize)
    const color = config.colors[Math.floor(random() * config.colors.length)] || config.colors[0]
    const [dx, dy] = particleVector(config.direction, config.drift, random)
    const duration = Math.max(2.5, (5 / config.speed) * (.72 + random() * .62))
    const delay = -random() * duration
    const alpha = config.opacity * (.5 + random() * .5)
    const glowPx = 3 + config.glow * 19
    const style = {
      left: `${random() * 100}%`,
      top: `${random() * 100}%`,
      width: `${size.toFixed(2)}px`,
      height: `${size.toFixed(2)}px`,
      opacity: Number(alpha.toFixed(3)),
      background: color,
      boxShadow: `0 0 ${glowPx.toFixed(1)}px ${color}`,
      '--rt-particle-dx': `${dx.toFixed(1)}px`,
      '--rt-particle-dy': `${dy.toFixed(1)}px`,
      '--rt-particle-duration': `${duration.toFixed(2)}s`,
      '--rt-particle-delay': `${delay.toFixed(2)}s`,
      animation: config.motion === 'continuous' ? undefined : 'none',
    } as React.CSSProperties
    return <span aria-hidden="true" className="rt-particle-field__particle" key={`${node.id}-particle-${index}`} style={style} />
  })
}

export const RUNTIME_CSS = `
.rt-page{width:100%;position:relative}
.rt-node{box-sizing:border-box}
.rt-editable{cursor:pointer;outline:1px dashed rgba(37,99,235,.55);outline-offset:2px}
.rt-editable:hover{outline:2px solid #2563eb;outline-offset:2px}
.rt-editable.rt-selected{outline:2px solid #22d3ee;box-shadow:0 0 0 4px rgba(34,211,238,.12)}
.rt-empty-node{min-height:24px;min-width:24px}
.rt-anim{--rt-duration:700ms;--rt-delay:0ms;--rt-easing:ease-out;--rt-transform:none}
.rt-resetting,.rt-resetting::after{transition:none!important;animation:none!important}
.rt-trigger-scroll{opacity:0;transition:opacity var(--rt-duration) var(--rt-easing) var(--rt-delay),transform var(--rt-duration) var(--rt-easing) var(--rt-delay),filter var(--rt-duration) var(--rt-easing) var(--rt-delay),clip-path var(--rt-duration) var(--rt-easing) var(--rt-delay),letter-spacing var(--rt-duration) var(--rt-easing) var(--rt-delay)}
.rt-trigger-scroll.rt-visible{opacity:1;transform:none!important;filter:none!important;clip-path:none!important;letter-spacing:normal!important}
.rt-editor-node.rt-trigger-scroll,.rt-editor-node.rt-trigger-state{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important;letter-spacing:normal!important;max-width:none!important;visibility:visible!important;animation:none!important}
.rt-editor-node.rt-anim-text-steps{visibility:visible!important}
.rt-editor-node.rt-anim-text-steps::after{display:none!important}

.rt-particle-field{position:relative;overflow:hidden;contain:layout paint;isolation:isolate}
.rt-particle-field__particle{position:absolute;display:block;border-radius:999px;pointer-events:none;will-change:transform;animation:rtParticleDrift var(--rt-particle-duration) ease-in-out var(--rt-particle-delay) infinite alternate}
@keyframes rtParticleDrift{from{transform:translate3d(0,0,0)}to{transform:translate3d(var(--rt-particle-dx),var(--rt-particle-dy),0)}}
@media (prefers-reduced-motion:reduce){.rt-particle-field__particle{animation:none!important;transform:none!important}}

/* Viewport/state entrance start states. */
.rt-anim-fade.rt-trigger-scroll{opacity:0}
.rt-anim-fade-up.rt-trigger-scroll{transform:translateY(48px)}
.rt-anim-fade-down.rt-trigger-scroll{transform:translateY(-48px)}
.rt-anim-fade-left.rt-trigger-scroll{transform:translateX(48px)}
.rt-anim-fade-right.rt-trigger-scroll{transform:translateX(-48px)}
.rt-anim-zoom-in.rt-trigger-scroll{transform:scale(.86)}
.rt-anim-pop-in.rt-trigger-scroll{transform:scale(.72)}
.rt-anim-rotate-in.rt-trigger-scroll{transform:rotate(-8deg) scale(.94)}
.rt-anim-skew-in.rt-trigger-scroll{transform:translateY(24px) skewY(5deg)}
.rt-anim-blur-in.rt-trigger-scroll{filter:blur(18px)}
.rt-anim-scale-blur-in.rt-trigger-scroll{transform:scale(.9);filter:blur(14px)}
.rt-anim-reveal.rt-trigger-scroll{clip-path:inset(0 100% 0 0)}
.rt-anim-wipe-up.rt-trigger-scroll{clip-path:inset(100% 0 0 0)}
.rt-anim-wipe-down.rt-trigger-scroll{clip-path:inset(0 0 100% 0)}
.rt-anim-flip-x.rt-trigger-scroll{transform:perspective(900px) rotateX(70deg)}
.rt-anim-flip-y.rt-trigger-scroll{transform:perspective(900px) rotateY(70deg)}
.rt-anim-tracking-in.rt-trigger-scroll{letter-spacing:.28em}
.rt-anim-text-blur-in.rt-trigger-scroll{filter:blur(10px)}

/* Load animations. */
.rt-trigger-load.rt-anim-fade{animation:rtFade var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-up{animation:rtFadeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-down{animation:rtFadeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-left{animation:rtFadeLeft var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-fade-right{animation:rtFadeRight var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-zoom-in{animation:rtZoomIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-pop-in{animation:rtPopIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-rotate-in{animation:rtRotateIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-skew-in{animation:rtSkewIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-blur-in{animation:rtBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-scale-blur-in{animation:rtScaleBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-reveal{animation:rtReveal var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-wipe-up{animation:rtWipeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-wipe-down{animation:rtWipeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-flip-x{animation:rtFlipX var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-flip-y{animation:rtFlipY var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-tracking-in{animation:rtTrackingIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-load.rt-anim-text-blur-in{animation:rtTextBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}

/* State-only entrance. rt-state-play is re-applied whenever a watched state key changes. */
.rt-trigger-state{opacity:0}
.rt-trigger-state.rt-state-play.rt-anim-fade{animation:rtFade var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-fade-up{animation:rtFadeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-fade-down{animation:rtFadeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-fade-left{animation:rtFadeLeft var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-fade-right{animation:rtFadeRight var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-zoom-in{animation:rtZoomIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-pop-in{animation:rtPopIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-rotate-in{animation:rtRotateIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-skew-in{animation:rtSkewIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-blur-in{animation:rtBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-scale-blur-in{animation:rtScaleBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-reveal{animation:rtReveal var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-wipe-up{animation:rtWipeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-wipe-down{animation:rtWipeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-flip-x{animation:rtFlipX var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-flip-y{animation:rtFlipY var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-tracking-in{animation:rtTrackingIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-state.rt-state-play.rt-anim-text-blur-in{animation:rtTextBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}

/* Text sequence animations. */
.rt-trigger-load.rt-anim-typewriter{overflow:hidden;white-space:nowrap;animation:rtTypewriter var(--rt-duration) steps(24,end) var(--rt-delay) both}
.rt-anim-typewriter.rt-trigger-scroll,.rt-anim-typewriter.rt-trigger-state{overflow:hidden;white-space:nowrap;max-width:0}
.rt-anim-typewriter.rt-trigger-scroll.rt-visible,.rt-anim-typewriter.rt-trigger-state.rt-state-play{animation:rtTypewriter var(--rt-duration) steps(24,end) var(--rt-delay) both}
.rt-anim-text-steps{position:relative;visibility:hidden}
.rt-anim-text-steps::after{position:absolute;inset:0 auto auto 0;visibility:visible;white-space:pre;content:""}
.rt-trigger-load.rt-anim-text-steps::after{animation:rtTextSteps var(--rt-duration) steps(1,end) var(--rt-delay) both}
.rt-trigger-scroll.rt-anim-text-steps.rt-visible::after,.rt-trigger-state.rt-anim-text-steps.rt-state-play::after{animation:rtTextSteps var(--rt-duration) steps(1,end) var(--rt-delay) both}

/* Entrance/text presets on hover, tap or keyboard focus. */
.rt-trigger-hover.rt-anim-fade:hover,.rt-trigger-tap.rt-anim-fade.rt-active,.rt-trigger-focus.rt-anim-fade:focus{animation:rtFade var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-fade-up:hover,.rt-trigger-tap.rt-anim-fade-up.rt-active,.rt-trigger-focus.rt-anim-fade-up:focus{animation:rtFadeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-fade-down:hover,.rt-trigger-tap.rt-anim-fade-down.rt-active,.rt-trigger-focus.rt-anim-fade-down:focus{animation:rtFadeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-fade-left:hover,.rt-trigger-tap.rt-anim-fade-left.rt-active,.rt-trigger-focus.rt-anim-fade-left:focus{animation:rtFadeLeft var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-fade-right:hover,.rt-trigger-tap.rt-anim-fade-right.rt-active,.rt-trigger-focus.rt-anim-fade-right:focus{animation:rtFadeRight var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-zoom-in:hover,.rt-trigger-tap.rt-anim-zoom-in.rt-active,.rt-trigger-focus.rt-anim-zoom-in:focus{animation:rtZoomIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-pop-in:hover,.rt-trigger-tap.rt-anim-pop-in.rt-active,.rt-trigger-focus.rt-anim-pop-in:focus{animation:rtPopIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-rotate-in:hover,.rt-trigger-tap.rt-anim-rotate-in.rt-active,.rt-trigger-focus.rt-anim-rotate-in:focus{animation:rtRotateIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-skew-in:hover,.rt-trigger-tap.rt-anim-skew-in.rt-active,.rt-trigger-focus.rt-anim-skew-in:focus{animation:rtSkewIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-blur-in:hover,.rt-trigger-tap.rt-anim-blur-in.rt-active,.rt-trigger-focus.rt-anim-blur-in:focus{animation:rtBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-scale-blur-in:hover,.rt-trigger-tap.rt-anim-scale-blur-in.rt-active,.rt-trigger-focus.rt-anim-scale-blur-in:focus{animation:rtScaleBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-reveal:hover,.rt-trigger-tap.rt-anim-reveal.rt-active,.rt-trigger-focus.rt-anim-reveal:focus{animation:rtReveal var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-wipe-up:hover,.rt-trigger-tap.rt-anim-wipe-up.rt-active,.rt-trigger-focus.rt-anim-wipe-up:focus{animation:rtWipeUp var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-wipe-down:hover,.rt-trigger-tap.rt-anim-wipe-down.rt-active,.rt-trigger-focus.rt-anim-wipe-down:focus{animation:rtWipeDown var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-flip-x:hover,.rt-trigger-tap.rt-anim-flip-x.rt-active,.rt-trigger-focus.rt-anim-flip-x:focus{animation:rtFlipX var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-flip-y:hover,.rt-trigger-tap.rt-anim-flip-y.rt-active,.rt-trigger-focus.rt-anim-flip-y:focus{animation:rtFlipY var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-tracking-in:hover,.rt-trigger-tap.rt-anim-tracking-in.rt-active,.rt-trigger-focus.rt-anim-tracking-in:focus{animation:rtTrackingIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-text-blur-in:hover,.rt-trigger-tap.rt-anim-text-blur-in.rt-active,.rt-trigger-focus.rt-anim-text-blur-in:focus{animation:rtTextBlurIn var(--rt-duration) var(--rt-easing) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-typewriter:hover,.rt-trigger-tap.rt-anim-typewriter.rt-active,.rt-trigger-focus.rt-anim-typewriter:focus{overflow:hidden;white-space:nowrap;animation:rtTypewriter var(--rt-duration) steps(24,end) var(--rt-delay) both}
.rt-trigger-hover.rt-anim-text-steps:hover::after,.rt-trigger-tap.rt-anim-text-steps.rt-active::after,.rt-trigger-focus.rt-anim-text-steps:focus::after{animation:rtTextSteps var(--rt-duration) steps(1,end) var(--rt-delay) both}

/* Continuous effects. */
.rt-trigger-continuous.rt-anim-float{animation:rtFloat var(--rt-duration) ease-in-out var(--rt-delay) infinite alternate}
.rt-trigger-continuous.rt-anim-spin{animation:rtSpin var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-orbit{animation:rtSpin var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-pulse{animation:rtPulse var(--rt-duration) ease-in-out var(--rt-delay) infinite alternate}
.rt-trigger-continuous.rt-anim-breathe{animation:rtBreathe var(--rt-duration) ease-in-out var(--rt-delay) infinite alternate}
.rt-trigger-continuous.rt-anim-flicker{animation:rtFlicker var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-aurora{background-size:200% 200%!important;animation:rtAurora var(--rt-duration) linear var(--rt-delay) infinite}
.rt-trigger-continuous.rt-anim-shimmer{background-size:220% 100%!important;animation:rtShimmer var(--rt-duration) linear var(--rt-delay) infinite}

/* Interaction-specific effects. */
.rt-trigger-hover.rt-anim-scale-hover,.rt-trigger-focus.rt-anim-scale-hover{transition:transform var(--rt-duration) var(--rt-easing)}
.rt-trigger-hover.rt-anim-scale-hover:hover,.rt-trigger-focus.rt-anim-scale-hover:focus{transform:scale(1.035)}
.rt-trigger-hover.rt-anim-lift-hover,.rt-trigger-focus.rt-anim-lift-hover{transition:transform var(--rt-duration) var(--rt-easing),box-shadow var(--rt-duration) var(--rt-easing)}
.rt-trigger-hover.rt-anim-lift-hover:hover,.rt-trigger-focus.rt-anim-lift-hover:focus{transform:translateY(-5px);box-shadow:0 14px 34px rgba(0,0,0,.24)}
.rt-trigger-hover.rt-anim-glow-hover,.rt-trigger-focus.rt-anim-glow-hover{transition:filter var(--rt-duration) var(--rt-easing),box-shadow var(--rt-duration) var(--rt-easing)}
.rt-trigger-hover.rt-anim-glow-hover:hover,.rt-trigger-focus.rt-anim-glow-hover:focus{filter:brightness(1.12);box-shadow:0 0 28px rgba(255,255,255,.12)}
.rt-trigger-hover.rt-anim-tilt-3d,.rt-trigger-focus.rt-anim-tilt-3d{transition:transform var(--rt-duration) var(--rt-easing);transform-style:preserve-3d}
.rt-trigger-hover.rt-anim-tilt-3d:hover,.rt-trigger-focus.rt-anim-tilt-3d:focus{transform:perspective(800px) rotateX(3deg) rotateY(-3deg) translateY(-2px)}
.rt-trigger-hover.rt-anim-glitch:hover,.rt-trigger-focus.rt-anim-glitch:focus{animation:rtGlitch var(--rt-duration) linear 1}
.rt-trigger-tap.rt-anim-scale-hover{transition:transform var(--rt-duration) var(--rt-easing)}
.rt-trigger-tap.rt-anim-scale-hover.rt-active{transform:scale(.965)}
.rt-trigger-tap.rt-anim-lift-hover.rt-active{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.2)}
.rt-trigger-tap.rt-anim-glow-hover.rt-active{filter:brightness(1.12);box-shadow:0 0 24px rgba(255,255,255,.12)}
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
@keyframes rtPopIn{0%{opacity:0;transform:scale(.72)}70%{opacity:1;transform:scale(1.035)}100%{opacity:1;transform:scale(1)}}
@keyframes rtRotateIn{from{opacity:0;transform:rotate(-8deg) scale(.94)}to{opacity:1;transform:none}}
@keyframes rtSkewIn{from{opacity:0;transform:translateY(24px) skewY(5deg)}to{opacity:1;transform:none}}
@keyframes rtBlurIn{from{opacity:0;filter:blur(18px)}to{opacity:1;filter:none}}
@keyframes rtScaleBlurIn{from{opacity:0;transform:scale(.9);filter:blur(14px)}to{opacity:1;transform:none;filter:none}}
@keyframes rtReveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
@keyframes rtWipeUp{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0)}}
@keyframes rtWipeDown{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0)}}
@keyframes rtFlipX{from{opacity:0;transform:perspective(900px) rotateX(70deg)}to{opacity:1;transform:none}}
@keyframes rtFlipY{from{opacity:0;transform:perspective(900px) rotateY(70deg)}to{opacity:1;transform:none}}
@keyframes rtTrackingIn{from{opacity:0;letter-spacing:.28em}to{opacity:1;letter-spacing:normal}}
@keyframes rtTextBlurIn{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:none}}
@keyframes rtFloat{from{transform:translateY(-8px)}to{transform:translateY(10px)}}
@keyframes rtSpin{to{transform:rotate(360deg)}}
@keyframes rtPulse{from{opacity:.82;transform:scale(.985)}to{opacity:1;transform:scale(1.015)}}
@keyframes rtBreathe{from{transform:scale(.99)}to{transform:scale(1.01)}}
@keyframes rtFlicker{0%,100%{opacity:1}7%{opacity:.86}9%{opacity:1}47%{opacity:.92}49%{opacity:1}78%{opacity:.88}81%{opacity:1}}
@keyframes rtAurora{0%{background-position:0 50%}100%{background-position:200% 50%}}
@keyframes rtShimmer{0%{background-position:200% 0}100%{background-position:-20% 0}}
@keyframes rtTypewriter{from{max-width:0}to{max-width:100%}}
@keyframes rtTextSteps{0%,32%{content:attr(data-rt-step-0)}33%,65%{content:attr(data-rt-step-1)}66%,100%{content:attr(data-rt-step-2)}}
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

export function computeNodeStyle(node: StudioNode, mode: ResponsiveMode = 'desktop', ctx?: RuntimeRenderContext): React.CSSProperties {
  let style = applyLayoutStyle(resolveResponsiveStyles(node.styles, mode), node)
  if (ctx && node.conditionalStyles?.length) {
    for (const rule of node.conditionalStyles) {
      if (evaluateRuntimeCondition(rule.when, ctx)) style = { ...style, ...resolveResponsiveStyles(rule.styles, mode) }
    }
  }
  const behavior = node.scrollBehavior
  const effectiveMode = mode === 'mobile' && behavior?.mobileFallback ? behavior.mobileFallback : behavior?.mode
  if (effectiveMode === 'sticky' || effectiveMode === 'pin' || effectiveMode === 'stack-over-previous') {
    style = { ...style, position: 'sticky', top: behavior?.stickyTop ?? 0 }
    if (effectiveMode === 'stack-over-previous') style.zIndex = (behavior?.stackOrder ?? Number(style.zIndex || 1)) + (ctx?.collectionIndex ?? 0)
  }
  if (effectiveMode === 'horizontal') style = { ...style, display: style.display || 'flex', flexWrap: 'nowrap' }
  return sanitizeRuntimeStyle(style)
}

function getObjectValue(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path]
  return path.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, obj)
}

function runtimeContextValue(key: string, ctx: RuntimeRenderContext): unknown {
  if (key === 'collectionIndex') return ctx.collectionIndex
  if (key === 'collectionPosition') return ctx.collectionPosition
  if (key === 'collectionCount') return ctx.collectionCount
  if (key === 'collectionKey') return ctx.currentCollection
  return undefined
}

export function resolveRuntimeValue(reference: RuntimeValueReference | undefined, ctx: RuntimeRenderContext): unknown {
  if (!reference) return undefined
  if (reference.source === 'literal') return reference.value
  if (reference.source === 'state') return getObjectValue(ctx.runtimeState, reference.key) ?? reference.fallback
  if (reference.source === 'field') return getObjectValue(ctx.fieldContext, reference.key) ?? reference.fallback
  if (reference.source === 'context') return runtimeContextValue(reference.key, ctx) ?? reference.fallback
  if (reference.source === 'content') return getObjectValue(ctx.content, reference.key) ?? reference.fallback
  if (reference.source === 'setting') return getObjectValue(ctx.settings, reference.key) ?? reference.fallback
  return undefined
}

const TEMPLATE_TOKEN = /\{\{\s*(state|field|context|content|setting):([^}]+)\s*\}\}/g

export function resolveRuntimeTemplate(template: string, ctx: RuntimeRenderContext): string {
  return String(template || '').replace(TEMPLATE_TOKEN, (_match, source, rawKey) => {
    const key = String(rawKey || '').trim()
    const value = resolveRuntimeValue({ source, key } as RuntimeValueReference, ctx)
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.join(' • ')
    return String(value)
  })
}

function conditionCompare(actual: unknown, operator: RuntimeCondition['operator'], expected?: unknown): boolean {
  switch (operator) {
    case 'eq': return actual === expected
    case 'neq': return actual !== expected
    case 'in': return Array.isArray(expected) ? expected.includes(actual) : false
    case 'contains': return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected ?? ''))
    case 'gt': return Number(actual) > Number(expected)
    case 'gte': return Number(actual) >= Number(expected)
    case 'lt': return Number(actual) < Number(expected)
    case 'lte': return Number(actual) <= Number(expected)
    case 'truthy': return Boolean(actual)
    case 'falsy': return !actual
    default: return false
  }
}

export function evaluateRuntimeCondition(condition: RuntimeCondition, ctx: RuntimeRenderContext): boolean {
  return conditionCompare(resolveRuntimeValue(condition.left, ctx), condition.operator, resolveRuntimeValue(condition.right, ctx))
}

function runRuntimeActions(actions: RuntimeAction[] | undefined, ctx: RuntimeRenderContext) {
  if (!actions?.length || !ctx.setRuntimeStateValue) return
  for (const action of actions) {
    if (action.type === 'set-state') ctx.setRuntimeStateValue(action.key, resolveRuntimeValue(action.value, ctx))
    if (action.type === 'toggle-state') ctx.setRuntimeStateValue(action.key, !Boolean(getObjectValue(ctx.runtimeState, action.key)))
    if (action.type === 'increment-state') ctx.setRuntimeStateValue(action.key, Number(getObjectValue(ctx.runtimeState, action.key) ?? 0) + Number(action.amount ?? 1))
  }
}

function runtimeActionsFor(node: StudioNode, event: 'click' | 'double-click' | 'mouseenter' | 'mouseleave'): RuntimeAction[] {
  return (node.interactions || []).filter((entry) => entry.event === event).flatMap((entry) => entry.actions || [])
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
  if (binding.type === 'state') return getObjectValue(ctx.runtimeState, binding.key) ?? binding.fallback
  if (binding.type === 'context') return runtimeContextValue(binding.key, ctx) ?? binding.fallback
  if (binding.type === 'template') return resolveRuntimeTemplate(binding.template, ctx) || binding.fallback
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

export function applyCollectionQuery(items: unknown[], binding: CollectionBinding, ctx: RuntimeRenderContext = {}): unknown[] {
  let result = [...items]
  for (const filter of binding.filters || []) {
    const expected = filter.value && typeof filter.value === 'object' && !Array.isArray(filter.value) && 'source' in (filter.value as Record<string, unknown>)
      ? resolveRuntimeValue(filter.value as RuntimeValueReference, ctx)
      : filter.value
    result = result.filter((item) => compareValue(getObjectValue(item as Record<string, unknown>, filter.field), filter.operator as any, expected))
  }
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

function nearestRuntimeScrollRoot(element: HTMLElement): Element | null {
  let parent = element.parentElement
  while (parent) {
    const style = window.getComputedStyle(parent)
    const overflowY = style.overflowY
    const overflowX = style.overflowX
    const scrollable = /(auto|scroll|overlay)/.test(`${overflowY} ${overflowX}`)
    if (scrollable && (parent.scrollHeight > parent.clientHeight + 1 || parent.scrollWidth > parent.clientWidth + 1)) return parent
    parent = parent.parentElement
  }
  return null
}

function snapAnimationToHidden(element: HTMLElement, className: 'rt-visible' | 'rt-state-play') {
  element.classList.add('rt-resetting')
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.remove('rt-resetting')
}

function replayAnimationClass(element: HTMLElement, className: 'rt-visible' | 'rt-state-play') {
  element.classList.add('rt-replay-pending')
  snapAnimationToHidden(element, className)
  // Two frames keep the hidden reset and the replay in separate paint cycles. This is
  // important for delayed entrance transitions: the old visible state must disappear
  // immediately instead of inheriting the entrance delay while it resets.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!element.isConnected) return
    element.classList.remove('rt-replay-pending')
    element.classList.add(className)
  }))
}

function replayLoadAnimation(element: HTMLElement) {
  element.classList.add('rt-resetting')
  void element.offsetWidth
  element.classList.remove('rt-resetting')
}

function useRuntimeEffects(node: StudioNode, mode: ResponsiveMode, ctx: RuntimeRenderContext) {
  const ref = useRef<HTMLElement | null>(null)
  const replayReady = useRef(false)
  const activeStateValue = node.scrollBehavior?.activeStateValue
    ? resolveRuntimeValue(node.scrollBehavior.activeStateValue, ctx)
    : ctx.collectionPosition ?? ctx.collectionIndex ?? node.id
  const replaySignature = (node.animation?.replayOnState || [])
    .map((key) => JSON.stringify(getObjectValue(ctx.runtimeState, key)))
    .join('|')

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const animation = node.animation
    const behavior = node.scrollBehavior
    const effective = mode === 'mobile' && behavior?.mobileFallback ? behavior.mobileFallback : behavior?.mode
    const observesVisibility = animation?.trigger === 'scroll' || effective === 'reveal'
    let observer: IntersectionObserver | undefined
    const visibilityThreshold = Number(animation?.params?.threshold ?? behavior?.params?.threshold ?? 0.14)
    const applyVisibility = (visible: boolean) => {
      if (visible) {
        if (animation?.trigger === 'scroll' && !element.classList.contains('rt-replay-pending')) element.classList.add('rt-visible')
        if (effective === 'reveal') element.classList.add('rt-scroll-visible')
      } else {
        // Entrance animations should reset immediately when leaving the viewport. Using
        // the normal transition here would also apply its entrance delay in reverse,
        // leaving completed terminal lines visible during the next replay.
        if (animation?.trigger === 'scroll' && animation.repeat && element.classList.contains('rt-visible')) snapAnimationToHidden(element, 'rt-visible')
        if (effective === 'reveal' && behavior?.params?.repeat) element.classList.remove('rt-scroll-visible')
      }
    }
    if (observesVisibility && typeof IntersectionObserver !== 'undefined') {
      const root = nearestRuntimeScrollRoot(element)
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => applyVisibility(entry.isIntersecting && entry.intersectionRatio >= Math.min(visibilityThreshold, 1))), {
        root,
        threshold: Math.min(Math.max(visibilityThreshold, 0), 1),
      })
      observer.observe(element)
      // Studio Runtime Preview scrolls inside a nested overflow container. Sync once
      // immediately as well so an element that is already visible when mounted does
      // not remain permanently in its hidden entrance state waiting for a later scroll.
      requestAnimationFrame(() => {
        if (!ref.current) return
        const rect = element.getBoundingClientRect()
        const rootRect = root?.getBoundingClientRect()
        const top = rootRect?.top ?? 0
        const bottom = rootRect?.bottom ?? window.innerHeight
        const left = rootRect?.left ?? 0
        const right = rootRect?.right ?? window.innerWidth
        const visibleWidth = Math.max(0, Math.min(rect.right, right) - Math.max(rect.left, left))
        const visibleHeight = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top))
        const area = Math.max(1, rect.width * rect.height)
        const ratio = (visibleWidth * visibleHeight) / area
        applyVisibility(ratio >= Math.min(Math.max(visibilityThreshold, 0), 1))
      })
    } else if (observesVisibility) {
      applyVisibility(true)
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
    const tracksActiveScrollItem = Boolean(behavior?.activeStateKey && ctx.setRuntimeStateValue)
    let ticking = false
    const onScroll = () => {
      if ((effective !== 'parallax' && !animationParallax && !tracksActiveScrollItem) || ticking) return
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
        if (tracksActiveScrollItem && behavior?.activeStateKey) {
          const activationLine = window.innerHeight * Number(behavior.activeThreshold ?? 0.45)
          if (rect.top <= activationLine && rect.bottom > activationLine) ctx.setRuntimeStateValue?.(behavior.activeStateKey, activeStateValue)
        }
        ticking = false
      })
    }
    if (effective === 'parallax' || animationParallax || tracksActiveScrollItem) {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      onScroll()
    }
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      element.removeEventListener('pointerdown', tapStart)
      element.removeEventListener('pointerup', tapEnd)
      element.removeEventListener('pointercancel', tapEnd)
      element.removeEventListener('pointerleave', tapEnd)
    }
  }, [node.animation, node.scrollBehavior, mode, activeStateValue, ctx.setRuntimeStateValue])

  useEffect(() => {
    const element = ref.current
    const animation = node.animation
    if (!element || !animation?.replayOnState?.length) return
    if (!replayReady.current) {
      replayReady.current = true
      return
    }
    if (animation.trigger === 'scroll') {
      replayAnimationClass(element, 'rt-visible')
      return
    }
    if (animation.trigger === 'state') {
      replayAnimationClass(element, 'rt-state-play')
      return
    }
    replayLoadAnimation(element)
  }, [replaySignature, node.animation])

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
  const collectionBinding = Object.values(node.bindings || {}).find((binding): binding is CollectionBinding => binding.type === 'collection')
  const collectionItems = collectionBinding ? applyCollectionQuery(ctx.collections?.[collectionBinding.collection] || [], collectionBinding, ctx) : null
  const ref = useRuntimeEffects(node, mode, ctx)
  useEffect(() => {
    if (collectionBinding?.countStateKey) ctx.setRuntimeStateValue?.(collectionBinding.countStateKey, collectionItems?.length || 0)
  }, [collectionBinding?.countStateKey, collectionItems?.length, ctx.setRuntimeStateValue])
  if (node.meta?.hidden) return null
  let style = computeNodeStyle(node, mode, ctx)
  const animation = node.animation
  if (animation) {
    ;(style as Record<string, unknown>)['--rt-duration'] = `${animation.duration ?? 700}ms`
    ;(style as Record<string, unknown>)['--rt-delay'] = `${(animation.delay ?? 0) + (ctx.collectionIndex ?? 0) * (animation.stagger ?? 0)}ms`
    ;(style as Record<string, unknown>)['--rt-easing'] = animation.easing ?? 'ease-out'
    style.willChange = style.willChange || 'transform, opacity'
  }
  const editableProperties = Object.entries(node.bindings || {})
    .filter(([, binding]) => binding.type === 'content' || binding.type === 'setting' || binding.type === 'collection')
    .map(([key]) => key)
  const classes = ['rt-node', node.type === 'particle-field' ? 'rt-particle-field' : '', animationClass(node), scrollClass(node, mode), nodeEditorProps ? 'rt-editor-node' : '', editable && editableProperties.length ? 'rt-editable' : '', selectedNodeId === node.id ? 'rt-selected' : ''].filter(Boolean).join(' ')
  const resolvedProps: Record<string, unknown> = { ...(node.props || {}) }
  Object.entries(node.bindings || {}).forEach(([property, binding]) => {
    if (binding.type !== 'collection') {
      const value = resolveBinding(binding, property, ctx)
      if (value === undefined) return
      if (property.startsWith('style.')) {
        const styleProperty = property.slice(6)
        let styleValue: unknown = value
        if (styleProperty === 'backgroundImage' && typeof value === 'string' && value && !/^\s*(?:url\(|none|linear-gradient\(|radial-gradient\(|conic-gradient\()/i.test(value)) {
          const safeUrl = sanitizeRuntimeUrl(value, 'src')
          styleValue = safeUrl ? `url("${safeUrl.replace(/"/g, '%22')}")` : undefined
        }
        if (styleValue !== undefined) style = sanitizeRuntimeStyle({ ...style, [styleProperty]: styleValue })
      } else resolvedProps[property] = value
    }
  })

  let children: React.ReactNode = null
  if (node.type === 'particle-field') {
    children = renderParticleField(node)
  } else if (collectionBinding) {
    const items = collectionItems || []
    children = items.length ? items.map((item, index) => (
      <React.Fragment key={String((item as any)?.id ?? index)}>
        {(node.children || []).map((child) => <RuntimeNodeSafe key={`${child.id}-${String((item as any)?.id ?? index)}`} node={child} ctx={{ ...ctx, fieldContext: item as Record<string, unknown>, currentCollection: collectionBinding.collection, collectionIndex: index, collectionPosition: index + 1, collectionCount: items.length }} mode={mode} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} onNodeClick={onNodeClick} nodeEditorProps={nodeEditorProps} />)}
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
  if (tag === 'img') {
    if (!domProps.src) domProps.src = fallbackImage()
    if (domProps.alt === undefined) domProps.alt = ''
    if (domProps.loading === undefined) domProps.loading = 'lazy'
    if (domProps.decoding === undefined) domProps.decoding = 'async'
  }
  if ((tag === 'video' || tag === 'audio') && domProps.preload === undefined) domProps.preload = 'metadata'
  if (domProps.target && !['_blank','_self','_parent','_top'].includes(String(domProps.target))) delete domProps.target
  if (domProps.target === '_blank') domProps.rel = 'noopener noreferrer'
  if (requestedTag !== tag) domProps['data-runtime-sanitized-tag'] = requestedTag
  if (node.type === 'particle-field') { domProps['aria-hidden'] = true; domProps.role = 'presentation' }
  if (node.accessibility?.ariaLabel) domProps['aria-label'] = node.accessibility.ariaLabel
  if (node.accessibility?.role) domProps.role = node.accessibility.role
  if (node.accessibility?.title) domProps.title = node.accessibility.title
  const click = (event: React.MouseEvent) => {
    if (!editable) runRuntimeActions(runtimeActionsFor(node, 'click'), ctx)
    const rawHref = resolvedProps.href
    if (tag === 'a' && ctx.linkMode === 'disabled') event.preventDefault()
    const navigationHref = sanitizeRuntimeUrl(rawHref, 'href')
    if (!editable && tag === 'a' && ctx.onNavigate && navigationHref) { event.preventDefault(); event.stopPropagation(); ctx.onNavigate(navigationHref); return }
    if (editable && editableProperties.length) { event.preventDefault(); event.stopPropagation(); onEditableClick?.(node, editableProperties) }
    onNodeClick?.(node)
  }
  const doubleClick = (event: React.MouseEvent) => {
    if (!editable) runRuntimeActions(runtimeActionsFor(node, 'double-click'), ctx)
    if (editable && editableProperties.length) { event.preventDefault(); event.stopPropagation(); onEditableDoubleClick?.(node, editableProperties) }
  }
  const mouseEnter = () => { if (!editable) runRuntimeActions(runtimeActionsFor(node, 'mouseenter'), ctx) }
  const mouseLeave = () => { if (!editable) runRuntimeActions(runtimeActionsFor(node, 'mouseleave'), ctx) }

  const editorProps = nodeEditorProps?.(node) || {}
  if (animation?.type === 'text-steps') {
    const rawSteps = Array.isArray(animation.params?.steps) ? animation.params?.steps : ['0%', '50%', '100%']
    const steps = [0, 1, 2].map((index) => String(rawSteps?.[index] ?? rawSteps?.[rawSteps.length - 1] ?? ''))
    domProps['data-rt-step-0'] = steps[0]
    domProps['data-rt-step-1'] = steps[1]
    domProps['data-rt-step-2'] = steps[2]
  }
  if (animation?.trigger === 'focus' && domProps.tabIndex === undefined && !['a', 'button', 'input', 'select', 'textarea'].includes(tag)) domProps.tabIndex = 0
  const commonProps: Record<string, unknown> = {
    ...domProps,
    ...editorProps,
    ref,
    className: [classes, editorProps.className].filter(Boolean).join(' '),
    style: sanitizeRuntimeStyle({ ...style, ...(editorProps.style || {}) }),
    'data-runtime-node-id': node.id,
    onClick: click,
    onDoubleClick: doubleClick,
    onMouseEnter: mouseEnter,
    onMouseLeave: mouseLeave,
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
  const [localState, setLocalState] = useState<Record<string, unknown>>(() => ({ ...(schema.initialState || {}) }))
  useEffect(() => setLocalState({ ...(schema.initialState || {}) }), [schema.pageId, schema.initialState])
  const setLocalStateValue = useCallback((key: string, value: unknown) => setLocalState((current) => Object.is(getObjectValue(current, key), value) ? current : { ...current, [key]: value }), [])
  const usesExternalState = Boolean(ctx.runtimeState && ctx.setRuntimeStateValue)
  const runtimeCtx: RuntimeRenderContext = {
    ...ctx,
    runtimeState: usesExternalState ? ctx.runtimeState : localState,
    setRuntimeStateValue: usesExternalState ? ctx.setRuntimeStateValue : setLocalStateValue,
  }
  return (
    <div className={`rt-page ${className || ''}`} style={{ ...tokenStyle, fontFamily: designTokens.fonts?.body || 'system-ui, sans-serif', background: 'var(--site-bg)', color: 'var(--site-text)', ...style }}>
      <style>{RUNTIME_CSS}</style>
      {schema.root.map((node) => <RuntimeNodeSafe key={node.id} node={node} ctx={runtimeCtx} mode={mode} editable={editable} selectedNodeId={selectedNodeId} onEditableClick={onEditableClick} onEditableDoubleClick={onEditableDoubleClick} onNodeClick={onNodeClick} nodeEditorProps={nodeEditorProps} />)}
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
