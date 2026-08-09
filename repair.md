Dynamic Portfolio Platform — Repair Group Status

Date: 2026-08-10
Project: Dynamic Portfolio Platform
Canonical architecture: portfolio.md
Current phase: Phase 5 / Batch 41 integration and repair gate
Status: Repair Groups 1, 2 and 3 complete; Repair Group 4 next.

1. Executive Status

Repair Group 1  ✅ COMPLETE
Repair Group 2  ✅ COMPLETE
Repair Group 3  ✅ COMPLETE

Current checkpoint:
Repair Group 4  ⏳ NEXT

Phase 5 overall:
NOT COMPLETE YET

Reason:
RG3's Admin → Release → Public Web → rollback acceptance gate passed. Repair
Groups 4-10 still remain before the overall Phase 5 repair program is complete.

The platform architecture remains:

UI/UX STUDIO
    ↓
Design + sample/dummy content
    ↓
Save draft layout
    ↓
Validate
    ↓
Publish immutable layout version
    ↓

ADMIN CMS
    ↓
Discover published layout
    ↓
Configure real content
    ↓
Publish content/settings revisions
    ↓
Create release candidate
    ↓
Validate + Preview
    ↓
Activate atomically
    ↓

PUBLIC WEB
    ↓
Loads active RuntimeManifest
    ↓
Renders selected design + real content

Non-negotiable rule:

Studio Publish ≠ Production Activation

Publishing a layout from Studio must never automatically change the live Public Web.

2. Repair Group 1 — COMPLETE

Name

Canonical Page / Collection Detail Contract Repair

Original problems

The Phase-5 review found that the Cosmic starter and runtime page model had inconsistent collection-detail behavior.

The most visible failure was duplicate page slugs:

Projects index  → projects
Project detail  → projects

Notes index     → notes
Note detail     → notes

This caused validation errors and conflicted with the database uniqueness rule for page slugs within a layout version.

The runtime also lacked an explicit collection source for detail pages and relied on route/slug inference.

Completed work

Canonical page/runtime contracts

Added explicit collection metadata to the canonical page/runtime model so collection-detail pages can declare which structured collection they represent.

Examples:

projects
notes
experience
apps

Cosmic detail-page slugs

Detail page identities were separated from index page identities.

Conceptually:

Projects index:
slug = projects

Project detail template:
slug = project-detail
routePattern = /projects/:slug
collection = projects

and:

Notes index:
slug = notes

Note detail template:
slug = note-detail
routePattern = /notes/:slug
collection = notes

This preserves clean public routes while keeping internal Studio page identities unique.

Manifest / consumer propagation

Collection metadata was propagated through the contracts/runtime path so consumers no longer need to guess collection ownership solely from route text.

Tests

The failing Cosmic starter validation was repaired.

At the completion point for Repair Group 1:

npm test
19 tests
19 passed
0 failed

The canonical collection-detail contract became valid enough for the repair plan to move into Studio persistence integrity.

Repair Group 1 result

Duplicate Cosmic page slug blocker        ✅ FIXED
Explicit collection detail metadata       ✅ IMPLEMENTED
Canonical page/runtime contract            ✅ UPDATED
Collection metadata propagation            ✅ IMPLEMENTED
Cosmic validation blocker                 ✅ FIXED
Tests                                     ✅ GREEN

Repair Group 1 status: COMPLETE

3. Repair Group 2 — COMPLETE

Name

Studio Persistence, Publication Integrity and Real Browser Integration

Repair Group 2 began as a database/API integrity repair for Studio save and publish operations.

Real browser testing then exposed several foundational Studio integration gaps. These were repaired within the same group because they blocked the required end-to-end Studio acceptance flow.

3.1 Published layout-page immutability

Problem

A page belonging to a published layout version could potentially be moved/reassigned into another version and escape the original published-page immutability check.

Completed repair

public.protect_published_layout_page() was hardened to:

reject UPDATE/DELETE of pages belonging to published versions;

reject INSERT into published versions;

reject every layout_version_id reassignment;

lock the owning layout-version row during mutation checks;

rotate draft revision state when page data changes.

The page-write trigger is explicitly attached for:

BEFORE INSERT OR UPDATE OR DELETE

Published versions remain immutable snapshots.

3.2 Atomic Studio document save

Created/hardened:

public.save_layout_document(...)

