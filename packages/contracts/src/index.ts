export type { ApiResponse, PaginatedResponse } from './api'
import { z } from 'zod'

export const PLATFORM_VERSION = '0.6.1'
export const LAYOUT_SCHEMA_VERSION = 3
export const RUNTIME_VERSION = '1.5.0'

export const UserRoleSchema = z.enum(['admin', 'user', 'designer', 'editor'])
export type UserRole = z.infer<typeof UserRoleSchema>

export interface Profile {
  id: string
  email: string
  role: UserRole
  created_at: string
  updated_at?: string
}

export interface Media {
  id: string
  filename: string
  storage_path: string
  public_url?: string | null
  mime_type: string
  size: number
  kind: string
  width?: number | null
  height?: number | null
  duration?: number | null
  alt_text?: string | null
  created_at: string
}

export interface SiteContent {
  id: string
  key: string
  value_json: unknown
  type: ContentValueType
  description?: string | null
  group_name?: string | null
  updated_by?: string | null
  updated_at: string
}

export interface Project {
  id: string
  slug: string
  title: string
  short_description: string
  full_description?: string | null
  thumbnail?: string | null
  thumbnail_media_id?: string | null
  gallery?: string[]
  gallery_media?: Array<{ media_id: string; sort_order: number; media?: Media | null }>
  gallery_media_ids?: string[]
  technologies?: string[]
  github_url?: string | null
  live_url?: string | null
  featured: boolean
  published: boolean
  display_order: number
  seo?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  category?: string | null
  tags?: string[]
  cover_image?: string | null
  cover_media_id?: string | null
  featured: boolean
  published: boolean
  display_order?: number
  seo?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Experience {
  id: string
  company: string
  role: string
  employment_type?: string | null
  location?: string | null
  start_date: string
  end_date?: string | null
  current: boolean
  summary?: string | null
  responsibilities?: string[]
  technologies?: string[]
  logo?: string | null
  logo_media_id?: string | null
  display_order: number
  published: boolean
  created_at?: string
  updated_at?: string
}

export interface AiApp {
  id: string
  slug: string
  name: string
  short_description: string
  full_description?: string | null
  icon?: string | null
  icon_media_id?: string | null
  cover_image?: string | null
  cover_media_id?: string | null
  category?: string | null
  tags?: string[]
  requires_login: boolean
  status: 'coming_soon' | 'available' | 'maintenance' | 'disabled'
  published: boolean
  featured: boolean
  display_order: number
  created_at?: string
  updated_at?: string
}

export const LayoutStatusSchema = z.enum(['active', 'archived'])
export type LayoutStatus = z.infer<typeof LayoutStatusSchema>

export interface Layout {
  id: string
  name: string
  slug: string
  description?: string | null
  thumbnail_media_id?: string | null
  status: LayoutStatus
  created_by?: string | null
  created_at: string
  updated_at: string
}

export const LayoutVersionStatusSchema = z.enum(['draft', 'published', 'archived'])
export type LayoutVersionStatus = z.infer<typeof LayoutVersionStatusSchema>

export interface DesignBreakpoints {
  /** Studio/device-frame preview width for the Desktop mode. */
  desktop?: number
  /** Studio/device-frame preview width for the Tablet mode. */
  tablet?: number
  /** Studio/device-frame preview width for the Mobile mode. */
  mobile?: number
  /** Public/runtime upper width (inclusive) that resolves to Mobile. */
  mobileMax?: number
  /** Public/runtime upper width (inclusive) that resolves to Tablet. */
  tabletMax?: number
}

export type KeyframeReducedMotionPolicy = 'disable' | 'reduce' | 'allow-essential'

export interface KeyframeStep {
  /** Normalized keyframe offset from 0 to 1. */
  offset: number
  /** Structured style declarations only; raw stylesheet text is never persisted. */
  styles: Record<string, string | number>
}

export interface KeyframeDefinition {
  /** Stable internal ID. Labels are never used as CSS identifiers. */
  id: string
  label: string
  description?: string
  category?: string
  steps: KeyframeStep[]
  reducedMotion?: KeyframeReducedMotionPolicy
}

export type CssPropertyRegistrationSyntax =
  | '<angle>'
  | '<length>'
  | '<number>'
  | '<percentage>'
  | '<color>'
  | '<length-percentage>'

export interface CssPropertyRegistration {
  name: string
  syntax: CssPropertyRegistrationSyntax
  inherits: boolean
  initialValue: string
}

export interface DesignTokens {
  variables: Record<string, string>
  fonts?: Record<string, string>
  breakpoints?: DesignBreakpoints
  /** Reusable, structured CSS keyframes scoped to this layout version. */
  keyframes?: KeyframeDefinition[]
  /** Optional typed custom-property registrations used by keyframe effects. */
  propertyRegistrations?: CssPropertyRegistration[]
}

export const DEFAULT_PREVIEW_WIDTHS = { desktop: 1440, tablet: 768, mobile: 375 } as const
export const DEFAULT_RESPONSIVE_THRESHOLDS = { mobileMax: 767, tabletMax: 1023 } as const

function finitePositiveOr(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

/**
 * Preview frame widths are intentionally separate from live runtime thresholds.
 * Legacy layouts keep their existing desktop/tablet/mobile numbers as preview widths.
 */
export function resolvePreviewWidth(tokens: DesignTokens | undefined, mode: ResponsiveMode): number {
  const configured = tokens?.breakpoints?.[mode]
  return finitePositiveOr(configured, DEFAULT_PREVIEW_WIDTHS[mode])
}

/** Resolve a real browser/container width to the canonical responsive mode. */
export function resolveResponsiveMode(width: number, tokens?: DesignTokens): ResponsiveMode {
  const mobileMax = finitePositiveOr(tokens?.breakpoints?.mobileMax, DEFAULT_RESPONSIVE_THRESHOLDS.mobileMax)
  const tabletCandidate = finitePositiveOr(tokens?.breakpoints?.tabletMax, DEFAULT_RESPONSIVE_THRESHOLDS.tabletMax)
  const tabletMax = Math.max(mobileMax + 1, tabletCandidate)
  const viewportWidth = finitePositiveOr(width, tabletMax + 1)
  if (viewportWidth <= mobileMax) return 'mobile'
  if (viewportWidth <= tabletMax) return 'tablet'
  return 'desktop'
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  variables: {
    '--site-bg': '#07070a',
    '--site-surface': '#101016',
    '--site-surface-2': '#181822',
    '--site-text': '#f8fafc',
    '--site-muted': '#94a3b8',
    '--site-border': '#27272f',
    '--site-primary': '#7c3aed',
    '--site-accent': '#22d3ee',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
  },
  breakpoints: { ...DEFAULT_PREVIEW_WIDTHS, ...DEFAULT_RESPONSIVE_THRESHOLDS },
}

export interface LayoutVersion {
  id: string
  layout_id: string
  version_number: number
  schema_version: number
  runtime_min_version: string
  status: LayoutVersionStatus
  changelog?: string | null
  design_tokens?: DesignTokens
  thumbnail_data?: string | null
  revision_token: string
  created_by?: string | null
  created_at: string
  published_at?: string | null
}

export const PageTypeSchema = z.enum(['standard', 'home', 'collection_index', 'collection_detail', 'system'])
export type PageType = z.infer<typeof PageTypeSchema>

export type ResponsiveMode = 'desktop' | 'tablet' | 'mobile'

const BLOCKED_RUNTIME_STYLE_PROPERTIES = new Set(['cssText', 'constructor', '__proto__', 'prototype', 'behavior', 'MozBinding'])
const CSS_CUSTOM_PROPERTY_NAME = /^--[A-Za-z_][A-Za-z0-9_-]*$/
const REACT_STYLE_PROPERTY_NAME = /^(?:[a-z][A-Za-z0-9]*|Webkit[A-Z][A-Za-z0-9]*|Moz[A-Z][A-Za-z0-9]*|ms[A-Z][A-Za-z0-9]*|O[A-Z][A-Za-z0-9]*)$/

/** Shared safety boundary for style keys persisted by Studio and consumed by React. */
export function isSafeRuntimeStyleProperty(property: string): boolean {
  const key = String(property || '').trim()
  if (!key || BLOCKED_RUNTIME_STYLE_PROPERTIES.has(key)) return false
  if (key.startsWith('--')) return CSS_CUSTOM_PROPERTY_NAME.test(key)
  return REACT_STYLE_PROPERTY_NAME.test(key)
}

export function isSafeCssCustomPropertyName(property: string): boolean {
  return CSS_CUSTOM_PROPERTY_NAME.test(String(property || '').trim())
}

/**
 * Structured stylesheet declarations (keyframes/@property) are compiled into a
 * generated <style> tag, so declaration-breaking tokens need a stricter boundary
 * than ordinary React inline styles.
 */
export function isSafeRuntimeStylesheetValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string' || value.length > 8192) return false
  return !/[;{}]|<\/style|\/\*|\*\//i.test(value)
}

export type StyleMap = Record<string, string | number | boolean | null | undefined>
export interface ResponsiveStyles {
  desktop?: StyleMap
  tablet?: StyleMap
  mobile?: StyleMap
}

export type ContentValueType = 'text' | 'richtext' | 'url' | 'number' | 'boolean' | 'media' | 'button' | 'json'

export interface StaticBinding {
  type: 'static'
  value: unknown
}

export interface ContentBinding {
  type: 'content'
  key: string
  label?: string
  contentType?: ContentValueType
  sample?: unknown
  required?: boolean
  fallback?: unknown
  description?: string
}

export interface SettingBinding {
  type: 'setting'
  key: string
  label?: string
  sample?: unknown
  required?: boolean
  fallback?: unknown
}

export interface MediaBinding {
  type: 'media'
  mediaId?: string
  sampleUrl?: string
  label?: string
  required?: boolean
}

export type RuntimeFieldScope = 'current' | 'parent' | 'root'

export interface FieldBinding {
  type: 'field'
  field: string
  /** Resolve the field from the current, parent, or root repeated-item context. */
  scope?: RuntimeFieldScope
  fallback?: unknown
}

export interface StateBinding {
  type: 'state'
  key: string
  fallback?: unknown
}

export type RuntimeContextKey = 'collectionIndex' | 'collectionPosition' | 'collectionCount' | 'collectionKey'

export interface ContextBinding {
  type: 'context'
  key: RuntimeContextKey
  fallback?: unknown
}

/**
 * Small, declarative interpolation binding for runtime UI such as progress labels.
 * Supported tokens are resolved by the renderer, for example:
 *   {{state:tech.category}}, {{field:name}}, {{context:collectionPosition}}
 */
export interface TemplateBinding {
  type: 'template'
  template: string
  fallback?: unknown
}

export type RuntimeValueReference =
  | { source: 'literal'; value: unknown }
  | { source: 'state'; key: string; fallback?: unknown }
  | { source: 'field'; key: string; scope?: RuntimeFieldScope; fallback?: unknown }
  | { source: 'context'; key: RuntimeContextKey; fallback?: unknown }
  | { source: 'content'; key: string; fallback?: unknown }
  | { source: 'setting'; key: string; fallback?: unknown }

export type RuntimeConditionOperator = 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'truthy' | 'falsy'

export interface RuntimeCondition {
  left: RuntimeValueReference
  operator: RuntimeConditionOperator
  right?: RuntimeValueReference
}

export interface ConditionalStyleRule {
  id?: string
  when: RuntimeCondition
  styles: ResponsiveStyles
}

export type RuntimeAction =
  | { type: 'set-state'; key: string; value: RuntimeValueReference }
  | { type: 'toggle-state'; key: string }
  | { type: 'increment-state'; key: string; amount?: number }

export interface NodeInteraction {
  event: 'click' | 'double-click' | 'mouseenter' | 'mouseleave'
  actions: RuntimeAction[]
}

export interface CollectionFilter {
  field: string
  operator: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
  /** Literal value or a runtime reference, e.g. {source:'state', key:'tech.category'}. */
  value: unknown | RuntimeValueReference
}

export interface CollectionSort {
  field: string
  direction: 'asc' | 'desc'
}

export type CollectionName = 'projects' | 'notes' | 'experience' | 'apps' | string

export interface CollectionBinding {
  type: 'collection'
  /** Existing bindings omit source and therefore continue to mean a named Collection. */
  source?: 'collection' | 'current-item-array'
  /** Named Collection key when source is collection (or omitted for legacy bindings). */
  collection?: CollectionName
  /** Dotted array field path when source is current-item-array. */
  field?: string
  /** Which item context owns field when repeating a current-item array. */
  fieldScope?: RuntimeFieldScope
  filters?: CollectionFilter[]
  sort?: CollectionSort[]
  limit?: number
  /** Optional runtime state key that receives the filtered collection size. */
  countStateKey?: string
}

export type Binding = StaticBinding | ContentBinding | SettingBinding | MediaBinding | FieldBinding | StateBinding | ContextBinding | TemplateBinding | CollectionBinding
export type BindingType = Binding['type']

export interface ContentSlot {
  key: string
  label: string
  contentType: ContentValueType
  sample?: unknown
  required: boolean
  fallback?: unknown
  description?: string
  pageId?: string
  nodeId?: string
  property?: string
  sectionLabel?: string
}

export type AnimationTrigger = 'load' | 'scroll' | 'state' | 'hover' | 'tap' | 'focus' | 'continuous'
export type AnimationEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | string

export interface AnimationConfig {
  type: string
  trigger: AnimationTrigger
  /** Reusable layout-level CSS keyframe reference when type is custom-keyframe. */
  keyframeId?: string
  duration?: number
  delay?: number
  easing?: AnimationEasing
  repeat?: boolean | number
  direction?: 'normal' | 'reverse' | 'alternate'
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both'
  playState?: 'running' | 'paused'
  stagger?: number
  params?: Record<string, unknown>
  /** Replays the animation whenever any listed runtime-state key changes. */
  replayOnState?: string[]
}

export type ScrollBehaviorMode = 'normal' | 'sticky' | 'pin' | 'stack-over-previous' | 'card-deck' | 'parallax' | 'horizontal' | 'reveal' | 'section-cover' | 'scene-transition'
export interface ScrollBehavior {
  mode: ScrollBehaviorMode
  stickyTop?: number
  stackOrder?: number
  pinDistance?: number
  releaseBehavior?: 'natural' | 'after-next' | 'after-distance' | string
  backgroundBehavior?: 'opaque' | 'inherit' | string
  /**
   * Optional responsive behavior overrides. Desktop always uses `mode`.
   * Tablet inherits Desktop when unset; Mobile inherits Tablet/Desktop when unset.
   *
   * `mobileFallback` is retained as the canonical persisted Mobile override for
   * backward compatibility with existing layouts.
   */
  tabletFallback?: ScrollBehaviorMode
  mobileFallback?: ScrollBehaviorMode
  reducedMotionFallback?: 'none' | 'skip' | 'reduce'
  /** When this node becomes the active/visible scroll item, write a value into runtime state. */
  activeStateKey?: string
  activeStateValue?: RuntimeValueReference
  activeThreshold?: number
  params?: Record<string, unknown>
}

export function resolveResponsiveScrollMode(behavior: ScrollBehavior | undefined, mode: ResponsiveMode = 'desktop'): ScrollBehaviorMode {
  if (!behavior) return 'normal'
  if (mode === 'mobile') return behavior.mobileFallback ?? behavior.tabletFallback ?? behavior.mode
  if (mode === 'tablet') return behavior.tabletFallback ?? behavior.mode
  return behavior.mode
}

/**
 * Reduced-motion scroll behavior defaults to `reduce` for accessibility and
 * backward compatibility with Studio's historical implicit fallback.
 * Explicit `none` is the opt-out that preserves authored scroll choreography.
 */
export function resolveReducedMotionScrollFallback(behavior: ScrollBehavior | undefined): 'none' | 'skip' | 'reduce' {
  return behavior?.reducedMotionFallback ?? 'reduce'
}

export interface NodeMeta {
  label?: string
  adminLabel?: string
  sectionLabel?: string
  locked?: boolean
  hidden?: boolean
}

export interface NodeAccessibility {
  ariaLabel?: string
  role?: string
  title?: string
}

export interface NodeLayoutOverride {
  mode?: 'flow' | 'absolute'
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
}

/**
 * Desktop geometry remains at the legacy top level for backward compatibility.
 * Tablet and Mobile store only authored overrides and inherit larger breakpoints.
 */
export interface NodeLayout extends NodeLayoutOverride {
  mode: 'flow' | 'absolute'
  tablet?: NodeLayoutOverride
  mobile?: NodeLayoutOverride
}

function mergeDefinedLayout(base: NodeLayoutOverride, override: NodeLayoutOverride | undefined): NodeLayoutOverride {
  if (!override) return { ...base }
  const next = { ...base }
  for (const [key, value] of Object.entries(override) as [keyof NodeLayoutOverride, NodeLayoutOverride[keyof NodeLayoutOverride]][]) {
    if (value !== undefined) (next as Record<string, unknown>)[key] = value
  }
  return next
}

export function resolveResponsiveLayout(layout: NodeLayout | undefined, mode: ResponsiveMode = 'desktop'): NodeLayout | undefined {
  if (!layout) return undefined
  const { tablet, mobile, ...desktop } = layout
  let resolved: NodeLayoutOverride = { ...desktop }
  if (mode === 'tablet' || mode === 'mobile') resolved = mergeDefinedLayout(resolved, tablet)
  if (mode === 'mobile') resolved = mergeDefinedLayout(resolved, mobile)
  return { mode: resolved.mode || 'flow', ...resolved } as NodeLayout
}

export interface StudioNode {
  id: string
  type: string
  tag?: string
  bindings?: Record<string, Binding>
  props?: Record<string, unknown>
  styles: ResponsiveStyles
  layout?: NodeLayout
  animation?: AnimationConfig
  scrollBehavior?: ScrollBehavior
  interactions?: NodeInteraction[]
  conditionalStyles?: ConditionalStyleRule[]
  children?: StudioNode[]
  meta?: NodeMeta
  accessibility?: NodeAccessibility
}

export interface LayoutPageSchema {
  schemaVersion: number
  pageId: string
  collectionName?: CollectionName
  initialState?: Record<string, unknown>
  root: StudioNode[]
}

export interface LayoutPage {
  id: string
  layout_version_id: string
  slug: string
  name: string
  page_type: PageType
  route_pattern?: string | null
  seo_defaults?: Record<string, unknown>
  sort_order: number
  layout_tree: LayoutPageSchema
  created_at: string
  updated_at: string
}

export interface EditorPage {
  id: string
  name: string
  slug: string
  pageType: PageType
  routePattern: string
  seoDefaults: Record<string, unknown>
  sortOrder: number
  schema: LayoutPageSchema
}

export interface EditorDocument {
  layoutId: string | null
  layoutName: string
  layoutSlug?: string
  layoutDescription?: string
  versionId: string | null
  versionNumber: number
  versionStatus: LayoutVersionStatus
  revisionToken?: string
  designTokens: DesignTokens
  pages: EditorPage[]
}

export const ReleaseStatusSchema = z.enum(['draft', 'ready', 'active', 'superseded', 'archived', 'failed'])
export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>

export type ContentRevisionStatus = 'draft' | 'published' | 'archived'
export interface ContentRevision {
  id: string
  revision_number: number
  status: ContentRevisionStatus
  values_json: Record<string, unknown>
  created_by?: string | null
  created_at: string
  published_at?: string | null
}

export interface SiteRelease {
  id: string
  release_number: number
  layout_version_id: string
  content_revision_id: string | null
  settings_revision_id: string | null
  snapshot_revision_token: string
  layout_schema_version: number
  runtime_min_version: string
  settings_snapshot: Record<string, unknown>
  collections_snapshot: Record<string, unknown[]>
  media_snapshot: Record<string, { id: string; url: string; alt?: string }>
  media_snapshot_version: 0 | 1
  status: ReleaseStatus
  created_by?: string | null
  created_at: string
  ready_at?: string | null
  validated_at?: string | null
  validated_by?: string | null
  activated_at?: string | null
  activated_by?: string | null
  deactivated_at?: string | null
  deactivated_by?: string | null
  notes?: string | null
}

export interface RuntimeRoute {
  path: string
  pageId: string
  slug: string
  name: string
  pageType: PageType
  collectionName?: CollectionName
  seo?: Record<string, unknown>
  schema: LayoutPageSchema
}

export interface RuntimeManifest {
  releaseId: string | null
  releaseNumber?: number
  mediaSnapshotVersion?: number
  layoutVersionId?: string | null
  schemaVersion: number
  runtimeMinVersion: string
  designTokens: DesignTokens
  routes: RuntimeRoute[]
  globals: {
    header?: LayoutPageSchema
    footer?: LayoutPageSchema
  }
  content: Record<string, unknown>
  settings: Record<string, unknown>
  media: Record<string, { id: string; url: string; alt?: string }>
  collections: Record<string, unknown[]>
  contentRevisionId?: string | null
  settingsRevisionId?: string | null
  generatedAt: string
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  pageId?: string
  nodeId?: string
  path?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  infos: ValidationIssue[]
}

export interface AuditLog {
  id: string
  actor_user_id?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  before_json?: unknown
  after_json?: unknown
  metadata?: Record<string, unknown>
  created_at: string
}

export interface LayoutLibraryCard {
  layout: Layout
  latestPublishedVersion: LayoutVersion
  publishedVersions?: Array<LayoutVersion & { pageCount?: number; compatible?: boolean; isLive?: boolean; isConfiguring?: boolean }>
  pageCount: number
  homePage?: LayoutPage
  compatible: boolean
  isLive: boolean
  isConfiguring: boolean
}

export interface ContentCompatibility {
  slots: ContentSlot[]
  resolved: string[]
  missingRequired: ContentSlot[]
  missingOptional: ContentSlot[]
  unusedKeys: string[]
}

// ---------------- Zod schemas: canonical runtime contracts ----------------

const ContentValueTypeSchema = z.enum(['text', 'richtext', 'url', 'number', 'boolean', 'media', 'button', 'json'])
const StyleValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
export const ResponsiveStylesSchema = z.object({
  desktop: z.record(StyleValueSchema).optional(),
  tablet: z.record(StyleValueSchema).optional(),
  mobile: z.record(StyleValueSchema).optional(),
})

const StaticBindingSchema = z.object({ type: z.literal('static'), value: z.unknown() })
const ContentBindingSchema = z.object({
  type: z.literal('content'),
  key: z.string().min(1),
  label: z.string().optional(),
  contentType: ContentValueTypeSchema.optional(),
  sample: z.unknown().optional(),
  required: z.boolean().optional(),
  fallback: z.unknown().optional(),
  description: z.string().optional(),
})
const SettingBindingSchema = z.object({
  type: z.literal('setting'), key: z.string().min(1), label: z.string().optional(), sample: z.unknown().optional(), required: z.boolean().optional(), fallback: z.unknown().optional(),
})
const MediaBindingSchema = z.object({ type: z.literal('media'), mediaId: z.string().optional(), sampleUrl: z.string().optional(), label: z.string().optional(), required: z.boolean().optional() })
const RuntimeFieldScopeSchema = z.enum(['current', 'parent', 'root'])
const FieldBindingSchema = z.object({ type: z.literal('field'), field: z.string().min(1), scope: RuntimeFieldScopeSchema.optional(), fallback: z.unknown().optional() })
const StateBindingSchema = z.object({ type: z.literal('state'), key: z.string().min(1), fallback: z.unknown().optional() })
const RuntimeContextKeySchema = z.enum(['collectionIndex', 'collectionPosition', 'collectionCount', 'collectionKey'])
const ContextBindingSchema = z.object({ type: z.literal('context'), key: RuntimeContextKeySchema, fallback: z.unknown().optional() })
const TemplateBindingSchema = z.object({ type: z.literal('template'), template: z.string(), fallback: z.unknown().optional() })
export const RuntimeValueReferenceSchema: z.ZodType<RuntimeValueReference> = z.discriminatedUnion('source', [
  z.object({ source: z.literal('literal'), value: z.unknown() }),
  z.object({ source: z.literal('state'), key: z.string().min(1), fallback: z.unknown().optional() }),
  z.object({ source: z.literal('field'), key: z.string().min(1), scope: RuntimeFieldScopeSchema.optional(), fallback: z.unknown().optional() }),
  z.object({ source: z.literal('context'), key: RuntimeContextKeySchema, fallback: z.unknown().optional() }),
  z.object({ source: z.literal('content'), key: z.string().min(1), fallback: z.unknown().optional() }),
  z.object({ source: z.literal('setting'), key: z.string().min(1), fallback: z.unknown().optional() }),
]) as z.ZodType<RuntimeValueReference>
const RuntimeConditionSchema: z.ZodType<RuntimeCondition> = z.object({
  left: RuntimeValueReferenceSchema,
  operator: z.enum(['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy']),
  right: RuntimeValueReferenceSchema.optional(),
})
const RuntimeActionSchema: z.ZodType<RuntimeAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set-state'), key: z.string().min(1), value: RuntimeValueReferenceSchema }),
  z.object({ type: z.literal('toggle-state'), key: z.string().min(1) }),
  z.object({ type: z.literal('increment-state'), key: z.string().min(1), amount: z.number().optional() }),
]) as z.ZodType<RuntimeAction>
const NodeInteractionSchema: z.ZodType<NodeInteraction> = z.object({
  event: z.enum(['click', 'double-click', 'mouseenter', 'mouseleave']),
  actions: z.array(RuntimeActionSchema).min(1),
})
const ConditionalStyleRuleSchema: z.ZodType<ConditionalStyleRule> = z.object({
  id: z.string().optional(),
  when: RuntimeConditionSchema,
  styles: ResponsiveStylesSchema,
})
const CollectionBindingSchema = z.object({
  type: z.literal('collection'),
  source: z.enum(['collection', 'current-item-array']).optional(),
  collection: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
  fieldScope: RuntimeFieldScopeSchema.optional(),
  filters: z.array(z.object({ field: z.string(), operator: z.enum(['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte']), value: z.unknown() })).optional(),
  sort: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })).optional(),
  limit: z.number().int().positive().optional(),
  countStateKey: z.string().min(1).optional(),
})
export const BindingSchema: z.ZodType<Binding> = z.discriminatedUnion('type', [StaticBindingSchema, ContentBindingSchema, SettingBindingSchema, MediaBindingSchema, FieldBindingSchema, StateBindingSchema, ContextBindingSchema, TemplateBindingSchema, CollectionBindingSchema]) as z.ZodType<Binding>

