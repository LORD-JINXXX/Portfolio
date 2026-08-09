Dynamic Portfolio Platform — Batch Execution Plan & Current Status

Date: 2026-08-10
Project: Dynamic Portfolio Platform
Canonical architecture: portfolio.md
Current stage: Phase 5 / Batch 41 repair gate; RG4A and RG4B1 complete; RG4B2 next
Purpose of this file: Single copyable source containing every implementation batch, what each batch is responsible for, and what has been implemented so far.

1. Final Target

The completed platform must support this workflow:

UI/UX STUDIO
    ↓
Design complete website using sample/dummy data
    ↓
Mark content as:
Static / Editable Content / Site Setting / Media / Collection
    ↓
Save real layout + pages + trees
    ↓
Publish immutable layout version
    ↓

ADMIN → LAYOUTS
    ↓
See published layouts as visual cards
    ↓
Preview complete layouts using dummy/sample content
    ↓
Choose a layout to configure
    ↓

ADMIN → SITE CONTENT
    ↓
See Header + Pages + Footer as visual tabs
    ↓
See the actual selected website UI
    ↓
Click editable text/image/button/etc.
    ↓
Enter real content
    ↓
Save Draft
    ↓
Publish Content Revision
    ↓

ADMIN → RELEASES
    ↓
Layout Version + Content Revision + Settings Revision
    ↓
Validate
    ↓
Preview
    ↓
Activate atomically
    ↓

PUBLIC WEB
    ↓
Loads runtime manifest
    ↓
Uses the same runtime renderer
    ↓
Displays selected design + real content

The most important architecture rules are:

Studio owns design.

Admin owns real content and activation.

Public Web is only a runtime.

Studio publishing never changes the live website automatically.

Published layout versions are immutable.

Activated releases are immutable snapshots.

Studio Preview, Admin Preview, Admin Site Content and Public Web should converge on the same runtime renderer.

Structured data such as Projects, Notes, Experience and AI Apps must not live only inside layout JSON.

Supabase service-role/secret credentials must never be exposed to frontend applications.

AI execution remains out of scope until the content/design/release platform is stable.

2. Status Legend

IMPLEMENTED
Code for the batch has been added to the Phase-5 implementation.

IMPLEMENTED — NEEDS INTEGRATION VALIDATION
Code exists, but the complete real workflow has not yet been proven in the local environment.

FIX APPLIED DURING BATCH 41 SETUP
An issue was discovered during local testing and a correction was supplied/applied.

PENDING
Not yet completed or intentionally reserved for full integration testing.

3. Current Overall Status

Implementation status

Batch 1  → Batch 40
IMPLEMENTED in the Phase-5 codebase,
but the entire system has NOT yet been proven end-to-end.

Batch 41
IN PROGRESS — this is the complete integration test and repair gate.

Repair Group checkpoint:

Repair Group 1  ✅ COMPLETE
Repair Group 2  ✅ COMPLETE
Repair Group 3  ✅ COMPLETE
RG4A            ✅ COMPLETE
RG4B1           ✅ COMPLETE
RG4B2           ⏳ NEXT

Therefore the correct project status is:

PHASE 1–5 IMPLEMENTATION:
Substantially implemented through Batch 40.

PHASE 5 FINAL SIGN-OFF:
NOT complete yet.

Reason:
RG4B2 and later repair work remain in the Batch 41 repair program. RG3's complete
release activation/rollback browser gate has passed.

We should not call Phase 5 production-complete until Batch 41 passes.

4. Issues Already Discovered During Batch 41 Setup

These are important because they show why Batch 41 is required even though Batches 1–40 were implemented.

Supabase migration compatibility issue

The reused Supabase project already contained an older:

public.is_admin()

function.

The Phase-5 migration introduced another overload with a default parameter, creating an ambiguous PostgreSQL call.

Fix applied:

public.is_admin(uid uuid)

without a default argument, with policies calling:

public.is_admin(auth.uid())

The corrected migration successfully ran and returned:

No rows returned

which means the schema migration completed.

Status:

FIX APPLIED DURING BATCH 41 SETUP

Windows static-test path issue

The static test originally resolved the project root using URL pathname handling that produced:

D:\D:\...

on Windows.

Fix:

Use:

fileURLToPath(new URL('..', import.meta.url))

instead of converting the URL pathname through path.resolve().

Status:

FIX APPLIED DURING BATCH 41 SETUP

Local .env static-test issue

The static suite originally required local .env files not to exist.

That is incorrect during local development because:

apps/api/.env
apps/web/.env
apps/admin/.env
apps/studio/.env

are intentionally required locally.

The correct test should verify:

real .env files are Git ignored;

.env.example files are present;

secrets are not committed.

At that historical test run:

19 tests
18 passed
1 failed

and the remaining failure was this environment-file packaging assertion.

Status:

RESOLVED — the final Batch D baseline is 74/74 static tests and 159/159 full tests.