The RPC now performs the Studio document save as one PostgreSQL operation.

It:

verifies layout/version ownership;

locks the target version;

requires status = draft;

validates existing page ownership;

rejects cross-version page IDs;

updates layout metadata;

updates version metadata;

removes intentionally omitted pages only from the target draft;

inserts/updates submitted pages;

preserves page IDs;

persists layout_tree.

Failure of any operation aborts the save instead of leaving a partially-written Studio document.

3.3 Safe publication + revision token concurrency

Added:

layout_versions.revision_token uuid

The revision token changes whenever relevant draft/version/page state changes.

Publication became:

validate exact draft revision
        ↓
capture revision_token
        ↓
publish_layout_version(
    versionId,
    expectedRevisionToken,
    ...
)
        ↓
lock row
        ↓
compare token
        ↓
publish only if unchanged

This closes the race where a draft could change after API validation but before publication.

The old three-argument publication RPC was removed so the token-aware flow cannot be bypassed.

Current publication RPC:

public.publish_layout_version(
    target_version_id uuid,
    expected_revision_token uuid,
    thumbnail_value text,
    changelog_value text
)

Publishing still does not activate production.

3.4 Forward-only Supabase migrations

The project keeps the corrected original migration as the clean fresh-install baseline.

Existing databases are upgraded using forward migrations.

Existing baseline

20260808000100_platform_phase5_complete.sql

Repair Group 2 persistence upgrade

20260808000200_repair_group_2_studio_persistence_integrity.sql

Contains the existing-database delta for:

revision token;

published-page protection;

atomic document save;

safe publication;

function permissions.

Atomic initial layout creation

20260808000300_repair_group_2_atomic_layout_creation.sql

Adds:

public.create_layout_document(...)

Do not rerun 00100 against a database that already applied it.

3.5 Atomic initial layout creation

Problem discovered during browser testing

Creating a blank/Cosmic layout previously used independent writes:

create layout
→ create version
→ create pages

A failure between steps could leave:

Layout
0 versions

Several old orphan layouts proved that this had happened.

Layout creation also reused fixed slug bases such as:

untitled-layout
cosmic-portfolio

which caused:

duplicate key value violates unique constraint "layouts_slug_key"

Completed repair

Created:

public.create_layout_document(...)

It atomically creates:

Layout
+
Initial Draft Version
+
Starter Pages

If any part fails, the complete operation rolls back.

Collision-safe slug allocation

The RPC keeps the database unique constraint and allocates:

my-layout
my-layout-2
my-layout-3
...

It catches only the expected layouts_slug_key violation and rethrows unrelated unique violations.

Slug normalization was corrected to:

lowercase
→ replace invalid characters
→ trim hyphens

Example:

"My Layout"
→ "my-layout"

Browser verification

A fresh Blank Layout successfully opened as:

Untitled Layout · v1

with an initial Home page and starter document instead of becoming a 0 versions · new orphan.

3.6 API runtime package-boundary repair

Runtime blocker discovered

Although:

npm test          ✅
npm run typecheck ✅
npm run build     ✅

the API initially crashed during npm run dev because Node/tsx could not resolve the named runtime export:

ANIMATION_PRESETS

Completed repair

Canonical owner confirmed as @platform/animation-runtime.

API imports it from the canonical package.

Shared runtime packages received explicit ESM/package export metadata.

Regression coverage verifies named exports through the actual Node/tsx runtime path.

Verified:

GET http://localhost:4000/health
→ status: ok

3.7 Durable Studio editor routing

Previous behavior

Refreshing while editing a layout returned the user to the Layout Library because editor identity lived only in transient React state.

Completed route

/layouts/:layoutId/versions/:versionId/editor?page=:pageId

Opening a layout now establishes durable route identity.

Refresh:

route
→ exact layout/version lookup
→ persisted document fetch
→ builder hydration
→ same editor/document

Selected page identity is synchronized through the URL.

Invalid/deleted/mismatched editor routes return to a controlled library/error state.

3.8 Direct canvas selection

Previous behavior

Elements could only reliably be selected through the Layers panel.

Completed behavior

One canonical state remains:

editor.state.selectedNodeId

Canvas, Layers, and Inspector all use it.

Now:

click Heading on canvas
→ Heading selected
→ Layers highlights Heading
→ Inspector shows Heading

Nested child clicks no longer bubble into parent/background handlers and lose the intended selection.

