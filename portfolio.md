# Dynamic Portfolio Platform — Architecture & Implementation Roadmap

**Document version:** 1.0  
**Status:** Source of Truth  
**Date:** 2026-08-07  
**Scope:** Public Portfolio + Admin CMS + UI/UX Studio + Common Platform Backend  
**AI execution phases:** Deferred  
**Supersedes:** Previous architecture/roadmap documents wherever they conflict with this document.

---

# 1. Purpose

This document defines the target architecture for the portfolio platform and the order in which it should be built.

The platform is not just a portfolio website. It is a small content-and-design platform consisting of three independently deployable frontend applications that communicate through a shared backend and database:

1. **Public Web** — the portfolio and authenticated user-facing application.
2. **Admin CMS** — the control center for content, publishing, users, media, configuration, and selection of the live design.
3. **UI/UX Studio** — the visual website design application used to create pages, sections, responsive layouts, reusable design systems, and advanced animations.

All three applications use a common platform backend and Supabase infrastructure.

The goal is to ensure that:

- Content can change without editing the design.
- Design can change without editing content.
- Multiple complete website layouts can exist simultaneously.
- A layout can be designed and tested without affecting the live website.
- Admin can choose which published layout becomes the live layout.
- Public Web remains a lightweight runtime rather than a visual editor.
- New Studio editor features do not automatically break Admin or Public Web.
- Application data is structured and is not buried inside arbitrary visual block JSON.
- AI applications can be added later without redesigning the core platform.

---

# 2. Core Architectural Decision

The platform will use **three independently deployable frontend applications**, not three backend microservices.

```text
┌───────────────────────┐
│      PUBLIC WEB       │
│                       │
│ Portfolio + User App  │
└───────────┬───────────┘
            │
            │ HTTPS / API
            ▼
┌────────────────────────────────────────────────────────────┐
│                    PLATFORM BACKEND                        │
│                                                            │
│ Auth  Content  Layout  Publishing  Media  Users  Analytics │
└─────────┬───────────────────────────────┬───────────────────┘
          │                               │
          ▼                               ▼
┌──────────────────────────┐    ┌────────────────────────────┐
│        SUPABASE          │    │      OBJECT STORAGE        │
│                          │    │                            │
│ PostgreSQL / Auth / RLS  │    │ Media / private user data  │
└──────────────────────────┘    └────────────────────────────┘
          ▲                               ▲
          │                               │
          │ HTTPS / API                   │
┌─────────┴──────────┐          ┌─────────┴──────────────┐
│     ADMIN CMS      │          │      UI/UX STUDIO     │
│                    │          │                        │
│ Content + Control  │          │ Design + Animation     │
└────────────────────┘          └────────────────────────┘
```

The backend should remain a **modular monolith** initially.

This gives us service boundaries without prematurely creating distributed backend complexity.

If scale or organizational requirements later justify true backend microservices, individual backend modules can be extracted behind the same API contracts.

---

# 3. Architecture Principles

## 3.1 Design and content are separate

Studio owns presentation.

Admin owns editable content and application records.

Public Web combines both at runtime.

Example:

Studio stores:

```json
{
  "id": "hero-heading",
  "type": "heading",
  "binding": {
    "type": "content",
    "key": "home.hero.heading"
  },
  "styles": {
    "desktop": {
      "fontSize": "72px"
    }
  }
}
```

Admin stores:

```json
{
  "key": "home.hero.heading",
  "value": "Mustafa Md Sajid"
}
```

The public renderer resolves the binding and displays the final result.

---

## 3.2 Structured application data never lives only inside visual layout JSON

Projects, notes, experiences, AI applications, site content, users, media metadata, and similar application records belong in dedicated tables.

A Studio block can query or bind to these records.

Example:

```json
{
  "type": "collection",
  "collection": "projects",
  "query": {
    "published": true,
    "featured": true,
    "limit": 6
  },
  "presentation": {
    "templateId": "project-card-v2"
  }
}
```

Studio controls card appearance.

Admin controls which projects exist and which are published.

---

## 3.3 Public Web is a runtime, not an editor

Public Web must not contain:

- Page editing logic.
- Drag-and-drop logic.
- Studio property panels.
- Admin forms.
- Layout mutation logic.
- Layout publishing decisions.
- Homepage-specific hard-coded animation implementations.

Public Web should:

1. Resolve the current site release.
2. Load the layout manifest.
3. Load required content.
4. Render it through the runtime renderer.
5. Provide authenticated user-facing functionality where needed.

---

## 3.4 Studio publishing and website activation are different actions

Publishing a layout means:

> This layout version is valid and available for use.

Activating a layout means:

> This published layout version should be used by the live website.

Only Admin can activate a layout.

Studio cannot silently replace the live website.

---

## 3.5 Existing live releases are immutable

Once a site release is activated, it should represent an immutable snapshot or immutable set of version references.

New edits create new drafts or versions.

This allows rollback.

---

## 3.6 Everything crossing an application boundary uses a versioned contract

Shared schemas define:

- Layout format.
- API requests.
- API responses.
- Content bindings.
- Collection queries.
- animation configuration.
- Release manifests.
- permissions.

The frontend applications should not depend on private implementation details of one another.

---

# 4. Application 1 — Public Web

## 4.1 Responsibility

Public Web is the visitor-facing portfolio and authenticated user application.

Possible deployment:

```text
www.portfolio-domain.com
```

or:

```text
portfolio-domain.com
```

## 4.2 Public routes

Initial routes may include:

```text
/
/projects
/projects/:slug
/notes
/notes/:slug
/apps
/about
/contact
/:dynamic-page-slug
```

The final public page list is controlled by the active Studio layout.

Studio may create or remove layout pages without requiring a new hard-coded React route for each ordinary content page.

Application routes such as authentication and user dashboard remain code-owned routes.

---

## 4.3 Authenticated user routes

Keep the user application foundation:

```text
/login
/register

/dashboard
/dashboard/resumes
/dashboard/history
/dashboard/settings
```

AI execution is deferred, so AI-related areas may be hidden, disabled, or marked Coming Soon until later phases.

---

## 4.4 Public Web responsibilities

Public Web owns:

- Public routing.
- Authentication UI for normal users.
- Authenticated user dashboard shell.
- Runtime layout rendering.
- SEO rendering.
- Dynamic structured-content routes.
- Collection rendering.
- Content binding resolution.
- Responsive runtime behavior.
- Animation runtime execution.
- Accessibility behavior.
- Error and fallback screens.
- Public navigation behavior.
- Performance optimizations.

---

## 4.5 Public Web must not own

Public Web does not own:

- Page creation.
- Section creation.
- Layout selection.
- Content editing.
- Project management.
- Note management.
- Studio canvas behavior.
- Design configuration.
- Layout publishing.
- Admin analytics.
- Administrative access.

