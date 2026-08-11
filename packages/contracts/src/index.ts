export type { ApiResponse, PaginatedResponse } from './api'
import { z } from 'zod'

export const PLATFORM_VERSION = '0.6.0'
export const LAYOUT_SCHEMA_VERSION = 3
export const RUNTIME_VERSION = '1.0.0'

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

export interface DesignTokens {
  variables: Record<string, string>
  fonts?: Record<string, string>
  breakpoints?: { desktop?: number; tablet?: number; mobile?: number }
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
  breakpoints: { desktop: 1440, tablet: 768, mobile: 375 },
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

export interface FieldBinding {
  type: 'field'
  field: string
  fallback?: unknown
}

export interface CollectionFilter {
  field: string
  operator: 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
  value: unknown
}

export interface CollectionSort {
  field: string
  direction: 'asc' | 'desc'
}

export type CollectionName = 'projects' | 'notes' | 'experience' | 'apps' | string

export interface CollectionBinding {
  type: 'collection'
  collection: CollectionName
  filters?: CollectionFilter[]
  sort?: CollectionSort[]
  limit?: number
}

export type Binding = StaticBinding | ContentBinding | SettingBinding | MediaBinding | FieldBinding | CollectionBinding
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

export type AnimationTrigger = 'load' | 'scroll' | 'hover' | 'tap' | 'continuous'
export type AnimationEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | string

export interface AnimationConfig {
  type: string
  trigger: AnimationTrigger
  duration?: number
  delay?: number
  easing?: AnimationEasing
  repeat?: boolean | number
  direction?: 'normal' | 'reverse' | 'alternate'
  stagger?: number
  params?: Record<string, unknown>
}

export type ScrollBehaviorMode = 'normal' | 'sticky' | 'pin' | 'stack-over-previous' | 'parallax' | 'horizontal' | 'reveal'
export interface ScrollBehavior {
  mode: ScrollBehaviorMode
  stickyTop?: number
  stackOrder?: number
  pinDistance?: number
  releaseBehavior?: 'natural' | 'after-next' | 'after-distance' | string
  backgroundBehavior?: 'opaque' | 'inherit' | string
  mobileFallback?: ScrollBehaviorMode | 'normal'
  reducedMotionFallback?: 'none' | 'skip' | 'reduce'
  params?: Record<string, unknown>
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

export interface NodeLayout {
  mode: 'flow' | 'absolute'
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  zIndex?: number
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
  children?: StudioNode[]
  meta?: NodeMeta
  accessibility?: NodeAccessibility
}

export interface LayoutPageSchema {
  schemaVersion: number
  pageId: string
  collectionName?: CollectionName
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
const FieldBindingSchema = z.object({ type: z.literal('field'), field: z.string().min(1), fallback: z.unknown().optional() })
const CollectionBindingSchema = z.object({
  type: z.literal('collection'),
  collection: z.string().min(1),
  filters: z.array(z.object({ field: z.string(), operator: z.enum(['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte']), value: z.unknown() })).optional(),
  sort: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })).optional(),
  limit: z.number().int().positive().optional(),
})
export const BindingSchema: z.ZodType<Binding> = z.discriminatedUnion('type', [StaticBindingSchema, ContentBindingSchema, SettingBindingSchema, MediaBindingSchema, FieldBindingSchema, CollectionBindingSchema]) as z.ZodType<Binding>

export const AnimationConfigSchema: z.ZodType<AnimationConfig> = z.object({
  type: z.string().min(1),
  trigger: z.enum(['load', 'scroll', 'hover', 'tap', 'continuous']),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: z.string().optional(),
  repeat: z.union([z.boolean(), z.number().int().min(0)]).optional(),
  direction: z.enum(['normal', 'reverse', 'alternate']).optional(),
  stagger: z.number().min(0).optional(),
  params: z.record(z.unknown()).optional(),
})

export const ScrollBehaviorSchema: z.ZodType<ScrollBehavior> = z.object({
  mode: z.enum(['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal']),
  stickyTop: z.number().optional(),
  stackOrder: z.number().optional(),
  pinDistance: z.number().min(0).optional(),
  releaseBehavior: z.string().optional(),
  backgroundBehavior: z.string().optional(),
  mobileFallback: z.union([z.enum(['normal', 'sticky', 'pin', 'stack-over-previous', 'parallax', 'horizontal', 'reveal']), z.literal('normal')]).optional(),
  reducedMotionFallback: z.enum(['none', 'skip', 'reduce']).optional(),
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
    mode: z.enum(['flow', 'absolute']), x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional(), rotation: z.number().optional(), zIndex: z.number().optional(),
  }).optional(),
  animation: AnimationConfigSchema.optional(),
  scrollBehavior: ScrollBehaviorSchema.optional(),
  children: z.array(StudioNodeSchema).optional(),
  meta: z.object({ label: z.string().optional(), adminLabel: z.string().optional(), sectionLabel: z.string().optional(), locked: z.boolean().optional(), hidden: z.boolean().optional() }).optional(),
  accessibility: z.object({ ariaLabel: z.string().optional(), role: z.string().optional(), title: z.string().optional() }).optional(),
}))

export const LayoutPageSchemaSchema: z.ZodType<LayoutPageSchema> = z.object({
  schemaVersion: z.number().int().positive(),
  pageId: z.string().min(1),
  collectionName: z.string().min(1).optional(),
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

export const DesignTokensSchema: z.ZodType<DesignTokens> = z.object({
  variables: z.record(z.string()),
  fonts: z.record(z.string()).optional(),
  breakpoints: z.object({ desktop: z.number().optional(), tablet: z.number().optional(), mobile: z.number().optional() }).optional(),
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
