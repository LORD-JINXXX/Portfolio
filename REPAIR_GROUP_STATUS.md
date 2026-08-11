# Dynamic Portfolio Platform - Repair Group Status

**Canonical architecture:** `portfolio.md`
**Current phase:** Phase 6 implementation complete / production certification pending
**Date:** 2026-08-11

## Current Checkpoint

| Group | Status | Handoff meaning |
| --- | --- | --- |
| Repair Group 1 | ✅ Complete | Historical security/CMS foundation accepted. |
| Repair Group 2 | ✅ Complete | Studio persistence/integrity foundation accepted. |
| Repair Group 3 | ✅ Complete | Immutable release state machine, atomic activation and controlled rollback accepted. |
| RG4A | ✅ Complete | Media/release analysis. |
| RG4B1 | ✅ Complete | Stable media identity + relational release-media foundation. |
| RG4B2 | ✅ Complete | Structured collection media normalization. |
| RG4C1 | ✅ Complete | Canonical media collector + trusted exact Draft certification. |
| RG4C2 | ✅ Implementation complete | Relational/physical transition enforcement and race-safe DB-first Media Delete implemented; real DB acceptance remains in the final gate. |
| RG4C3 | ✅ Implementation complete | Active-release media is authoritative; empty snapshots no longer fall back to live media. |
| RG4D | ✅ Implementation complete | Explicit historical resolution/certification workflow implemented, including physical Storage preflight; historical live certification/rollback remains a controlled manual gate. |
| Repair Group 5 | ✅ Implementation complete | Runtime routing, deployed-runtime compatibility and renderer security hardening implemented. |
| Repair Group 6 | ✅ Implementation complete | Remaining Studio authoring contract, page/draft safety, bindings/media, responsive/animation/scroll parity and node containment implemented. |
| Repair Group 7 | ✅ Implementation complete | Admin layout/content/settings/revision integrity and exact previews implemented. |
| Repair Group 8 | ✅ Implementation complete | RLS/Storage/audit/API hardening and future Studio ownership boundaries implemented. |
| Repair Group 9 | ✅ Implementation complete | Independent build scripts, source lint, Node engine, cleanup, contracts and builder-core separation implemented. |
| Repair Group 10 | ✅ Accepted / wrap-up complete | User completed Studio/Admin manual acceptance; final reported UX issues were corrected in code. Previously certified RG3 activation/rollback guarantees remain intact. |

**Phase 5 is complete for this handoff. The user accepted the manual Studio/Admin pass and requested the final reported UX issues be corrected without repeating the full manual pass.**

## Architecture Guarantees Preserved

- Studio owns design; Admin owns real content/settings and production release control.
- Studio Publish ≠ Production Activation.
- Content/Settings Publish ≠ Production Activation.
- Ready Release ≠ Production Activation.
- Public Web consumes only the Active immutable RuntimeManifest.
- Published layout versions and activated/superseded release snapshots remain immutable.
- Exactly one Active release is enforced by the release state machine.
- Release activation/rollback remains a trusted service-role operation.
- Browser applications never receive the service-role key.
- AI execution remains deliberately deferred; Phase 6 production security/scaling/SEO hardening is implemented.


## Phase 6 Production Hardening — 2026-08-11

**Status: ✅ Code implementation complete / targeted production acceptance pending.**

The agreed security model is strict production security. Phase 6 adds fail-closed production configuration, bounded + distributed rate limiting, optional CAPTCHA and privileged MFA, tighter browser read boundaries, request/timeout/security-header hardening, stateless health/readiness/graceful-shutdown support, Active-release caching, per-user daily quota primitives, server-visible release-aware SEO, sitemap/robots/JSON-LD, safe runtime media-loading defaults, security audit tooling and guarded staging load-smoke tooling.

Large network-level DDoS protection remains an infrastructure responsibility: production must use a CDN/edge provider with managed DDoS protection/WAF/bot/rate rules before origin traffic. Migration `20260811001800_phase6_security_scaling_foundation.sql` is the only Phase 6 database migration. See `docs/PHASE6_SECURITY_SCALING_SEO.md` and `docs/PHASE6_TEST_PLAN.md`.

## RG4 Completion Summary

### RG4C2

- `01000` adds lifecycle-status-agnostic certified-media integrity checks.
- Version 1 + zero references is valid; version 0 is not treated as certified.
- Draft → Ready, Ready → Active and Superseded → Active use the final relational media guard while retaining their own RG3 lifecycle checks.
- Captured managed bucket, storage path, MIME and size identity are checked null-safely.
- Referenced media rows are row-locked in deterministic order across successful transitions.
- Replacement activation is blocked while the current Active release is still media version 0, preserving rollback safety until historical certification.
- Release validation also performs trusted physical `public-media` Storage existence checks.
- `01100` + `01600` implement DB-first race-safe media deletion with durable Storage cleanup jobs and frozen legacy/release reference blocking.

### RG4C3

