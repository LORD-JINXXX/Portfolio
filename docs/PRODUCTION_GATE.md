# Final production gate

Patch 11 adds a browser-level regression gate using Playwright. The deterministic browser suite does not depend on current Admin content, an active release, or Supabase credentials: Public Web requests are intercepted with a fixed runtime manifest and the Admin modal suite uses a dev-only standalone HTML harness that is not part of the production Admin entry bundle.

## One-time setup

```bash
npm install
npx playwright install chromium
```

## Run the browser gate

```bash
npm run test:e2e
```

The suite covers Chromium desktop and a 390px touch/mobile viewport for the public runtime, plus browser-real Admin modal lifecycle checks.

## Full production gate

First clean generated patch artifacts that should not remain committed:

```bash
npm run repo:hygiene
npm run repo:hygiene:clean
```

Then run:

```bash
npm run test:production-gate
```

This runs repository-hygiene enforcement, source lint/static checks/typecheck, the Node/integration suite, all workspace builds, and the Playwright browser suite.

## Browser behaviors covered

- real Desktop/Mobile responsive mode resolution and live resize
- Card Deck -> Mobile normal-flow fallback and restoration
- Pin distance spacer behavior
- Horizontal flex/overflow behavior
- collection-detail slug selection
- Projects -> Project Details relationship filtering
- nested `blocks[]` Current Item Array repeat
- nested gallery managed-media resolution
- public project-card navigation preserving the exact slug
- generic reusable custom keyframes
- generic Decoration runtime behavior
- reduced-motion suppression for reusable keyframes
- cinematic Desktop choreography vs Mobile flow fallback
- Admin dirty-edit discard protection
- Admin clean close behavior
- nested modal Escape handling and body-scroll lock lifetime

## External/staging validation

`E2E_WEB_URL` can point the public-runtime suite at another Web deployment. The deterministic manifest is still route-mocked so layout/runtime behavior stays reproducible. The Admin modal suite defaults to the local `/e2e.html` development harness.