Selection itself does not mutate or dirty the document.

3.9 Canvas tree drag/drop

Implemented canonical flow-layout movement.

Supported:

reorder before sibling;

reorder after sibling;

move inside valid containers;

move between containers;

move out to valid ancestor/root;

preserve stable node IDs;

keep moved node selected;

persist moved hierarchy through Save + reload.

Safety includes:

reject self-drop;

reject ancestor → descendant cycles;

reject invalid/leaf inside targets;

reject locked node/parent movement;

reject published-document movement;

cancelled drag does not mutate;

no-op/rejected moves do not dirty history;

one successful move creates one logical history operation.

Canonical builder-core movement helpers include:

canNodeContainChildren
resolveNodeDropTarget
canMoveNode
moveNodeInTree
commitNodeMove

3.10 Studio selection/drop chrome overlay

Previous problem

Selection borders/drop indicators were drawn on runtime website elements and could be clipped/covered by:

overflow
position
z-index
transform
stacking contexts
backgrounds

Completed repair

Added Studio-only:

CanvasChromeOverlay

The website remains in a lower isolated rendering layer while editor chrome is rendered above it.

Overlay geometry tracks runtime node bounds and responds to:

selected node;

tree movement;

responsive preview mode;

zoom;

scroll;

browser resize;

DOM changes;

element resizing;

font/image loading.

Selection and drag indicators do not modify saved website styles or Public Web output.

3.11 Save / Validate / Publish feedback

Added reusable:

ActionFeedback

Supported action states:

Save:
idle → Saving... → success/error

Validate:
idle → Validating... → valid/issues/error

Publish:
idle → Publishing... → success/error

Examples:

Layout saved successfully
Layout is valid and ready to publish
Layout version published successfully

Duplicate clicks on the same pending action are prevented.

Expected validation issues are shown in Studio instead of requiring DevTools.

3.12 Responsive Studio chrome

The top toolbar was repaired for constrained editor widths.

Primary actions remain directly accessible:

Layout
Page
Desktop / Tablet / Mobile
Save
Validate
Publish

Secondary controls move into a More overflow menu where necessary.

The toolbar wraps/compacts rather than clipping actions off-screen.

3.13 Left/right panel controls + Back navigation

Text-based panel visibility controls were replaced with canvas-edge arrows.

Left

‹ collapse
› expand

Right Inspector

› collapse
‹ expand

Both panels are independently controlled.

Both may be closed simultaneously so the canvas receives maximum workspace.

Panel state is Studio-only and does not dirty the design document.

A separate:

← Back to Layouts

navigation action was added.

If the document is dirty, Studio warns before leaving:

Stay
Leave without saving

3.14 Studio authentication/session refresh

Real browser issue

After a long Studio session:

PUT /api/studio/versions/:versionId/document
→ 401
{"error":"Invalid or expired session"}

The Authorization header was present, proving the problem was a stale/expired token rather than a missing header.

Logging out and signing in again immediately restored:

Save      ✅
Validate  ✅
Publish   ✅

A dedicated session-refresh repair was then completed so protected Studio requests use the current Supabase session/token lifecycle rather than intentionally relying on the initial token forever.

Security rules remain:

API still verifies bearer tokens;

Studio remains admin protected;

service-role credentials remain API-only;

no anon write bypass.

3.15 Real browser acceptance verified

The real browser flow demonstrated:

Blank layout creation             ✅
Initial v1 draft                  ✅
Edit content                      ✅
Save                              ✅
Refresh persistence               ✅
Durable editor route              ✅
Direct canvas selection           ✅
Canvas reorder/move               ✅
Save moved tree                   ✅
Validate                          ✅
Publish                           ✅
Published v1 UI state             ✅
Public Web did not auto-activate  ✅

The Public Web at:

http://localhost:3000

remained blank/unactivated after Studio publication.

That is correct and proves the architecture rule:

Studio Publish ≠ Production Activation

The published editor state exposes Create Draft, supporting the intended model:

Layout
├── v1 Published 🔒
└── v2 Draft ✏️

A published version is immutable; future layout edits should clone/open a draft version rather than rebuild the entire layout.

3.16 Latest explicitly reported automated baseline

The last explicitly reported complete suite after the Studio chrome/navigation work was:

npm run test:static
35 / 35 passed

npm test
60 / 60 passed

