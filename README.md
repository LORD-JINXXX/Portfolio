# Dynamic Portfolio Platform

A production-oriented **content + design + publishing platform** for building and operating a dynamic developer portfolio.

The repository contains four independently deployable applications:

- **Public Web** — renders the active portfolio release.
- **Admin CMS** — manages content, media, settings, users, layouts, and releases.
- **UI/UX Studio** — visual website builder for responsive layouts, collections, and animation.
- **Platform API** — trusted backend for content, publishing, validation, media, security, and release delivery.

The platform is designed so that **content can change without editing the design**, **design can change without editing content**, and **production changes only when an Admin deliberately activates a release**.

---

## Table of Contents

- [Architecture](#architecture)
- [Key Capabilities](#key-capabilities)
- [Monorepo Structure](#monorepo-structure)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Database and Supabase](#database-and-supabase)
- [Running the Applications](#running-the-applications)
- [Development Scripts](#development-scripts)
- [Content and Studio Workflow](#content-and-studio-workflow)
- [Project Detail Architecture](#project-detail-architecture)
- [Responsive and Scroll Runtime](#responsive-and-scroll-runtime)
- [CSS and Animation System](#css-and-animation-system)
- [Release Workflow](#release-workflow)
- [Security Model](#security-model)
- [Testing and Production Gate](#testing-and-production-gate)
- [Deployment](#deployment)
- [Runtime Compatibility](#runtime-compatibility)
- [Repository Documentation](#repository-documentation)
- [Important Rules](#important-rules)

---

# Architecture

```text
                         ┌────────────────────┐
                         │     Admin CMS      │
                         │ Content / Releases │
                         └─────────┬──────────┘
                                   │
                                   │ authenticated API
                                   ▼
┌────────────────────┐      ┌────────────────────┐
│   UI/UX Studio     │◄────►│    Platform API    │
│ Design / Animation │      │ Auth / Data /      │
└─────────┬──────────┘      │ Publishing / Media │
          │                 └─────────┬──────────┘
          │                           │
          │ shared contracts/runtime  │
          ▼                           ▼
┌────────────────────┐      ┌────────────────────┐
│ Runtime Renderer   │      │      Supabase      │
└─────────┬──────────┘      │ PostgreSQL / Auth  │
          │                 │ Storage / RLS      │
          │                 └────────────────────┘
          ▼
┌───────────────────────────────────────────────┐
│                  Public Web                   │
│       Active immutable release manifest      │
└───────────────────────────────────────────────┘
```

The backend is a **modular monolith**, not a set of unnecessary backend microservices.

The four applications share versioned contracts and reusable packages, but each application has a clear responsibility.

For the full architecture, see:

```text
ARCHITECTURE.md
```

---

# Key Capabilities

## Admin CMS

Admin currently supports:

- Projects
- Notes
- Experience
- AI Apps catalog
- Site Content
- Site Settings
- Media management
- Custom Collections
- Structured nested arrays
- Layout Library
- Release management
- User/admin controls
- Publish/readiness validation
- Unsaved-change protection
- Shared modal editing
- Server-side search / filter / sort / pagination for structured resources
- Shared loading / refreshing / empty / error / retry states
- Direct resumable CMS media uploads with progress, cancel, and retry
- Media selection and validation

## UI/UX Studio

Studio supports:

- Multiple layouts
- Multiple pages
- Layout versions
- Responsive Desktop / Tablet / Mobile editing
- Nested element tree
- Generic HTML-style elements
- Collection bindings
- Collection filtering, search, sorting, and pagination
- Input/change interactions that can write event values into runtime state
- Visual Studio query authoring with an Advanced JSON escape hatch
- Runtime state
- Current / Parent / Root field contexts
- Named Collection repeats
- Current Item Array repeats
- Live Admin preview data
- Managed media
- Advanced CSS authoring
- Responsive CSS variables
- Scroll behaviors
- Reusable keyframes
- Generic Decoration layers
- Runtime Preview
- Cinematic section choreography

## Public Runtime

Public Web supports:

- Active-release rendering
- Dynamic routes
- `/projects/:slug`
- Collection index/detail pages
- SEO
- Sitemap and robots support
- Responsive runtime resolution
- Nested collection/array rendering
- Managed media resolution
- Animation runtime
- Reduced-motion behavior
- Runtime state
- Client-side search / filter / sort / pagination over the immutable active-release snapshot
- Release-compatible rendering

---

# Monorepo Structure

```text
dynamic-portfolio-platform/
│
├── apps/
│   ├── web/                  # Public portfolio runtime
│   ├── admin/                # Admin CMS
│   ├── studio/               # UI/UX Studio
│   └── api/                  # Common trusted backend
│
├── packages/
│   ├── contracts/            # Shared TypeScript + Zod contracts
│   ├── builder-core/         # Editor-neutral layout/node model
│   ├── runtime-renderer/     # Production renderer
│   ├── animation-runtime/    # Shared animation definitions/runtime
│   ├── validation/           # Shared validation and CSS safety
│   ├── supabase/             # Shared Supabase utilities
│   └── ui/                   # Shared UI primitives
│
├── supabase/
│   └── migrations/           # Database migration history
│
├── scripts/                  # Lint/security/cleanup/repository utilities
├── tests/                    # Unit, integration, source and migration tests
│
├── README.md
├── ARCHITECTURE.md
├── PATCH_HISTORY.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── turbo.json
```

---

# Technology Stack

## Frontend

- React 18
- TypeScript
- Vite
- React Router
- Shared runtime renderer
- Responsive CSS/style maps

## Backend

- Node.js
- Express
- TypeScript
- Zod-based validation
- Supabase client

## Data / Infrastructure

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Database RPCs for atomic operations

## Tooling

- npm workspaces
- Turborepo
- TypeScript
- custom source/security checks
- Node test runner

The repository currently also contains Playwright browser-regression infrastructure if it has not been intentionally removed after final production verification.

---

# Prerequisites

Use:

```text
Node.js >=20.19.0 <23
npm 10+
```

For local Supabase:

- Docker Desktop or another compatible Docker runtime
- Supabase CLI

Check your versions:

```powershell
node --version
npm --version
docker version
npx supabase --version
```

---

# Quick Start

## 1. Install dependencies

For a clean reproducible install:

```powershell
npm ci
```

For normal local dependency updates:

```powershell
npm install
```

## 2. Configure environment files

Copy each example:

```text
apps/api/.env.example
→ apps/api/.env

apps/web/.env.example
→ apps/web/.env

apps/admin/.env.example
→ apps/admin/.env

apps/studio/.env.example
→ apps/studio/.env
```

Fill the required Supabase and API values.

Never commit real `.env` files.

## 3. Apply database migrations

For a linked Supabase project:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Review the pending migrations before applying them.

Then:

```powershell
npx supabase db push --linked
```

Do not manually apply only the newest migration to an empty database. Migrations are intended to run in filename order.

The current migration history includes production hardening through:

```text
20260817002100_patch_06_content_release_integrity.sql
```

## 4. Start the platform

Run all workspaces:

```powershell
npm run dev
```

Or start them independently:

```powershell
npm run dev:web
npm run dev:admin
npm run dev:studio
npm run dev:api
```

Default local URLs:

| Application | URL |
|---|---|
| Public Web | `http://localhost:3000` |
| Admin CMS | `http://localhost:3001` |
| UI/UX Studio | `http://localhost:3002` |
| Platform API | `http://localhost:4000` |

---

# Environment Configuration

## Platform API

Start from:

```text
apps/api/.env.example
```

Important values:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

PORT=4000
NODE_ENV=development
DEV_BYPASS_AUTH=false

PUBLIC_WEB_RUNTIME_VERSION=1.5.0
PUBLIC_SITE_URL=http://localhost:3000

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

### Security configuration

Local/development defaults may use:

```env
SECURITY_MODE=development
RATE_LIMIT_STORE=memory
REQUIRE_PRIVILEGED_AAL2=false
```

Production should use appropriately configured values such as:

```env
SECURITY_MODE=strict
RATE_LIMIT_STORE=supabase
REQUIRE_PRIVILEGED_AAL2=true
RATE_LIMIT_HASH_SECRET=<secure-random-secret>
TRUST_PROXY_HOPS=<actual-hosting-proxy-hop-count>
```

Do not guess `TRUST_PROXY_HOPS`.

---

## Public Web

Start from:

```text
apps/web/.env.example
```

Typical local values:

```env
VITE_API_URL=http://localhost:4000

VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

PLATFORM_API_URL=http://localhost:4000
PUBLIC_SITE_URL=http://localhost:3000
VITE_PUBLIC_SITE_URL=http://localhost:3000
```

Production password/auth flows may also require:

```env
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...
```

---

## Admin and Studio

Both use frontend-safe values only:

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Production may also require:

```env
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...
```

### Never expose this in frontend variables

```text
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key belongs **only** in the trusted API environment.

---

# Database and Supabase

The platform uses Supabase for:

- PostgreSQL
- authentication
- object storage
- RLS
- database-side transactional/RPC operations

For local Supabase:

```powershell
npx supabase start
```

Make sure Docker is running first.

Important data domains include:

```text
Projects
Notes
Experience
AI Apps
Site Content
Site Settings
Media
Layouts
Layout Versions
Layout Pages
Releases
Custom Collection Definitions
Custom Collection Items
Audit/Security data
```

Do not move business records into arbitrary Studio layout JSON.

Studio stores **presentation**.

Admin/database stores **content/application records**.

## Query and pagination model

Structured Admin resources (`projects`, `notes`, `experience`, `apps`) use an allowlisted server-side list API:

```text
q + page + pageSize + sort + direction + filter.<field>
        ↓
Supabase/PostgREST query
        ↓
{ data, meta }
```

The API bounds page size and page number, sanitizes the substring search term, allows only configured sort/filter fields, and adds `id` as a deterministic secondary order for offset pagination. Database indexes target the default `display_order` path and exact Admin filters.

The Public Web intentionally uses a different strategy: collection search/filter/sort/pagination runs against the **active release snapshot already delivered to the runtime**. It does not query mutable Admin rows on each keystroke.

## Media storage model

Keep media bytes out of PostgreSQL rows and out of Redis. The canonical split is:

```text
Supabase PostgreSQL
  media metadata + stable media IDs + storage paths

Supabase Storage
  image / video / audio / document bytes
```

Admin uploads use an authenticated prepare → direct resumable Storage upload → verified finalize flow. The API validates the completed object before inserting the canonical `media` row.

---

# Running the Applications

## All applications

```powershell
npm run dev
```

## Public Web only

```powershell
npm run dev:web
```

## Admin only

```powershell
npm run dev:admin
```

## Studio only

```powershell
npm run dev:studio
```

## API only

```powershell
npm run dev:api
```

---

# Development Scripts

## Build everything

```powershell
npm run build
```

Individual builds:

```powershell
npm run build:web
npm run build:admin
npm run build:studio
npm run build:api
```

## TypeScript

```powershell
npm run typecheck
```

## Lint / static validation

```powershell
npm run lint
```

The root lint command includes:

```text
source checks
+
static/source integration checks
+
workspace TypeScript checks
```

For lighter checks:

```powershell
npm run lint:source
npm run test:static
```

## Test suite

```powershell
npm test
```

Additional checks:

```powershell
npm run test:security
npm run test:load-smoke
```

## Clean generated workspace output

```powershell
npm run clean
```

More aggressive clean:

```powershell
npm run clean:all
```

---

# Content and Studio Workflow

The system deliberately separates content from presentation.

Example:

```text
Admin
  ↓
Project record
  ↓
Studio Collection binding
  ↓
Runtime Renderer
  ↓
Public Web
```

A content change such as a Project title should normally require:

```text
Admin → Edit Project
```

not a Studio layout change.

A visual change such as changing the Project card layout should require:

```text
Studio → Edit layout
```

not a Project record edit.

---

# Project Detail Architecture

Projects remain the canonical records.

```text
Projects
├── slug
├── title
├── descriptions
├── thumbnail_media_id
├── gallery_media
├── gallery_media_ids
├── technologies
├── github_url
├── live_url
└── seo
```

Additional case-study metadata belongs in:

```text
Project Details
```

Relationship:

```text
Projects.slug
        ↓
Project Details.project_slug
```

Project Details may contain:

```text
project_type
status
role
company
version
package_url
documentation_url
license
blocks[]
```

One reusable Studio page renders:

```text
/projects/:slug
```

rather than creating a separate Studio page for every project.

## Nested repeat model

The runtime supports:

```text
Named Collection
Current Item Array
```

Example:

```text
Project
  ↓
Project Details
  ↓
blocks[]
```

Field scopes:

```text
Current
Parent
Root
```

This allows a nested block to read its own fields while still accessing the original Project.

---

# Responsive and Scroll Runtime

Responsive inheritance follows:

```text
Desktop
   ↓
Tablet overrides
   ↓
Mobile overrides
```

Free-position geometry is also responsive:

```text
x
y
width
height
rotation
zIndex
```

## Scroll behaviors

The runtime supports systems including:

```text
normal
sticky
pin
stack-over-previous
parallax
horizontal
reveal
card-deck
scene-transition
cinematic section sequences
```

Scroll/runtime effects are responsible for cleaning:

```text
RAF callbacks
listeners
observers
runtime classes
CSS variables
inline transforms
behavior-owned state
```

when behavior, breakpoint, page, or mounted node changes.

---

# CSS and Animation System

Studio exposes broad generic CSS primitives instead of hardcoding one feature for every visual effect.

Examples include:

- layout / flex / grid
- typography
- gradients
- borders
- shadows
- filters
- backdrop filters
- blend modes
- Transform / 3D
- transitions
- masks
- clipping
- border images
- motion paths
- CSS variables
- scroll CSS
- advanced safe CSS properties

## Reusable Keyframe Library

The platform supports structured reusable keyframes.

Starter concepts include:

```text
Float
Spin 360
Glow Pulse
Background Sweep
Mask Sweep
Path Travel
Angle 360
```

Keyframes are stored as structured data, not raw arbitrary stylesheet text.

## Decoration element

The generic `Decoration` node can be combined with normal CSS and reusable keyframes to create effects such as:

```text
comet borders
rotating conic borders
neon glows
scanner lines
shimmer overlays
animated masks
rotating rings
CSS loaders
spotlights
```

This avoids creating project-specific runtime effects for visuals CSS can already express.

## Runtime-driven animation remains appropriate for

Systems that genuinely require measurement, state, or coordinated scroll behavior remain runtime-driven.

Examples:

```text
Card Deck
cinematic sequence
runtime-state replay
active collection state
complex parallax
scroll geometry
```

---

# Release Workflow

Studio publishing and production activation are separate actions.

```text
Studio
  ↓
Publish layout version
  ↓
Admin
  ↓
Create release candidate
  ↓
Validate
  ↓
Preview
  ↓
Activate
  ↓
Public Web
```

Publishing a Studio layout **does not automatically change production**.

Only controlled Admin release activation changes the live site.

## Release candidate validation

The platform checks concepts such as:

- layout/runtime compatibility
- content bindings
- collection validity
- Custom Collection schema/data compatibility
- Project / Project Details relationships
- media availability
- certified release-media references
- page routes
- SEO/runtime requirements

## Immutable production

Public Web renders an **active immutable release manifest**.

It does not directly render current mutable Admin rows.

This enables:

- safe drafts
- release preview
- rollback
- repeatable production state
- protected historical media references

---

# Security Model

The platform uses layered security:

```text
UI route guards
+
server authorization
+
input validation
+
Supabase RLS
+
storage policy
+
release validation
```

Important rules:

- Public registration never creates Admin users.
- Admin/Studio access is authorized server-side.
- Service-role credentials are never exposed to browser applications.
- Production auth bypasses must remain disabled.
- Production CORS should allow only known origins.
- Uploads must be validated.
- Public Web uses certified release media.
- Admin and Studio should be `noindex`.

API health endpoints include:

```text
/health
/ready
```

---

# Testing and Production Gate

Core verification:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Security:

```powershell
npm run test:security
```

Static/source tests:

```powershell
npm run test:static
```

## Optional Playwright E2E

The stabilization branch included browser tests for:

- Desktop/Mobile responsive runtime
- Card Deck fallback
- Pin / Horizontal
- Project Detail slug routing
- nested blocks
- gallery media
- generic keyframes
- Decoration
- reduced motion
- cinematic breakpoint fallback
- Admin modal lifecycle

If Playwright infrastructure is still retained:

```powershell
npm run test:e2e
```

Install Chromium once with:

```powershell
npm run test:e2e:install
```

The final production stabilization run completed with:

```text
15 / 15 browser tests passed
```

If Playwright is intentionally removed after stabilization, remove its package scripts and E2E-only source assertions as part of the same cleanup.

---

# Deployment

The applications are independently deployable.

A typical deployment model:

```text
Public Web
→ Vercel / equivalent web host

Admin CMS
→ Vercel / equivalent web host

UI/UX Studio
→ Vercel / equivalent web host

Platform API
→ managed Node/container platform

Supabase
→ PostgreSQL + Auth + Storage
```

## Public Web production environment

Typical values:

```env
VITE_API_URL=https://api.example.com
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...

PLATFORM_API_URL=https://api.example.com
PUBLIC_SITE_URL=https://www.example.com
VITE_PUBLIC_SITE_URL=https://www.example.com
```

The public host should return release-aware SEO metadata to crawlers without requiring client-side React execution.

## Admin / Studio production environment

```env
VITE_API_URL=https://api.example.com
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_CAPTCHA_PROVIDER=turnstile
VITE_CAPTCHA_SITE_KEY=...
```

Admin and Studio must not receive the Supabase service-role key.

## API production configuration

Production should use strict security settings and the deployed runtime version:

```env
NODE_ENV=production
DEV_BYPASS_AUTH=false

PUBLIC_WEB_RUNTIME_VERSION=1.5.0

SECURITY_MODE=strict
RATE_LIMIT_STORE=supabase
REQUIRE_PRIVILEGED_AAL2=true
```

Configure:

```text
PUBLIC_SITE_URL
ALLOWED_ORIGINS
TRUST_PROXY_HOPS
RATE_LIMIT_HASH_SECRET
Supabase credentials
rate limits
timeouts
cache controls
CMS_MEDIA_MAX_BYTES
```

for the actual infrastructure.

`CMS_MEDIA_MAX_BYTES` is the application ceiling for one CMS object; the configured Supabase Storage/bucket/plan ceiling still applies independently. Large CMS uploads travel directly from Admin to Storage using the resumable upload path rather than through the API JSON body.

---

# Runtime Compatibility

The current public runtime contract is:

```text
1.5.0
```

Keep:

```env
PUBLIC_WEB_RUNTIME_VERSION=1.5.0
```

when the corresponding runtime is deployed.

Admin release activation validates runtime compatibility so an unsupported layout cannot replace the working production release.

---

# Repository Documentation

Recommended permanent documentation:

```text
README.md
ARCHITECTURE.md
PATCH_HISTORY.md
```

### README.md

Installation, development, operation, and deployment overview.

### ARCHITECTURE.md

Canonical explanation of application ownership, data flow, runtime behavior, releases, Studio, Admin, and system boundaries.

### PATCH_HISTORY.md

Historical record of the production stabilization series.

Temporary handoff/progress/patch notes do not need to remain once their useful information has been consolidated.

---

# Important Rules

1. **Admin owns content; Studio owns presentation.**
2. **Public Web is a runtime, not an editor.**
3. **Do not move the visual builder back into Admin.**
4. **Do not store Projects/Notes/Experience only in layout JSON.**
5. **Studio publishing never silently changes production.**
6. **Admin controls release activation.**
7. **Active releases are immutable snapshots.**
8. **Public Web must not ship Studio editor code.**
9. **Shared contracts are versioned.**
10. **Studio Preview and Public Web use the shared runtime renderer.**
11. **CSS-capable visual effects should use generic CSS/keyframe primitives.**
12. **JavaScript runtime behavior should be reserved for state, measurement, scroll choreography, or generated structures.**
13. **Never expose service-role credentials to frontend applications.**
14. **Do not bulk-rewrite existing saved layouts merely because new capabilities exist.**
15. **Database migrations and release changes must be explicit and reviewable.**

---

# Current Production Baseline

The platform has completed its production stabilization series through:

```text
Patch 01
→ Patch 02
→ Patch 03
→ Patch 04
→ Patch 05
→ Patch 06
→ Patch 07
→ Patch 08
→ Patch 09
→ Patch 10
→ Patch 11
→ Patch 11A
→ Patch 11B
```

The final browser production verification completed successfully.

For exact historical changes, see:

```text
PATCH_HISTORY.md
```

For the full design and system model, see:

```text
ARCHITECTURE.md
```

---

## Project Status

**Dynamic Portfolio Platform: production-stabilized application baseline.**

Future work should build incrementally on this baseline and preserve existing releases, saved layouts, runtime contracts, and database integrity.
