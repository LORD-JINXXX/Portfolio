# Phase 5 Final Manual-Feedback Fixes

Final cleanup applied after the user completed the Phase-5 Studio/Admin manual pass.

## Fixed

- Admin CRUD forms now show field-specific placeholders/help.
- Experience dates use native date inputs.
- AI App status is a dropdown with the backend-supported values: `coming_soon`, `available`, `maintenance`, `disabled`.
- CRUD modals and Site Settings adapt to narrow viewports.
- Site Settings explicitly labels Setting Key / Value Type / Value and validates key syntax before submit.
- Settings no longer reports a false failure after an HTTP-200 save; committed saves/publishes also distinguish a later refresh failure from a mutation failure.
- Dashboard, structured CRUD, Media, Layouts, and Settings show loading states before empty states.
- Admin Media uses document/native scrolling and avoids the previous sticky/content-visibility/video-preload work that contributed to resistant scrolling.
- Public login/register button/link spacing is corrected.
- Web/Admin/Studio include an SVG favicon.
- Admin/Public reuse one Supabase browser client instance instead of repeatedly creating clients in one browser context.

## Verification in the handoff environment

- `npm run lint:source` — PASS
- `npm run test:static` — 164 total / 163 pass / 0 fail / 1 dependency-backed skip

No new Supabase migration was added for these UX fixes. The Phase-5 migration set remains `01000` through `01700` on top of the earlier migrations.