---

# 5. Application 2 — Admin CMS

## 5.1 Responsibility

Admin CMS controls the **data and operational state** of the portfolio.

Possible deployment:

```text
admin.portfolio-domain.com
```

Admin access requires an authenticated user with the admin role.

There will be no public admin signup.

---

## 5.2 Admin CMS modules

### Dashboard

Shows:

- Current active release.
- Current active layout.
- Draft content counts.
- Published project count.
- Published note count.
- Published AI application count.
- Recent changes.
- Failed publishing attempts.
- Recent audit activity.
- User counts.
- Storage information.
- Platform health summaries.

### Site Content

Manage editable site-wide and page-specific content values.

Examples:

```text
home.hero.heading
home.hero.description
home.hero.primaryCta.label
home.hero.primaryCta.href
home.hero.profileImage
about.introduction
contact.email
site.social.github
site.social.linkedin
```

Admin controls the values.

Studio controls where and how those values appear.

### Projects Manager

Suggested fields:

```text
id
slug
title
short_description
full_description
thumbnail
gallery
technologies
github_url
live_url
featured
published
display_order
seo
created_at
updated_at
```

### Notes Manager

Suggested fields:

```text
id
slug
title
summary
content
category
tags
cover_image
featured
published
seo
created_at
updated_at
```

The future `include_in_rag` field can remain available but does not trigger RAG work during the current roadmap.

### Experience Manager

Suggested fields:

```text
id
company
role
employment_type
location
start_date
end_date
current
summary
responsibilities
technologies
logo
display_order
published
```

### AI Applications Manager

For now this is the public catalog/configuration layer only.

Suggested fields:

```text
id
slug
name
short_description
full_description
icon
cover_image
category
tags
requires_login
status
published
featured
display_order
```

Possible statuses:

```text
coming_soon
available
maintenance
disabled
```

Provider IDs, agent execution configuration, usage limits, token tracking, and provider adapters are deferred until AI implementation resumes.

### Media Manager

Admin manages reusable public media:

```text
images
videos
documents
icons
posters
other approved site assets
```

Media metadata should include:

```text
id
filename
storage_path
mime_type
size
kind
width
height
duration
alt_text
created_at
```

### Layout Library

Admin can view layouts published from Studio.

For every layout:

```text
name
thumbnail
description
latest published version
schema version
supported runtime version
created date
published date
status
```

Admin cannot visually edit the layout here.

Admin can:

- Preview it.
- Inspect compatibility.
- Choose it for the next release.
- Activate it.
- Roll back to an older compatible release.

### Release Manager

Admin creates a deployable site release by selecting:

```text
layout version
content version/state
site settings
navigation configuration if applicable
```

Admin can:

```text
Create release
Preview release
Activate release
Rollback
Archive release
```

### Users

Admin can inspect platform users and account status subject to privacy/security rules.

### Site Settings

Examples:

```text
site_name
site_description
default_seo
favicon
social links
maintenance_mode
registration_enabled
active_release
```

### Audit Logs

Every sensitive operation should be recorded.

---

# 6. Application 3 — UI/UX Studio

## 6.1 Responsibility

Studio is the design-authoring system.

Possible deployment:

```text
studio.portfolio-domain.com
```

Only authorized admin/design users can access it.

Studio is where the complete visual interface is created.

---

## 6.2 Studio capabilities

The intended Studio eventually includes:

### Layout management

```text
Create layout
Duplicate layout
Rename layout
Archive layout
Create version
Preview version
Publish version
```

Example layouts:

```text
Cosmic Portfolio
Minimal Portfolio
Experimental 3D
Developer Terminal
Editorial Portfolio
```

Multiple layouts can coexist.

---

## 6.3 Page management

Inside each layout:

```text
Home
Projects
Project Detail Template
Notes
Note Detail Template
Apps
About
Contact
Custom pages
```

Studio determines which ordinary public pages exist in a layout.

---

## 6.4 Canvas

The Studio canvas should support:

- Drag and drop.
- Nested drag and drop.
- Reordering.
- Free/absolute positioning where enabled.
- Flow layout.
- Resizing.
- Parent/child hierarchy.
- Container nesting.
- Flex.
- Grid.
- Layer ordering.
- Element locking.
- Element hiding.
- Desktop/tablet/mobile modes.
- Zoom.
- Pan.
- Canvas rulers/guides later.
- Snap behavior later.
- Multi-select later.
- Undo/redo.
- Duplicate.
- Copy/paste.
- Keyboard actions.

---

## 6.5 Elements

Preserve and extend the generic element model already present in the current builder.

Examples:

```text
section
container
div
main
article
aside
header
footer
nav
span
p
h1-h6
a
button
ul
ol
li
blockquote
figure
label
form
input
textarea
select
image
video
audio
embed
icon
spacer
divider
card
marquee
```

Studio should prefer generic primitives over one-off homepage-specific React components.

---

# 7. Studio Styling System

The existing builder already provides a strong basis and should be migrated rather than discarded.

The styling system should cover:

## Layout

```text
display
width
height
min/max dimensions
margin
padding
box sizing
overflow
aspect ratio
```

## Flexbox

```text
direction
wrap
justify
align
gap
grow
shrink
basis
order
```

## Grid

```text
template columns
template rows
auto flow
row/column positioning
gaps
place items
```

## Position

```text
static
relative
absolute
fixed
sticky
top/right/bottom/left
inset
z-index
```

## Typography

```text
family
size
weight
style
line height
letter spacing
alignment
decoration
transform
text shadow
text stroke
```

## Background

```text
color
image
position
size
repeat
attachment
blend
```

## Borders and effects

```text
border
radius
shadow
opacity
outline
```

## Media

```text
object-fit
object-position
image rendering
```

## Transform / 3D

```text
translate
rotate
scale
skew
transform origin
transform style
perspective
perspective origin
backface visibility
```

## Filters

```text
blur
brightness
contrast
saturation
hue rotate
grayscale
sepia
invert
drop shadow
backdrop filter
blend mode
```

## Advanced CSS

```text
clip-path
mask
motion path
transition
will-change
contain
content-visibility
scroll snap
custom CSS
```

---

# 8. Animation Runtime

Animations must be expressed as **data**, not homepage-specific React code whenever practical.

The runtime contract should support the concepts already present in the current builder:

## Entrance / basic animation

Examples:

```text
fade
fade-up
fade-down
fade-left
fade-right
zoom
flip
slide
bounce
rotate
scale
blur-in
reveal
clip
glitch
float
spin
orbit
parallax
custom
```

## Trigger

```text
load
scroll
hover
tap
continuous
```

## Timing

```text
duration
delay
easing
repeat
direction
stagger
```

