# Dynamic Portfolio Platform — Architecture

**Document purpose:** Production architecture reference  
**Platform type:** Dynamic portfolio CMS + visual Studio + immutable public runtime  
**Current runtime contract:** `1.5.0`

---

# 1. System overview

The Dynamic Portfolio Platform is a monorepo containing four primary applications and several shared packages.

At a high level:

```text
                         ┌───────────────────┐
                         │       Admin       │
                         │   CMS / Content   │
                         └─────────┬─────────┘
                                   │
                                   │ authenticated API
                                   ▼
┌───────────────────┐      ┌───────────────────┐
│      Studio       │◄────►│        API        │
│ Visual UI Builder │      │ Content / Layout  │
└─────────┬─────────┘      │ Release / Media   │
          │                └─────────┬─────────┘
          │ shared contracts/runtime          │
          ▼                                   │
┌───────────────────┐                         │
│ Runtime Renderer  │                         │
└─────────┬─────────┘                         │
          │                                   │
          ▼                                   ▼
┌─────────────────────────────────────────────────────┐
│                     Public Web                      │
│          Active immutable release manifest         │
└─────────────────────────────────────────────────────┘
```

The key architectural idea is that **Admin/Studio work with editable/live data**, while the **Public Web renders an immutable active release snapshot**.

---

# 2. Monorepo structure

The important root folders are:

```text
apps/
packages/
scripts/
supabase/
tests/
```

Typical responsibility split:

```text
apps/admin
    Content-management UI

apps/api
    Server/API, authentication, content persistence,
    releases, SEO, media, Studio endpoints

apps/studio
    Visual page/layout builder

apps/web
    Public portfolio runtime

packages/contracts
    Shared persisted/runtime schemas and types

packages/runtime-renderer
    Shared React renderer for Studio Preview and Public Web

packages/builder-core
    Editor document model, node creation, templates,
    hydration/normalization

packages/validation
    Layout/content/release validation and CSS safety

packages/animation-runtime
    Animation presets and animation metadata

packages/ui
    Shared UI/mutation-feedback primitives

supabase/
    PostgreSQL/Supabase migrations and database-side support

tests/
    Unit, integration, static/source, migration and behavior tests
```

---

# 3. Primary applications

## 3.1 Admin

Admin is the content-management system.

It manages built-in resources such as:

- Projects
- Notes
- Experience
- AI Apps
- Media
- Site Content
- Site Settings
- Layouts
- Releases

It also manages generic Custom Collections.

### Admin responsibilities

```text
Admin UI
   │
   ├── built-in CRUD resources
   ├── Custom Collection schemas
   ├── Custom Collection items
   ├── structured arrays
   ├── media upload / metadata
   ├── release management
   └── layout management
```

### Admin list-query architecture

The structured built-in resources (`projects`, `notes`, `experience`, `apps`) use one allowlisted server-side query contract:

```text
Admin list controls
      ↓
q / page / pageSize / sort / direction / filter.<field>
      ↓
API allowlist + sanitization + bounded range
      ↓
Supabase/PostgREST
      ↓
{ data, meta }
```

The API adds `id ASC` as a deterministic secondary order so offset pagination does not reshuffle rows that share the same primary sort value. The database migration indexes the default `display_order` path and exact filters exposed by the Admin UI. Alternate sorts remain supported and should receive dedicated indexes only if production query plans justify the additional write/index cost.

Search is intentionally a simple multi-field case-insensitive substring search for the current CMS scale. If the Admin dataset grows enough that `%term%` search becomes a measured bottleneck, move that search path to PostgreSQL trigram/full-text indexing rather than introducing a separate cache database by default.

### Admin form architecture

Editing uses a shared centered modal system with:

- portal rendering
- backdrop dimming/blur
- focus trap
- Escape handling
- body scroll lock
- modal stacking
- unsaved-change protection
- mutation loading/error feedback

### Structured arrays

Custom Collection fields can define structured arrays through:

```text
array
├── itemLabelField
└── itemFields[]
```

Nested items are rendered recursively in Admin.

Use cases include:

```text
Project Details
└── blocks[]
    ├── Rich Text
    ├── Image
    ├── Architecture
    ├── Code
    └── Callout
```

Array order is persisted.

---