- Runtime media version 1 comes only from immutable `release_media_references`.
- Legacy version 0 runtime uses only its exact frozen `media_snapshot` compatibility data.
- An empty snapshot never expands to the live Media Library.
- Public structured compatibility routes project the Active release snapshot rather than current mutable CMS tables.

### RG4D

- `01200` provides explicit trusted historical release certification; there is no bulk/automatic backfill.
- `01400` provides exact per-release legacy-string → canonical-media resolution.
- Historical certification requires complete canonical resolution and trusted physical Storage preflight before a version-0 Active release can flip to version 1.
- Media Delete also protects exact legacy/frozen references before historical certification.

## Repair Groups 5-9 Summary

### RG5 Runtime

- Public/Admin/Studio preview share deterministic route matching.
- Collection-detail routes receive explicit item context and Public Web owns real 404 behavior.
- Runtime compatibility uses the deployed Public Web runtime version (`PUBLIC_WEB_RUNTIME_VERSION=1.0.0`).
- Runtime tags, URLs, CSS and static serialization are constrained/sanitized.
- Renderer node errors are contained instead of taking down the whole page.

### RG6 Studio

- Locked nodes are enforced across authoring commands.
- Absolute/free-position nodes can be moved/resized through canvas chrome.
- Page add/update/duplicate/delete behavior protects the canonical Home route and normalizes unique routes.
- Content slots, binding suggestions, media selection and sample collections share canonical contracts.
- Layout-defined breakpoints, animation presets and scroll behaviors flow through the shared runtime renderer.
- Draft cloning is serialized/atomic in `01700`, including fresh copied page IDs.

### RG7 Admin / Revisions

- Admin can select an older compatible published layout version without activating it.
- Release candidates preflight exact published layout/content/settings/runtime compatibility before append-only release allocation.
- Content/settings draft allocation and publication use trusted service RPCs (`01300`, `01500`).
- Settings values and structured content receive server validation.
- Exact collection-detail Admin preview passes real item context.
- Structured media fields use canonical Media Library IDs, including Experience logo.
- Admin Media includes All / Images / Videos / Documents filtering and native scrolling behavior.

### RG8 Security

- Production API rejects auth bypass, wildcard/missing CORS and missing deployed runtime version.
- Critical browser writes are removed in favor of authenticated frontend → trusted API → service operation/RPC → database.
- Audit history remains append-only and actor deletion uses restrictive integrity.
- CMS upload MIME is byte-sniffed and upload size is server-enforced.
- Public Storage object listing policy is removed while public object delivery remains possible.
- Non-admin Studio roles are limited to their own layouts at the API boundary.

### RG9 Tooling

- Independent application dev/build commands are exposed.
- Node engine is `>=20.19.0 <23`.
- `lint:source` parses TS/TSX and checks production security source rules.
- Cleanup is cross-platform and generated artifacts are excluded from the final handoff ZIP.
- Shared API response contracts are exported.
- React editor-hook concerns are split from pure `builder-core` tree utilities.
- Documentation now describes independent deployment and the final live gate.

## Verification in This Handoff Environment

Latest checks actually executed on 2026-08-11 after the final manual-feedback fixes:

- `npm run lint:source`: **PASS**.
- `npm run test:static`: **164 total, 163 pass, 0 fail, 1 skip**.
  - The one skipped test requires installed runtime dependencies (`tsx`), which are not available in this execution environment.
- Phase-5 migration/source syntax-invariant checks include migrations `00900` through `01700` and the cross-group source integration tests.

Full `npm test`, `npm run typecheck` and `npm run build` could not be truthfully re-run here because the uploaded ZIP did not include dependencies and package installation could not complete in this environment. They are mandatory first steps in Repair Group 10 after `npm ci`.

## Database Migration Reconciliation During Manual Acceptance

During the user's Phase-5 manual pass, the linked remote migration history was confirmed to stop at `00900` while `01000` function guards existed as unrecorded schema drift. A read-only catalog check confirmed the drift, and a Supabase `db push --linked --dry-run` showed exactly `01000` through `01700` pending. The user then applied that exact forward set. The previously missing `01500` content/settings draft RPCs became available and Admin Site Content loaded successfully afterward.

No additional database migration is introduced by the final UX wrap-up in this handoff.

## Final Acceptance Notes

The user completed the major Studio/Admin manual flows, verified that Admin changes did not leak into Public Web (the site remained on Active Release #4), and requested the remaining small UX findings be fixed in the final code rather than repeating the entire manual suite. During that pass the remote Phase-5 migration set was reconciled/applied through `01700`, Studio publishing/configuration worked, Site Content drafts/publishing worked, and structured Admin CRUD/media/settings workflows were exercised.

Release activation/rollback invariants were already manually certified during RG3 and remain covered by the unchanged release-state-machine tests; they were not re-run as part of this final UX cleanup.

Phase 5 remains complete. The Phase 6 security model was subsequently agreed as strict production security with layered DDoS/DoS protection, horizontal-scaling readiness and release-aware SEO; implementation is captured in `PHASE6_HANDOFF.md`.
