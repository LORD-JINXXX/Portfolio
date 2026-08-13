DYNAMIC PORTFOLIO PLATFORM — CUMULATIVE ALL-FIXES PATCH
Date: 2026-08-13
Baseline: exact GPTZIP.zip uploaded at the start of this chat
Platform version: 0.6.1
Runtime compatibility: 1.4.0

PURPOSE
-------
This is a rebuilt cumulative patch. It was reconstructed from the original GPTZIP.zip and compared against every generated patch from this chat. Superseded/broken patch snapshots were not blindly applied; their intended changes were merged into one final state.

This patch is intended to replace all earlier hotfix ZIPs from this chat. Do not re-apply the older patches after this one.

INCLUDED FIXES / FEATURES
-------------------------
1. Interactive runtime + dynamic data
- page runtime state
- set/toggle/increment actions
- state/context/template bindings
- conditional state-driven styles
- state-driven collection filters and counts
- animation replay keys and collection stagger
- scroll-active state for Journey/progress patterns, including reverse scrolling
- corrected stack-over-previous ordering
- Hero/background style bindings

2. Admin generic Collections
- Collections sidebar/screen restored and preserved
- generic collection definitions/items
- seeded Technologies collection definition
- managed-media fields for custom collection items
- generic collection API endpoints
- release snapshot/certification/delete-protection integration
- Studio collection picker discovers live custom collections
- Studio Runtime Preview loads published custom collection data rather than stale dummy technologies

3. Studio Inspector correctness
- strict StyleMap typing fix
- multiline text content support from the cumulative runtime patch
- Replay on re-entry
- Stagger ms
- State-change replay keys
- Viewport threshold
- combined Enter viewport + state-change playback guidance

4. Tech Stack / animation runtime
- Typewriter supports viewport/scroll playback
- Text Steps for discrete progress sequences such as 0 -> 50 -> 100
- nested Studio Runtime Preview scroll-container visibility detection
- immediate visible-state sync
- scroll animations stay visible in normal editor mode but animate in Preview/Public
- state-change replay immediately resets delayed completed elements before replay
- re-entry replay resets immediately
- expanded triggers: page load, viewport, state, hover, tap, focus, continuous
- expanded entrance/text/interaction/background/continuous presets

5. Admin Media bulk upload
- multi-file native selection
- sequential safe uploads through the existing hardened endpoint
- current/total progress
- partial-failure reporting
- one refresh after batch
- auth/authorization/rate-limit stop behavior
- existing per-file size/MIME/security rules preserved
- Collections UI and bulk Media now coexist in the same Admin App.tsx

6. Particle Field runtime 1.4
- reusable Particle Field Studio element
- Props controls: Count, Min/Max Size, Speed, Drift, Opacity, Glow, Seed, Direction, Colors, Continuous/Static
- deterministic seeded layout
- lightweight CSS drift animation
- reduced-motion fallback
- validated production runtime values
- particle Count cap raised consistently from 80 to 200 across Studio, validation, and renderer

7. Regression protection
- tests verify generic Collections and bulk Media remain present together
- tests verify Particle Field 200 cap is consistent end-to-end

DATABASE
--------
Includes one forward migration introduced by the cumulative runtime/collections work:
  supabase/migrations/20260813002000_generic_content_collections.sql

If you already applied it, normal Supabase migration history should prevent it from being re-applied. If you are starting again from the original GPTZIP database state, apply it with your normal linked migration workflow.

IMPORTANT: This patch does not delete or rewrite existing saved Studio layouts/content. Authored layout JSON in Supabase remains data, not source files.

INSTALL — RECOMMENDED
---------------------
1. Back up the current project folder.
2. Extract this ZIP.
3. Copy the extracted repository folders/files into the project root (the folder containing package.json).
4. Choose Replace/Overwrite for matching files. Do not delete unrelated files.
5. Do NOT apply any older patch ZIP from this chat afterward.
6. Ensure the deployed/local API environment uses:
     PUBLIC_WEB_RUNTIME_VERSION=1.4.0
7. If migration 02000 has not been applied:
     npx supabase db push
8. Restart API/Admin/Studio/Web dev servers.
9. Run locally with installed dependencies:
     npm run typecheck
     npm run test:static
     npm run build
     npm run test:security

VALIDATION PERFORMED ON THIS REBUILT MERGE
-------------------------------------------
- npm run test:static: 182 tests, 181 passed, 0 failed, 1 skipped
- npm run lint:source: PASS
- npm run test:security: PASS
- Fresh-baseline overlay verification is performed before delivery.

Full workspace typecheck/build cannot be truthfully claimed in the isolated rebuild copy because the uploaded GPTZIP.zip does not contain node_modules/workspace dependencies. Run those two commands in your local project after replacement.

SCOPE NOTE
----------
This consolidates the source-code patches created so far. The next Journey step (creating/binding the Journey Chapters data in your saved Studio layout) is configuration/data work we had only just started discussing; it is not silently hardcoded into this patch.