export const AnimationConfigSchema: z.ZodType<AnimationConfig> = z.object({
  type: z.string().min(1),
  trigger: z.enum(['load', 'scroll', 'state', 'hover', 'tap', 'focus', 'continuous']),
  keyframeId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).optional(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: z.string().optional(),
  repeat: z.union([z.boolean(), z.number().int().min(0)]).optional(),
  direction: z.enum(['normal', 'reverse', 'alternate']).optional(),
  fillMode: z.enum(['none', 'forwards', 'backwards', 'both']).optional(),
  playState: z.enum(['running', 'paused']).optional(),
  stagger: z.number().min(0).optional(),
  params: z.record(z.unknown()).optional(),
  replayOnState: z.array(z.string().min(1)).optional(),
})

export const ScrollBehaviorSchema: z.ZodType<ScrollBehavior> = z.object({
  mode: z.enum(['normal', 'sticky', 'pin', 'stack-over-previous', 'card-deck', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition']),
  stickyTop: z.number().optional(),
  stackOrder: z.number().optional(),
  pinDistance: z.number().min(0).optional(),
  releaseBehavior: z.string().optional(),
  backgroundBehavior: z.string().optional(),
  tabletFallback: z.enum(['normal', 'sticky', 'pin', 'stack-over-previous', 'card-deck', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition']).optional(),
  mobileFallback: z.enum(['normal', 'sticky', 'pin', 'stack-over-previous', 'card-deck', 'parallax', 'horizontal', 'reveal', 'section-cover', 'scene-transition']).optional(),
  reducedMotionFallback: z.enum(['none', 'skip', 'reduce']).optional(),
  activeStateKey: z.string().min(1).optional(),
  activeStateValue: RuntimeValueReferenceSchema.optional(),
  activeThreshold: z.number().min(0).max(1).optional(),
  params: z.record(z.unknown()).optional(),
})

export const StudioNodeSchema: z.ZodType<StudioNode> = z.lazy(() => z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  tag: z.string().optional(),
  bindings: z.record(BindingSchema).optional(),
  props: z.record(z.unknown()).optional(),
  styles: ResponsiveStylesSchema,
  layout: z.object({
    mode: z.enum(['flow', 'absolute']),
    x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), rotation: z.number().optional(), zIndex: z.number().optional(),
    tablet: z.object({ mode: z.enum(['flow', 'absolute']).optional(), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), rotation: z.number().optional(), zIndex: z.number().optional() }).optional(),
    mobile: z.object({ mode: z.enum(['flow', 'absolute']).optional(), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), rotation: z.number().optional(), zIndex: z.number().optional() }).optional(),
  }).optional(),
  animation: AnimationConfigSchema.optional(),
  scrollBehavior: ScrollBehaviorSchema.optional(),
  interactions: z.array(NodeInteractionSchema).optional(),
  conditionalStyles: z.array(ConditionalStyleRuleSchema).optional(),
  children: z.array(StudioNodeSchema).optional(),
  meta: z.object({ label: z.string().optional(), adminLabel: z.string().optional(), sectionLabel: z.string().optional(), locked: z.boolean().optional(), hidden: z.boolean().optional() }).optional(),
  accessibility: z.object({ ariaLabel: z.string().optional(), role: z.string().optional(), title: z.string().optional() }).optional(),
}))