## Scroll motion

```text
parallax-x
parallax-y
scale
rotate
fade
blur
skew
zoom-through
horizontal
pin
```

## Text effects

```text
words-up
letters-up
typewriter
scramble
glitch
gradient-flow
wave
```

## Mouse effects

```text
tilt-3d
follow
magnetic
spotlight
```

## Background effects

```text
aurora
mesh
spotlight
noise
grid-pulse
orbs
```

## Advanced movement

```text
orbit
3D revolve
motion path
custom keyframes
Ken Burns
glitch loop
```

---

# 9. Section-Level Scroll Behavior

This is a first-class Studio feature.

Do not hard-code the homepage stacking experience into Public Web.

Section scroll behavior should be configurable.

Initial modes:

```text
normal
sticky
pin
stack-over-previous
parallax
horizontal
reveal
```

For `stack-over-previous`, Studio should expose properties such as:

```text
enabled
sticky_top
stack_order
pin_distance
release_behavior
background_behavior
mobile_fallback
reduced_motion_fallback
```

The current homepage animation should eventually be recreated through this system.

If a future page needs the same effect, no code change should be required.

---

# 10. Content Binding System

The binding system is the bridge between Admin data and Studio design.

Every bindable property can use one of several sources.

## 10.1 Static

Useful for decorative text that belongs specifically to a layout.

```json
{
  "type": "static",
  "value": "Scroll to explore"
}
```

## 10.2 Site content key

```json
{
  "type": "content",
  "key": "home.hero.heading"
}
```

## 10.3 Site setting

```json
{
  "type": "setting",
  "key": "site.social.github"
}
```

## 10.4 Media reference

```json
{
  "type": "media",
  "id": "uuid"
}
```

## 10.5 Collection field

Within a collection template:

```json
{
  "type": "field",
  "field": "title"
}
```

## 10.6 Collection query

```json
{
  "type": "collection",
  "collection": "projects",
  "filters": [
    {
      "field": "featured",
      "operator": "eq",
      "value": true
    }
  ],
  "sort": [
    {
      "field": "display_order",
      "direction": "asc"
    }
  ],
  "limit": 6
}
```

---

# 11. Collection Components

Studio needs dynamic collection blocks.

Initial collection types:

```text
Project Grid
Project List
Notes Grid
Notes List
Experience Timeline
AI App Gallery
Generic Collection
```

Eventually these should converge on a generic collection/repeater model.

Studio controls:

```text
query
layout
card template
empty state
pagination style
animation
responsive behavior
```

Admin controls records.

---

# 12. Reusable Components and Symbols

Studio should support reusable design elements.

Examples:

```text
Project Card
Note Card
App Card
CTA
Section Header
Social Links
Button Style
Footer Column
Navigation Item
```

A reusable component can have bindable props.

Updating a component can either:

- Update all linked instances.
- Create a new component version.

This can be introduced after the initial Studio migration and renderer are stable.

---

# 13. Navbar and Footer

Navbar and Footer are design entities, not simple arrays.

Studio controls:

```text
structure
layout
logo/image placement
responsive behavior
mobile menu design
animations
sticky/fixed behavior
typography
buttons
icons
dropdown appearance
footer layout
```

Admin controls dynamic values such as:

```text
brand image
social URLs
contact information
selected navigation destinations if needed
```

Navigation items may bind to the active layout's page manifest so Studio-created pages can be linked without hard-coded routes.

---

# 14. Layout Data Model

A layout represents a complete website design family.

Suggested model:

```text
layouts
```

Fields:

```text
id
name
slug
description
thumbnail_media_id
status
created_by
created_at
updated_at
```

Suggested statuses:

```text
active
archived
```

This status refers to whether the layout is maintained in Studio, not whether it is live on Public Web.

---

# 15. Layout Versions

Every publishable change creates a version.

```text
layout_versions
```

Suggested fields:

```text
id
layout_id
version_number
schema_version
runtime_min_version
status
changelog
created_by
created_at
published_at
```

Statuses:

```text
draft
published
archived
```

A published version is immutable.

Editing a published version creates a new draft version.

---

# 16. Layout Pages

```text
layout_pages
```

Suggested fields:

```text
id
layout_version_id
slug
name
page_type
route_pattern
seo_defaults
sort_order
layout_tree
created_at
updated_at
```

Possible `page_type` values:

```text
standard
home
collection_index
collection_detail
system
```

Examples:

```text
Home
Projects
Project Detail Template
Notes
Note Detail Template
Apps
About
Contact
```

---

# 17. Layout Schema

The layout JSON should contain presentation data, not business records.

Simplified shape:

```ts
interface LayoutPageSchema {
  schemaVersion: number;
  pageId: string;
  root: StudioNode[];
}

interface StudioNode {
  id: string;
  type: string;
  tag?: string;

  bindings?: Record<string, Binding>;

  props?: Record<string, unknown>;

  styles: {
    desktop?: StyleMap;
    tablet?: StyleMap;
    mobile?: StyleMap;
  };

  layout?: {
    mode: "flow" | "absolute";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    zIndex?: number;
  };

  animation?: AnimationConfig;

  children?: StudioNode[];

  accessibility?: {
    ariaLabel?: string;
    role?: string;
  };
}
```

The exact final TypeScript contract will evolve from the existing `builder-core` types.

---

# 18. Schema Versioning and Runtime Compatibility

Studio will evolve faster than Public Web.

Therefore every layout version must declare:

```text
schema_version
runtime_min_version
```

Example:

```text
Layout: Cosmic Portfolio
Version: 8
Schema: 2
Minimum runtime: 1.4.0
```

Admin must not activate a layout that the currently deployed runtime cannot render.

Activation validation:

```text
layout schema supported?
runtime version supported?
all required bindings resolved?
all referenced media available?
all dynamic collections valid?
page routes valid?
no fatal validation errors?
```

If any required check fails:

```text
ACTIVATION BLOCKED
```

The currently active release remains untouched.

---

# 19. Platform Backend

The backend should begin as one modular Node.js/TypeScript service.

Possible deployment:

```text
api.portfolio-domain.com
```

The API is the trusted coordination layer.

Supabase can still provide Auth, PostgreSQL, Storage, and RLS.

---

# 20. Backend Modules

Suggested modules:

```text
auth
users
content
projects
notes
experience
apps-catalog
media
layouts
layout-versions
studio
publishing
releases
site-settings
audit
analytics
health
```

Deferred modules:

```text
agent-runtime
provider-adapters
rag
embeddings
token-cost
agent-usage
```

---

# 21. API Boundary

Applications should talk to supported APIs rather than reaching into arbitrary database tables everywhere.

Supabase client access may still be used where it is safe and beneficial, especially for authentication.