npm run typecheck
18 / 18 tasks passed

npm run build
11 / 11 tasks passed

Additional auth/session work was reported completed afterward; the exact post-auth test totals were not captured in this status document.

3.17 Repair Group 2 result

Published-page integrity                 ✅
Atomic draft save                        ✅
Revision-token publication               ✅
Safe forward migration                   ✅
Atomic initial layout creation           ✅
Slug collision handling                  ✅
API runtime package exports              ✅
Editor deep-link + refresh               ✅
Canvas selection                         ✅
Canvas tree movement                     ✅
Editor overlay chrome                    ✅
Action feedback                          ✅
Responsive toolbar                       ✅
Panel edge controls                      ✅
Back navigation + dirty guard            ✅
Session/token lifecycle repair           ✅
Studio publish does not activate Web     ✅

Repair Group 2 status: COMPLETE

4. Repair Group 2 Housekeeping Before Repair Group 3 — COMPLETE

The five historical orphan layouts from the old non-atomic creation flow were
verified as zero-version records and cleaned before RG3 began:

136b3eab-f450-4598-b98a-7b3157794804 | Cosmic Portfolio
21b4b111-6a0d-4e50-a25a-24ab5d4d63c4 | test-unique-layout-12345
5fb080f6-b5aa-4f24-b6b7-6b6627722f43 | unique-test-layout-99999
0df9be7b-5e4e-4221-ad45-b62f83876058 | Test Save
cd07da89-27e9-47da-a30e-4f98e78720b3 | Studio Save Test

The guarded allowlist cleanup is complete. Atomic `create_layout_document(...)`
remains the Studio creation path.

5. Remaining Repair Plan

The original repository review identified additional integrity, runtime, Admin, security and integration work after the Studio persistence repair.

The sequence below records RG3 certification and continues with Repair Group 4.

Repair Group 3 — COMPLETE

Release Integrity, Activation Security and Rollback

The database, API, Admin UI, regression tests and real browser activation and
rollback acceptance are complete.

Problems resolved

Browser admins must not be able to bypass the trusted release workflow through direct site_releases writes.

Activation must occur only through a validated atomic operation.

Exactly one active production release must be maintained.

Ready/active release state must not remain mutable.

Release number generation must be race-safe.

Rollback must use the same controlled release transition.

Release RLS must match trusted API ownership.

Verified outcome

Published Layout Version
+
Published Content Revision
+
Published Settings Revision
        ↓
Release Candidate
        ↓
Validate
        ↓
Ready
        ↓
Atomic Activate
        ↓
exactly one Active Release

Rollback:

Previous compatible release
        ↓
controlled rollback
        ↓
becomes active atomically

Security guarantees

remove/bound direct browser writes to release state;

enforce release status transitions;

protect activated release snapshots;

verify Admin API authorization;

preserve append-only transition/audit semantics where applicable.

Browser acceptance

Studio Publish
→ Public Web unchanged

Admin Activate
→ Public Web changes

Rollback
→ previous release restored

All browser acceptance steps passed, including a second complete release,
atomic supersession, controlled rollback and immutable snapshot restoration.

Implemented:

race-safe sequence allocation for release numbers;

snapshot revision tokens binding validation to exact release state;

immutable Ready/Active/Superseded snapshots;

database-enforced legal transitions;

service-role-only create/validate/activate/rollback RPCs;

serialized atomic activation;

dedicated controlled rollback;

read-only browser RLS for releases/validation/audit;

atomic release transition audit events;

separate Admin Validate, Preview, Activate and Rollback actions;

Public Web active-release continuity.

Admin/API interaction guarantees:

visible pending states for explicit Admin and Studio network actions;

synchronous duplicate/conflict gates with guaranteed cleanup;

approximately three-second success feedback and persistent controlled errors;

final typed 83-action Admin/Studio audit with no uncovered explicit clickable
network action.

Migration:

20260808000400_repair_group_3_release_integrity.sql

Applied successfully to the linked Supabase project.

Latest verified automated baseline from Batch D:

npm run test:static  74 / 74 passed

npm test             159 / 159 passed

npm run typecheck    18 / 18 tasks passed

npm run build        11 / 11 tasks passed

Admin               HTTP 200

Studio              HTTP 200

API health           healthy; auth bypass false

Final verified guarantees:

controlled release state machine;