# 4. API layer

The API is the authoritative server boundary.

It handles:

- authentication / authorization
- Admin CRUD
- Studio data
- saved layout documents
- Custom Collection definitions/items
- media
- validation
- release candidate creation
- release activation
- SEO
- public runtime manifest delivery

All important mutation authorization is enforced server-side rather than relying only on UI visibility.

---

# 5. Data architecture

## 5.1 Built-in collections

Built-in content includes:

```text
projects
notes
experience
apps
```

These have dedicated database/API structures and canonical fields.

Example Project data includes:

```text
title
slug
short_description
full_description
thumbnail_media_id
gallery_media
gallery_media_ids
technologies
github_url
live_url
display_order
featured
published
seo
```

---

## 5.2 Custom Collections

Custom Collections are schema-driven.

Conceptually:

```text
collection_definitions
    ↓
fields_json
    ↓
collection_items
    ↓
data_json
```

Fields support generic types including:

```text
text
textarea
number
boolean
date
array
json
media
url
select
```

Structured arrays extend `array` with nested `itemFields`.

Schemas may also carry generic integrity metadata such as:

```text
unique
relation
```

---

# 6. Projects and Project Details architecture

Projects remain the canonical Project records.

```text
Projects
├── title
├── slug
├── descriptions
├── thumbnail
├── gallery
├── technologies
├── GitHub / Live links
└── SEO
```

Additional case-study metadata lives in the Custom Collection:

```text
Project Details
├── name
├── project_slug
├── project_type
├── status
├── role
├── company/context
├── version
├── package_url
├── documentation_url
├── license
└── blocks[]
```

Relationship:

```text
Projects.slug
      │
      ▼
Project Details.project_slug
```

`project_slug` is intended to be unique in Project Details.

---

# 7. Project Detail rendering

The platform uses **one reusable Project Detail Studio page** rather than a separate page per Project.

Route:

```text
/projects/:slug
```

Conceptually:

```text
URL slug
   ↓
active Project record
   ↓
Project Detail page fieldContext
   ↓
Project Details relation lookup
   ↓
blocks[] nested repeat
```

Studio can select which Project record to preview.

Public Web resolves the actual record from the URL.

---

# 8. Collection rendering model

The runtime supports two repeat sources.

## Named Collection

Example:

```text
Projects
Project Details
Journey Chapters
Technologies
```

Binding:

```text
Repeat source = Named Collection
Collection = ...
```

## Current Item Array

Example:

```text
Project Details.blocks[]
Projects.gallery_media[]
Projects.technologies[]
```

Binding:

```text
Repeat source = Current Item Array
Array field = blocks
```

---

# 9. Nested field context

Nested rendering uses scoped field contexts.

Available scopes:

```text
Current
Parent
Root
```

Example:

```text
Root Project
    ↓
Project Details item
    ↓
Block item
```

Inside the Block:

```text
Current.heading
Current.body

Parent.project_type

Root.title
Root.slug
Root.technologies
```

This prevents nested collection repeats from losing access to the original Project.

---

# 10. Runtime collection query pipeline

For a named collection, the runtime applies the release-safe query pipeline in memory:

```text
active-release collection snapshot
    ↓
conditional filters
    ↓
search
    ↓
conditional sorting
    ↓
legacy limit cap
    ↓
pre-page total/count state
    ↓
page slice
    ↓
repeat
```

Search, filters, sorting and pagination may read runtime state. Inputs/selects can write event values into that state through declarative `input` / `change` interactions. Pagination can publish state such as:

```text
total items
page count
has next
has previous
```

Runtime metadata still includes:

```text
collectionIndex
collectionPosition
collectionCount
```

The Public Web does **not** query mutable Admin collection rows for each search/filter/page interaction. It queries the frozen active-release collection data already loaded into the runtime, preserving immutable release semantics.

---

# 11. Media architecture

Media is canonical and ID-based.

```text
Admin Media
   ↓
media record
   ↓
bucket/storage path
   ↓
canonical media ID
```

Layouts and content should reference managed media by ID rather than permanently embedding arbitrary storage URLs.

Runtime resolution:

```text
media_id
   ↓
runtime Media map
   ↓
public URL
```

Media IDs are supported in:

- image `src`
- poster
- collection fields
- nested structured arrays
- Project galleries
- supported CSS image properties

### Upload path

Large CMS files do not travel as base64 JSON through the API. Uploads use:

```text
Admin
  ↓ authenticated prepare
API creates signed upload/finalization intent
  ↓
Admin browser ── resumable chunks ──► Supabase Storage
  ↓ completed object
API verifies ownership + size + declared/stored/sniffed MIME
  ↓
canonical media row in PostgreSQL
```

The `media` table stores metadata/references; Supabase Storage stores file bytes. Redis is not a media/object store in this architecture.

---

# 12. Release-media architecture

Public releases use certified media.

At release creation:

```text
layout/content/collection snapshot
        ↓
collect canonical media references
        ↓
verify media records
        ↓
verify physical Storage object
        ↓
freeze release-media references
```

The Public Web only receives media authorized for that release.

Historical release-media references are protected from deletion.

---

## Shared data-loading state model

Database/network-backed surfaces share the same state vocabulary:

```text
initial loading → skeleton
loaded         → content
refreshing     → keep content + subtle updating status
empty          → contextual empty state
error          → error + real retry action
```

A search/filter/page refresh must not erase already loaded content while the next request is in flight. This model is shared by Admin, Studio data surfaces and the Public runtime bootstrap.

---

# 13. Release architecture

The release system separates editable live content from public production state.

## Editable/live side

```text
Admin database
Studio draft layout
current Media
current published collection items
```

## Release side

A release freezes:

```text
layout
content
settings
collections
custom collection schema metadata
media references
runtime compatibility
```

The Public Web does **not** directly render current Admin rows.

It renders:

```text
Active Release
      ↓
immutable runtime manifest
      ↓
Public Web
```

This means editing Admin data does not unexpectedly change the live public site until a new release is created and activated.

---

# 14. Studio architecture

Studio is the visual layout editor.

Core concepts:

```text
EditorDocument
├── pages
├── nodes
├── responsive styles
├── design tokens
├── CSS variables
├── reusable keyframes
└── layout metadata
```

Studio contains:

- Elements panel
- Canvas
- Layers/tree
- Inspector
- Runtime Preview
- responsive device selector
- Collection binding controls
- Animation controls
- design tokens

---

# 15. Canvas vs Runtime Preview

These intentionally serve different purposes.

## Canvas

Canvas prioritizes editing.

It should accurately represent:

- content
- layout
- responsive styles
- media
- static transforms
- collections

Structural runtime choreography may be neutralized so nodes remain selectable.

## Runtime Preview

Runtime Preview executes the real runtime behavior:

- sticky
- Pin
- Card Deck
- cinematic sequences
- parallax
- section transitions
- viewport triggers
- runtime state

Therefore:

```text
Canvas = authoring truth
Runtime Preview = behavioral truth
```

---

# 16. Responsive architecture

Responsive behavior is based on two separate concepts.

## Device preview dimensions

Studio may display example widths such as:

```text
Desktop
Tablet
Mobile
```

These are visual simulation sizes.

## Runtime breakpoint thresholds

The public/runtime resolver independently decides:

```text
Mobile
Tablet
Desktop
```

from actual viewport width.

These values are no longer conflated.

---

# 17. Responsive style inheritance

The style inheritance model is:

```text
Desktop
   ↓
Tablet overrides
   ↓
Mobile overrides
```

If a smaller breakpoint does not override a property, it inherits from the larger breakpoint.

Clearing an override means:

```text
remove property from that breakpoint
```

rather than storing an undefined override.

---

# 18. Responsive geometry

Free-position layout geometry is responsive.

Supported responsive geometry includes:

```text
x
y
width
height
rotation
zIndex
```

This prevents editing a Mobile position from accidentally moving the Desktop element.

---

# 19. Scroll/runtime architecture

Scroll behaviors are stored on nodes and resolved against responsive mode.

Supported systems include:

```text
normal
sticky
pin
stack-over-previous / section-cover
parallax
horizontal
reveal
card-deck
scene-transition
cinematic sections
```

Runtime effects own and clean their DOM side effects.

On:

- breakpoint change
- behavior change
- page change
- unmount

the runtime cancels/cleans:

```text
RAF callbacks
listeners
observers
inline transforms
runtime CSS variables
behavior classes
behavior-owned local state
```