5. COMPLETE BATCH ROADMAP

BATCH 1 — Application Theme + Editor Stability

Goal

Stabilize Admin and Studio application UI before deeper platform work.

Work

Shared Admin/Studio application theme foundation.

Theme token normalization.

Six application themes:

Codex Black

GitHub Dark

GitHub Light

VS Code Dark

VS Code Light

Midnight

Separate Admin and Studio theme persistence.

Separate editor application theme from website layout/design theme.

Fix invisible theme options.

Fix missing CSS variables.

Remove hard-coded dark UI areas where practical.

Responsive Studio canvas width.

Real canvas zoom.

Responsive style inheritance.

Nested drag/drop fixes.

Prevent parent → descendant cycles.

Recursive duplicate IDs.

Better same-parent reorder logic.

Layers delete correctness.

Status

IMPLEMENTED — NEEDS INTEGRATION VALIDATION

BATCH 2 — Canonical Platform Contracts

Goal

Make packages/contracts the single source of truth for data crossing application/package boundaries.

Contracts

StudioNode

LayoutPage

Layout

LayoutVersion

Binding

ContentSlot

CollectionBinding

MediaBinding

StyleMap

ResponsiveStyles

AnimationConfig

ScrollBehavior

SiteRelease

RuntimeManifest

ContentRevision

Use Zod for runtime validation.

Required dependency direction

packages/contracts
      ↓
builder-core
runtime-renderer
animation-runtime
validation
Studio
Admin
API
Web

Avoid incompatible duplicate StudioNode definitions.

Status

IMPLEMENTED — NEEDS INTEGRATION VALIDATION

BATCH 3 — Database and Migration Foundation

Goal

Make the database schema reproducible and aligned with the platform architecture.

Domains

profiles

projects
notes
experiences
ai_apps
site_content
site_settings
media

layouts
layout_versions
layout_pages

content_revisions
settings_revisions
site_releases

layout_validation_results
release_validation_results

audit_logs

Constraints

page slug uniqueness per layout version;

valid layout/version relationships;

release relationships;

immutability support;

one active production release invariant;

RLS foundations;

storage buckets.

Storage

public-media
user-resumes

Status

IMPLEMENTED

Batch 41 correction

Migration compatibility with an existing public.is_admin() function was fixed.

BATCH 4 — API Authentication, Authorization and CORS

Goal

Make Admin and Studio APIs secure independently of frontend route guards.

Flow

Supabase access token
      ↓
API authentication
      ↓
profile role
      ↓
authorization

Roles

admin
user

Access

Admin:

/api/admin/*
/api/studio/*

Normal users must not access privileged mutations.

CORS

Development origins:

http://localhost:3000
http://localhost:3001
http://localhost:3002

Production origins must be explicitly configured.

Status

IMPLEMENTED — NEEDS INTEGRATION VALIDATION

BATCH 5 — Studio Layout + Page Persistence

Goal

Move Studio from primarily in-memory editing to persistent layouts/versions/pages.

Data path

Layout
   ↓
Draft Layout Version
   ↓
Layout Pages
   ↓
layout_tree

Page model

id
name
slug
pageType
routePattern
seo
sortOrder
layoutTree

Studio operations

create page;

rename page;

duplicate page;

delete page;

reorder page;

save;

reload.

Global layout regions

Header
Footer

must be persisted rather than fake preview-only UI.

Status

IMPLEMENTED — NEEDS REAL SAVE/REFRESH VALIDATION

BATCH 6 — Studio Content Slot / Binding System

Goal

Define what is design-owned versus Admin-editable.

Content sources

Static
Editable Content
Site Setting
Media
Collection Field

Editable content metadata

Admin Label
Content Key
Sample Value
Content Type
Required
Fallback
Description

Example:

Admin Label: Hero Heading
Key: home.hero.heading
Sample: Hero Heading
Type: text
Required: true

Initial content types

text
rich-text
url
number
boolean
media
button/link

Status

IMPLEMENTED — NEEDS STUDIO→ADMIN VALIDATION

BATCH 7 — Website Design Theme / Design Tokens

Goal

Keep website visual design completely independent from Admin/Studio application themes.

Layout design tokens

colors
typography
spacing
radius
shadows
custom variables

Example token names:

primary
secondary
background
surface
text
muted
accent
heading-font
body-font

Changing:

Studio Codex Black → Studio GitHub Light

must not recolor the website layout.

Status

IMPLEMENTED — NEEDS VISUAL VALIDATION

BATCH 8 — Unified Runtime Renderer

Goal

Use one production renderer wherever the website itself is rendered.

Consumers

Studio Preview
Admin Layout Preview
Admin Site Content
Admin Release Preview
Public Web

Renderer responsibilities

StudioNode tree;

standard HTML elements;

props;

responsive styles;

design tokens;

bindings;

media;

collections;

layout modes;

accessibility;

animations;

scroll behavior.

Wrappers

Studio adds editor controls.

Admin adds content-edit overlays.

Public Web adds no editing wrapper.

Status

IMPLEMENTED — HIGH-PRIORITY INTEGRATION VALIDATION REQUIRED

BATCH 9 — Studio Canvas Completion

Goal

Provide a capable generic website design canvas.

Features

nested drag/drop
flow layout
absolute positioning
resize
layers
selection
desktop/tablet/mobile
zoom
undo/redo
copy/paste
duplicate/delete
locking
visibility
z-index

Property categories

Dimensions
Spacing
Flex
Grid
Position
Typography
Background
Borders
Shadows
Media
Object fit
Object position
Transform
3D
Filters
Overflow
Transitions
Advanced CSS

Status

IMPLEMENTED TO PHASE-5 FOUNDATION LEVEL
NEEDS REAL DESIGN WORKFLOW VALIDATION

BATCH 10 — Animation Runtime Completion

Goal

Consolidate animation configuration and execution.

Normalize

easing
duration
delay
repeat
direction
trigger
stagger

Categories

Entrance
Hover
Continuous
Text
Mouse
Background
3D
Scroll

Performance rules

no per-frame React state for animation;

avoid multiple competing scroll engines;

pause unnecessary offscreen continuous effects;

respect prefers-reduced-motion;

provide mobile fallbacks.

Status

IMPLEMENTED TO FOUNDATION LEVEL — NEEDS VISUAL/RUNTIME TESTING

BATCH 11 — Section Scroll Runtime

Goal

Make homepage/section scroll behavior generic Studio data rather than hard-coded React.

Modes

normal
sticky
pin
stack-over-previous
parallax
horizontal
reveal

stack-over-previous

stickyTop
stackOrder
pinDistance
releaseBehavior
backgroundBehavior
mobileFallback
reducedMotionFallback

Status

IMPLEMENTED TO FOUNDATION LEVEL — REAL COSMIC SCROLL TESTING PENDING

BATCH 12 — Admin Structured Content Managers

Goal

Make Admin the owner of structured content.

Managers

Projects
Notes
Experience
AI Apps
Media
Site Settings

Projects

title
slug
descriptions
thumbnail
gallery
technologies
github_url
live_url
featured
published
display_order
SEO

Notes

title
slug
summary
content
category
tags
cover
featured
published
SEO

AI Apps

Catalog only.

No AI execution.

Statuses:

Coming Soon
Available
Maintenance
Disabled

Status

IMPLEMENTED — CRUD BEHAVIOR NEEDS LOCAL VALIDATION

BATCH 13 — Content Registry + Content Revisions

Goal

Connect Studio-defined editable slots to Admin-managed real content.

Registry metadata

content key
label
type
required
fallback
description

Revisions

Content Revision 1
Content Revision 2
Content Revision 3

Workflow:

Save Draft
→ Preview
→ Publish

Live site should not change on every Admin keystroke.

Status

IMPLEMENTED — END-TO-END VALIDATION PENDING

BATCH 14 — Layout Publishing + Immutability

Goal

Make Studio publishing safe.

Workflow

Draft Layout Version
→ Validate
→ Publish

Published versions:

cannot be directly edited;

cannot have their page trees silently mutated;

editing creates another draft version.

Example:

Cosmic v3 — Published
        ↓ Edit
Cosmic v4 — Draft

Status

IMPLEMENTED — API/DATABASE ENFORCEMENT NEEDS TESTING

BATCH 15 — Full Publication Validation Engine

Goal

Block invalid layouts from publication/activation.

Validate

schema version
runtime compatibility
page structure
route uniqueness
node IDs
tree cycles
required content slots
binding validity
media references
collection configuration
animation configuration
scroll configuration
header/footer
design tokens
unsupported node types

Severity

ERROR
WARNING
INFO

Errors block publication/activation.

Status

IMPLEMENTED TO CURRENT VALIDATION LEVEL — REAL CASE TESTS PENDING

BATCH 16 — Admin Layout Library

Goal

Turn Admin Layouts into the visual layout-selection experience.

Layout card

thumbnail
layout name
version
page count
compatibility
published date
active/configuring status
Preview
Configure

States

ACTIVE LIVE
CONFIGURING
INCOMPATIBLE

Critical rule

Configure
≠
Activate

Configuring a new layout must not replace the current live website.

Status

IMPLEMENTED — VISUAL/BEHAVIOR TESTING PENDING

BATCH 17 — Layout Screenshot/Thumbnail Generation

Goal

Provide meaningful previews in Admin Layout Library.

Initial strategy:

Home desktop preview
→ representative layout thumbnail

Later Studio may allow choosing another thumbnail.

Status

IMPLEMENTED TO FOUNDATION LEVEL — GENERATION/DELIVERY VALIDATION PENDING

BATCH 18 — Admin Full Layout Preview

Goal

Preview any published layout using Studio sample/dummy content.

Controls

Home / About / Projects / Notes / ...
Desktop / Tablet / Mobile

Must allow:

navigation
scrolling
animation
navbar/footer testing
responsive comparison

Important distinction

Layout Preview uses:

Studio sample/dummy content

not real Admin content.

Status

IMPLEMENTED — END-TO-END PREVIEW TEST PENDING

BATCH 19 — Admin Visual Site Content Editor

Goal

Make Site Content a visual CMS rather than a key/value table.

Tabs

Header
Home
About
Projects
Notes
Contact
Footer

Workflow

Render selected layout
→ click editable element
→ edit real content
→ save draft
→ publish content revision

Admin may edit content only.

Admin must not change:

CSS
layout
position
animation
responsive design

Those belong to Studio.

Status

IMPLEMENTED — MAJOR BATCH 41 VALIDATION TARGET

BATCH 20 — Inline Editing + Content Inspector

Goal

Improve Admin visual-content workflow.

Behaviors

Single click:

select content
→ right-side inspector

Double click:

quick inline editing

Inspector example

Hero Heading

Text:
Hi, I'm Mustafa.

Content key:
home.hero.heading

Required:
Yes

Status

IMPLEMENTED — UX VALIDATION PENDING

BATCH 21 — Admin Page/Section Navigator

Goal

Make long visual pages manageable.

Example:

HOME

Hero
Journey
Projects
Tech Stack
About
CTA

Clicking a section scrolls to that area.

Studio supplies section metadata such as:

Section Name
Admin Label

Status

IMPLEMENTED — VALIDATION PENDING

BATCH 22 — Collection / Repeater System

Goal

Render structured Admin content through Studio-designed templates.

Collections

Projects
Notes
Experience
AI Apps
Generic Collection

Example

Project Card

Image     → project.thumbnail
Heading   → project.title
Paragraph → project.shortDescription
Tags      → project.technologies
Button    → project.slug

Admin Site Content behavior

Clicking a collection should show collection configuration and:

Manage Projects

rather than editing every project record inline.

Status

IMPLEMENTED — COLLECTION RESOLUTION TESTING PENDING

BATCH 23 — Dynamic Detail Templates

Goal

Remove hard-coded detail page design.

Routes

/projects
/projects/:slug

/notes
/notes/:slug

Studio templates

Project Index
Project Detail Template
Notes Index
Note Detail Template

Contextual bindings:

project.title
project.description
project.gallery

note.title
note.content
...

Status

IMPLEMENTED — ROUTE/DATA TESTING PENDING

BATCH 24 — Navbar + Footer as True Layout Entities

Goal

Remove fake/hard-coded navbar/footer previews.

Studio controls:

structure
logo/image
nested navigation
buttons
dropdowns
responsive menu
mobile nav
sticky/fixed
animations

Admin controls only permitted values:

logo
social URLs
contact info
navigation destination values

Status

IMPLEMENTED TO CURRENT FOUNDATION — REAL LAYOUT TEST PENDING

BATCH 25 — Release Model + Immutable Content Snapshot

Goal

Make releases represent the complete website state.

A release combines:

Layout Version
+
Content Revision
+
Settings Revision
+
required collection/media snapshot references

Example:

Release 18

Layout:
Cosmic v4

Content:
Revision 11

Settings:
Revision 3

Rollback should restore the prior site rather than old design + current content.

Status

IMPLEMENTED — DATABASE/RUNTIME TESTING PENDING

BATCH 26 — Atomic Release Activation + Rollback

Goal

Guarantee safe activation and rollback.

Activation

validate candidate
       ↓
BEGIN TRANSACTION
       ↓
old active → superseded
new release → active
       ↓
COMMIT

Failure:

ROLLBACK

Old live release remains active.

Invariants

Never accidentally allow:

zero active releases because of partial activation
multiple active production releases

Status

IMPLEMENTED — CRITICAL BATCH 41 TEST TARGET

BATCH 27 — Runtime Manifest

Goal

Create a production-oriented Public Web bootstrap contract.

Example:

{
  "releaseId": "...",
  "layoutVersionId": "...",
  "schemaVersion": 1,
  "runtimeMinVersion": "1.0.0",
  "contentRevisionId": "...",
  "settingsRevisionId": "...",
  "routes": [],
  "navigation": {},
  "generatedAt": "..."
}

Endpoint:

GET /api/public/runtime

Public Web must not consume Studio editing state directly.

Status

IMPLEMENTED — RUNTIME VALIDATION PENDING

BATCH 28 — Public Web Runtime Conversion

Goal

Make Public Web render the active release instead of a hard-coded portfolio.

Runtime flow

load active runtime manifest
       ↓
resolve route
       ↓
load layout page
       ↓
load required content
       ↓
runtime-renderer

Code-owned system routes remain

/login
/register
/dashboard
/dashboard/settings

Success condition

Activating another layout changes the portfolio without redeploying apps/web.

Status

IMPLEMENTED — CRITICAL END-TO-END VALIDATION PENDING

BATCH 29 — Layout Content Compatibility

Goal

Safely switch between layouts with different content requirements.

Example:

Cosmic requires:

home.hero.heading
home.hero.description

Minimal requires:

home.hero.heading
home.hero.tagline

Admin should report:

✓ Hero Heading
✓ Description
⚠ Hero Tagline missing
ℹ Eyebrow unused

Required missing content blocks release activation.

Status

IMPLEMENTED — VALIDATION PENDING

BATCH 30 — Release Preview

Goal

Render the exact release candidate before activation.

Inputs

Layout Version
+
real Content Revision
+
Settings Revision
+
structured data snapshots

Difference

Layout Preview:

sample/dummy Studio content

Release Preview:

actual selected portfolio content

Status

IMPLEMENTED — CRITICAL TEST PENDING

BATCH 31 — Build Cosmic Portfolio: Global Structure

Goal

Create the first real production layout through Studio-native structures.

Layout

Cosmic Portfolio

Global areas

Header
Footer
Design Tokens
Desktop/Tablet/Mobile behavior

No homepage-specific React architecture should be required.

Status

IMPLEMENTED AS A COSMIC STARTER/TEMPLATE FOUNDATION
FINAL VISUAL DESIGN STILL REQUIRES REAL STUDIO WORK

BATCH 32 — Build Cosmic Homepage

Goal

Build the real homepage through Studio primitives.

Sections

Hero
Journey / Experience
Projects
Tech Stack
About
Contact / CTA

Hero direction

Potentially:

space background
planet
profile image
tech orbit
glitch
headline
description
CTAs

Use generic Studio/runtime capabilities wherever practical.

Status

IMPLEMENTED AS TEMPLATE/FOUNDATION
FINAL VISUAL AUTHORING AND POLISH STILL PENDING

BATCH 33 — Cosmic Stacking Scroll

Goal

Apply generic:

stack-over-previous

to the real homepage.

Requirements

no premature reveal
no flicker
no huge empty contact gap
smooth down-scroll
smooth reverse-scroll
correct backgrounds
no overlay/video column breakage
stable section heights
mobile fallback
reduced-motion fallback

Status

RUNTIME FOUNDATION IMPLEMENTED
REAL COSMIC VISUAL BEHAVIOR STILL REQUIRES BROWSER TESTING/POLISH

BATCH 34 — Cosmic Projects

Goal

Use Studio + Admin structured projects.

Build

Projects Listing
Project Card
Project Detail Template

Admin owns project records.

Studio owns design.

Verify

featured
ordering
responsive cards
animations
detail routes
SEO

Status

IMPLEMENTED AS PLATFORM/TEMPLATE FOUNDATION
REAL CONTENT + VISUAL POLISH PENDING

BATCH 35 — Cosmic Notes

Goal

Use Studio + Admin structured notes.

Build

Notes Listing
Note Card
Note Detail Template

Status

IMPLEMENTED AS PLATFORM/TEMPLATE FOUNDATION
REAL CONTENT + VISUAL POLISH PENDING

BATCH 36 — Cosmic Experience / Journey

Goal

Render structured Experience data through Studio-controlled Journey design.

Admin owns:

company
role
dates
summary
responsibilities
technologies

Studio owns:

timeline design
spacing
typography
animations
responsive presentation

Status

IMPLEMENTED AS PLATFORM/TEMPLATE FOUNDATION
REAL CONTENT + VISUAL POLISH PENDING

BATCH 37 — Cosmic AI Apps

Goal

Build AI Apps catalog/gallery presentation.

Admin controls:

name
description
cover
category
status
published
featured

AI execution remains deferred.

Valid status:

Coming Soon

Status

IMPLEMENTED AS CATALOG/TEMPLATE FOUNDATION
AI EXECUTION INTENTIONALLY NOT IMPLEMENTED

BATCH 38 — Cosmic About / Contact / Remaining Pages

Goal

Build ordinary remaining pages through Studio.

Examples:

About
Contact
Custom pages

Site Content owns editable values.

Studio owns visual design.

Status

IMPLEMENTED AS TEMPLATE/PAGE FOUNDATION
FINAL VISUAL AUTHORING PENDING

BATCH 39 — SEO + Page Metadata

Goal

Support metadata for dynamic Studio-driven pages.

Metadata

title
description
OG image
canonical behavior
index/noindex

Studio supplies defaults.

Admin/structured content can supply record-specific overrides.

Status

IMPLEMENTED — BROWSER/ROUTE VALIDATION PENDING

BATCH 40 — Phase 1–5 Automated Validation Tests

Goal

Provide automated guards before the final integration gate.

Minimum validation areas

tree operations
recursive duplicate
nested move
cycle prevention
responsive inheritance
binding validation
content slot resolution
collection resolution
layout publishing
published immutability
release validation
atomic activation
rollback
runtime manifest
route resolution
theme completeness
package boundaries
secret/environment hygiene

Smoke-test targets

Studio save/reload
Admin configure content
Layout preview
Release preview
Public render

Current observed local state

After Windows path correction:

tests 19
pass 18
fail 1

Remaining issue:

"no real environment secret file is packaged"

This test needs to be changed for local development so it checks Git ignore/example-file hygiene rather than requiring local .env files not to exist.

Status

IMPLEMENTED
CURRENTLY BEING VALIDATED/FIXED DURING BATCH 41 SETUP

BATCH 41 — Final Phase 5 Integration / Gate

Status

PENDING

This is the batch we are entering now.

No new major feature should be added here unless a missing implementation is discovered.

The purpose is to test the real system from beginning to end and fix root causes.

6. Batch 41 Test Sequence

Run in this order.

Stage 1 — Source tests

npm run test:static

Expected:

all static/invariant tests pass

Then:

npm test

Then:

npm run typecheck

Then:

npm run build

Do not ignore failures.

Fix one logical problem group at a time.

Stage 2 — Start the platform

npm run dev

Expected local services:

Public Web
http://localhost:3000

Admin CMS
http://localhost:3001

UI/UX Studio
http://localhost:3002

Platform API
http://localhost:4000

Check:

http://localhost:4000/health

Stage 3 — Authentication

Verify:

normal user
→ cannot access Admin/Studio privileged APIs

admin user
→ can access Admin/Studio

Verify service-role/secret credentials exist only in API environment configuration.

Stage 4 — Scenario A: Create a layout

Studio
→ Create Test/Cosmic Layout
→ Create Home/About/etc.
→ Design Header/Footer
→ Add editable Hero Heading
→ Save
→ Refresh browser
→ Everything remains
→ Validate
→ Publish

Pass condition:

Layout persistence and immutable publication work.

Stage 5 — Scenario B: Admin layout discovery

Admin → Layouts
→ Published card appears
→ thumbnail appears
→ Preview
→ dummy/sample design renders

Pass condition:

Admin can compare published layouts without affecting live production.

Stage 6 — Scenario C: Configure without changing live site

Configure Layout
→ Site Content
→ Home
→ click Hero Heading
→ change to real text
→ Save Draft

Pass condition:

Current live website remains unchanged.

Stage 7 — Scenario D: Publish content

Admin
→ Publish Content Revision

Pass condition:

Content revision becomes immutable and selectable for a release.

Stage 8 — Scenario E: Release preview

Create release candidate
→ selected layout version
→ content revision
→ settings revision
→ validate
→ preview

Pass condition:

Release preview matches expected production rendering.

Stage 9 — Scenario F: Activate

Activate Release

Pass condition:

activation is atomic;

exactly one active production release exists;

Public Web updates;

no apps/web redeployment is required.

Stage 10 — Scenario G: Switch layouts

Studio
→ create/publish second layout

Admin
→ Configure second layout
→ fill missing content
→ preview
→ create release
→ activate

Pass condition:

First layout is not destroyed.

Stage 11 — Scenario H: Rollback

Admin → Releases
→ previous release
→ Rollback

Pass condition:

Previous design + content + settings return correctly.

7. Phase 5 Completion Criteria

Phase 5 is complete only when all of the following are proven in the real environment:

[ ] test:static passes
[ ] npm test passes
[ ] TypeScript passes
[ ] all apps build

[ ] API health works
[ ] authentication works
[ ] admin authorization works
[ ] studio authorization works

[ ] Studio layout creates successfully
[ ] Studio page tree persists
[ ] browser refresh restores Studio layout
[ ] content slots persist
[ ] responsive styles persist
[ ] animations persist
[ ] header/footer persist
[ ] Studio publish works
[ ] published version is immutable

[ ] Admin Layout Library displays published layout
[ ] sample-data layout preview works
[ ] configuring layout does not activate it

[ ] Admin Site Content renders actual selected layout
[ ] editable content is clickable
[ ] real text changes save
[ ] image/media changes save
[ ] structured collection handoff works
[ ] content draft works
[ ] content publication works
[ ] content revision is immutable

[ ] release candidate creation works
[ ] validation works
[ ] release preview works
[ ] atomic activation works

[ ] Public Web loads RuntimeManifest
[ ] Public Web renders selected layout
[ ] Public Web renders real Admin content
[ ] dynamic routes work
[ ] Projects routes work
[ ] Notes routes work
[ ] SEO metadata resolves

[ ] second layout can be created
[ ] second layout can be configured without changing live site
[ ] second layout can be activated
[ ] rollback restores previous release

[ ] Studio application theme does not affect website design
[ ] Admin theme works across all components
[ ] Studio theme works across all components
[ ] Desktop/Tablet/Mobile render correctly
[ ] reduced-motion fallback works
[ ] stacking-scroll runtime behaves acceptably

Only after this checklist passes should Phase 5 be marked:

COMPLETE

8. Current Project Summary for an AI Coding Agent

Use this section when giving the repository to Kilo Code or another coding agent.

This repository is the Dynamic Portfolio Platform.

Canonical architecture:
portfolio.md

Apps:
- apps/web: public portfolio runtime + normal authenticated user UI
- apps/admin: structured content + visual Site Content + layouts + releases
- apps/studio: visual website design application
- apps/api: trusted Node.js/TypeScript platform backend

Shared packages:
- contracts
- builder-core
- runtime-renderer
- animation-runtime
- validation
- ui
- supabase

Infrastructure:
- Supabase PostgreSQL
- Supabase Auth
- RLS
- Storage

Implementation batches:
Batch 1 through Batch 40 have been implemented in the current Phase-5 codebase.

Important qualification:
They have NOT all been proven end-to-end yet.

Current stage:
Batch 41 integration testing.

Already discovered during local setup:
1. Existing Supabase `is_admin()` overload caused migration ambiguity; corrected migration was applied successfully.
2. Static test root path was not Windows-safe; corrected using fileURLToPath.
3. Current static test state is 18/19 because the remaining test incorrectly rejects intentional local `.env` files. It must instead verify that real environment files are Git ignored and `.env.example` files exist.

Do not claim Phase 5 is complete until Batch 41 passes.

Primary workflow that must be proven:

Studio
→ Save Layout
→ Publish Layout
→ Admin Layout Preview
→ Configure Content
→ Publish Content Revision
→ Create Release
→ Preview Release
→ Atomically Activate
→ Public Web renders active release
→ Rollback restores previous release

Architecture constraints:
- Studio publishing never directly activates production.
- Admin owns activation.
- Public Web is a runtime, not an editor.
- Structured content stays outside layout JSON.
- Shared runtime-renderer should power all production-like previews.
- Published versions/releases are immutable.
- service-role/secret key stays only in API.
- Do not expose secrets.
- Do not weaken tests merely to make them green.
- Fix root causes.

9. Short Status Answer

If someone asks:

“How far is the project implemented?”

The correct answer is:

Batches 1–40 have been implemented in the Phase-5 codebase and Batch 41 is the
active integration/repair gate.

Repair Groups 1, 2 and 3, RG4A, and RG4B1 are complete. RG4B2 is next.

RG3's real Studio → Admin → Release → Public Web → rollback browser workflow
passed, including second-release activation, exactly one Active release,
controlled rollback and immutable snapshot restoration.

Latest verified Batch D baseline:

- `npm run test:static` → 84/84 passed.
- `npm test` → 175/175 passed.
- `npm run typecheck` → 18/18 passed.
- `npm run build` → 11/11 passed.

Phase 5 is not yet production-complete because RG4B2 and later repair work remain.

10. Final Rule

From this point forward:

Do not add more portfolio-specific patches before integration is stable.

First finish Batch 41.

Every discovered issue should be fixed at its actual architectural layer:

Studio problem
→ Studio/builder/contracts

Content problem
→ Admin/content/API

Renderer problem
→ runtime-renderer

Publishing problem
→ API/database

Runtime problem
→ Public Web/runtime manifest

Security problem
→ API/RLS/storage

Do not bypass architecture with one-off fixes.

11. Batch 41 Repair Groups

Repair Group 1

COMPLETE

Repair Group 2 — Studio persistence and published-layout integrity

COMPLETE

Repairs completed:

- Studio document saves now use one transactional database operation for layout metadata, version metadata, page deletions and page upserts.
- Studio saves reject page IDs already owned by another layout version instead of allowing cross-version page movement.
- Layout page immutability checks both the old and new layout-version owner during updates, so pages cannot be moved out of published versions.
- Layout publication now uses a draft-only database transition rather than a general direct update.
- Focused static regression tests cover atomic Studio persistence, page ownership, both-sided immutability and draft-only publication.

Verified baseline after Repair Group 2:

npm run test:static
22/22 passed

npm test
22/22 passed

npm run typecheck
18/18 tasks passed

npm run build
11/11 tasks passed

Completed integration validation:

- Updated migration functions/triggers were applied to the linked Supabase environment.
- The real Studio create → edit → save → browser refresh → validate → publish workflow passed.
- Published layout versions and their pages remain immutable.

12. Repair Group 3 Final Certification

Status:

✅ COMPLETE

Repair Group 3 implemented and verified the release-integrity foundation
required by portfolio.md. The real Admin → Activate → Public Web → Rollback
browser acceptance scenarios passed.

Implemented:

- Forward-only migration `20260808000400_repair_group_3_release_integrity.sql`.
- Local migration history aligned with three pre-Phase-5 remote history entries
  through explicit no-op placeholders; the complete Phase-5 baseline remains
  `20260808000100_platform_phase5_complete.sql`.
- PostgreSQL sequence-based, race-safe site release numbering.
- Exact release snapshot revision tokens.
- Persisted layout schema/runtime compatibility values per release.
- Validation results tied to the exact current release snapshot and runtime.
- Legal state transitions enforced by a database trigger.
- Draft → Ready only through trusted validation.
- Ready → Active only through trusted activation.
- Active → Superseded only inside activation/rollback transitions.
- Superseded → Active only through the dedicated rollback operation.
- Ready, Active and Superseded release snapshots are immutable.
- Release records, validation records and audit logs are append-only.
- Activation and rollback use a transaction-scoped advisory lock and row locks.
- The one-active-release unique index remains enforced.
- Release creation, validation, activation and rollback RPCs are service-role-only.
- Browser Admin release/validation/audit RLS is read-only; direct writes are revoked.
- Release transition audit events are written inside the same database transaction.
- Admin Releases UI exposes separate Create, Validate, Preview, Activate and Rollback actions.
- Preview is read-only and cannot make a release Ready.
- Public Web continues to resolve only the single Active release.
- Studio has no release activation path and Studio Publish still does not activate Web.
- Admin and Studio API-backed actions use standardized visible pending states,
  synchronous duplicate/conflict gates, controlled feedback and guaranteed cleanup.
- The final typed Admin/Studio API-action audit classified 83 actions and found
  no remaining explicit clickable network action without visible in-progress feedback.

Reused-database compatibility:

- The legacy per-check `release_validation_results` shape was upgraded in place
  without deleting historical columns or rows.
- Three historical releases have no content/settings revision IDs. They remain
  readable and the current active release remains live, but incomplete legacy
  releases cannot be reactivated after supersession.

Migration status:

- `20260808000100`, `20260808000200` and `20260808000300` were recorded as
  already applied in remote migration history.
- `20260808000400` was applied successfully to the linked Supabase project.
- The migration did not activate, supersede or delete any release.

Latest verified automated baseline from Batch D:

- `npm run test:static` → 74 / 74 passed.
- `npm test` → 159 / 159 passed.
- `npm run typecheck` → 18 / 18 tasks passed.
- `npm run build` → 11 / 11 tasks passed.
- Admin → HTTP 200.
- Studio → HTTP 200.
- API health → healthy.
- Auth bypass → `false`.

Live non-destructive verification:

- Existing release #3 remained the active Public RuntimeManifest release.
- Superseded releases were rejected by the activation RPC.
- Historical incomplete releases were rejected as rollback targets.
- Anonymous direct release updates were rejected.

Manual browser acceptance: PASSED

1. Studio Publish left Public Web unchanged.
2. Complete release candidates could be created without changing Public Web.
3. Draft Preview did not mutate release status.
4. Revision-bound validation moved valid Draft releases to Ready.
5. Ready releases did not affect Public Web.
6. Atomic activation changed production while preserving exactly one Active release.
7. Public Runtime and Public Web switched without redeployment only after activation.
8. A second complete release was created, previewed, validated and activated.
9. The previous Active release became Superseded.
10. Controlled rollback restored the previous immutable layout/content/settings snapshot.
11. Release transition audit/history behavior was verified.

Architecture certification:

- Studio → design plus immutable published layout versions.
- Admin → content plus controlled release activation.
- Release → exact immutable layout/content/settings snapshot.
- Public Web → active release only.
- Studio Publish ≠ Production Activation.
- Ready Release ≠ Production Activation.
- Only controlled Admin activation changes production.

Repair Group 3 status: COMPLETE

13. Repair Group 4B1 Final Certification

Status:

✅ COMPLETE

RG4A is complete. RG4B1 established the media identity and release-media
foundation without starting later collection/backfill work.

Verified guarantees:

- `00600` introduced stable media UUID identity, unique and immutable
  `storage_path`, `release_media_references`, and `media_snapshot_version`.
- `00700` reconciled reused legacy `url` / `size_bytes` columns with canonical
  `public_url` / `size` / `alt_text` columns while retaining compatibility.
- Browser direct media/reference writes are restricted; trusted API upload and
  unreferenced deletion remain available.
- Trusted uploads write canonical and required legacy compatibility fields.
- Real authenticated Admin upload and delete acceptance passed.
- Committed upload/delete success cannot be falsely reported as failure because
  a post-operation library refresh failed.
- All releases remain `media_snapshot_version = 0`; Release #4 remains the sole
  Active release; Public Runtime remains Release #4.
- Final validation: 84/84 static, 175/175 full, 18/18 typecheck tasks, 11/11
  build tasks, and HTTP 200 for Web/Admin/Studio/API health.

Repair Group 4 is not complete. Exact next batch: RG4B2.
