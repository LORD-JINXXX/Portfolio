# Foundation Refactor — 2026-08-08

This implementation batch is the first code change after finalizing the Studio → Layout Library → Visual Site Content → Release workflow.

## Completed in this batch

### 1. Application theme system moved to `@platform/ui`

Admin and Studio now consume one shared application-theme implementation from:

```text
packages/ui/src/theme.tsx
```

The application theme controls only Admin/Studio chrome. It is not a portfolio/layout design theme.

Fixed:

- CSS variable naming mismatch (`surfaceAlt` vs `surface-alt`, etc.).
- Missing theme variables such as workspace/canvas values.
- Light/dark theme contrast inconsistencies.
- Theme selector options becoming invisible against the current menu background.
- Invalid fallback theme key from the previous builder-core theme implementation.
- Hard-coded Studio shell background.
- Admin surfaces/buttons that incorrectly used `--canvas` as text or background color.
- Separate persistence keys for Admin and Studio theme preferences.

### 2. Studio design surface separated from Studio chrome

Changing the Studio application theme no longer recolors the website design surface.

A neutral scoped design-surface variable set is currently used as the fallback until layout-level design tokens are introduced.

### 3. Responsive preview behavior improved

- Desktop/tablet/mobile modes now set an actual canvas width.
- Studio zoom is applied to the design canvas.
- Responsive styles now inherit correctly:

```text
desktop base
  + tablet overrides
  + mobile overrides
```

### 4. Tree editing hardening

Fixed several structural editor issues before adding the visual CMS workflow:

- before/after drag-and-drop now works for nested children instead of forcing them to root;
- a node cannot be dropped into itself or one of its descendants;
- moving within the same parent adjusts the insertion index correctly;
- duplicate recursively generates fresh IDs for every child;
- duplicate is inserted next to the original instead of always at root;
- Layers-panel delete now deletes the row that was clicked instead of whichever node happened to be selected.

## Next implementation batch

The next vertical slice should be:

1. Canonical page/document contract.
2. Persist every Studio page tree to `layout_pages`.
3. Content-slot metadata: Static vs Editable Content vs Setting vs Collection.
4. Studio publish with immutable version behavior.
5. Admin Layout Library preview using persisted page schemas.
6. `Configure Content` action that opens the selected layout in visual Site Content mode.
7. Visual click-to-edit content overlays in Admin.

Public Web activation remains separate from "currently configuring" a layout.