immutable layout/content/settings release snapshots;

revision-bound validation;

race-safe release numbering;

trusted API-only release mutations;

serialized atomic activation and exactly-one-active-release invariant;

controlled rollback;

atomic audit transition recording;

Public Web active-release-only contract;

Studio Publish isolation from production activation;

manual browser activation and rollback acceptance passed.

Status: COMPLETE

Repair Group 4 — NEXT

Release Snapshot + Media Integrity

Problems from review

Release snapshots do not yet fully guarantee every referenced asset.

Structured-record media may be omitted from snapshots, including:

project thumbnails/galleries;

note cover images;

experience logos;

AI app covers/icons;

layout thumbnail media.

Media deletion protection also needs to cover every release/reference source.

Required work

normalize structured media references to stable media IDs;

recursively collect all release media references;

include them in immutable release snapshots;

prevent destructive deletion of media referenced by immutable releases;

ensure layout/content/settings/media references are frozen together.

Status: NEXT

Repair Group 5 — PENDING

RuntimeManifest, Routing, Compatibility and Renderer Security

Main work

deterministic route matching;

explicit collection-detail context throughout runtime;

deployed Public Web runtime compatibility;

Web fallback for incompatible manifests;

safe HTML/tag rendering;

safe URL protocols;

escaped static HTML output;

runtime error boundaries;

malformed-node fallback behavior.

Compatibility requirement

API and Public Web are independently deployable.

Activation must not compare only against an API-side source constant.

It must know whether the currently deployed Public Web runtime supports the candidate layout/runtime schema.

Security requirement

Allowlist/sanitize:

runtime tag values
href protocols
HTML/static serialization
dangerous props

Status: PENDING

Repair Group 6 — PENDING

Remaining Studio Contract / Authoring Gaps

Repair Group 2 fixed the critical real-browser Studio workflow, but the original review still identified deeper authoring gaps to finish.

Remaining areas

resizing;

fully verified absolute/free-position behavior;

lock enforcement across all editor commands;

safe page duplication semantics;

Home/detail route normalization;

canonical shared content registry;

binding picker;

media picker;

consistent Studio/Admin sample manifests;

meaningful renderer-derived thumbnails;

responsive behavior based on layout-defined breakpoints;

finish animation contract/runtime parity;

finish scroll-behavior contract/runtime parity;

node-level error containment.

Some of these may be addressed while later Phase-5 browser scenarios are tested rather than as one large patch.

Status: PENDING

Repair Group 7 — PENDING

Admin Content, Layout Library and Revision Integrity

Admin Layout Library

Need complete real-browser verification of:

Published layout card appears
Thumbnail/preview
Version history
Actual active version
Compatibility state
Configure without activation

Admin must be able to select an older compatible published version as well as the latest one.

Site Content

Repair direct/unvalidated content write paths.

Expected model:

selected layout
→ canonical content registry
→ typed draft content revision
→ visual editing
→ validate
→ publish immutable content revision

Admin must not mutate live site content on every keystroke.

Structured managers

Finish real validation for:

Projects
Notes
Experience
AI Apps
Site Settings
Media

Known areas from review

desktop-only Site Content preview;

typed settings;

structured media picker;

content-key/type validation;

mutation error feedback;

exact detail-page previews;

compatibility recomputation after draft changes.

Status: PENDING

Repair Group 8 — PENDING

RLS, Storage, Audit and API Security Hardening

High-priority review findings

overly broad direct browser-admin writes;

mutable/deletable audit logs;

public media enumeration / direct storage write bypass;

development auth bypass too broad;

upload MIME validation trusts client metadata;

ownership rules for future non-admin Studio designers are not defined.

Required outcome

Critical mutations flow through:

authenticated frontend
→ trusted API
→ validated service operation/RPC
→ database

not unrestricted direct PostgREST writes.

Audit

Audit log must be append-only.

Storage

Review:

public-media
user-resumes

and all upload/delete policies.

No service-role key may enter frontend bundles.

Status: PENDING

Repair Group 9 — PENDING

Build, Package and Maintainability Cleanup

Remaining review items

align build/package scripts with independently deployable applications;

make deployment model explicit;

align Node engine requirement with tooling actually used;

add real linting;

make cleanup scripts cross-platform;

clean generated build cache files;

format highly compressed/minified source files where safe;

resolve orphaned API contract types;