---

# 20. Card Deck architecture

Card Deck is a runtime-coordinated collection behavior.

It depends on:

- repeated collection items
- active index
- element measurement
- viewport behavior
- transforms
- focus/interaction gating

It therefore remains runtime-driven rather than being converted to pure CSS.

Mobile may explicitly fall back to normal flow.

---

# 21. Cinematic sequence architecture

Cinematic section choreography is also runtime-driven because it requires:

- sticky stage management
- dynamic scene measurement
- scroll progress
- viewport/breakpoint behavior
- scene transition coordination

Desktop/Tablet can run the full choreography.

Mobile can use flow fallback.

---

# 22. Style architecture

Node styles are open-ended React/CSS style maps.

The runtime passes safe CSS properties after validation/sanitization.

Studio exposes a property metadata registry rather than hardcoding every effect.

Major authoring categories include:

```text
Layout
Spacing
Flexbox
Grid
Position
Typography
Background
Border
Effects
Transform / 3D
Transition
Mask / Clip
Motion Path
Interaction
Scroll CSS
Performance
Media
CSS Variables
Advanced CSS
```

---

# 23. CSS safety boundary

The CSS model is intentionally broad but rejects dangerous/meta properties.

Validation/runtime cooperate on:

- safe property names
- scalar style values
- maximum value length
- dangerous CSS substrings
- URL protocols
- CSS custom-property names

Unsafe/meta fields such as `cssText` are not accepted as normal authored styles.

---

# 24. CSS variables

CSS custom properties may be authored globally or per node.

Examples:

```text
--glow-color
--angle
--speed
--border-size
```

Node-level variables participate in responsive style inheritance.

Example:

```css
box-shadow: 0 0 30px var(--glow-color);
```

---

# 25. Animation architecture

The platform has two complementary animation systems.

## Runtime-coordinated animation

Used when animation requires:

- state
- viewport observation
- scroll measurement
- collection position
- interaction coordination

Examples:

- Card Deck
- cinematic sequences
- runtime-state replay
- parallax
- collection active state

## CSS animation

Used for visual motion that CSS can perform efficiently.

Examples:

- float
- spin
- glow pulse
- shimmer
- scanning
- gradient motion
- masks
- loaders
- decorative rings

Runtime may control the trigger, while CSS renders the visual effect.

---

# 26. Legacy animation presets

Existing AnimationConfig presets remain supported for backward compatibility.

Examples include:

- Fade
- Slide
- Zoom
- Pop
- Typewriter
- Text Steps
- Float
- Pulse
- Breathe
- Shimmer
- Aurora

Their stored configuration remains compatible with older layouts.

---

# 27. Reusable Keyframe Library

The Studio document may contain reusable structured keyframes.

Concept:

```text
animationLibrary
└── keyframes[]
```

Each keyframe contains:

```text
id
label
category
description
steps[]
reduced-motion policy
```

Steps are structured style maps rather than raw stylesheet text.

Runtime compiles stable internal IDs into collision-safe CSS names.

---

# 28. Typed CSS custom properties

The platform can register selected typed CSS variables through structured `@property` metadata.

Supported types include:

```text
<angle>
<length>
<number>
<percentage>
<color>
<length-percentage>
```

This enables smooth animation of variables such as gradient angles.

---

# 29. Decoration nodes

Decoration is a generic visual layer.

Concept:

```text
Card / Container
├── content
└── Decoration
```

Decoration is normally:

- absolutely positioned
- pointer-event transparent at runtime
- selectable in Canvas
- styled through normal CSS
- attachable to reusable keyframes

This is the generic foundation for effects such as:

- comet borders
- glowing rings
- scanners
- shimmer
- corner accents
- moving masks
- rotating gradients

No dedicated runtime node is needed for each effect.

---

# 30. Existing ambient systems

The platform also contains specialized generated visual fields:

## Particle Field

Seeded particle generation with CSS/runtime motion.

## Ambient Field

Seeded floating visual/tag/icon field.

## Code Stream

Repeated code-line visual stream.

These remain specialized because runtime generation is useful, while their motion can still rely heavily on CSS.

---

# 31. Runtime state

Runtime state provides interaction/state coordination for layouts.

