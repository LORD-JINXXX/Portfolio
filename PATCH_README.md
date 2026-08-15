# Studio Features Cumulative Patch V5 — Ambient Palette Colors

This patch is cumulative on top of the uploaded `portzip.zip`, the Journey V3 active-scroll/count-state fixes, and Studio Features V4. It preserves all V4 functionality and only adds an opt-in color-palette enhancement to **Ambient Field**.

## New Ambient Field controls

### Random colors from palette
- New checkbox: **Random colors from palette**
- Default is **OFF**, so existing Ambient Field nodes keep their current inherited Studio text color and do not visually change after applying this patch.

### Color palette
- New field: **Color palette**
- Accepts comma- or whitespace-separated hex colors.
- Supports 3, 4, 6, or 8 digit hex colors.
- Up to 12 valid colors are used.
- Example:

```text
#dce8ff, #91afff, #7c8cff, #8b5cf6, #67e8f9
```

When Random colors is enabled, each generated Ambient Field item receives one color from the palette.

## Deterministic behavior

Color assignment is based on the existing Ambient Field `Seed`, but it uses a separate deterministic hash from position/size/motion generation. Therefore enabling or editing the palette does **not** reshuffle item positions, sizes, animation durations, or motion paths.

Changing the Seed still produces another stable overall arrangement and another stable color assignment.

## Text and icon behavior

- Text/code tags receive the selected palette color directly.
- Image icons retain their original image pixels; the assigned color is available as the element color and is used by the existing glow/drop-shadow behavior where supported.
- If Random colors is disabled, both text and icons behave exactly as they did in V4.

## Invalid palette safety

If Random colors is enabled but no valid hex color is present, Studio validation emits a warning and the runtime falls back to the safe default palette rather than failing rendering.

## Existing V4 features preserved

- Particle Field unchanged, including count up to 200
- Ambient Field Text / Icons / Mixed modes
- Ambient Field seeded placement, size range, same-size option, Float / Drift / Orbit / Spin / Pulse / Flicker / Static
- Code Stream infinite scrolling
- Page Turn animation
- Section Cover scroll behavior
- generic collection media release safety
- Journey nested-preview active-scroll tracking
- Journey repeated sticky-card arbitration
- `journey.activeIndex`
- collection-derived `journey.total` persistence
- all existing Collections, responsive controls, animation triggers, Tech Stack behavior, and `stack-over-previous`

## Files replaced

- `apps/api/src/index.ts`
- `apps/api/src/lib/generic-collections.ts`
- `apps/api/src/lib/release-media.ts`
- `apps/studio/src/Inspector.tsx`
- `apps/studio/src/elements.ts`
- `packages/animation-runtime/src/index.ts`
- `packages/builder-core/src/editor-state.ts`
- `packages/contracts/src/index.ts`
- `packages/runtime-renderer/src/index.tsx`
- `packages/validation/src/index.ts`
- `tests/source-integration.test.mjs`

No SQL migration is included or required.

## Verification performed

```text
npm run lint:source
PASS

npm run test:static
191 tests
190 passed
1 existing skip
0 failed
```

The isolated verification workspace does not contain installed workspace dependencies, so run these in your local project after replacement:

```powershell
npm run typecheck
npm run build
```

Then restart your dev processes.

## How to use after applying

Select an **Ambient Field** in Studio → **Props**:

1. Turn on **Random colors from palette**.
2. In **Color palette**, enter for example:

```text
#dce8ff, #91afff, #7c8cff, #8b5cf6, #67e8f9
```

3. Keep or change **Seed** to get a different stable distribution.
4. Save and Preview.