split React-dependent Studio hook concerns away from pure builder-core utilities where appropriate;

keep progress docs synchronized with actual repository state.

This group should not be allowed to change architecture merely for cosmetic cleanup.

Status: PENDING

Repair Group 10 — PENDING

Full Phase-5 Behavioral / Browser Integration Gate

This is the final Batch 41 end-to-end gate.

The original completion workflow is:

Studio
→ Save Layout
→ Publish Layout

Admin → Layouts
→ Discover
→ Preview
→ Configure

Admin → Site Content
→ Edit real content
→ Save Draft
→ Publish Content Revision

Admin → Releases
→ Create candidate
→ Validate
→ Preview
→ Activate

Public Web
→ Load RuntimeManifest
→ Render active release

Studio/Admin
→ create and activate second layout

Admin → Releases
→ Rollback

Required scenarios

Scenario A — Studio

Largely completed during Repair Group 2.

Scenario B — Admin layout discovery

Still pending.

Scenario C — Configure without changing live site

Pending.

Scenario D — Publish content revision

Pending.

Scenario E — Release preview

Pending.

Scenario F — Atomic activation

Pending.

Scenario G — Switch layouts

Pending.

Scenario H — Rollback

Pending.

Public Web acceptance

Verify:

RuntimeManifest loads;

selected layout renders;

real Admin content renders;

dynamic routes work;

Projects routes work;

Notes routes work;

SEO metadata resolves;

no redeployment is required when Admin activates a different compatible release.

Status: PENDING

6. Current Completion Matrix

Area

Status

Repair Group 1 — Page/detail contract

✅ Complete

Repair Group 2 — Studio persistence/integration

✅ Complete

Atomic layout creation

✅ Complete

Atomic Studio save

✅ Complete

Studio validate/publish

✅ Working

Studio publish does not activate Web

✅ Verified

Studio canvas selection

✅ Complete

Studio flow drag/drop

✅ Complete

Studio deep-link refresh

✅ Complete

Studio action feedback/chrome

✅ Complete

Studio session/token refresh

✅ Implemented

Five historical zero-version orphans

✅ Cleanup complete

Repair Group 3 — Release integrity

✅ Complete

Repair Group 4 — Release/media snapshot integrity

⏳ Next

Repair Group 5 — Runtime/security/compatibility

⏳ Pending

Repair Group 6 — Remaining Studio authoring gaps

⏳ Pending

Repair Group 7 — Admin/revision integrity

⏳ Pending

Repair Group 8 — RLS/storage/audit hardening

⏳ Pending

Repair Group 9 — Build/tooling cleanup

⏳ Pending

Repair Group 10 — Full E2E Phase-5 gate

⏳ Pending

7. Next Repair Group

Do not repeat Repair Groups 1, 2 or 3.

Repair Group 3 is complete.

Exact next repair group:

Repair Group 4 — Release Snapshot + Media Integrity

Repair Group 4 has not been started by this certification update.

8. Current Architecture Guarantees to Preserve

Every remaining repair must preserve these rules:

Studio owns design.

Admin owns real content.

Admin owns production activation.

Public Web is a runtime, not an editor.

Studio publishing never directly activates the live website.

Ready release status never directly activates the live website.

Only controlled Admin activation changes production.

Published layout versions are immutable.

Activated releases are immutable snapshots.

A release identifies an exact immutable layout/content/settings snapshot.

Public Web resolves only the Active release.

Editing a published layout means creating/opening a new draft version, not rebuilding a new layout.

Structured Projects/Notes/Experience/Apps data stays outside arbitrary layout JSON.

Studio/Admin/Public production-like previews converge on the shared runtime renderer.

Service-role and provider secrets never enter frontend bundles.

Do not weaken tests/security to force green status.

Fix failures at their architectural layer instead of adding one-off bypasses.

AI execution remains deferred until the design/content/release platform is stable.

9. Definition of Repair Completion

The repair program is complete only after:

Repair Groups 1–10 complete
        ↓
Batch 41 full gate passes
        ↓
Studio → Admin → Release → Public Web works end-to-end
        ↓
second layout activation works
        ↓
rollback works
        ↓
security/RLS/storage review passes
        ↓
Phase 5 can be marked COMPLETE

Until then:

Batches 1–40:
implemented foundation

Batch 41:
active integration/repair gate

Phase 5:
not yet production-complete