export const LayoutPageSchemaSchema: z.ZodType<LayoutPageSchema> = z.object({
  schemaVersion: z.number().int().positive(),
  pageId: z.string().min(1),
  collectionName: z.string().min(1).optional(),
  initialState: z.record(z.unknown()).optional(),
  root: z.array(StudioNodeSchema),
})

export const EditorPageSchema: z.ZodType<EditorPage> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  pageType: PageTypeSchema,
  routePattern: z.string(),
  seoDefaults: z.record(z.unknown()),
  sortOrder: z.number().int(),
  schema: LayoutPageSchemaSchema,
})

const BreakpointNumberSchema = z.number().finite().positive()
const KeyframeStyleValueSchema = z.union([z.string().max(8192), z.number().finite()])
const KeyframeDefinitionSchema: z.ZodType<KeyframeDefinition> = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  steps: z.array(z.object({
    offset: z.number().finite().min(0).max(1),
    styles: z.record(KeyframeStyleValueSchema),
  })).min(2).max(32),
  reducedMotion: z.enum(['disable', 'reduce', 'allow-essential']).optional(),
}).superRefine((value, ctx) => {
  const offsets = value.steps.map((step) => step.offset)
  if (new Set(offsets).size !== offsets.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Keyframe step offsets must be unique.' })
  for (let index = 1; index < offsets.length; index += 1) if (offsets[index] < offsets[index - 1]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Keyframe steps must be ordered from 0 to 1.' })
    break
  }
})
const CssPropertyRegistrationSchema: z.ZodType<CssPropertyRegistration> = z.object({
  name: z.string().refine((value) => isSafeCssCustomPropertyName(value), 'Registered property name must be a valid CSS custom property.'),
  syntax: z.enum(['<angle>', '<length>', '<number>', '<percentage>', '<color>', '<length-percentage>']),
  inherits: z.boolean(),
  initialValue: z.string().min(1).max(1024),
})
export const DesignTokensSchema: z.ZodType<DesignTokens> = z.object({
  variables: z.record(z.string()),
  fonts: z.record(z.string()).optional(),
  keyframes: z.array(KeyframeDefinitionSchema).max(64).optional(),
  propertyRegistrations: z.array(CssPropertyRegistrationSchema).max(32).optional(),
  breakpoints: z.object({
    desktop: BreakpointNumberSchema.optional(),
    tablet: BreakpointNumberSchema.optional(),
    mobile: BreakpointNumberSchema.optional(),
    mobileMax: BreakpointNumberSchema.optional(),
    tabletMax: BreakpointNumberSchema.optional(),
  }).superRefine((value, ctx) => {
    const mobile = value.mobile ?? DEFAULT_PREVIEW_WIDTHS.mobile
    const tablet = value.tablet ?? DEFAULT_PREVIEW_WIDTHS.tablet
    const desktop = value.desktop ?? DEFAULT_PREVIEW_WIDTHS.desktop
    if (!(mobile < tablet && tablet < desktop)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Preview widths must be ordered Mobile < Tablet < Desktop.' })
    const mobileMax = value.mobileMax ?? DEFAULT_RESPONSIVE_THRESHOLDS.mobileMax
    const tabletMax = value.tabletMax ?? DEFAULT_RESPONSIVE_THRESHOLDS.tabletMax
    if (!(mobileMax < tabletMax)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Runtime responsive thresholds must be ordered Mobile max < Tablet max.' })
  }).optional(),
}).superRefine((value, ctx) => {
  const keyframeIds = value.keyframes?.map((entry) => entry.id) || []
  if (new Set(keyframeIds).size !== keyframeIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Keyframe IDs must be unique.', path: ['keyframes'] })
  const registrationNames = value.propertyRegistrations?.map((entry) => entry.name) || []
  if (new Set(registrationNames).size !== registrationNames.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Registered CSS custom-property names must be unique.', path: ['propertyRegistrations'] })
})

export const EditorDocumentSchema: z.ZodType<EditorDocument> = z.object({
  layoutId: z.string().nullable(),
  layoutName: z.string().min(1),
  layoutSlug: z.string().optional(),
  layoutDescription: z.string().optional(),
  versionId: z.string().nullable(),
  versionNumber: z.number().int().positive(),
  versionStatus: LayoutVersionStatusSchema,
  revisionToken: z.string().uuid().optional(),
  designTokens: DesignTokensSchema,
  pages: z.array(EditorPageSchema).min(1),
})

export function isContentBinding(binding: Binding | undefined): binding is ContentBinding {
  return binding?.type === 'content'
}

export function isCollectionBinding(binding: Binding | undefined): binding is CollectionBinding {
  return binding?.type === 'collection'
}