Critical mutations and publication operations should go through the backend.

Suggested API groups:

```text
/api/public/*
/api/admin/*
/api/studio/*
/api/user/*
```

---

# 22. Public API

Examples:

```text
GET /api/public/runtime
GET /api/public/pages/:slug
GET /api/public/projects
GET /api/public/projects/:slug
GET /api/public/notes
GET /api/public/notes/:slug
GET /api/public/experience
GET /api/public/apps
```

`/api/public/runtime` is the main website bootstrap endpoint.

It should return enough information to resolve the current release efficiently.

---

# 23. Admin API

Examples:

```text
GET    /api/admin/dashboard

GET    /api/admin/projects
POST   /api/admin/projects
PATCH  /api/admin/projects/:id
DELETE /api/admin/projects/:id

GET    /api/admin/notes
POST   /api/admin/notes
PATCH  /api/admin/notes/:id

GET    /api/admin/content
PUT    /api/admin/content/:key

GET    /api/admin/layouts
GET    /api/admin/layouts/:id/versions

POST   /api/admin/releases
POST   /api/admin/releases/:id/activate
POST   /api/admin/releases/:id/rollback
```

---

# 24. Studio API

Examples:

```text
GET    /api/studio/layouts
POST   /api/studio/layouts

GET    /api/studio/layouts/:id
PATCH  /api/studio/layouts/:id

POST   /api/studio/layouts/:id/versions
GET    /api/studio/versions/:id
PATCH  /api/studio/versions/:id

POST   /api/studio/versions/:id/pages
PATCH  /api/studio/pages/:id

POST   /api/studio/versions/:id/validate
POST   /api/studio/versions/:id/publish
```

Studio cannot call the release activation endpoint.

---

# 25. Release System

A release represents the version of the site that Public Web should render.

Suggested table:

```text
site_releases
```

Fields:

```text
id
release_number
layout_version_id
status
created_by
created_at
activated_at
deactivated_at
notes
```

Statuses:

```text
draft
ready
active
superseded
archived
failed
```

There must be only one active release for the main production site.

---

# 26. Release Activation Flow

```text
Admin chooses published layout
        ↓
Create release candidate
        ↓
Backend validates compatibility
        ↓
Backend validates bindings
        ↓
Backend validates media references
        ↓
Backend validates routes
        ↓
Generate/resolve runtime manifest
        ↓
Admin previews candidate
        ↓
Admin clicks Activate
        ↓
Database transaction marks new release active
        ↓
Old release becomes superseded
        ↓
Public cache invalidated
        ↓
Public Web begins resolving new release
```

Activation must be atomic.

If activation fails, the old live release remains active.

---

# 27. Rollback

Rollback should not reconstruct old data manually.

Admin chooses a previous compatible release and activates it.

```text
Release 40 — Cosmic v6
Release 41 — Cosmic v7
Release 42 — Minimal v2  ← active

Rollback to Release 41
```

The backend validates Release 41 and atomically reactivates it.

---

# 28. Runtime Manifest

For performance and stability, Public Web should resolve a runtime-oriented manifest rather than consuming Studio editing records directly.

Conceptual example:

```json
{
  "releaseId": "release-42",
  "layoutVersionId": "layout-v7",
  "schemaVersion": 1,
  "runtimeMinVersion": "1.0.0",
  "theme": {},
  "navigation": {},
  "routes": [],
  "contentRevision": "content-r18",
  "generatedAt": "2026-08-07T11:30:00Z"
}
```

A manifest can reference page schemas and collections rather than embedding the entire site in one huge response.

---

# 29. Database Domains

The database should be organized conceptually into the following domains.

## Identity and security

```text
profiles
roles if needed
audit_logs
security_events
```

Supabase `auth.users` remains the authentication identity source.

Avoid creating a separate independent password/user identity table.

---

## Structured content

```text
site_content
projects
notes
experiences
ai_apps
media
site_settings
```

---

## Design

```text
layouts
layout_versions
layout_pages
layout_components
layout_assets
```

`layout_components` can be introduced when reusable Studio components are implemented.

---

## Publishing

```text
site_releases
release_validation_results
```

Optional later:

```text
content_revisions
release_content_snapshots
```

---

## User-facing private data

Keep the Phase 1 foundation:

```text
user_resumes
agent_runs
```

Agent execution remains dormant until later.

---

## Operations

```text
audit_logs
error_logs
feedback
analytics_events
```

---

# 30. Site Content Table

Suggested shape:

```text
site_content

id
key
value_json
type
description
group_name
updated_by
updated_at
```

Examples:

```text
home.hero.heading
home.hero.description
home.hero.primary_cta
home.hero.profile_image
contact.heading
contact.email
footer.copyright
```

`value_json` makes the binding system flexible.

---

# 31. Content Contract Registry

Studio should not be allowed to invent arbitrary Admin content keys without visibility.

We should maintain a content contract/field registry.

Example:

```text
home.hero.heading
Type: text
Required: true
Editable in Admin: true

home.hero.profile_image
Type: media
Required: false

site.social.github
Type: url
Required: false
```

This can be stored in code initially and later exposed dynamically.

The Studio binding picker reads this registry.

Admin uses the same registry to build suitable editors.

---

# 32. Authentication

Use Supabase Auth.

Roles:

```text
admin
user
```

Optionally later:

```text
designer
editor
```

For the first implementation:

- `admin` can access Admin CMS and Studio.
- `user` can access normal authenticated user areas.
- Public registration always creates `user`.
- Admin accounts are assigned securely.
- There is no public admin registration route.

---

# 33. Authorization

Security is enforced at multiple levels:

```text
UI route guard
+
backend authorization
+
database RLS
+
storage policy
```

Route guards alone are not security.

---

# 34. RLS

Maintain and improve the Phase 1 RLS work.

Rules should include:

- Public users can read only public/published runtime data.
- Public users cannot read Studio drafts.
- Normal authenticated users cannot read Studio drafts.
- Normal users cannot modify CMS data.
- Admin users can manage content.
- Authorized Studio users can manage design records.
- Users can access only their private resumes.
- Users cannot access another user's private application history.
- Service-role credentials never appear in frontend bundles.

---

# 35. Media Storage

Use separate storage concerns.

## Public CMS media

```text
media/
```

or a renamed:

```text
public-media/
```

Suitable for:

```text
portfolio images
project thumbnails
note images
logos
background videos
Studio design assets
```

## Private user files

```text
user-resumes/{userId}/...
```

Private bucket.

The existing private resume security work should be retained even though agent processing is deferred.

---

# 36. Media References

Layouts should prefer stable media IDs over embedding permanent storage URLs everywhere.

Example:

```json
{
  "type": "media",
  "mediaId": "uuid"
}
```