It can drive:

- conditional styles
- collection filters
- active states
- animation replay
- text steps
- selected categories
- scroll-driven content state

Runtime state belongs to a rendered page/detail identity and should reset appropriately when changing detail records.

---

# 32. Validation architecture

Validation exists at multiple boundaries.

```text
Studio/client
    ↓
shared contracts / validation
    ↓
API
    ↓
database constraints / RPCs
    ↓
release validation
```

Important categories include:

- layout/schema validity
- CSS safety
- Collection binding validity
- custom schema/data validity
- media references
- relationship constraints
- release readiness
- runtime compatibility

---

# 33. SEO architecture

SEO is resolved from:

```text
page route SEO
+
record-specific SEO
+
record fields
+
media
```

For collection-detail routes, record-level SEO may override generic page defaults.

Examples:

- title
- description
- canonical
- noindex
- Open Graph image

`noindex` detail records are excluded from sitemap expansion.

---

# 34. Security model

Important production boundaries include:

- server-side Admin authorization
- server-side Studio authorization
- validated mutation inputs
- CSS sanitization
- safe runtime URLs
- canonical managed media
- release-media certification
- immutable release snapshots
- guarded production auth bypass configuration

Public Web should never rely on client-only security decisions for authoritative data access.

---

# 35. Database integrity

Database-side support includes:

- canonical built-in content tables
- generic collection definitions/items
- canonical media
- Project gallery relation/order
- releases
- release media
- relation/uniqueness support added during production hardening

Multi-step operations that require atomicity should use database transactions/RPCs rather than separate client-side writes.

---

# 36. Production data flow

A typical Project publication path:

```text
Admin edits Project
        ↓
Database
        ↓
Studio Live Admin Preview
        ↓
layout authoring
        ↓
Release candidate
        ↓
validate:
  layout
  collections
  schemas
  relations
  media
  runtime version
        ↓
freeze snapshots
        ↓
certify release media
        ↓
activate release
        ↓
Public Web runtime manifest
```

---

# 37. Runtime rendering flow

Public rendering conceptually follows:

```text
URL
 ↓
active release manifest
 ↓
route match
 ↓
detail fieldContext (if applicable)
 ↓
RuntimeSitePreview / RuntimeRenderer
 ↓
responsive style resolution
 ↓
collection/nested repeat resolution
 ↓
media resolution
 ↓
animation/scroll effects
 ↓
React DOM
```

---

# 38. Backward compatibility principles

Future changes should follow the same rules used during production stabilization:

1. Prefer optional/additive contract fields.
2. Avoid rewriting saved layouts merely because new features exist.
3. Preserve existing AnimationConfig semantics.
4. Preserve legacy release snapshots.
5. Keep migration behavior explicit.
6. Do not silently delete/merge user content.
7. Keep Public Web release-driven.
8. Add regression tests for shared runtime changes.

---

# 39. Recommended repository documentation

The repository only needs a small permanent documentation set:

```text
README.md
PATCH_HISTORY.md
ARCHITECTURE.md
```

`README.md` should explain how to install/run/deploy the project.

`PATCH_HISTORY.md` should record the major production stabilization history.

`ARCHITECTURE.md` should remain the canonical explanation of how the platform works.

Temporary implementation/handoff/repair Markdown files can be removed after their useful information has been consolidated into these documents.

---

# 40. Architecture summary

The Dynamic Portfolio Platform is designed around five important principles:

### 1. Content and layout are separate

Admin owns content; Studio owns presentation.

### 2. Studio is dynamic

Layouts can bind to Collections, nested arrays, runtime state, media, and responsive values rather than hardcoded content.

### 3. Public production is immutable

Public Web renders an active release snapshot instead of current mutable Admin rows.

### 4. Visual effects are generic where possible

CSS-capable effects are constructed from CSS primitives, reusable keyframes, CSS variables, and Decoration nodes.

Runtime JavaScript is reserved for behavior that genuinely needs state, measurement, scroll choreography, or generated structures.

### 5. Existing user work is protected

The architecture is designed to evolve through additive contracts, explicit migrations, immutable releases, and cumulative patches rather than destructive layout rewrites.

---

**Current architecture status:** Production baseline after Patch 11 + Patch 11A + Patch 11B.