The backend/runtime resolves the public delivery URL.

This makes asset migration easier.

---

# 37. Monorepo

Keep one repository.

Target structure:

```text
dynamic-portfolio-platform/
│
├── apps/
│   ├── web/
│   │   └── Public portfolio + authenticated user UI
│   │
│   ├── admin/
│   │   └── Content + publishing + operations
│   │
│   ├── studio/
│   │   └── Visual UI/UX builder
│   │
│   └── api/
│       └── Common modular backend
│
├── packages/
│   ├── contracts/
│   │   ├── api
│   │   ├── content
│   │   ├── layout
│   │   └── release
│   │
│   ├── builder-core/
│   │   └── Studio-neutral block/layout model
│   │
│   ├── runtime-renderer/
│   │   └── Production layout renderer
│   │
│   ├── animation-runtime/
│   │   └── Shared animation execution engine
│   │
│   ├── ui/
│   │   └── Shared application UI primitives
│   │
│   ├── validation/
│   │   └── Zod schemas
│   │
│   └── supabase/
│       └── Shared typed Supabase client utilities
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── tests/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── LAYOUT_SCHEMA.md
│   ├── API_CONTRACTS.md
│   └── SECURITY.md
│
├── package.json
├── turbo.json
└── tsconfig.base.json
```

---

# 38. Shared Package Rules

Shared packages must contain platform contracts or genuinely reusable runtime code.

They must not become a way to secretly couple the three applications.

## `contracts`

No React UI.

Contains:

```text
TypeScript types
Zod schemas
API contracts
schema versions
binding types
release types
```

## `builder-core`

Contains:

```text
node model
tree operations
layout semantics
default element definitions
editor-neutral helpers
```

It must not import Admin or Public Web.

## `runtime-renderer`

Renders published layout schemas.

Used by:

```text
Public Web
Studio Preview
Admin Release Preview
```

This is important: Studio preview and Public Web should use the same rendering engine.

## `animation-runtime`

Contains production-safe animation interpretation.

It should not contain Studio property controls.

## `ui`

Shared buttons, inputs, modal primitives, loading states, etc.

Do not place entire Admin pages in this package.

---

# 39. Why Studio and Runtime Must Share Renderer Contracts

Studio preview must accurately represent production.

We should avoid:

```text
Studio has one renderer
Public Web has another renderer
```

Instead:

```text
Studio Canvas Editor
        │
        ├── editing overlays
        │
        ▼
Runtime Renderer
        ▲
        │
Public Web
```

Studio wraps the production renderer with editor controls.

This eliminates many preview-vs-production mismatches.

---

# 40. Deployment

Each application has an independent build and deployment.

Suggested model:

```text
apps/web
→ Vercel
→ portfolio-domain.com

apps/admin
→ Vercel
→ admin.portfolio-domain.com

apps/studio
→ Vercel
→ studio.portfolio-domain.com

apps/api
→ Railway / Render / Fly / suitable Node platform
→ api.portfolio-domain.com

Supabase
→ PostgreSQL + Auth + Storage + RLS
```

A Studio deployment can happen without redeploying Web.

An Admin deployment can happen without redeploying Studio.

An API deployment should maintain backward-compatible contracts when possible.

---

# 41. Environment Separation

Use at least:

```text
local
production
```

Prefer eventually:

```text
local
staging
production
```

Each environment has separate:

```text
database configuration
storage
API URL
frontend URLs
allowed origins
release state
```

Do not test risky Studio migrations directly against production data.

---

# 42. CORS and Origin Rules

The backend should explicitly allow known application origins.

Example:

```text
https://portfolio-domain.com
https://admin.portfolio-domain.com
https://studio.portfolio-domain.com
```

Do not use unrestricted production CORS.

---

# 43. Observability

Add platform-level monitoring before launch.

Track:

```text
API failures
database failures
layout validation failures
release activation failures
broken bindings
missing media
render failures
authentication failures
slow API routes
404 routes
client runtime errors
```

Do not make analytics dependent on future AI phases.

---

# 44. Audit Log

Record important administrative actions:

```text
project created
project updated
project deleted
note published
content key changed
layout published
release created
release activated
release rolled back
user role changed
media deleted
site setting changed
```

Suggested fields:

```text
id
actor_user_id
action
resource_type
resource_id
before_json
after_json
metadata
created_at
```

---

# 45. Performance Strategy

Public Web should be optimized separately from Studio.

Studio may be heavy.

Public Web must not ship Studio dependencies such as:

```text
drag-and-drop libraries
property editor code
canvas editing state
Studio history engine
editor-only panels
```

Public Web should load only:

```text
runtime renderer
animation runtime
public UI
auth/user functionality
```

Use:

```text
lazy loading
code splitting
media optimization
runtime manifest caching
content caching
route-level splitting
reduced-motion support
```

---

# 46. Animation Performance Rules

Advanced animation is allowed, but Studio must help produce performant output.

Rules:

- Prefer transforms and opacity for continuous animation.
- Avoid unnecessary layout-triggering animation.
- Use `will-change` selectively.
- Pause offscreen continuous effects where possible.
- Provide mobile fallbacks.
- Respect `prefers-reduced-motion`.
- Avoid multiple competing scroll controllers.
- Avoid per-frame React state for visual animation.
- Keep scroll calculations outside React render cycles where possible.
- Use one consistent animation runtime contract.
- Validate impossible or dangerous combinations in Studio.

---

# 47. Homepage Stacking Animation — New Treatment

The current homepage animation is not discarded as a design.

It is discarded as a **hard-coded architectural special case**.

We will recreate it later using Studio primitives:

```text
Hero
Journey
Projects
Tech Stack
About
Contact / CTA
```

Each relevant section can use:

```text
scrollBehavior: stack-over-previous
```

The runtime renderer/animation runtime implements the effect generically.

This makes the feature reusable on any page.

---

# 48. Error Boundaries

Each application needs separate failure behavior.

## Public Web

If a new release is invalid:

- It should never have been activated.
- Continue using the last valid active release.

If a non-critical binding is missing:

- Use configured fallback.
- Log the error.

If a required binding is missing:

- Activation should have been blocked.

## Admin

Show actionable validation failures.

## Studio

A broken node should not crash the entire editor.

Render an error placeholder for the node and preserve the remaining document.

---

# 49. Backward Compatibility

When shared contracts change:

1. Add a new schema version.
2. Keep the runtime capable of reading supported older versions.
3. Add migration functions where appropriate.
4. Do not mutate published layout versions.
5. Upgrade a layout by creating a new version.

---

# 50. AI Scope Decision

AI execution is explicitly **out of scope for the current roadmap**.

We are not currently implementing:

```text
Gemini Enterprise calls
agent provider adapters
RAG
pgvector ingestion
embedding workers
agent streaming
job search
token accounting
AI cost tracking
AI daily quotas
```

We may keep database foundations that already exist if they do not interfere with the current architecture.

The UI can expose AI Apps as:

```text
Coming Soon
```

or hide them.

When AI development resumes, it will plug into the existing platform through a new backend domain rather than changing the Public/Admin/Studio architecture.

---

# 51. Current Codebase — What We Keep

The current ZIP is the migration source.

Useful existing assets include:

```text
builder-core
builder-renderer
validation
ui package
Supabase client configuration
AuthContext
admin/user route guards
private resume storage
RLS work
media library
block tree utilities
responsive styles
CSS property model
animation configuration model
3D/orbit/revolve configuration
drag/drop foundations
page builder UI ideas
public renderer concepts
```

We should not restart everything from an empty repository.

---

# 52. Current Codebase — What Changes

The current application combines:

```text
Public Web
Admin
Studio/Page Builder
User Dashboard
Runtime Renderer
```

inside one Vite application.

That architecture is retired.

Existing code will be moved into the appropriate application/package.

Examples:

```text
src/admin/PageBuilder.tsx
→ apps/studio

src/admin/PropertyEditor.tsx
→ apps/studio

src/admin/BlockPalette.tsx
→ apps/studio

packages/builder-core
→ retain and refactor

packages/builder-renderer
→ packages/runtime-renderer

src/pages/PublicPage.tsx
→ apps/web

src/pages/dashboard/*
→ apps/web

Admin content/media/security screens
→ apps/admin
```

Homepage-specific logic inside Public Web should be removed after its equivalent is implemented generically in the runtime.

---

# 53. Migration Rule

Do not attempt a giant one-time rewrite.

Migrate vertically while keeping the project runnable.

Every stage must leave us with a buildable system.

---

# 54. New Roadmap Overview

The active roadmap is now:

```text
PHASE 0 — Freeze + Architecture Baseline

PHASE 1 — Platform Separation
  1A Monorepo shell
  1B Shared contracts
  1C Public Web extraction
  1D Admin extraction
  1E Studio extraction
  1F Common API

PHASE 2 — Content Platform
  2A Structured database
  2B Admin content managers
  2C Content binding registry
  2D Dynamic public content

PHASE 3 — Design Platform
  3A Layout/version system
  3B Studio canvas
  3C Style system
  3D Animation runtime
  3E Collection/repeater system
  3F Navbar/footer
  3G Responsive tooling

PHASE 4 — Publishing Platform
  4A Validation
  4B Layout publishing
  4C Release creation
  4D Admin activation
  4E Public runtime manifest
  4F Rollback

PHASE 5 — Rebuild Portfolio in Studio
  5A Cosmic layout
  5B Homepage
  5C Stacking scroll
  5D Projects
  5E Notes
  5F Apps
  5G Remaining pages

PHASE 6 — Production Controls
  6A Security hardening
  6B Audit logs
  6C Monitoring
  6D Media validation
  6E Privacy controls
  6F Analytics
  6G Performance
  6H Backups/recovery

FUTURE — AI Platform
```

---

# 55. Phase 0 — Freeze and Baseline

## Goal

Stop adding architecture-specific homepage patches to the current combined application.

## Work

- Save the current ZIP as a migration checkpoint.
- Tag the current source if Git is available.
- Preserve existing Supabase migrations.
- Document current tables and buckets.
- Document current auth flow.
- Document current public routes.
- Document builder node model.
- Confirm current project builds.
- Create this architecture document in the repository.

## Done when

We can always return to the current state and know exactly what we are migrating.

---

# 56. Phase 1 — Platform Separation

This is the next implementation phase.

## 1A. Create monorepo shell

Create:

```text
apps/web
apps/admin
apps/studio
apps/api
packages/contracts
packages/builder-core
packages/runtime-renderer
packages/animation-runtime
packages/ui
packages/validation
```

Add workspace tooling.

Do not rewrite behavior yet.

---

## 1B. Create shared contracts

Move/create versioned types for:

```text
User role
Media
Projects
Notes
Experience
AI App catalog
Studio node
Animation
Layout
Layout version
Layout page
Binding
Release
Runtime manifest
```

Use Zod for runtime validation.

---

## 1C. Extract Public Web

Move:

```text
PublicPage
Login
Register
User Dashboard
User Resumes
Account Settings
```

into `apps/web`.

Remove all Admin routes and editing code from the Web bundle.

At this stage Public Web may still read the legacy page structure temporarily through a compatibility adapter.

---

## 1D. Extract Admin

Move:

```text
Admin login
Admin shell
Media management
Admin dashboard
```

into `apps/admin`.

Do **not** move PageBuilder/PropertyEditor into Admin.

---

## 1E. Extract Studio

Move:

```text
PageBuilder
PropertyEditor
BlockPalette
Chrome editor ideas
drag/drop
animation editor
canvas
```

into `apps/studio`.

Studio gets its own route shell and authentication guard.

---

## 1F. Create API

Create `apps/api`.

First endpoints:

```text
GET /health
GET /api/public/runtime
GET /api/admin/me
GET /api/studio/me
```

Then incrementally move trusted write operations behind it.

---

## Phase 1 done when

- Web, Admin, Studio, and API run independently.
- All three frontends authenticate correctly.
- Admin/Studio reject normal users.
- Web contains no Studio editor code.
- Admin contains no Studio editor.
- Shared packages build.
- Legacy site can still render during migration.

---

# 57. Phase 2 — Content Platform

## Goal

Make Admin the definitive owner of application content.

## 2A. Database migrations

Create/refine:

```text
projects
notes
experiences
ai_apps
site_content
site_settings
media
audit_logs
```

Do not delete legacy tables immediately.

---

## 2B. Admin managers

Build complete CRUD for:

```text
Projects
Notes
Experience
AI Apps
Site Content
Media
Site Settings
```

Features:

```text
draft/published where appropriate
featured
display order
preview
SEO
validation
```

---

## 2C. Binding registry

Implement shared binding contracts.

Admin provides editable values.

Studio can inspect available keys and data types.

---

## 2D. Public structured routes

Public Web renders structured data independently of the Studio migration.

Examples:

```text
/projects
/projects/:slug
/notes
/notes/:slug
/apps
```

## Phase 2 done when

Changing a project, note, experience, hero text, or app entry in Admin updates public data without editing layout JSON.

---

# 58. Phase 3 — Design Platform

## Goal

Turn the existing builder into the dedicated UI/UX Studio.

## 3A. Layout management

Implement:

```text
Create Layout
Duplicate
Archive
Versions
Draft
Publish
```

---

## 3B. Page system

Implement per-layout pages.

Studio can:

```text
create
rename
reorder
duplicate
delete
set page type
configure route
```

---

## 3C. Canvas foundation

Stabilize:

```text
nested drag/drop
reordering
selection
resize
flow/absolute modes
layers tree
desktop/tablet/mobile
undo/redo
copy/duplicate/delete
```

Do this before adding more fancy animation effects.

---

## 3D. Complete style controls

Expose the CSS capabilities already represented in builder-core.

Do not create separate implementation logic for every property.

Properties update the generic schema.

---

## 3E. Content bindings

Allow elements to bind text/images/links to Admin content.

Add a binding picker.

Studio preview resolves real or preview data.

---

## 3F. Collections

Create:

```text
Project collection
Notes collection
Experience collection
Apps collection
Generic repeater foundation
```

---

## 3G. Animation runtime

Extract animation execution into `packages/animation-runtime`.

Studio edits configuration.

Runtime executes configuration.

---

## 3H. Section scroll behavior

Implement generic:

```text
normal
sticky
pin
stack-over-previous
parallax
horizontal
reveal
```

Test with simple sections before rebuilding the homepage.

---

## 3I. Navbar/Footer

Move them to the same generic node/layout system.

They must support images, nested elements, animation, responsive design, and mobile navigation.

---

## Phase 3 done when

A new complete website layout can be created in Studio without writing a custom React homepage.

---

# 59. Phase 4 — Publishing Platform

## Goal

Make design publishing safe and controlled.

## 4A. Schema validation

Every Studio save validates basic structure.

Publishing performs strict validation.

---

## 4B. Publish layout version

Publishing:

- Locks the version.
- Records schema version.
- Records runtime compatibility.
- Creates validation results.
- Makes the version visible in Admin Layout Library.

It does not activate it.

---

## 4C. Admin preview

Admin can preview a published layout with current content before activation.

The preview uses `runtime-renderer`.

---

## 4D. Create site release

Admin selects:

```text
published layout version
current approved content
settings
```

and creates a release candidate.

---

## 4E. Activate

Perform atomic activation.

Invalidate runtime cache.

Public Web resolves the new release.

---

## 4F. Rollback

Allow Admin to reactivate a prior compatible release.

---

## Phase 4 done when

Studio can publish multiple layout versions, Admin can choose one, and Public Web changes only after deliberate release activation.

---

# 60. Phase 5 — Rebuild the Actual Portfolio Using Studio

Only after the platform works do we recreate the portfolio design.

## 5A. Create first production layout

```text
Cosmic Portfolio
```

---

## 5B. Homepage

Build using Studio primitives.

Suggested sections:

```text
Hero
Journey / Experience
Projects
Tech Stack
About
Contact / CTA
Footer
```

---

## 5C. Recreate stacked scroll

Use the new generic `stack-over-previous` behavior.

Requirements:

- No premature next-section reveal.
- No overlay/video column breakage.
- Smooth reverse scrolling.
- No huge spacer before contact.
- Mobile fallback.
- Reduced-motion fallback.
- No per-frame React rendering.
- Stable section height computation.
- Clean release after final section.

The design should no longer require a homepage-specific React patch.

---

## 5D. Projects

Studio controls listing/detail presentation.

Admin controls records.

---

## 5E. Notes

Studio controls listing/detail presentation.

Admin controls records.

---

## 5F. Apps

Studio controls gallery presentation.

Admin controls which apps are visible and their status.

Actual AI execution remains deferred.

---

## Phase 5 done when

The entire live portfolio can be visually redesigned in Studio, its content controlled from Admin, and its active design switched through releases.

---

# 61. Phase 6 — Production Controls

This phase includes only controls relevant before AI execution.

## Security hardening

- Review RLS on every table.
- Review storage policies.
- Verify admin role checks in API.
- Secure CORS.
- Remove public admin signup.
- Verify secrets never enter browser bundles.
- Add request validation.

## Email verification

Require verification for sensitive authenticated actions where appropriate.

## Bot protection

For registration/contact/user-facing forms:

```text
CAPTCHA or equivalent
rate limiting
abuse detection
```

## Upload validation

Validate:

```text
file extension
MIME type
file size
ownership
filename
storage quota
```

## Error monitoring

Track frontend and backend failures.

## Audit logs

Finish platform audit coverage.

## Privacy controls

Users can:

```text
delete resume
delete account
delete private user history when applicable
```

## Admin analytics

Initial analytics can include:

```text
total users
verified users
published projects
published notes
published apps
active layout
release history
storage usage
runtime errors
page traffic if analytics provider is added
```

AI-specific token/cost analytics are deferred.

## Backup/recovery

Document:

```text
database backup strategy
storage recovery expectations
release rollback
migration recovery
```

## Performance

Measure:

```text
LCP
CLS
INP
bundle size
runtime render time
animation smoothness
media load time
API latency
```

## Scaling and resilience readiness

The production API must remain stateless and horizontally scalable. Shared counters/quotas belong in shared infrastructure rather than one Node process. Production deployment should support:

```text
CDN / managed DDoS protection / WAF
        ↓
load balancer or hosting edge
        ↓
multiple interchangeable API instances
        ↓
Supabase database + object storage + shared security counters
```

Add liveness/readiness checks, graceful shutdown, bounded request/header timeouts, safe caching for immutable Active-release responses, structured monitoring, staging load tests and autoscaling when traffic justifies it. Do not add Redis/queues/PM2/Kubernetes merely for appearance; introduce them when the workload actually requires shared cache, background jobs, CPU isolation or host-level multi-process operation.

## SEO and crawl controls

Only Public Web is indexable. Admin and Studio must be `noindex`. Public SEO must be generated from the Active release so drafts and published-but-not-activated content cannot leak into search metadata. Support:

```text
title + description
canonical URL
Open Graph / social cards
robots directives
sitemap.xml
robots.txt
JSON-LD structured data
per-route noindex
collection-detail metadata
```

Where the public host is SPA-based, provide server/edge-rendered metadata so crawlers and social preview bots do not depend on client JavaScript execution.

---

# 62. Future AI Platform

When we intentionally resume AI development, add backend modules without changing the three-frontend architecture.

Future flow:

```text
Public Web
    ↓
Platform API
    ↓
Agent Runtime
    ↓
Provider Adapter
    ↓
Gemini / Other Provider
```

Possible future backend domains:

```text
agents
agent-runs
agent-sessions
provider-adapters
rag
retrieval
embeddings
usage
quotas
cost
feedback
```

Admin gains agent configuration.

Studio continues to control how AI application pages look.

Public Web provides the runner UI.

The architectural separation remains unchanged.

---

# 63. Dependency Direction

Allowed dependencies:

```text
apps/web ───────────────┐
apps/admin ─────────────┼──> shared packages
apps/studio ────────────┘

apps/api ─────────────────> contracts / validation

runtime-renderer ─────────> contracts / builder-core / animation-runtime
studio ───────────────────> runtime-renderer
web ──────────────────────> runtime-renderer
```

Forbidden dependencies:

```text
web → admin
web → studio
admin → studio implementation
studio → admin implementation

runtime-renderer → studio UI
builder-core → React admin pages
contracts → application UI
```

---

# 64. Ownership Matrix

| Concern | Public Web | Admin CMS | UI/UX Studio | Backend/Supabase |
|---|---|---|---|---|
| Display live site | Owns | No | Preview only | Supplies runtime |
| User login/register | Owns UI | Admin login only | Studio login only | Auth/security |
| Projects data | Reads | Owns CRUD | Binds/designs | Stores/validates |
| Notes data | Reads | Owns CRUD | Binds/designs | Stores/validates |
| Experience data | Reads | Owns CRUD | Binds/designs | Stores/validates |
| AI app catalog | Reads | Owns CRUD | Binds/designs | Stores/validates |
| Hero text/content | Reads | Owns values | Places/styles bindings | Stores |
| Pages in a layout | Renders | Views | Owns | Stores |
| Sections | Renders | Views | Owns | Stores |
| CSS/layout | Renders | Views | Owns | Stores |
| Animation config | Executes | Views | Owns | Stores/validates |
| Navbar/footer design | Renders | Values/settings | Owns design | Stores |
| Layout versions | Reads active | Selects | Creates/publishes | Stores |
| Choose live layout | No | Owns | No | Enforces |
| Release activation | Consumes | Owns action | No | Executes atomically |
| RLS | No | No | No | Owns |
| Private user files | User UI | Limited admin | No | Owns |
| Audit logs | No | Reads | Generates actions | Owns |
| Runtime compatibility | Enforces | Checks | Declares | Validates |

---

# 65. Non-Negotiable Rules

These rules should be treated as architecture constraints.

### Rule 1

Do not put the visual builder back inside Admin.

### Rule 2

Do not hard-code a portfolio section animation into Public Web when it can be represented as generic layout/animation data.

### Rule 3

Do not store projects, notes, experience, or AI app records only inside layout JSON.

### Rule 4

Studio publishing never changes the live site automatically.

### Rule 5

Only a published and runtime-compatible layout version can be included in a production release.

### Rule 6

Published layout versions and activated releases are immutable.

### Rule 7

Public Web must not ship Studio editor dependencies.

### Rule 8

Do not expose service-role keys or backend provider credentials to any frontend.

### Rule 9

Every sensitive database domain uses RLS and backend authorization where appropriate.

### Rule 10

Studio preview, Admin release preview, and Public Web should use the same production renderer.

### Rule 11

AI execution remains deferred until the content/design/release platform is stable.

### Rule 12

Existing useful code should be migrated, not rewritten without reason.

---

# 66. Immediate Next Work

The next coding work should **not** be another homepage stacking patch.

The next implementation milestone is:

```text
PHASE 1 — PLATFORM SEPARATION
```

The exact first sequence should be:

```text
1. Create monorepo workspace
2. Create apps/web
3. Create apps/admin
4. Create apps/studio
5. Create apps/api
6. Move shared contracts
7. Move builder-core
8. Extract runtime renderer
9. Move public routes to Web
10. Move Admin shell/media to Admin
11. Move builder to Studio
12. Restore all apps to buildable state
13. Verify auth and role separation
14. Add basic API health/runtime endpoints
```

Only after this is stable should we begin the structured content migrations.

---

# 67. Phase Gate Checklist

Do not move to the next major phase until the current gate passes.

## Gate A — Separation

```text
[ ] web builds independently
[ ] admin builds independently
[ ] studio builds independently
[ ] api builds independently
[ ] normal users cannot access admin/studio
[ ] public web contains no editor code
```

## Gate B — Content

```text
[ ] projects managed from Admin
[ ] notes managed from Admin
[ ] experience managed from Admin
[ ] AI app catalog managed from Admin
[ ] hero/site content managed from Admin
[ ] public routes consume structured data
```

## Gate C — Studio

```text
[ ] multiple layouts
[ ] multiple layout versions
[ ] pages per layout
[ ] nested drag/drop
[ ] responsive design
[ ] CSS controls
[ ] bindings
[ ] collections
[ ] generic animation runtime
[ ] navbar/footer
```

## Gate D — Publishing

```text
[ ] Studio publish
[ ] compatibility validation
[ ] Admin layout library
[ ] release preview
[ ] activation
[ ] rollback
[ ] public runtime manifest
```

## Gate E — Portfolio

```text
[ ] complete homepage built in Studio
[ ] stacking animation works generically
[ ] projects layout
[ ] notes layout
[ ] apps layout
[ ] responsive
[ ] performant
```

## Gate F — Production

```text
[ ] RLS audit
[ ] role audit
[ ] storage audit
[ ] error monitoring
[ ] audit logs
[ ] upload validation
[ ] privacy controls
[ ] backup plan
[ ] performance validation
```

---

# 68. Definition of Success

The architecture is working when all of the following are true:

A content change such as changing the Hero heading requires:

```text
Admin → edit content → publish/update
```

and no Studio/code change.

A design change such as moving the Hero image requires:

```text
Studio → edit layout → publish layout version
Admin → create/activate release
```

and no project-content edit.

Adding a new project requires:

```text
Admin → Projects → Add
```

and no Studio/code change.

Creating a completely different website design requires:

```text
Studio → New Layout
```

without affecting the currently active site.

Switching from one website design to another requires:

```text
Admin → Layout Library → Select → Preview → Activate
```

without a Web code deployment.

A bad Studio draft has zero effect on production.

A bad published layout that fails compatibility validation cannot be activated.

Public Web remains fast because Studio/editor code is not in its bundle.

A new generic Studio CSS control usually requires no Public Web change because it maps to the existing schema/runtime.

A truly new runtime capability can be introduced using a new compatible schema/runtime version without breaking existing releases.

That is the target platform.

---

# 69. Final Target

The final system is:

```text
UI/UX STUDIO
Designs the website
        │
        │ published layout versions
        ▼
ADMIN CMS
Controls content + chooses release
        │
        │ active site release
        ▼
PLATFORM BACKEND
Auth + validation + publishing + data
        │
        ▼
PUBLIC WEB
Renders the selected design with selected content
```

with:

```text
Supabase
PostgreSQL
Auth
RLS
Storage
```

underneath the platform.

This is now the canonical architecture for the project.

Any future implementation decision should be evaluated against this document before code is added.

If a proposed feature violates the ownership boundaries or non-negotiable rules above, the architecture should be updated deliberately first rather than bypassed with a one-off implementation.
